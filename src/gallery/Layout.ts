/** Occupied columns, not unused auto-fill tracks, define the header edge. */
export function galleryRowLayout(available: number, cardWidth: number, gap: number, count: number, compact = false): { width: number; fluid: boolean } {
  const space = Math.max(0, available);
  const fluid = compact || space < cardWidth;
  if (fluid || count === 0) return { width: space, fluid };
  const columns = Math.max(1, Math.min(count, Math.floor((space + gap) / (cardWidth + gap))));
  return { width: columns * cardWidth + (columns - 1) * gap, fluid };
}

/** Keep the title and controls on one row, even with only one occupied card. */
export function galleryHeaderWidth(available: number, rowWidth: number, titleWidth: number, controlsWidth: number, gap: number): number {
  return Math.min(Math.max(0, available), Math.max(rowWidth, Math.min(titleWidth, 320) + controlsWidth + gap));
}

function textWidth(element: HTMLElement | null): number {
  if (!element) return 0;
  const context = element.ownerDocument.createElement("canvas").getContext("2d");
  if (!context) return element.scrollWidth;
  const style = getComputedStyle(element);
  context.font = style.font;
  return context.measureText(element.textContent ?? "").width;
}

export function syncGalleryLayout(shell: HTMLElement, layout: HTMLElement, grid: HTMLElement, count: number, cardWidth: number): void {
  const style = getComputedStyle(shell);
  const available = parseFloat(style.width) - (style.boxSizing === "border-box"
    ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) : 0);
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
  const result = galleryRowLayout(available, cardWidth, gap, count, shell.ownerDocument.defaultView!.matchMedia("(max-width: 720px)").matches);
  const header = layout.querySelector<HTMLElement>(".visual-gallery-header");
  const filter = layout.querySelector<HTMLElement>(".visual-gallery-select");
  const sort = layout.querySelector<HTMLElement>(".visual-gallery-sort");
  const controls = layout.querySelector<HTMLElement>(".visual-gallery-controls");
  const filterStyle = filter ? getComputedStyle(filter) : null;
  const sortStyle = sort ? getComputedStyle(sort) : null;
  // Measure untruncated text, not the controls' previously constrained boxes.
  // Otherwise resize/locale changes can oscillate between wrapped layouts.
  const filterWidth = textWidth(filter?.querySelector<HTMLOptionElement>("option:checked") ?? null)
    + (parseFloat(filterStyle?.paddingLeft ?? "0") || 0) + (parseFloat(filterStyle?.paddingRight ?? "0") || 0);
  const sortWidth = textWidth(sort?.querySelector<HTMLElement>(".visual-gallery-sort-label") ?? null)
    + (parseFloat(sortStyle?.paddingLeft ?? "0") || 0) + (parseFloat(sortStyle?.paddingRight ?? "0") || 0) + 22;
  const headerWidth = galleryHeaderWidth(available, result.width, textWidth(layout.querySelector("h2")),
    filterWidth + sortWidth + (controls ? parseFloat(getComputedStyle(controls).gap) || 0 : 0), header ? parseFloat(getComputedStyle(header).columnGap) || 0 : 0);
  const width = headerWidth + "px";
  if (layout.style.width !== width) layout.style.width = width;
  grid.style.width = result.width + "px";
  layout.classList.toggle("is-header-expanded", headerWidth > result.width + .1);
  layout.classList.toggle("is-fluid", result.fluid);
}
