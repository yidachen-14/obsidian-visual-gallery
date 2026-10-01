import { setIcon } from "obsidian";

export const FOLDER_ICONS = ["legacy-folder", "folder", "folders", "archive", "box", "library", "book-open", "folder-heart", "folder-cog", "folder-tree"] as const;
export const NAVIGATION_ICONS = ["layout-grid", "gallery-horizontal", "images", "folder", "library", "book-open", "film", "clapperboard", "palette", "home"] as const;

export function validIcon(value: string | undefined, choices: readonly string[], fallback: string): string {
  return value && choices.includes(value) ? value : fallback;
}

export function renderGalleryIcon(element: HTMLElement, icon: string): void {
  element.replaceChildren();
  element.classList.toggle("is-legacy-folder", icon === "legacy-folder");
  if (icon === "legacy-folder") element.textContent = "⌑";
  else {
    setIcon(element, icon);
    const svg = element.querySelector("svg");
    if (svg) {
      // A centered SVG viewport need not have centered artwork (folders are
      // top-heavy). Center the visible paths too, without changing their scale.
      const view = svg.viewBox.baseVal;
      try {
        const bounds = svg.getBBox();
        if (view.width > 0 && view.height > 0 && bounds.width > 0 && bounds.height > 0) {
          svg.setAttribute("viewBox", `${bounds.x + bounds.width / 2 - view.width / 2} ${bounds.y + bounds.height / 2 - view.height / 2} ${view.width} ${view.height}`);
        }
      } catch {
        // Hidden or detached SVGs can be unmeasurable; retain the host viewport.
      }
    }
  }
}
