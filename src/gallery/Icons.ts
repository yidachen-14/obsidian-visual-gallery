import { setIcon } from "obsidian";

export const FOLDER_ICONS = ["legacy-folder", "folder", "folders", "archive", "box", "library", "book-open", "folder-heart", "folder-cog", "folder-tree"] as const;
export const NAVIGATION_ICONS = ["layout-grid", "gallery-horizontal", "images", "folder", "library", "book-open", "film", "clapperboard", "palette", "home"] as const;

export function validIcon(value: string | undefined, choices: readonly string[], fallback: string): string {
  return value && choices.includes(value) ? value : fallback;
}

export function centeredIconViewBox(bounds: { x: number; y: number; width: number; height: number }, width: number, height: number): string | null {
  if (width <= 0 || height <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;
  return `${bounds.x + bounds.width / 2 - width / 2} ${bounds.y + bounds.height / 2 - height / 2} ${width} ${height}`;
}

function centerSvgArtwork(element: HTMLElement, svg: SVGSVGElement, glyph: boolean): void {
  try {
    const view = svg.viewBox.baseVal;
    let bounds = svg.getBBox();
    if (glyph) {
      // Center visible glyph ink, not the font's asymmetric ascent/descent box.
      // Keep the original character and font; SVG inherits theme color live.
      const canvas = element.ownerDocument.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `650 24px ${getComputedStyle(element).fontFamily}`;
      const ink = context.measureText("⌑");
      bounds = { x: -ink.actualBoundingBoxLeft, y: -ink.actualBoundingBoxAscent,
        width: ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight,
        height: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent } as DOMRect;
    }
    const centered = centeredIconViewBox(bounds, view.width, view.height);
    if (centered) svg.setAttribute("viewBox", centered);
  } catch {
    // Detached/hidden nodes get one more measurement after the layout pass.
  }
}

export function renderGalleryIcon(element: HTMLElement, icon: string): void {
  element.replaceChildren();
  element.classList.toggle("is-legacy-folder", icon === "legacy-folder");
  const glyph = icon === "legacy-folder";
  if (glyph) {
    const svg = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "svg-icon visual-gallery-glyph-icon");
    const text = element.ownerDocument.createElementNS(svg.namespaceURI, "text");
    text.setAttribute("x", "0"); text.setAttribute("y", "0");
    text.setAttribute("font-size", "24"); text.setAttribute("font-weight", "650");
    text.setAttribute("fill", "currentColor"); text.setAttribute("stroke", "none");
    text.textContent = "⌑";
    svg.append(text); element.append(svg);
  } else {
    setIcon(element, icon);
  }
  const svg = element.querySelector("svg");
  if (svg) {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    centerSvgArtwork(element, svg, glyph);
    // Recheck connected card geometry after layout/font availability, instead
    // of accepting an early zero-size measurement for the lifetime of a card.
    const recenter = () => { if (svg.isConnected) centerSvgArtwork(element, svg, glyph); };
    element.ownerDocument.defaultView?.requestAnimationFrame(recenter);
    void element.ownerDocument.fonts.ready.then(recenter);
  }
}
