import { useState, useCallback, useRef, useEffect } from 'react';
import { FamilyTree, SavedView, GraphType, defaultLayoutSettings, Person } from '../types';
import { PersonSearch } from './PersonSearch';
import { LayoutSettings } from './LayoutSettings';
import { TreeCanvas, PixelNode, LegendEntry } from './TreeCanvas';
import { TreeMiniMap } from './TreeMiniMap';
import { PersonEditDialog } from './PersonEditDialog';
import { ChevronLeft, Printer, Save, ZoomIn, ZoomOut, Map } from 'lucide-react';

interface ViewEditorProps {
  tree: FamilyTree;
  view: SavedView | null;
  onSave: (view: SavedView) => void;
  onBack: () => void;
  onPersonEdit: (person: Person) => void;
}

export function ViewEditor({ tree, view, onSave, onBack, onPersonEdit }: ViewEditorProps) {
  const [name, setName] = useState(view?.name || 'New View');
  const [rootPersonId, setRootPersonId] = useState(view?.rootPersonId || (tree.people[0]?.id || ''));
  const [graphType, setGraphType] = useState<GraphType>(view?.graphType || 'ancestor');
  const [layout, setLayout] = useState({
    ...defaultLayoutSettings,
    ...(view?.layout || {}),
    maxGenerations: view?.layout?.maxGenerations ?? defaultLayoutSettings.maxGenerations,
    showMarriageInfo: view?.layout?.showMarriageInfo ?? defaultLayoutSettings.showMarriageInfo,
    dateFormat: view?.layout?.dateFormat ?? defaultLayoutSettings.dateFormat,
    lineStyle: view?.layout?.lineStyle ?? defaultLayoutSettings.lineStyle,
    lineWidth: view?.layout?.lineWidth ?? defaultLayoutSettings.lineWidth,
  });
  const [showSettings, setShowSettings] = useState(true);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canvasStats, setCanvasStats] = useState<{ widthPx: number; heightPx: number; lineLengthPx: number } | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<PixelNode[]>([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([]);
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  // Viewport dimensions of the scroll container (kept in state so the minimap
  // receives accurate values even after the settings panel is toggled or the
  // browser window is resized).
  const [viewportDims, setViewportDims] = useState({ width: 0, height: 0, left: 0 });
  const statsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Stores the world-space anchor point set by a wheel zoom, consumed by a
   *  useEffect after the new zoom is rendered so the point under the cursor
   *  stays fixed. */
  const pendingZoomScrollRef = useRef<{ worldX: number; worldY: number; cursorX: number; cursorY: number } | null>(null);

  // Drag-to-pan state
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !scrollRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDraggedRef.current = true;
      scrollRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
      scrollRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
    };
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDraggingState(false);
      // Reset hasDragged after a tick so SVG click handlers can check first
      setTimeout(() => { hasDraggedRef.current = false; }, 0);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    setIsDraggingState(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
   };
   e.preventDefault();
  };

  // Track scroll position for minimap
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      setScrollPos({ left: scrollContainer.scrollLeft, top: scrollContainer.scrollTop });
    };

    // Non-passive wheel listener so we can preventDefault and zoom instead of scroll
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      // Record the cursor's world-space position so we can keep it fixed after zoom
      const rect = scrollContainer.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setZoom(z => {
        const newZoom = Math.min(Math.max(+(z + delta).toFixed(2), 0.1), 3);
        const worldX = (scrollContainer.scrollLeft + cursorX) / z;
        const worldY = (scrollContainer.scrollTop + cursorY) / z;
        pendingZoomScrollRef.current = { worldX, worldY, cursorX, cursorY };
        return newZoom;
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    scrollContainer.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      scrollContainer.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Track scroll-container viewport dimensions so the minimap indicator is accurate
  // even when the settings panel is toggled or the browser window is resized.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setViewportDims({
        width:  entry.contentRect.width,
        height: entry.contentRect.height,
        // Distance from the left viewport edge to the start of the canvas pane.
        // Used to keep the minimap from overlapping the settings sidebar.
        left: el.getBoundingClientRect().left,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleMiniMapNavigate = (scrollLeft: number, scrollTop: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft;
      scrollRef.current.scrollTop = scrollTop;
    }
  };

  // After a wheel-zoom re-render, adjust scroll so the point under the cursor
  // stays at the same screen position (cursor-anchored zooming).
  useEffect(() => {
    const pending = pendingZoomScrollRef.current;
    if (pending && scrollRef.current) {
      scrollRef.current.scrollLeft = pending.worldX * zoom - pending.cursorX;
      scrollRef.current.scrollTop  = pending.worldY * zoom - pending.cursorY;
      pendingZoomScrollRef.current = null;
    }
  }, [zoom]);

  // Break the infinite render loop: only update state when values actually change.
  // TreeCanvas fires these callbacks on every render via microtasks.
  // Using the functional setState form lets React bail out (return prev reference)
  // when the data is identical, which stops the re-render cycle.
  const handleStatsChange = useCallback((widthPx: number, heightPx: number, totalLineLengthPx: number) => {
    if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current);
    statsTimeoutRef.current = setTimeout(() => {
      setCanvasStats(prev => {
        if (
          prev &&
          prev.widthPx === widthPx &&
          prev.heightPx === heightPx &&
          prev.lineLengthPx === totalLineLengthPx
        ) return prev; // same values – bail out, no re-render
        return { widthPx, heightPx, lineLengthPx: totalLineLengthPx };
      });
    }, 50);
  }, []);

  const handleNodesLayout = useCallback((nodes: PixelNode[]) => {
    setLayoutNodes(prev => {
      // Bail out if node count and boundary positions are unchanged
      if (
        prev.length === nodes.length &&
        nodes.length > 0 &&
        prev[0]?.x === nodes[0].x &&
        prev[0]?.y === nodes[0].y &&
        prev[prev.length - 1]?.x === nodes[nodes.length - 1].x &&
        prev[prev.length - 1]?.y === nodes[nodes.length - 1].y
      ) return prev; // no re-render
      return nodes;
    });
  }, []);

  const handleLegendData = useCallback((entries: LegendEntry[]) => {
    setLegendEntries(prev => {
      if (
        prev.length === entries.length &&
        prev.every((e, i) => e.label === entries[i].label && e.color === entries[i].color)
      ) return prev; // identical – bail out, no re-render
      return entries;
    });
  }, []);

  const handleCoupleSwap = useCallback((key: string) => {
    setLayout(prev => {
      const current = prev.swappedCouples || [];
      const next = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
      return { ...prev, swappedCouples: next };
    });
  }, []);

  const handleSave = () => {
    const savedView: SavedView = {
      id: view?.id || Date.now().toString(),
      name,
      rootPersonId,
      graphType,
      layout,
      createdAt: view?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(savedView);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePersonClick = (person: Person) => {
    if (hasDraggedRef.current) return; // Ignore clicks that were actually drags
    setEditingPerson(person);
    setDialogOpen(true);
  };

  const handlePersonSave = (person: Person) => {
    onPersonEdit(person);
    setDialogOpen(false);
    setEditingPerson(null);
  };

  const handleZoomIn  = () => setZoom(z => Math.min(+(z + 0.1).toFixed(2), 3));
  const handleZoomOut = () => setZoom(z => Math.max(+(z - 0.1).toFixed(2), 0.1));
  const handleZoomReset = () => setZoom(1);

  const rootPerson = tree.people.find(p => p.id === rootPersonId);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border print:hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-0 px-0"
              placeholder="View name"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 border border-border rounded-md px-1">
              <button onClick={handleZoomOut} className="p-1.5 hover:bg-accent rounded" title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={handleZoomReset} className="px-2 py-1 text-xs hover:bg-accent rounded min-w-[46px] text-center" title="Reset zoom">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={handleZoomIn} className="p-1.5 hover:bg-accent rounded" title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Minimap button – make it more visible */}
            <button
              onClick={() => setShowMiniMap(!showMiniMap)}
              className={`px-4 py-2 text-sm flex items-center gap-2 rounded-md font-medium transition-all ${
                showMiniMap
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'border border-border hover:bg-accent hover:border-primary'
              }`}
              title="Klick um Übersichtskarte anzeigen/verbergen"
            >
              <Map className="w-4 h-4" />
              Karte {showMiniMap ? 'An' : 'Aus'}
            </button>

            {/* Canvas stats – always visible in header */}
             {canvasStats && (
               <div className="flex gap-3 items-center text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 select-none">
                 <span title="Canvas area">📐 {canvasStats.widthPx} × {canvasStats.heightPx} px</span>
                 <span className="border-l border-border pl-3" title="Total length of all connection lines">〰 {canvasStats.lineLengthPx.toLocaleString()} px</span>
               </div>
             )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
            >
              {showSettings ? 'Hide' : 'Show'} Settings
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
            >
              <Save className="w-4 h-4" />
              Save View
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Settings Panel */}
        {showSettings && (
          <div className="w-80 border-r border-border overflow-y-auto p-6 print:hidden">
            <div className="space-y-6">
              <div>
                <label className="block mb-2">Graph Type</label>
                <select
                  value={graphType}
                  onChange={(e) => setGraphType(e.target.value as GraphType)}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md"
                >
                  <option value="ancestor">Ancestor Tree</option>
                  <option value="descendant">Descendant Tree</option>
                  <option value="hourglass">Hourglass (Both)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {graphType === 'ancestor' && 'Shows ancestors going upward'}
                  {graphType === 'descendant' && 'Shows descendants going downward'}
                  {graphType === 'hourglass' && 'Shows both ancestors and descendants'}
                </p>
              </div>

              <PersonSearch
                people={tree.people}
                selectedPersonId={rootPersonId}
                onSelectPerson={setRootPersonId}
              />

              {rootPerson && (
                <div className="p-3 bg-accent rounded-md">
                  <div className="text-sm font-medium">
                    {rootPerson.firstName} {rootPerson.lastName}
                  </div>
                  {rootPerson.birthDate && (
                    <div className="text-xs text-muted-foreground">
                      * {rootPerson.birthDate}
                      {rootPerson.birthPlace && `, ${rootPerson.birthPlace}`}
                    </div>
                  )}
                  {rootPerson.deathDate && (
                    <div className="text-xs text-muted-foreground">
                      † {rootPerson.deathDate}
                      {rootPerson.deathPlace && `, ${rootPerson.deathPlace}`}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-4">
                <h3 className="mb-4">Layout Settings</h3>
                <LayoutSettings layout={layout} onUpdate={setLayout} />
              </div>
            </div>
          </div>
        )}

        {/* Canvas Area: flex column — scroll pane on top, minimap bar on bottom */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div
            ref={scrollRef}
            className={`flex-1 overflow-auto bg-muted/20 relative${showMiniMap ? ' mmbar-scroll-hide' : ''}`}
            onMouseDown={handleCanvasMouseDown}
            style={{ cursor: isDraggingState ? 'grabbing' : 'grab', userSelect: 'none' }}
          >
            {rootPersonId ? (
              /* Sizer div: tells the scroll container exactly how much space the
                 zoomed canvas occupies so there is no phantom whitespace.
                 canvasStats.widthPx / heightPx is the SVG size; +64 accounts for
                 the p-8 (32 px each side) padding inside TreeCanvas. */
              <div
                style={{
                  width:     canvasStats ? `${Math.ceil((canvasStats.widthPx  + 64) * zoom)}px` : '100%',
                  minWidth:  '100%',
                  height:    canvasStats ? `${Math.ceil((canvasStats.heightPx + 64) * zoom)}px` : undefined,
                  minHeight: '100%',
                }}
              >
                <div
                  style={{
                    transform:       `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <TreeCanvas
                    people={tree.people}
                    rootPersonId={rootPersonId}
                    graphType={graphType}
                    layout={layout}
                    onPersonClick={handlePersonClick}
                    onCoupleSwap={handleCoupleSwap}
                    onStatsChange={handleStatsChange}
                    onNodesLayout={handleNodesLayout}
                    onLegendData={handleLegendData}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="mb-2">No root person selected</p>
                  <p className="text-sm">Search for a person to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend overlay – shown when showLegend is enabled */}
          {layout.showLegend && legendEntries.length > 0 && layout.colorScheme !== 'uniform' && (
            <div className="absolute top-3 right-3 bg-background/95 border border-border rounded-lg shadow-md p-3 print:block pointer-events-none select-none z-10 max-w-[220px]">
              <div className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                {layout.colorScheme === 'by-parish' && 'Parish'}
                {layout.colorScheme === 'by-grandparent' && 'Grandparent'}
                {layout.colorScheme === 'by-great-grandparent' && 'Great-Grandparent'}
              </div>
              <ul className="space-y-1">
                {legendEntries.map((entry) => (
                  <li key={entry.label} className="flex items-center gap-2">
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-black/10"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-foreground leading-tight">{entry.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Minimap sits below the scroll pane inside the canvas column —
              it naturally occupies only the canvas pane width and never
              overlaps the settings sidebar. */}
          {showMiniMap && layoutNodes.length > 0 && canvasStats && (
            <TreeMiniMap
              nodes={layoutNodes}
              treeWidth={canvasStats.widthPx}
              treeHeight={canvasStats.heightPx}
              viewportWidth={viewportDims.width  || (scrollRef.current?.clientWidth  ?? 800)}
              viewportHeight={viewportDims.height || (scrollRef.current?.clientHeight ?? 600)}
              scrollLeft={scrollPos.left}
              scrollTop={scrollPos.top}
              zoom={zoom}
              onNavigate={handleMiniMapNavigate}
            />
          )}
        </div>
      </div>

      <PersonEditDialog
        person={editingPerson}
        people={tree.people}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingPerson(null);
        }}
        onSave={handlePersonSave}
      />
    </div>
  );
}