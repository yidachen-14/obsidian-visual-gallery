import { validDisplayMode, type DisplayMode } from "../gallery/DisplayMode";
interface FolderDisplay { mode: DisplayMode; scroll: Partial<Record<DisplayMode, number>> }
interface DisplayData { folders: [string, FolderDisplay][]; recent: [string, number][] }
function parse(value: unknown): DisplayData {
  const data = value && typeof value === "object" ? value as Partial<DisplayData> : {};
  const folders: DisplayData["folders"] = [], recent: DisplayData["recent"] = [];
  if (Array.isArray(data.folders)) for (const entry of data.folders.slice(-500)) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || !entry[1] || typeof entry[1] !== "object") continue;
    const folder = entry[1] as FolderDisplay, scroll: FolderDisplay["scroll"] = {};
    for (const mode of ["masonry", "grid", "list"] as const) {
      const n = folder.scroll?.[mode]; if (typeof n === "number" && Number.isFinite(n)) scroll[mode] = Math.max(0, n);
    }
    folders.push([entry[0], { mode: validDisplayMode(folder.mode), scroll }]);
  }
  if (Array.isArray(data.recent)) for (const entry of data.recent.slice(-2000)) {
    if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0) recent.push([entry[0], entry[1]]);
  }
  return { folders, recent };
}
/** Device-local only. Re-read on every write so multiple gallery leaves merge. */
export class DisplayPreferences {
  constructor(private readonly read: () => unknown, private readonly write: (data: DisplayData) => void) {}
  folder(path: string): FolderDisplay { return parse(this.read()).folders.find(([key]) => key === path)?.[1] ?? { mode: "grid", scroll: {} }; }
  save(path: string, mode: DisplayMode, scrollTop: number): void {
    const data = parse(this.read()), folders = new Map(data.folders), prior = folders.get(path);
    folders.delete(path); folders.set(path, { mode, scroll: { ...prior?.scroll, [mode]: Math.max(0, scrollTop) } });
    this.write({ ...data, folders: [...folders].slice(-500) });
  }
  viewed(path: string): number | null { return new Map(parse(this.read()).recent).get(path) ?? null; }
  record(path: string, time = Date.now()): void {
    const data = parse(this.read()), recent = new Map(data.recent);
    recent.delete(path); recent.set(path, time); this.write({ ...data, recent: [...recent].slice(-2000) });
  }
  rename(oldPath: string, newPath: string): void {
    const data = parse(this.read());
    const replace = (path: string) => path === oldPath || path.startsWith(oldPath + "/") ? newPath + path.slice(oldPath.length) : path;
    this.write({ folders: data.folders.map(([path, value]) => [replace(path), value]), recent: data.recent.map(([path, value]) => [replace(path), value]) });
  }
  remove(path: string): void {
    const data = parse(this.read()), keep = ([key]: [string, unknown]) => key !== path && !key.startsWith(path + "/");
    this.write({ folders: data.folders.filter(keep), recent: data.recent.filter(keep) });
  }
}
