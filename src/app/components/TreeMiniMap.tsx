import { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { PixelNode } from './TreeCanvas';

interface TreeMiniMapProps {
  nodes: PixelNode[];
  containerWidth: number;
  containerHeight: number;
  scrollLeft: number;
  scrollTop: number;
  zoom: number;
  onNavigate: (scrollLeft: number, scrollTop: number) => void;
  onClose: () => void;
}

const MINIMAP_W = 450;
const MINIMAP_H = 300;

export function TreeMiniMap({
  nodes,
  containerWidth,
  containerHeight,
  scrollLeft,
  scrollTop,
  zoom,
  onNavigate,
  onClose,
}: TreeMiniMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!nodes.length) return null;

  // Compute content bounding box
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + n.width));
  const maxY = Math.max(...nodes.map(n => n.y + n.height));
  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // Scale to fit the fixed minimap dimensions
  const scale = Math.min(MINIMAP_W / contentW, MINIMAP_H / contentH);
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;

  // Center the content within the minimap
  const offsetX = (MINIMAP_W - scaledW) / 2;
  const offsetY = (MINIMAP_H - scaledH) / 2;

  const toMiniX = (x: number) => (x - minX) * scale + offsetX;
  const toMiniY = (y: number) => (y - minY) * scale + offsetY;

  // Viewport rectangle in minimap coords.
  // scrollLeft/Top are in CSS-scroll pixels; PixelNode coords are in content pixels.
  // content_pos = scroll_pos / zoom  →  divide before mapping.
  const vpX = toMiniX(scrollLeft / zoom);
  const vpY = toMiniY(scrollTop / zoom);
  const vpW = Math.max(4, (containerWidth / zoom) * scale);
  const vpH = Math.max(4, (containerHeight / zoom) * scale);

  // Convert minimap click → scroll position and navigate
  const navigateTo = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    // Convert from minimap pixels → content pixels, centre the viewport
    const contentX = (mx - offsetX) / scale + minX - (containerWidth / zoom) / 2;
    const contentY = (my - offsetY) / scale + minY - (containerHeight / zoom) / 2;
    // Convert content pixels → scroll pixels
    onNavigate(Math.max(0, contentX * zoom), Math.max(0, contentY * zoom));
  }, [offsetX, offsetY, scale, minX, minY, containerWidth, containerHeight, zoom, onNavigate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    navigateTo(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => navigateTo(e.clientX, e.clientY);
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, navigateTo]);

  return (
    <div
      className="fixed bottom-6 right-6 bg-background border-2 border-primary/60 rounded-lg shadow-2xl p-2 z-50 print:hidden select-none"
      style={{ width: MINIMAP_W + 16 }}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-xs font-semibold text-muted-foreground">Übersicht</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <svg
        ref={svgRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        className="block rounded overflow-hidden cursor-crosshair"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
        onMouseDown={handleMouseDown}
      >
        {/* White canvas area */}
        <rect x={offsetX} y={offsetY} width={scaledW} height={scaledH} fill="white" stroke="#d1d5db" strokeWidth={1} />

        {/* All person boxes */}
        {nodes.map((n, i) => (
          <rect
            key={i}
            x={toMiniX(n.x)}
            y={toMiniY(n.y)}
            width={Math.max(1.5, n.width * scale)}
            height={Math.max(1.5, n.height * scale)}
            fill={n.color === 'white' ? '#f3f4f6' : n.color}
            stroke="#9ca3af"
            strokeWidth={0.5}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={vpX} y={vpY} width={vpW} height={vpH}
          fill="rgba(59,130,246,0.12)"
          stroke="rgb(59,130,246)"
          strokeWidth={1.5}
          rx={1}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
}
