import { TFolder, type App, type TAbstractFile } from "obsidian";
import { newItemDestination } from "./ItemActions";

export function selectionRoots(items: readonly TAbstractFile[]): TAbstractFile[] {
  const unique = [...new Set(items)];
  return unique.filter(item => !unique.some(parent => parent !== item && parent instanceof TFolder && item.path.startsWith(parent.path + "/")));
}
function current(app: App, items: readonly TAbstractFile[]): void {
  if (!items.length || items.some(item => item === app.vault.getRoot() || app.vault.getAbstractFileByPath(item.path) !== item)) throw Error("Selection is no longer available");
}

export async function trashGallerySelection(app: App, items: readonly TAbstractFile[]): Promise<{ deleted: TAbstractFile[]; error?: unknown }> {
  const roots = selectionRoots(items), deleted: TAbstractFile[] = [];
  current(app, roots);
  try {
    for (const item of roots) {
      current(app, [item]);
      await app.fileManager.trashFile(item);
      deleted.push(item);
    }
    return { deleted };
  } catch (error) { return { deleted, error }; }
}

export class GroupSelectionError extends Error {
  constructor(public readonly remaining: number, public readonly folderPath: string, options: { cause: unknown }) {
    super("Could not group the selection"); this.cause = options.cause;
  }
  cause: unknown;
}

/** Preflight every item; on an I/O failure restore moved items where safe. */
export async function groupGallerySelection(app: App, parent: TFolder, items: readonly TAbstractFile[], name: string): Promise<TFolder> {
  const roots = selectionRoots(items);
  current(app, roots);
  if ((parent.isRoot() ? app.vault.getRoot() : app.vault.getAbstractFileByPath(parent.path)) !== parent || roots.some(item => item.parent !== parent)) throw Error("Selection parent changed");
  const path = newItemDestination(parent, name, "folder");
  if (!path || app.vault.getAbstractFileByPath(path)) throw Error("Invalid or duplicate folder name");
  const originals = roots.map(item => ({ item, path: item.path }));
  const folder = await app.vault.createFolder(path);
  const moved: typeof originals = [];
  try {
    for (const original of originals) {
      current(app, [original.item]);
      if (original.item.path !== original.path || app.vault.getAbstractFileByPath(path) !== folder) throw Error("Selection changed during move");
      const destination = `${path}/${original.item.name}`;
      if (app.vault.getAbstractFileByPath(destination)) throw Error("Destination appeared during move");
      await app.fileManager.renameFile(original.item, destination);
      moved.push(original);
    }
    return folder;
  } catch (cause) {
    for (const original of [...moved].reverse()) {
      if (original.item.parent !== folder || app.vault.getAbstractFileByPath(original.path)) continue;
      try { await app.fileManager.renameFile(original.item, original.path); } catch { /* Retain the item in the new folder and report it. */ }
    }
    const remaining = roots.filter(item => item.parent === folder).length;
    if (!folder.children.length && app.vault.getAbstractFileByPath(path) === folder) {
      try { await app.vault.delete(folder); } catch { /* Only this newly-created empty folder is eligible for cleanup. */ }
    }
    throw new GroupSelectionError(remaining, path, { cause });
  }
}
