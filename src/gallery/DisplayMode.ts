import { setIcon, setTooltip } from "obsidian";
import { translate, type UiLanguage } from "../i18n";
export const DISPLAY_MODES = ["masonry", "grid", "list"] as const;
export type DisplayMode = typeof DISPLAY_MODES[number];
export const validDisplayMode = (value: unknown): DisplayMode => DISPLAY_MODES.includes(value as DisplayMode) ? value as DisplayMode : "grid";
const keys = { masonry: "viewMasonry", grid: "viewGrid", list: "viewList" } as const;
export function modeDefinitions(language: UiLanguage) {
  return DISPLAY_MODES.map((mode, index) => ({ mode, icon: ["panels-top-left", "layout-grid", "list"][index]!, label: translate(language, keys[mode]) }));
}
export function renderDisplayModes(header: HTMLElement, language: UiLanguage, active: DisplayMode, change: (mode: DisplayMode, keyboard: boolean) => void): void {
  const group = header.createDiv({ cls: "visual-gallery-mode-switch" });
  group.setAttribute("role", "radiogroup"); group.setAttribute("aria-label", translate(language, "displayMode"));
  for (const definition of modeDefinitions(language)) {
    const button = group.createEl("button", { cls: "clickable-icon nav-action-button visual-gallery-mode-button" });
    button.type = "button"; button.dataset.mode = definition.mode;
    button.setAttribute("role", "radio"); button.setAttribute("aria-checked", String(active === definition.mode));
    button.setAttribute("aria-label", definition.label); button.tabIndex = active === definition.mode ? 0 : -1;
    setIcon(button, definition.icon); button.querySelector("svg")?.setAttribute("aria-hidden", "true");
    setTooltip(button, definition.label);
    button.addEventListener("click", () => change(definition.mode, false));
    button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = DISPLAY_MODES.indexOf(definition.mode);
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? 2 : 1)) % 3;
      change(DISPLAY_MODES[next]!, true);
    });
  }
}

export interface LayoutBox { x: number; y: number; width: number; height: number }
export function masonryBoxes(width: number, desired: number, gap: number, ratios: number[], fluid = false): { boxes: LayoutBox[]; height: number } {
  const columns = fluid ? 1 : Math.max(1, Math.floor((width + gap + .05) / (desired + gap)));
  const cardWidth = fluid || width < desired ? Math.max(0, width) : desired;
  const bottoms = Array<number>(columns).fill(0);
  const boxes = ratios.map(ratio => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const height = cardWidth * Math.max(.55, Math.min(2, Number.isFinite(ratio) ? ratio : 1.4));
    const box = { x: column * (cardWidth + gap), y: bottoms[column]!, width: cardWidth, height };
    bottoms[column] = box.y + height + gap; return box;
  });
  return { boxes, height: ratios.length ? Math.max(...bottoms) - gap : 0 };
}
export function nearestCard(boxes: LayoutBox[], index: number, direction: string): number {
  const origin = boxes[index]; if (!origin) return index;
  const horizontal = direction === "ArrowLeft" || direction === "ArrowRight";
  const sign = direction === "ArrowLeft" || direction === "ArrowUp" ? -1 : 1;
  const cx = origin.x + origin.width / 2, cy = origin.y + origin.height / 2;
  let best = index, score = Infinity;
  boxes.forEach((box, candidate) => {
    if (candidate === index) return;
    const dx = box.x + box.width / 2 - cx, dy = box.y + box.height / 2 - cy;
    const primary = (horizontal ? dx : dy) * sign, cross = Math.abs(horizontal ? dy : dx);
    if (primary <= .5) return;
    const next = primary + cross * 2.5;
    if (next < score) { best = candidate; score = next; }
  });
  return best;
}
