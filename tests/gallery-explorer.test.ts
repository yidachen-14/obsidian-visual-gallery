import { describe, expect, it, vi } from "vitest";
import type { App, View, WorkspaceLeaf } from "obsidian";
import { TAbstractFile, TFile, TFolder } from "./obsidian-stub";
import { createGalleryExplorer, GALLERY_EXPLORER_TYPE, nativeExplorerFactory } from "../src/gallery/GalleryExplorer";
import { EXPLORER_TRANSLATIONS } from "../src/i18n-explorer";
import { translate, UI_LANGUAGES } from "../src/i18n";

function fixture() {
  const root = new TFolder(""), folder = new TFolder("Projects", root);
  const note = new TFile("Projects/Note.md", 0, folder), zip = new TFile("Projects/archive.zip", 0, folder);
  const files = new Map<string, TAbstractFile>([folder, note, zip].map(file => [file.path, file]));
  const nodes: Record<string, ReturnType<typeof nodeFor>> = {};
  const nativeClicks = new Map<TAbstractFile, ReturnType<typeof vi.fn>>();
  function nodeFor(file: TAbstractFile) {
    const node = { file, selfEl: {}, collapsed: true, shouldDisplay: () => false, onSelfClick: vi.fn() };
    node.onSelfClick = vi.fn(() => { if (file instanceof TFolder) node.collapsed = !node.collapsed; });
    nativeClicks.set(file, node.onSelfClick);
    return node;
  }
  const selectedDoms = new Set<ReturnType<typeof nodeFor>>();
  const domEvents: Record<string, (e: unknown) => void> = {};
  const tree = {
    id: "file-explorer", selectedDoms, activeDom: null,
    handleItemSelection: vi.fn((_event: MouseEvent | KeyboardEvent, _node: unknown) => false),
    clearSelectedDoms: vi.fn(() => selectedDoms.clear()),
    selectItem: vi.fn(node => selectedDoms.add(node)),
    deselectItem: vi.fn(node => selectedDoms.delete(node)),
    setFocusedItem: vi.fn(),
  };
  const menu = vi.fn(), addClass = vi.fn();
  const native = {
    tree, fileItems: nodes, fileBeingRenamed: null as TAbstractFile | null,
    containerEl: { addClass }, navFileContainerEl: { addClass },
    onCreate: (file: TAbstractFile) => { nodes[file.path] = nodeFor(file); },
    onFileOpen: vi.fn(() => selectedDoms.clear()),
    updateShowUnsupportedFiles: vi.fn(), onFileContextMenu: menu,
    registerDomEvent: (_el: unknown, type: string, callback: (e: unknown) => void) => { domEvents[type] = callback; },
    getViewType: () => "file-explorer", getDisplayText: () => "Files", getIcon: () => "folder",
  };
  let opened = false;
  const fileLeaf = { view: { file: null as TFile | null }, getViewState: () => ({state:{file:fileLeaf.view.file?.path}}), loadIfDeferred: vi.fn(async()=>{}), openFile: vi.fn(async (file: TFile) => { fileLeaf.view.file = file; }) };
  const openFile = fileLeaf.openFile, getLeaf = vi.fn(() => { opened=true;return fileLeaf; });
  const app = {
    viewRegistry: { getViewCreatorByType: () => () => native },
    vault: { getRoot: () => root, getAbstractFileByPath: (path: string) => files.get(path) },
    workspace: { getLeaf, setActiveLeaf: vi.fn(), revealLeaf:vi.fn(async()=>{}), iterateAllLeaves:(fn:(leaf:WorkspaceLeaf)=>void)=>{if(opened)fn(fileLeaf as unknown as WorkspaceLeaf);} },
  } as unknown as App;
  const leaf = {} as WorkspaceLeaf, navigate = vi.fn(async () => {}), onError = vi.fn();
  const view = createGalleryExplorer(app, leaf, () => "Gallery files", navigate, onError);
  files.forEach(file => view.onCreate(file));
  const event = (options = {}) => ({ button: 0, defaultPrevented: false, target: { closest: () => null }, ...options } as unknown as MouseEvent);
  const click = (file: TAbstractFile, options = {}) => view.fileItems[file.path]!.onSelfClick(event(options));
  return { app, leaf, view, native, tree, files, folder, note, zip, navigate, onError, click, event, domEvents, openFile, getLeaf, nativeClicks };
}

