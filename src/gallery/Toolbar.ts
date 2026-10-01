import { setIcon, setTooltip } from "obsidian";
import type { GalleryFilter, GallerySort } from "../browser/VaultBrowser";
import { filterLabel, sortLabel, translate, type UiLanguage } from "../i18n";

export const TOOLBAR_ACTIONS = ["create", "sort", "filter"] as const;
export type ToolbarAction = typeof TOOLBAR_ACTIONS[number];

export function toolbarDefinitions(language: UiLanguage, filter: GalleryFilter, sort: GallerySort) {
  return [
    { action: "create", icon: "plus", label: translate(language, "create") },
    { action: "sort", icon: "arrow-up-narrow-wide", label: `${translate(language, "sortAria")}: ${sortLabel(language, sort)}` },
    { action: "filter", icon: "list-filter", label: `${translate(language, "filterAria")}: ${filterLabel(language, filter)}` },
  ] satisfies { action: ToolbarAction; icon: string; label: string }[];
}

/** Real toolbar DOM is shared with host-style QA, not a separately drawn mock. */
export function renderGalleryToolbar(header: HTMLElement, language: UiLanguage, filter: GalleryFilter, sort: GallerySort,
  open: (action: ToolbarAction, button: HTMLButtonElement) => void): HTMLElement {
  const controls = header.ownerDocument.createElement("div");
  controls.className = "visual-gallery-controls";
  controls.setAttribute("role", "toolbar");
  controls.setAttribute("aria-label", translate(language, "gallery"));
  header.appendChild(controls);
  for (const definition of toolbarDefinitions(language, filter, sort)) {
    const button = header.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "clickable-icon nav-action-button visual-gallery-toolbar-button";
    button.dataset.action = definition.action;
    button.setAttribute("aria-label", definition.label);
    button.setAttribute("aria-haspopup", "menu");
    if (definition.action === "filter") button.classList.toggle("is-active", filter !== "all");
    setIcon(button, definition.icon);
    button.querySelector("svg")?.setAttribute("aria-hidden", "true");
    setTooltip(button, definition.label, { placement: "bottom" });
    button.addEventListener("click", () => open(definition.action, button));
    button.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") { event.preventDefault(); button.click(); }
    });
    controls.appendChild(button);
  }
  return controls;
}
