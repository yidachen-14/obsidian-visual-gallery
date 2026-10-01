import { describe, expect, it, vi } from "vitest";
import type { App, ViewState, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { TAbstractFile, TFolder, TFile } from "./obsidian-stub";
import { DEFAULT_SETTINGS } from "../src/SettingsModel";
import { CardSelection } from "../src/gallery/Selection";

// Only the host base classes are stubbed; exercise the actual GalleryView.
vi.mock("obsidian", async importOriginal => ({
  ...await importOriginal<typeof import("./obsidian-stub")>(),
  ItemView: class {
    app: App;
    contentEl = { isConnected: false, scrollTop: 90 };
    navigation = false;
    constructor(public leaf: WorkspaceLeaf) { this.app = (leaf as WorkspaceLeaf & { app: App }).app; }
    async setState(): Promise<void> {}
  },
  Modal: class {},
}));
import { GALLERY_VIEW_TYPE, GalleryView } from "../src/gallery/GalleryView";

type TestView = {
  navigateTo: (folder: TFolder) => Promise<void>;
};
function fixture() {
  const root = new TFolder(""), a = new TFolder("A", root), nested = new TFolder("A/Nested", a), b = new TFolder("B", root);
  const files = new Map<string, TAbstractFile>([a, nested, b].map(folder => [folder.path, folder]));
  const app = { vault: { getRoot: () => root, getAbstractFileByPath: (path: string) => files.get(path) } } as unknown as App;
  const back: ViewState[] = [], forward: ViewState[] = [];
  let view: GalleryView;
  const snapshot = (): ViewState => ({ type: GALLERY_VIEW_TYPE, state: { ...view.getState() } });
  // Mirrors the documented flag plus installed 1.13.7 leaf popstate handling;
  // this does not pretend to be native UI/physical-mouse E2E evidence.
  const apply = vi.fn(async (next: ViewState & { popstate?: boolean }) => {
    const previous = snapshot(), result: ViewStateResult = { history: false };
    await view.setState(next.state, result);
    if (result.history && !next.popstate) { back.push(previous); forward.length = 0; }
  });
  const leaf = { app, setViewState: apply } as unknown as WorkspaceLeaf;
  view = new GalleryView(leaf, () => null, () => ({ ...DEFAULT_SETTINGS }));
  const navigate = (folder: TFolder) => (view as unknown as TestView).navigateTo(folder);
  const go = async (direction: -1 | 1) => {
    const source = direction === -1 ? back : forward, destination = direction === -1 ? forward : back;
    const state = source.pop();
    if (state) { destination.push(snapshot()); await apply({ ...state, popstate: true }); }
  };
  return { root, a, nested, b, files, view, leaf, apply, navigate, go, back, forward };
}

describe("gallery uses the host leaf navigation history", () => {
  it("opts into a navigable view", () => {
    expect(fixture().view.navigation).toBe(true);
  });
  it("captures the previous page before entering folders and restores back/forward", async () => {
    const f = fixture();
    await f.navigate(f.a); await f.navigate(f.nested);
    expect(f.back.map(entry => entry.state?.folderPath)).toEqual(["", "A"]);
    expect(f.view.getState().folderPath).toBe("A/Nested");
    await f.go(-1); expect(f.view.getState().folderPath).toBe("A");
    await f.go(-1); expect(f.view.getState().folderPath).toBe("");
    expect(f.back).toHaveLength(0); expect(f.forward).toHaveLength(2);
    await f.go(1); await f.go(1);
    expect(f.view.getState().folderPath).toBe("A/Nested");
    expect(f.back).toHaveLength(2); expect(f.forward).toHaveLength(0);
  });
  it("breadcrumbs use the same leaf and clear forward history only for a new destination", async () => {
    const f = fixture();
    await f.navigate(f.a); await f.navigate(f.nested); await f.navigate(f.root);
    await f.go(-1); expect(f.forward).toHaveLength(1);
    await f.navigate(f.b);
    expect(f.view.getState().folderPath).toBe("B"); expect(f.forward).toHaveLength(0);
    expect(f.apply.mock.calls.at(-1)?.[0]).toMatchObject({ type: GALLERY_VIEW_TYPE, active: true, state: { folderPath: "B" } });
  });
  it("does not push duplicate or stale folder destinations", async () => {
    const f = fixture();
    await f.navigate(f.root); expect(f.apply).not.toHaveBeenCalled();
    await f.navigate(f.a); await f.navigate(f.a); expect(f.back).toHaveLength(1);
    f.files.delete(f.b.path); await f.navigate(f.b);
    await f.navigate(new TFolder("A", f.root));
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it("preserves each visited page's filter/sort without adding settings-only history", async () => {
    const f = fixture();
    await f.apply({ type: GALLERY_VIEW_TYPE, state: { filter: "canvas", sort: "name-desc" } });
    expect(f.back).toHaveLength(0);
    await f.navigate(f.a);
    expect(f.view.getState()).toMatchObject({ folderPath: "A", filter: "canvas", sort: "name-desc" });
    await f.apply({ type: GALLERY_VIEW_TYPE, state: { filter: "pdf", sort: "created-asc" } });
    expect(f.back).toHaveLength(1);
    await f.navigate(f.b); await f.go(-1);
    expect(f.view.getState()).toMatchObject({ folderPath: "A", filter: "pdf", sort: "created-asc" });
    await f.go(-1);
    expect(f.view.getState()).toMatchObject({ folderPath: "", filter: "canvas", sort: "name-desc" });
    await f.go(1); await f.go(1);
    expect(f.view.getState()).toMatchObject({ folderPath: "B", filter: "pdf", sort: "created-asc" });
  });
  it("external explorer navigation also signals the public history flag", async () => {
    const f = fixture(), result = { history: false };
    await f.view.setState({ folderPath: "A", filter: "all" }, result);
    expect(result.history).toBe(true);
    const repeated = { history: false };
    await f.view.setState({ folderPath: "A" }, repeated); expect(repeated.history).toBe(false);
  });
  it("deleted or non-folder history destinations recover to the root", async () => {
    const f = fixture();
    await f.navigate(f.a); await f.navigate(f.b); f.files.delete("A");
    await f.go(-1); expect(f.view.getState().folderPath).toBe("");
    f.files.set("not-folder.md", new TFile("not-folder.md"));
    await f.view.setState({ folderPath: "not-folder.md" }, { history: false });
    expect(f.view.getState().folderPath).toBe("");
  });
  it("clears stale selection and scroll only when the folder changes", async () => {
    const f = fixture(), selection = (f.view as unknown as { selection: CardSelection }).selection;
    selection.paths.add("old.md"); await f.navigate(f.a);
    expect(selection.paths.size).toBe(0); expect(f.view.contentEl.scrollTop).toBe(0);
    selection.paths.add("A/note.md"); f.view.contentEl.scrollTop = 30;
    await f.view.setState({ filter: "notes" }, { history: false });
    expect([...selection.paths]).toEqual(["A/note.md"]); expect(f.view.contentEl.scrollTop).toBe(30);
  });
  it("ignores malformed settings without inventing history entries", async () => {
    const f = fixture();
    await f.navigate(f.a);
    for (const state of [null, undefined, "A", { folderPath: 123, filter: "bad", sort: "bad" }]) {
      const result = { history: false }; await f.view.setState(state, result);
      expect(result.history).toBe(false);
      expect(f.view.getState()).toEqual({ folderPath: "A", filter: "all", sort: "modified" });
    }
  });
});
