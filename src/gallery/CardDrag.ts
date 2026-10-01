import { TAbstractFile, TFile, TFolder, normalizePath, type App } from "obsidian";

// Obsidian's file explorer consumes this internal drag manager. Keep the
// compatibility boundary here; actual moves use the public FileManager API.
interface NativeDrag {
  type: string;
  file?: TAbstractFile;
  files?: TAbstractFile[];
}
interface NativeDragManager {
  draggable: NativeDrag | null;
  dragFile(event: DragEvent, file: TFile, source?: string): NativeDrag;
  dragFolder(event: DragEvent, folder: TFolder, source?: string): NativeDrag;
  dragFiles?(event: DragEvent, files: TAbstractFile[], source?: string): NativeDrag;
  onDragStart(event: DragEvent, drag: NativeDrag): void;
}

export function getDragManager(app: App): NativeDragManager | null {
  const manager = (app as App & { dragManager?: NativeDragManager }).dragManager;
  return manager && typeof manager.dragFile === "function" &&
    typeof manager.dragFolder === "function" && typeof manager.onDragStart === "function"
    ? manager : null;
}

export function startCardDrag(app: App, event: DragEvent, item: TAbstractFile | TAbstractFile[]): boolean {
  const manager = getDragManager(app);
  if (!manager || !event.dataTransfer) return false;
  const items = Array.isArray(item) ? item : [item];
  if (!items.length || items.some(value => !(value instanceof TFile || value instanceof TFolder))) return false;
  const first = items[0];
  const drag = items.length > 1 ? manager.dragFiles?.(event, items, "visual-gallery")
    : first instanceof TFile ? manager.dragFile(event, first, "visual-gallery")
    : manager.dragFolder(event, first as TFolder, "visual-gallery");
  if (!drag) return false;
  manager.onDragStart(event, drag);
  event.dataTransfer.effectAllowed = "move";
  return true;
}

export function draggedItem(app: App): TAbstractFile | null {
  return draggedItems(app)[0] ?? null;
}

export function draggedItems(app: App): TAbstractFile[] {
  const drag = getDragManager(app)?.draggable;
  if (!drag) return [];
  const items = drag.type === "files" ? drag.files : (drag.type === "file" || drag.type === "folder") && drag.file ? [drag.file] : [];
  // Never resolve arbitrary external paths or drag content as vault files.
  return items?.length && items.every(item => app.vault.getAbstractFileByPath(item.path) === item) ? items : [];
}

export function planCardMoves(items: TAbstractFile[], target: TFolder, exists: (path: string) => boolean):
  { moves: { item: TAbstractFile; path: string }[]; error?: never } | { error: "invalidTarget" | "nameConflict"; moves?: never } {
  const unique = [...new Set(items)];
  const roots = unique.filter(item => !unique.some(parent => parent instanceof TFolder && parent !== item && item.path.startsWith(`${parent.path}/`)));
  const moves: { item: TAbstractFile; path: string }[] = [];
  const destinations = new Set<string>();
  for (const item of roots) {
    const plan = planCardMove(item, target, path => exists(path) || destinations.has(path));
    if (plan.error === "sameFolder") continue;
    if (plan.error) return { error: plan.error };
    destinations.add(plan.path);
    moves.push({ item, path: plan.path });
  }
  return { moves };
}

export type MovePlan = { path: string; error?: never } | {
  error: "sameFolder" | "invalidTarget" | "nameConflict"; path?: never;
};

export function planCardMove(
  item: TAbstractFile,
  target: TFolder,
  exists: (path: string) => boolean,
): MovePlan {
  if (item instanceof TFolder && (item.isRoot() || item === target ||
    target.path.startsWith(`${item.path}/`))) return { error: "invalidTarget" };
  const path = normalizePath(`${target.isRoot() ? "" : target.path}/${item.name}`);
  if (path === item.path) return { error: "sameFolder" };
  if (exists(path)) return { error: "nameConflict" };
  return { path };
}
