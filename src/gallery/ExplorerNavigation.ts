import { TFile, TFolder, type App, type TAbstractFile } from "obsidian";
import { classifyGalleryFile } from "../browser/VaultBrowser";

export interface GalleryTarget { folderPath: string; revealPath?: string; }

/** Resolve the clicked item, never the unrelated active editor file. */
export function explorerGalleryTarget(app: App, item: TAbstractFile): GalleryTarget | null {
  if (item !== app.vault.getRoot() && app.vault.getAbstractFileByPath(item.path) !== item) return null;
  if (item instanceof TFolder) return { folderPath: item.path };
  if (item instanceof TFile && item.parent && classifyGalleryFile(item)) {
    return { folderPath: item.parent.path, revealPath: item.path };
  }
  return null;
}
