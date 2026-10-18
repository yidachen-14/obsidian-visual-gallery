import { TFile, TFolder, setIcon, setTooltip, type App } from "obsidian";
import type { NativeExplorer } from "./GalleryExplorer";

/** One postorder walk per structure update, never one subtree walk per row. */
export function folderFileCounts(root: TFolder): Map<string, number> {
  const counts = new Map<string, number>();
  const stack: { folder: TFolder; visited: boolean }[] = [{ folder: root, visited: false }];
  while (stack.length) {
    const { folder, visited } = stack.pop()!;
    if (!visited) {
      stack.push({ folder, visited: true });
      for (const child of folder.children) if (child instanceof TFolder) stack.push({ folder: child, visited: false });
    } else {
      let count = 0;
      for (const child of folder.children) {
        if (child instanceof TFolder) count += counts.get(child.path) ?? 0;
        else if (child instanceof TFile) count++;
      }
      counts.set(folder.path, count);
    }
  }
  return counts;
}

function decorativeIcon(parent: HTMLElement, cls: string, icon: string): HTMLElement {
  const element = parent.createSpan({ cls });
  element.setAttribute("aria-hidden", "true");
  setIcon(element, icon);
  return element;
}

/** Decorate only this plugin's native tree. Keep the host's disclosure element
 * and listeners intact, so keyboard, virtual rendering and drag/drop still work. */
export function installExplorerAppearance(
  app: App,
  view: NativeExplorer,
  homeLabel: () => string,
  navigate: (folder: TFolder) => Promise<void>,
  onError: (error: unknown) => void,
): void {
  const home = document.createElement("button");
  home.type = "button";
  home.className = "visual-gallery-explorer-home";
  decorativeIcon(home, "visual-gallery-explorer-home-icon", "house");
  const name = home.createSpan({ cls: "visual-gallery-explorer-home-name", text: app.vault.getName() });
  view.containerEl.insertBefore(home, view.navFileContainerEl);
  const labels = () => {
    name.setText(app.vault.getName());
    setTooltip(home, homeLabel());
  };
  labels();
  view.registerDomEvent(home, "click", () => {
    view.tree.clearSelectedDoms();
    void navigate(app.vault.getRoot()).catch(onError);
  });
  view.registerDomEvent(home, "keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    // The native Files scope otherwise opens its focused file on Enter.
    event.preventDefault();
    event.stopPropagation();
    home.click();
  });
  view.registerDomEvent(home, "contextmenu", event => {
    event.preventDefault();
    view.tree.clearSelectedDoms();
    view.onFileContextMenu?.(event, app.vault.getRoot());
  });
  view.attachDropHandler?.(app.vault.getRoot(), home);
  const setState = view.setState;
  view.setState = async (state, result) => { await setState.call(view, state, result); labels(); };

  const decorated = new WeakSet<object>();
  const decorate = (folder: TFolder) => {
    const node = view.fileItems[folder.path];
    if (!node || decorated.has(node) || !node.collapseEl) return;
    decorated.add(node);
    // Keep the original clickable collapseEl, replacing only its artwork.
    setIcon(node.collapseEl, "chevron-down");
    node.collapseEl.querySelector("svg")?.setAttribute("aria-hidden", "true");
    const folderIcon = node.collapseEl.createSpan({ cls: "visual-gallery-explorer-folder-icon" });
    folderIcon.setAttribute("aria-hidden", "true");
    // Explicit lucide prefix bypasses Obsidian's legacy folder -> folder-open alias.
    decorativeIcon(folderIcon, "visual-gallery-explorer-folder-closed", "lucide-folder");
    decorativeIcon(folderIcon, "visual-gallery-explorer-folder-open", "lucide-folder-open");
    const badge = node.selfEl.createSpan({ cls: "visual-gallery-explorer-folder-count" });
    badge.setAttribute("aria-hidden", "true");
    node.selfEl.setAttribute("aria-expanded", String(!node.collapsed));
    if (node.setCollapsed) {
      const collapse = node.setCollapsed;
      node.setCollapsed = (collapsed, animate) => {
        const result = collapse.call(node, collapsed, animate);
        node.selfEl.setAttribute("aria-expanded", String(!node.collapsed));
        return result;
      };
    }
  };
  let timer: number | null = null;
  let disposed = false;
  const refresh = () => {
    timer = null;
    if (disposed) return;
    const counts = folderFileCounts(app.vault.getRoot());
    for (const node of Object.values(view.fileItems)) {
      if (!(node.file instanceof TFolder)) continue;
      decorate(node.file);
      const count = node.selfEl.querySelector<HTMLElement>(".visual-gallery-explorer-folder-count");
      if (count) count.setText(String(counts.get(node.file.path) ?? 0));
    }
    // Styles can arrive just after a native view's first virtual-tree measure.
    // Recompute its row metrics so untouched and expanded siblings align.
    view.tree.infinityScroll?.invalidateAll();
  };
  const schedule = () => {
    if (disposed || timer !== null) return;
    timer = window.setTimeout(refresh, 30);
  };
  const create = view.onCreate;
  view.onCreate = file => {
    create.call(view, file);
    if (file instanceof TFolder) decorate(file);
    schedule();
  };
  for (const node of Object.values(view.fileItems)) if (node.file instanceof TFolder) decorate(node.file);
  view.registerEvent(app.vault.on("create", schedule));
  view.registerEvent(app.vault.on("delete", schedule));
  view.registerEvent(app.vault.on("rename", schedule));
  view.registerEvent(app.workspace.on("css-change", () => view.tree.infinityScroll?.invalidateAll()));
  view.register(() => { disposed = true; if (timer !== null) window.clearTimeout(timer); });
  schedule();
}
