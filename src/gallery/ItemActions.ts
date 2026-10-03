import { FileSystemAdapter, Platform, TFolder, normalizePath, type App, type TAbstractFile } from "obsidian";
import { isValidItemName } from "./Rename";

export type NewItemKind = "note" | "canvas" | "folder";

export function newItemDestination(folder: TFolder, name: string, kind: NewItemKind): string | null {
  name = name.trim();
  if (!isValidItemName(name)) return null;
  const extension = kind === "note" ? ".md" : kind === "canvas" ? ".canvas" : "";
  const filename = extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name;
  return normalizePath(`${folder.isRoot() ? "" : folder.path}/${filename}`);
}

function requireCurrentItem(app: App, item: TAbstractFile): void {
  if (item === app.vault.getRoot() || app.vault.getAbstractFileByPath(item.path) !== item) {
    throw new Error("Item no longer exists or is the vault root");
  }
}

export async function deleteGalleryItem(app: App, item: TAbstractFile): Promise<boolean> {
  requireCurrentItem(app, item);
  // This native method both confirms AND deletes. Do not trash the item again.
  // It honors Obsidian's trash, backlinks and unlinked-attachment preferences.
  return app.fileManager.promptForDeletion(item);
}

export async function createGalleryItem(app: App, folder: TFolder, name: string, kind: NewItemKind): Promise<TAbstractFile> {
  if (folder !== app.vault.getRoot() && app.vault.getAbstractFileByPath(folder.path) !== folder) {
    throw new Error("Folder no longer exists");
  }
  const destination = newItemDestination(folder, name, kind);
  if (!destination || app.vault.getAbstractFileByPath(destination)) throw new Error("Invalid or duplicate name");
  // Vault.create/createFolder also reject collisions at write time; never overwrite.
  if (kind === "folder") return app.vault.createFolder(destination);
  return app.vault.create(destination, kind === "canvas" ? JSON.stringify({ nodes: [], edges: [] }) + "\n" : "");
}

export interface RevealShell { showItemInFolder(path: string): void; }

export function canRevealItem(app: App): boolean {
  return !Platform.isMobile && typeof FileSystemAdapter === "function" && app.vault.adapter instanceof FileSystemAdapter;
}

export function revealGalleryItem(app: App, item: TAbstractFile, injectedShell?: RevealShell): void {
  requireCurrentItem(app, item);
  if (!canRevealItem(app)) throw new Error("Not a local desktop vault");
  const electron = injectedShell ? null : require("electron") as { shell?: RevealShell; remote?: { shell?: RevealShell } };
  const shell = injectedShell ?? electron?.shell ?? electron?.remote?.shell;
  if (!shell?.showItemInFolder) throw new Error("System file manager is unavailable");
  shell.showItemInFolder((app.vault.adapter as FileSystemAdapter).getFullPath(item.path));
}
