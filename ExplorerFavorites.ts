import { Menu, TFolder, setIcon, setTooltip, type App } from "obsidian";
import type { NativeExplorer } from "./GalleryExplorer";
import type { ExplorerTranslationKey } from "../i18n-explorer";

export interface ExplorerFavorites {
  paths: () => string[];
  toggle: (path: string) => Promise<void>;
  label: (key: ExplorerTranslationKey) => string;
  navigate: (folder: TFolder) => Promise<void>;
  error: (error: unknown) => void;
}
/** Shortcuts live outside the native tree, leaving its selection/menus/folds intact. */
export function installExplorerFavorites(app: App, view: NativeExplorer, options: ExplorerFavorites): () => void {
  const section = document.createElement("div");
  section.className = "visual-gallery-explorer-favorites";
  view.containerEl.insertBefore(section, view.navFileContainerEl);
  let collapsed = app.loadLocalStorage("visual-gallery-favorites-collapsed") === true;
  const render = () => {
    section.empty();
    const paths = options.paths();
    section.hidden = paths.length === 0;
    if (!paths.length) return;
    const heading = section.createEl("button", { cls: "visual-gallery-explorer-favorites-heading", attr: { type: "button", "aria-expanded": String(!collapsed) } });
    const arrow = heading.createSpan({ attr: { "aria-hidden": "true" } });
    setIcon(arrow, collapsed ? "chevron-right" : "chevron-down");
    heading.createSpan({ text: options.label("favoriteFolders") });
    heading.addEventListener("click", () => {
      collapsed = !collapsed; app.saveLocalStorage("visual-gallery-favorites-collapsed", collapsed);
      render(); section.querySelector<HTMLElement>(".visual-gallery-explorer-favorites-heading")?.focus();
    });
    heading.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); event.stopPropagation(); heading.click();
    });
    if (collapsed) return;
    for (const path of paths) {
      const folder = app.vault.getAbstractFileByPath(path);
      const available = folder instanceof TFolder;
      const row = section.createDiv({ cls: "visual-gallery-explorer-favorite-row" });
      row.dataset.path = path;
      const button = row.createEl("button", { cls: "visual-gallery-explorer-favorite", attr: { type: "button", "aria-label": path, "aria-disabled": String(!available) } });
      const icon = button.createSpan({ attr: { "aria-hidden": "true" } });
      setIcon(icon, "pin");
      button.createSpan({ cls: "visual-gallery-explorer-favorite-name", text: path.split("/").pop()! });
      setTooltip(button, available ? path : `${path} · ${options.label("favoriteMissing")}`);
      button.addEventListener("click", () => {
        const current = app.vault.getAbstractFileByPath(path);
        if (current instanceof TFolder) {
          view.tree.clearSelectedDoms();
          void options.navigate(current).catch(options.error);
        }
      });
      // Keep Enter/Space on a shortcut away from the native tree's focused file.
      button.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault(); event.stopPropagation(); button.click();
      });
      row.addEventListener("contextmenu", event => {
        event.preventDefault();
        const current = app.vault.getAbstractFileByPath(path);
        if (current instanceof TFolder && view.onFileContextMenu) {
          view.tree.clearSelectedDoms();
          view.onFileContextMenu(event, current);
        }
        else new Menu().addItem(item => item.setTitle(options.label("unpinFolder")).setIcon("pin-off")
          .onClick(() => void options.toggle(path).catch(options.error))).showAtMouseEvent(event);
      });
      const remove = row.createEl("button", { cls: "clickable-icon visual-gallery-explorer-unpin", attr: { type: "button", "aria-label": `${options.label("unpinFolder")}: ${path}` } });
      setIcon(remove, "pin-off"); setTooltip(remove, options.label("unpinFolder"));
      remove.addEventListener("click", () => void options.toggle(path).catch(options.error));
      remove.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault(); event.stopPropagation(); remove.click();
      });
      if (available) view.attachDropHandler?.(folder, button);
    }
  };
  view.registerEvent(app.vault.on("create", render));
  view.registerEvent(app.vault.on("delete", render));
  // Rename rendering follows the asynchronous shared favorite-path update.
  const setState = view.setState.bind(view);
  view.setState = async (state, result) => { await setState(state, result); render(); };
  render();
  return render;
}
