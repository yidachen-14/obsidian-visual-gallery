import { setIcon, setTooltip } from "obsidian";
import type { GallerySort } from "../browser/VaultBrowser";
import { sortLabel, translate, type UiLanguage } from "../i18n";

export const LIST_COLUMNS = ["name", "viewed", "modified", "created"] as const;
export type ListColumn = typeof LIST_COLUMNS[number];
const sorts: Record<ListColumn, readonly [GallerySort, GallerySort]> = {
  name: ["name", "name-desc"], viewed: ["viewed-asc", "viewed"],
  modified: ["modified-asc", "modified"], created: ["created-asc", "created"],
};
export function columnSort(column: ListColumn, current: GallerySort) {
  const [ascending, descending] = sorts[column];
  const active = current === ascending || current === descending;
  return { active, direction: current === ascending ? "ascending" : "descending",
    next: active ? current === ascending ? descending : ascending : column === "name" ? ascending : descending } as const;
}

export function renderListHeader(parent: HTMLElement, language: UiLanguage, current: GallerySort,
  metadata: boolean, choose: (sort: GallerySort, column: ListColumn) => void): void {
  const header = parent.createDiv({ cls: "visual-gallery-list-header" });
  header.setAttribute("role", "group"); header.setAttribute("aria-label", translate(language, "sortAria"));
  const labels = { name: "fileName", viewed: "lastViewed", modified: "dateModified", created: "dateCreated" } as const;
  for (const column of metadata ? LIST_COLUMNS : ["name"] as const) {
    const state = columnSort(column, current), label = translate(language, labels[column]);
    const button = header.createEl("button", { cls: "visual-gallery-column-button" });
    button.type = "button"; button.dataset.column = column;
    button.setAttribute("aria-pressed", String(state.active));
    button.setAttribute("aria-label", state.active ? `${label}: ${sortLabel(language, current)}` : `${translate(language, "sortAria")}: ${label}`);
    button.createSpan({ text: label });
    if (state.active) {
      button.dataset.direction = state.direction;
      const icon = button.createSpan({ cls: "visual-gallery-sort-direction" });
      setIcon(icon, state.direction === "ascending" ? "arrow-up" : "arrow-down");
      icon.querySelector("svg")?.setAttribute("aria-hidden", "true");
    }
    setTooltip(button, sortLabel(language, state.next));
    button.addEventListener("click", () => choose(state.next, column));
  }
}