describe("Visual Gallery native file browser adapter", () => {
  it("owns a distinct view and fold namespace while retaining the actual native context menu", () => {
    const { view, native } = fixture();
    expect(view).toBe(native);
    expect(view.getViewType()).toBe(GALLERY_EXPLORER_TYPE);
    expect(view.tree.id).toBe(GALLERY_EXPLORER_TYPE);
    expect(view.getDisplayText()).toBe("Gallery files");
    expect(native.onFileContextMenu).toBeTypeOf("function");
  });
  it("selects a file on a single click, without opening an editor or moving the gallery", () => {
    const { view, tree, note, click, openFile, navigate } = fixture();
    click(note);
    expect([...tree.selectedDoms]).toEqual([view.fileItems[note.path]]);
    expect(openFile).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    view.onFileOpen(null);
    expect(tree.selectedDoms.size).toBe(1);
  });
  it("opens a double-clicked file in a new tab and reuses it for Enter", async () => {
    const { app, note, view, domEvents, event, openFile, getLeaf } = fixture();
    domEvents.dblclick!({ button: 0, preventDefault: vi.fn(), target: { closest: (selector: string) => selector === ".nav-file-title" ? { dataset: { path: note.path } } : null } });
    await vi.waitFor(() => expect(getLeaf).toHaveBeenLastCalledWith("tab"));
    expect(openFile).toHaveBeenCalledExactlyOnceWith(note);
    view.fileItems[note.path]!.onSelfClick(event({ key: "Enter" }) as unknown as KeyboardEvent);
    await vi.waitFor(() => expect(app.workspace.setActiveLeaf).toHaveBeenCalled());
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(getLeaf).toHaveBeenCalledTimes(1);
  });
  it("selects and navigates folder rows without changing either fold state; only the arrow toggles", () => {
    const { folder, navigate, click, view, tree, nativeClicks } = fixture();
    const node = view.fileItems[folder.path]!;
    click(folder);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(folder);
    expect([...tree.selectedDoms]).toEqual([node]);
    expect(node.collapsed).toBe(true);
    expect(nativeClicks.get(folder)).not.toHaveBeenCalled();
    click(folder, { target: { closest: (selector: string) => selector === ".collapse-icon" ? {} : null } });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(node.collapsed).toBe(false);
    click(folder); click(folder);
    expect(navigate).toHaveBeenCalledTimes(3);
    expect(node.collapsed).toBe(false);
    expect(nativeClicks.get(folder)).toHaveBeenCalledTimes(1);
    click(folder, { target: { closest: (selector: string) => selector === ".collapse-icon" ? {} : null } });
    expect(node.collapsed).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(3);
    expect(nativeClicks.get(folder)).toHaveBeenCalledTimes(2);
  });
  it("retains native keyboard disclosure", () => {
    const { folder, click, nativeClicks } = fixture();
    click(folder, { key: "ArrowRight" });
    expect(nativeClicks.get(folder)).toHaveBeenCalledTimes(1);
  });
  it("allows modifier selection and native range selection without opening files", () => {
    const { tree, note, zip, folder, click, openFile, navigate } = fixture();
    click(note); click(zip, { metaKey: true });
    expect(tree.selectedDoms.size).toBe(2);
    click(note, { ctrlKey: true });
    expect(tree.selectedDoms.size).toBe(1);
    click(zip, { shiftKey: true });
    expect(tree.handleItemSelection.mock.lastCall?.[0].shiftKey).toBe(true);
    click(folder, { altKey: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
  });
  it("shows all vault files without changing the user's unsupported-files preference", () => {
    const { view, zip, native } = fixture();
    expect(view.fileItems[zip.path]!.shouldDisplay()).toBe(true);
    view.updateShowUnsupportedFiles();
    expect(native.navFileContainerEl.addClass).toHaveBeenCalledWith("show-unsupported");
  });
  it("toggles folders in a mixed file/folder selection without navigating", () => {
    const { click, note, folder, tree, navigate } = fixture();
    click(note); click(folder, { metaKey: true });
    expect(tree.selectedDoms.size).toBe(2);
    click(folder, { ctrlKey: true });
    expect(tree.selectedDoms.size).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("ignores stale references, rename fields and non-primary clicks", () => {
    const { files, view, native, note, folder, click, navigate, openFile } = fixture();
    files.delete(folder.path); click(folder);
    files.set(note.path, new TFile(note.path)); click(note);
    expect(navigate).not.toHaveBeenCalled(); expect(openFile).not.toHaveBeenCalled();
    native.fileBeingRenamed = note;
    view.fileItems[note.path]!.onSelfClick({ key: "Enter" } as KeyboardEvent);
    expect(openFile).not.toHaveBeenCalled();
    native.fileBeingRenamed = null;
    click(note, { button: 3 });
    expect(openFile).not.toHaveBeenCalled();
  });
  it("fails explicitly if Files is disabled or its native API changes", () => {
    expect(nativeExplorerFactory({} as App)).toBeUndefined();
    const app = { viewRegistry: { getViewCreatorByType: () => () => ({}) as View } } as unknown as App;
    expect(() => createGalleryExplorer(app, {} as WorkspaceLeaf, () => "", async () => {}, () => {})).toThrow("Unsupported");
  });
  it.each(UI_LANGUAGES)("translates all file browser labels in %s", locale => {
    expect(Object.keys(EXPLORER_TRANSLATIONS[locale]).sort()).toEqual(Object.keys(EXPLORER_TRANSLATIONS.en).sort());
    for (const key of Object.keys(EXPLORER_TRANSLATIONS.en) as (keyof typeof EXPLORER_TRANSLATIONS.en)[]) {
      expect(translate(locale, key).trim()).not.toBe("");
      if (locale !== "en") expect(translate(locale, key)).not.toBe(translate("en", key));
    }
  });
});
