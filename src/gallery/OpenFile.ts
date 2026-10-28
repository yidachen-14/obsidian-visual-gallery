import { TFile, type App, type WorkspaceLeaf } from "obsidian";

const opening = new WeakMap<App, Map<TFile, Promise<WorkspaceLeaf | undefined>>>();

/** Shared by cards and the plugin's sidebar, including concurrent opens. */
export function openGalleryFile(app: App, file: TFile): Promise<WorkspaceLeaf | undefined> {
  let jobs = opening.get(app);
  if (!jobs) { jobs = new Map(); opening.set(app, jobs); }
  const running = jobs.get(file);
  if (running) return running;
  const task = Promise.resolve().then(async () => {
    if (app.vault.getAbstractFileByPath(file.path) !== file) return;
    let existing: WorkspaceLeaf | undefined;
    app.workspace.iterateAllLeaves(leaf => {
      const shown = (leaf.view as { file?: TFile | null }).file;
      if (!existing && (shown === file || (!shown && leaf.getViewState().state?.file === file.path))) existing = leaf;
    });
    if (existing) {
      await existing.loadIfDeferred();
      // revealLeaf flashes the tab yellow; activation already selects and focuses it.
      app.workspace.setActiveLeaf(existing, { focus: true });
      return existing;
    }
    const leaf = app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    return leaf;
  }).finally(() => jobs.delete(file));
  jobs.set(file, task);
  return task;
}
