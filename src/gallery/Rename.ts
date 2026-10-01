import { TAbstractFile, TFile, normalizePath } from "obsidian";

export function renameDestination(item: TAbstractFile, name: string): string | null {
  name = name.trim();
  if (!isValidItemName(name)) return null;
  const fullName = item instanceof TFile && item.extension ? `${name}.${item.extension}` : name;
  return normalizePath(`${item.parent?.isRoot() ? "" : item.parent?.path ?? ""}/${fullName}`);
}

export function isValidItemName(name: string): boolean {
  return !!name && name !== "." && name !== ".." && !/[\\/:*?"<>|\u0000-\u001f]/.test(name) && !name.endsWith(".");
}
