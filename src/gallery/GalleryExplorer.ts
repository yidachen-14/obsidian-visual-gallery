import { TFile, TFolder, type App, type View, type WorkspaceLeaf, type TAbstractFile } from "obsidian";

export const GALLERY_EXPLORER_TYPE = "visual-gallery-explorer";

// Obsidian does not expose its Files view in the public API. Keep the small,
// capability-checked adapter here; never patch a host prototype or the user's
// existing Files view. Native menus, rename, clipboard, drag/drop and rendering
// belong to the host instance, including third-party file-menu listeners.
interface FileNode {
  file: TAbstractFile;
  selfEl: HTMLElement;
  shouldDisplay(): boolean;
  onSelfClick(event: MouseEvent | KeyboardEvent): void;
  collapsed?: boolean;
  collapseEl?: HTMLElement;
  setCollapsed?(collapsed: boolean, animate: boolean): Promise<void> | void;
}
interface NativeTree {
  id: string;
  infinityScroll?: { invalidateAll(): void };
  activeDom: FileNode | null;
  selectedDoms: Set<FileNode>;
  handleItemSelection(event: MouseEvent | KeyboardEvent, node: FileNode): boolean;
  clearSelectedDoms(): void;
  selectItem(node: FileNode): void;
  deselectItem(node: FileNode): void;
  setFocusedItem(node: FileNode, scroll?: boolean): void;
}
export interface NativeExplorer extends View {
  tree: NativeTree;
  fileItems: Record<string, FileNode>;
  fileBeingRenamed: TAbstractFile | null;
  activeDom?: FileNode | null;
  autoRevealFile?: boolean;
  revealActiveFile?(): void;
  navFileContainerEl: HTMLElement;
  onCreate(file: TAbstractFile): void;
  onFileOpen(file: TFile | null): void;
  updateShowUnsupportedFiles(): void;
  onFileContextMenu?(event: MouseEvent, file: TAbstractFile): void;
  attachDropHandler?(folder: TFolder, element: HTMLElement): void;
}
type ViewFactory = (leaf: WorkspaceLeaf) => View;
type HostApp = App & { viewRegistry?: { getViewCreatorByType?(type: string): ViewFactory | undefined } };

export function nativeExplorerFactory(app: App): ViewFactory | undefined {
  return (app as HostApp).viewRegistry?.getViewCreatorByType?.("file-explorer");
}

function isNativeExplorer(view: View): view is NativeExplorer {
  const v = view as Partial<NativeExplorer>;
  return !!v.tree && typeof v.tree.handleItemSelection === "function"
    && typeof v.tree.selectItem === "function" && typeof v.tree.deselectItem === "function"
    && typeof v.tree.clearSelectedDoms === "function" && typeof v.tree.setFocusedItem === "function"
    && !!v.fileItems && !!v.navFileContainerEl && typeof v.onCreate === "function"
    && typeof v.onFileOpen === "function" && typeof v.updateShowUnsupportedFiles === "function";
}

function editableTarget(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  return !!target?.closest?.("input,textarea,[contenteditable=true],.is-being-renamed");
}

export function createGalleryExplorer(
  app: App,
  leaf: WorkspaceLeaf,
  title: () => string,
  navigate: (folder: TFolder) => Promise<void>,
  onError: (error: unknown) => void,
): NativeExplorer {
  const factory = nativeExplorerFactory(app);
  if (!factory) throw new Error("The Obsidian Files core plugin is unavailable");
  const view = factory(leaf);
  if (!isNativeExplorer(view)) throw new Error("Unsupported Obsidian Files view API");
  view.getViewType = () => GALLERY_EXPLORER_TYPE;
  view.getDisplayText = title;
  view.getIcon = () => "folder-tree";
  // Native folds use tree.id as their storage namespace. Keep the two trees'
  // expansion preferences independent, including across restarts.
  view.tree.id = GALLERY_EXPLORER_TYPE;
  view.containerEl.addClass("visual-gallery-explorer");

  const current = (file: TAbstractFile) => file === app.vault.getRoot()
    || app.vault.getAbstractFileByPath(file.path) === file;
  const open = (file: TFile) => {
    if (current(file)) void app.workspace.getLeaf("tab").openFile(file).catch(onError);
  };
  const select = (node: FileNode, event: MouseEvent | KeyboardEvent) => {
    const tree = view.tree;
    if (event.metaKey || event.ctrlKey) {
      if (tree.selectedDoms.has(node)) tree.deselectItem(node);
      else tree.selectItem(node);
      tree.setFocusedItem(node, false);
      tree.activeDom = node;
    } else if (!(event.shiftKey || event.altKey) || !tree.handleItemSelection(event, node)) {
      tree.clearSelectedDoms();
      tree.selectItem(node);
      tree.setFocusedItem(node, false);
      tree.activeDom = node;
    }
    app.workspace.setActiveLeaf(leaf, { focus: true });
  };
  const patched = new WeakSet<FileNode>();
  const patchNode = (file: TAbstractFile) => {
    const node = view.fileItems[file.path];
    if (!node || patched.has(node)) return;
    patched.add(node);
    if (file instanceof TFile) node.shouldDisplay = () => true;
    const click = node.onSelfClick;
    node.onSelfClick = event => {
      if (event.defaultPrevented || editableTarget(event) || view.fileBeingRenamed === file || !current(file)) return;
      if ("button" in event && event.button !== 0) return;
      if (file instanceof TFolder) {
        if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
          select(node, event);
          return;
        }
        // Keep native disclosure/keyboard handling, but a label click navigates
        // even when the folder was already selected or has no children.
        click.call(node, event);
        if (!(event.target as HTMLElement | null)?.closest?.(".collapse-icon")) {
          select(node, event);
          void navigate(file).catch(onError);
        }
      } else if (file instanceof TFile) {
        if ("key" in event && event.key === "Enter") open(file);
        else select(node, event);
      }
    };
  };
  const create = view.onCreate;
  view.onCreate = file => { create.call(view, file); patchNode(file); };
  Object.values(view.fileItems).forEach(node => patchNode(node.file));
  const showUnsupported = view.updateShowUnsupportedFiles;
  view.updateShowUnsupportedFiles = () => {
    showUnsupported.call(view);
    view.navFileContainerEl.addClass("show-unsupported");
  };
  // Editor file-open events must not clear an intentional sidebar selection.
  view.onFileOpen = file => {
    view.activeDom?.selfEl.removeClass("is-active");
    view.activeDom = file ? view.fileItems[file.path] ?? null : null;
    view.activeDom?.selfEl.addClass("is-active");
    if (view.autoRevealFile) view.revealActiveFile?.();
  };
  view.registerDomEvent(view.containerEl, "dblclick", event => {
    if (event.button !== 0 || editableTarget(event) || view.fileBeingRenamed) return;
    const row = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(".nav-file-title");
    const path = row?.dataset.path ?? row?.parentElement?.dataset.path;
    const file = path ? app.vault.getAbstractFileByPath(path) : null;
    if (file instanceof TFile) { event.preventDefault(); open(file); }
  });
  return view;
}
