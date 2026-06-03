import { useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';


export interface UseTreeExportReturn {
  /** True while an export is being generated. */
  isExporting: boolean;
  /** Non-null when the last export attempt failed. Cleared on the next attempt. */
  exportError: string | null;
  /**
   * Download the full tree as a high-resolution PNG.
   * @param pixelRatio – Multiplier applied to the SVG's native pixel dimensions.
   *   Be aware of the browser canvas limit (~16 384 px per dimension in Safari,
   *   ~32 767 px in Chrome/Firefox).
   */
  exportAsPng: (filename?: string, pixelRatio?: number) => Promise<void>;
  /**
   * Download the full tree as a **vector** PDF via svg2pdf.js – no rasterisation,
   * no canvas-size limit, infinite resolution.
   */
  exportAsPdf: (filename?: string) => Promise<void>;
  /** Download the raw SVG markup – perfect vector quality, ideal for large-format printing. */
  exportAsSvg: (filename?: string) => Promise<void>;
}

export function useTreeExport(
  svgRef: React.RefObject<SVGSVGElement | null>,
): UseTreeExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── PNG ───────────────────────────────────────────────────────────────────

  const exportAsPng = useCallback(
    async (filename = 'family-tree.png', pixelRatio = 2) => {
      setIsExporting(true);
      setExportError(null);

      const svg = svgRef.current;
      if (!svg) { handleError(new Error('SVG element is not mounted.'), setExportError, 'PNG'); setIsExporting(false); return; }
      const svgWidth  = svg.width.baseVal.value  || svg.clientWidth;
      const svgHeight = svg.height.baseVal.value || svg.clientHeight;
      if (svgWidth === 0 || svgHeight === 0) { handleError(new Error('SVG has zero dimensions.'), setExportError, 'PNG'); setIsExporting(false); return; }

      try {
        // html-to-image TS types declare HTMLElement; SVGSVGElement works at runtime.
        const dataUrl = await toPng(svg as unknown as HTMLElement, {
          pixelRatio,
          width:  svgWidth,
          height: svgHeight,
          style: { transform: 'none', margin: '0', maxWidth: 'none' },
          skipFonts: false,
          backgroundColor: '#ffffff',
        });
        triggerDownload(dataUrl, filename);
      } catch (err) {
        handleError(err, setExportError, 'PNG');
      } finally {
        setIsExporting(false);
      }
    },
    [svgRef],
  );

  // ── PDF (vector via svg2pdf.js) ───────────────────────────────────────────

  const exportAsPdf = useCallback(
    async (filename = 'family-tree.pdf') => {
      setIsExporting(true);
      setExportError(null);

      const svg = svgRef.current;
      if (!svg) { handleError(new Error('SVG element is not mounted.'), setExportError, 'PDF'); setIsExporting(false); return; }
      const svgWidth  = svg.width.baseVal.value  || svg.clientWidth;
      const svgHeight = svg.height.baseVal.value || svg.clientHeight;
      if (svgWidth === 0 || svgHeight === 0) { handleError(new Error('SVG has zero dimensions.'), setExportError, 'PDF'); setIsExporting(false); return; }

      try {
        // Use the actual rendered bounding box so strokes at the edges
        // (which extend strokeWidth/2 beyond the node boundary) are not clipped.
        // Fall back to the declared SVG dimensions if getBBox() is unavailable.
        let contentW = svgWidth;
        let contentH = svgHeight;
        try {
          const bbox = svg.getBBox();
          // Add 4 px safety margin for stroke overhangs
          const pad = 4;
          contentW = Math.max(svgWidth,  bbox.x + bbox.width  + pad);
          contentH = Math.max(svgHeight, bbox.y + bbox.height + pad);
        } catch { /* SVG not visible / detached – use declared size */ }

        // 1 CSS px = 0.75 pt (at 96 dpi)
        const PX_TO_PT  = 0.75;
        const pdfWidth  = contentW * PX_TO_PT;
        const pdfHeight = contentH * PX_TO_PT;

        const pdf = new jsPDF({
          orientation: pdfWidth >= pdfHeight ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [pdfWidth, pdfHeight],
          compress: true,
        });

        // Pre-process the SVG clone to fix svg2pdf.js limitations before rendering.
        const cleanSvg = prepareSvgForPdf(svg, contentW, contentH);
        await svg2pdf(cleanSvg, pdf, { x: 0, y: 0, width: pdfWidth, height: pdfHeight });
        pdf.save(filename);
      } catch (err) {
        handleError(err, setExportError, 'PDF');
      } finally {
        setIsExporting(false);
      }
    },
    [svgRef],
  );

  // ── SVG ───────────────────────────────────────────────────────────────────

  const exportAsSvg = useCallback(
    async (filename = 'family-tree.svg') => {
      setIsExporting(true);
      setExportError(null);

      const svg = svgRef.current;
      if (!svg) {
        setExportError('SVG element is not mounted – cannot export.');
        setIsExporting(false);
        return;
      }

      try {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        const svgString = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        triggerDownload(url, filename);
        URL.revokeObjectURL(url);
      } catch (err) {
        handleError(err, setExportError, 'SVG');
      } finally {
        setIsExporting(false);
      }
    },
    [svgRef],
  );

  return { isExporting, exportError, exportAsPng, exportAsPdf, exportAsSvg };
}

