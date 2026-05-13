import { useRef, useState, useEffect, useCallback } from 'react';
import { PixelNode } from './TreeCanvas';

/**
 * Height of the fixed bottom minimap bar in pixels.
 * Imported by ViewEditor to add an equal paddingBottom to the scroll container.
 */
export const MINIMAP_HEIGHT = 88;

/** Left/right padding inside TreeCanvas's `<div className="p-8">` wrapper. */
const CANVAS_PAD = 32;

interface TreeMiniMapProps {
  nodes: PixelNode[];
  treeWidth: number;
  treeHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  zoom: number;
  onNavigate: (scrollLeft: number, scrollTop: number) => void;
}

export function TreeMiniMap({
  nodes,
  treeWidth,
  treeHeight,
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
  zoom,
  onNavigate,
}: TreeMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [mmWidth, setMmWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startClientX: 0, startScrollLeft: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setMmWidth(Math.max(1, entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!nodes.length || treeWidth <= 0 || treeHeight <= 0) return null;

  const totalW = treeWidth  + 2 * CANVAS_PAD;
  const totalH = treeHeight + 2 * CANVAS_PAD;

  // Uniform scale: fit to height first, but never exceed available width.
  // This preserves aspect ratio and avoids horizontal stretching for narrow trees.
  const scaleByHeight = MINIMAP_HEIGHT / totalH;
  const scaleByWidth  = mmWidth        / totalW;
  const scale  = Math.min(scaleByHeight, scaleByWidth);

  // The SVG is only as wide as the actual content – CSS flex centers it.
  const svgWidth = Math.max(1, Math.round(totalW * scale));

  const nX = (x: number) => (x + CANVAS_PAD) * scale;
  const nY = (y: number) => (y + CANVAS_PAD) * scale;

  const vpX = Math.max(0, scrollLeft / zoom * scale);
  const vpY = Math.max(0, scrollTop  / zoom * scale);
  const vpW = Math.min(Math.max(6, viewportWidth  / zoom * scale), svgWidth);
  const vpH = Math.min(Math.max(6, viewportHeight / zoom * scale), MINIMAP_HEIGHT);

  // Navigation: use the SVG element's own bounding rect so we always work in
  // SVG-local coordinates regardless of where the SVG sits in the container.
  const navigateToMinimapX = useCallback(
    (clientX: number): number => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return scrollLeft;
      const mx    = Math.max(0, Math.min(clientX - rect.left, svgWidth));
      const newSL = Math.max(0, ((mx / svgWidth) * totalW - viewportWidth / zoom / 2) * zoom);
      onNavigate(newSL, scrollTop);
      return newSL;
    },
    [svgWidth, totalW, viewportWidth, zoom, scrollTop, scrollLeft, onNavigate],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const onIndicator = mx >= vpX && mx <= vpX + vpW;
      if (onIndicator) {
        dragRef.current = { startClientX: e.clientX, startScrollLeft: scrollLeft };
      } else {
        const newSL = navigateToMinimapX(e.clientX);
        dragRef.current = { startClientX: e.clientX, startScrollLeft: newSL };
      }
      setIsDragging(true);
    },
    [vpX, vpW, scrollLeft, navigateToMinimapX],
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const deltaScroll = ((e.clientX - dragRef.current.startClientX) / svgWidth) * totalW * zoom;
      onNavigate(Math.max(0, dragRef.current.startScrollLeft + deltaScroll), scrollTop);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, svgWidth, totalW, zoom, scrollTop, onNavigate]);

  return (
    <div
      ref={containerRef}
      className="shrink-0 print:hidden select-none border-t border-border"
      style={{
        height:          MINIMAP_HEIGHT,
        background:      'hsl(var(--background))',
        cursor:          isDragging ? 'grabbing' : 'crosshair',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
    >
      <svg
        ref={svgRef}
        width={svgWidth}
        height={MINIMAP_HEIGHT}
        style={{ display: 'block', flexShrink: 0 }}
        onMouseDown={handleMouseDown}
      >
        {/* Background */}
        <rect width={svgWidth} height={MINIMAP_HEIGHT} fill="hsl(var(--muted) / 0.15)" />
        {/* White canvas area */}
        <rect
          x={CANVAS_PAD * scale} y={CANVAS_PAD * scale}
          width={treeWidth * scale} height={treeHeight * scale}
          fill="white" stroke="#d1d5db" strokeWidth={0.5}
        />
        {/* Person boxes */}
        {nodes.map((n, i) => (
          <rect
            key={i}
            x={nX(n.x)} y={nY(n.y)}
            width={Math.max(1, n.width * scale)} height={Math.max(1, n.height * scale)}
            fill={n.color === 'white' ? '#e5e7eb' : n.color}
            stroke="none"
          />
        ))}
        {/* Full-height viewport band */}
        <rect x={vpX} y={0} width={vpW} height={MINIMAP_HEIGHT} fill="rgba(59,130,246,0.07)" style={{ pointerEvents: 'none' }} />
        {/* Viewport left edge */}
        <line x1={vpX} y1={0} x2={vpX} y2={MINIMAP_HEIGHT} stroke="rgb(59,130,246)" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        {/* Viewport right edge */}
        <line x1={vpX + vpW} y1={0} x2={vpX + vpW} y2={MINIMAP_HEIGHT} stroke="rgb(59,130,246)" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        {/* Inner 2-D viewport box */}
        <rect x={vpX} y={vpY} width={vpW} height={vpH} fill="rgba(59,130,246,0.14)" stroke="rgba(59,130,246,0.55)" strokeWidth={1} rx={1} style={{ pointerEvents: 'none' }} />
      </svg>
    </div>
  );
}
