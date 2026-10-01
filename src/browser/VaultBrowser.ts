import { TFile, TFolder, type TAbstractFile } from "obsidian";

export type GalleryFilter = "all" | "canvas" | "notes" | "images" | "pdf";
export const GALLERY_FILTERS: GalleryFilter[] = ["all", "canvas", "notes", "images", "pdf"];
export const GALLERY_SORTS = ["name", "name-desc", "modified", "modified-asc", "created", "created-asc"] as const;
export type GallerySort = typeof GALLERY_SORTS[number];

export function validSort(value: unknown, fallback: GallerySort = "modified"): GallerySort {
  return GALLERY_SORTS.includes(value as GallerySort) ? value as GallerySort : fallback;
}
export type GalleryFileKind = Exclude<GalleryFilter, "all">;

export interface GalleryEntry {
  item: TFile | TFolder;
  kind: GalleryFileKind | "folder";
}

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

export function classifyGalleryFile(file: TFile): GalleryFileKind | null {
  const extension = file.extension.toLowerCase();
  if (extension === "canvas") return "canvas";
  if (extension === "md") return "notes";
  if (extension === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "images";
  return null;
}

export function listGalleryEntries(
  folder: TFolder,
  filter: GalleryFilter,
  sort: GallerySort,
): GalleryEntry[] {
  const entries: GalleryEntry[] = [];
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      entries.push({ item: child, kind: "folder" });
      continue;
    }
    if (!(child instanceof TFile)) continue;
    const kind = classifyGalleryFile(child);
    if (kind && (filter === "all" || filter === kind)) entries.push({ item: child, kind });
  }

  return entries.sort((left, right) => compareEntries(left, right, sort));
}

export function getBreadcrumbFolders(folder: TFolder): TFolder[] {
  const folders: TFolder[] = [];
  let current: TAbstractFile | null = folder;
  while (current instanceof TFolder) {
    folders.unshift(current);
    current = current.parent;
  }
  return folders;
}

function compareEntries(left: GalleryEntry, right: GalleryEntry, sort: GallerySort): number {
  if (left.kind === "folder" && right.kind !== "folder") return -1;
  if (left.kind !== "folder" && right.kind === "folder") return 1;
  if (left.item instanceof TFile && right.item instanceof TFile) {
    const field = sort.startsWith("modified") ? "mtime" : sort.startsWith("created") ? "ctime" : null;
    if (field) {
      const difference = right.item.stat[field] - left.item.stat[field];
      if (difference !== 0) return sort.endsWith("-asc") ? -difference : difference;
    }
  }
  // Like the file explorer, folders remain first in A–Z order; file names
  // compare by basename so extensions do not unexpectedly reorder equal titles.
  const leftName = left.item instanceof TFile ? left.item.basename : left.item.name;
  const rightName = right.item instanceof TFile ? right.item.basename : right.item.name;
  const names = leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: "base" });
  return sort === "name-desc" && left.item instanceof TFile && right.item instanceof TFile ? -names : names;
}