// ── SVG pre-processing for svg2pdf.js ────────────────────────────────────────

/**
 * Characters outside the WinAnsiEncoding of standard PDF fonts (Helvetica/Times)
 * produce garbage glyphs in svg2pdf.js.  Mapping to plain ASCII fallbacks.
 *
 * Why each glyph breaks:
 *   ⚭ U+26AD – "MARRIAGE SYMBOL"  → not in any standard PDF font → replace with "oo"
 *   ♂ U+2642 – "MALE SIGN"        → not in Helvetica WinAnsi    → replace with "M"
 *   ♀ U+2640 – "FEMALE SIGN"      → not in Helvetica WinAnsi    → replace with "F"
 *   ⇄ U+21C4 – "LEFT RIGHT ARROW" → UI swap button, removed below
 */
const PDF_GLYPH_MAP: [string, string][] = [
  ['\u26AD', 'oo'],  // ⚭ marriage
  ['\u2642',  'M'],  // ♂ male
  ['\u2640',  'F'],  // ♀ female
  ['\u21C4', '<>'],  // ⇄ swap arrow (UI element – also removed below)
];

/**
 * Returns a deep clone of `svg` with all known svg2pdf.js rendering issues fixed:
 *
 * 1. **`viewBox`** added  – without it svg2pdf.js may clip the bottom / right edge.
 * 2. **Unicode glyphs** replaced  – prevents "&@" / "&B" / "&-" garbage text.
 * 3. **Swap-button UI elements** removed  – they are interactive controls that
 *    serve no purpose in a static PDF and contain the `⇄` character.
 * 4. **`userSelect` styles** stripped  – cosmetic, not valid in PDF context.
 * 5. **XML namespaces** set  – required by the SVG spec for standalone files.
 *
 * The live DOM is never mutated.
 */
function prepareSvgForPdf(svg: SVGSVGElement, svgWidth: number, svgHeight: number): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // 1. viewBox – covers actual content bounds (passed in after getBBox() correction).
  //    Also update the width/height attributes to match so svg2pdf.js scales correctly.
  clone.setAttribute('viewBox',  `0 0 ${svgWidth} ${svgHeight}`);
  clone.setAttribute('width',    String(svgWidth));
  clone.setAttribute('height',   String(svgHeight));
  clone.setAttribute('xmlns',       'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // 2. Walk every text node and replace unsupported Unicode characters
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const patches: [Text, string][] = [];
  let n = walker.nextNode();
  while (n) {
    const orig = (n as Text).textContent ?? '';
    let updated = orig;
    for (const [from, to] of PDF_GLYPH_MAP) {
      if (updated.includes(from)) updated = updated.split(from).join(to);
    }
    if (updated !== orig) patches.push([n as Text, updated]);
    n = walker.nextNode();
  }
  for (const [node, text] of patches) node.textContent = text;

  // 3. Fix font-weight: svg2pdf.js only supports "normal" and "bold".
  //    React renders fontWeight="500" as font-weight="500" in the SVG DOM;
  //    svg2pdf.js silently falls back to normal, so last names appear unbolded.
  clone.querySelectorAll<SVGElement>('[font-weight="500"]').forEach(el => {
    el.setAttribute('font-weight', 'bold');
  });
  // Also catch any inline style declarations for font-weight
  clone.querySelectorAll<SVGElement>('[style]').forEach(el => {
    const style = el.getAttribute('style') ?? '';
    if (style.includes('font-weight')) {
      el.setAttribute('style', style.replace(/font-weight\s*:\s*500/g, 'font-weight: bold'));
    }
  });

  // 4. Remove interactive UI elements (swap buttons contain a <title> child).
  clone.querySelectorAll('title').forEach(title => {
    const g = title.closest('g');
    if (g) g.remove();
  });

  // 5. Strip userSelect (not valid in PDF context)
  clone.querySelectorAll<SVGElement>('[style]').forEach(el => {
    const cleaned = (el.getAttribute('style') ?? '')
      .replace(/user-select\s*:[^;]+;?/g, '')
      .trim();
    if (cleaned) el.setAttribute('style', cleaned);
    else el.removeAttribute('style');
  });

  return clone;
}

// ── shared helpers ────────────────────────────────────────────────────────────

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  link.click();
}

function handleError(err: unknown, setError: (msg: string) => void, format: string) {
  const msg = err instanceof Error ? err.message : String(err);
  setError(msg);
  console.error(`[useTreeExport] ${format} export failed:`, err);
}
