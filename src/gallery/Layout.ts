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

/** Keep all actual buttons visible before truncating the folder title. */
export function galleryToolbarSizing(available: number, count = 3, touch = false): { buttonSize: number; gap: number; width: number } {
  if (count <= 0) return { buttonSize: 28, gap: 4, width: 0 };
  const maximum = touch ? 44 : 28, minimum = touch && count <= 3 ? 32 : 18;
  const gap = available >= 42 + count * maximum + (count - 1) * 4 ? 4 : 2;
  const buttonSize = Math.floor(Math.min(maximum, Math.max(minimum, (available - 42 - (count - 1) * gap) / count)) * 64) / 64;
  return { buttonSize, gap, width: count * buttonSize + (count - 1) * gap };
}

function textWidth(element: HTMLElement | null, text = element?.textContent ?? ""): number {
  if (!element) return 0;
  const context = element.ownerDocument.adoptNode(createFragment()).createEl("canvas").getContext("2d");
  if (!context) return element.scrollWidth;
  const style = getComputedStyle(element);
  context.font = style.font;
  return context.measureText(text).width + Math.max(0, text.length - 1) * (parseFloat(style.letterSpacing) || 0);
}

/** Preferred card widths are retained until fitting one more column only needs
 * a modest compression. Content stops growing once it reaches the page cap. */
export function craftPageLayout(available: number, preferred: number, gap: number, count: number, mode: "grid" | "masonry" | "list") {
  const space = Math.max(0, Math.min(1120, available));
  if (mode === "list" || count === 0) return { width: space, cardWidth: Math.min(preferred, space), columns: 1, fluid: space < preferred };
  let columns = Math.max(1, Math.floor((space + gap) / (preferred + gap)));
  const maxColumns = Math.max(1, Math.floor((1120 + gap) / (preferred + gap)));
  if (columns < maxColumns && (space - columns * gap) / (columns + 1) >= preferred * .8) columns++;
  columns = Math.max(1, Math.min(columns, count));
  const cardWidth = Math.max(0, Math.min(preferred, (space - (columns - 1) * gap) / columns));
  return { width: columns * cardWidth + (columns - 1) * gap, cardWidth, columns, fluid: columns === 1 && cardWidth < preferred };
}

export function syncGalleryLayout(shell: HTMLElement, layout: HTMLElement, grid: HTMLElement, count: number, cardWidth: number, mode: "grid" | "masonry" | "list" = "grid"): void {
  const style = getComputedStyle(shell);
  const shellWidth = parseFloat(style.width) - (style.boxSizing === "border-box"
    ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) : 0);
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
  const craft = !!shell.closest(".is-craft");
  const available = craft ? Math.min(1120, shellWidth) : shellWidth;
  const preferred = craftPageLayout(available, cardWidth, gap, count, mode);
  const result = craft ? preferred : galleryRowLayout(available, cardWidth, gap, count, shell.ownerDocument.defaultView!.matchMedia("(max-width: 720px)").matches);
  if (craft) {
    grid.style.setProperty("--vg-effective-card-width", preferred.cardWidth + "px");
    grid.style.setProperty("--vg-columns", String(preferred.columns));
  }
  const header = layout.querySelector<HTMLElement>(".visual-gallery-header");
  const controls = layout.querySelector<HTMLElement>(".visual-gallery-controls");
  const switcher = layout.querySelector<HTMLElement>(".visual-gallery-mode-switch");
  const actionCount = controls?.querySelectorAll(".visual-gallery-toolbar-button").length ?? 0;
  const modeCount = switcher?.querySelectorAll(".visual-gallery-mode-button").length ?? 0;
  const toolbar = galleryToolbarSizing(available - (modeCount ? 12 : 0), actionCount + modeCount, !!shell.closest(".visual-gallery-mobile"));
  const groupWidth = (count: number) => count * toolbar.buttonSize + Math.max(0, count - 1) * toolbar.gap;
  if (switcher) switcher.style.width = groupWidth(modeCount) + 4 + "px";
  const controlsWidth = groupWidth(actionCount);
  layout.style.setProperty("--vg-toolbar-button-size", toolbar.buttonSize + "px");
  layout.style.setProperty("--vg-toolbar-gap", toolbar.gap + "px");
  if (controls) controls.style.width = controlsWidth + "px";
  const headerGap = header ? parseFloat(getComputedStyle(header).columnGap) || 0 : 0;
  controls?.classList.toggle("is-overflowing", toolbar.width > Math.max(0, available - 26 - headerGap));
  const occupiedWidth = mode === "list" ? available : result.width;
  const headerWidth = galleryHeaderWidth(available, occupiedWidth, textWidth(layout.querySelector("h2")),
    toolbar.width + (modeCount ? 12 + headerGap : 0), headerGap);
  const width = headerWidth + "px";
  if (layout.style.width !== width) layout.style.width = width;
  grid.style.width = occupiedWidth + "px";
  layout.classList.toggle("is-header-expanded", headerWidth > result.width + .1);
  layout.classList.toggle("is-fluid", result.fluid);
}
