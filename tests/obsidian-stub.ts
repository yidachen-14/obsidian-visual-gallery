export const Platform = { isMobile: false, isMacOS: true };
export class TAbstractFile {
  vault!: import("obsidian").Vault;
  path: string;
  name: string;
  parent: TFolder | null;

  constructor(path = "", parent: TFolder | null = null) {
    this.path = path;
    this.name = path.split("/").at(-1) ?? path;
    this.parent = parent;
  }
}

export class TFile extends TAbstractFile {
  basename: string;
  extension: string;
  stat: { mtime: number; ctime: number; size: number };

  constructor(path = "", size = 0, parent: TFolder | null = null) {
    super(path, parent);
    const dot = this.name.lastIndexOf(".");
    this.basename = dot >= 0 ? this.name.slice(0, dot) : this.name;
    this.extension = dot >= 0 ? this.name.slice(dot + 1) : "";
    this.stat = { mtime: 1, ctime: 1, size };
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];

  constructor(path = "", parent: TFolder | null = null) {
    super(path, parent);
  }

  isRoot(): boolean {
    return this.path === "";
  }
}

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

export class FileSystemAdapter {
  constructor(private basePath = "/test-vault") {}
  getFullPath(path: string): string { return `${this.basePath}/${path}`; }
}

export class MenuItem {
  title = "";
  icon = "";
  checked: boolean | null = null;
  disabled = false;
  warning = false;
  callback: () => unknown = () => {};
  setTitle(value: string): this { this.title = value; return this; }
  setIcon(value: string): this { this.icon = value; return this; }
  setChecked(value: boolean | null): this { this.checked = value; return this; }
  setDisabled(value: boolean): this { this.disabled = value; return this; }
  setWarning(value: boolean): this { this.warning = value; return this; }
  onClick(callback: () => unknown): this { this.callback = callback; return this; }
}

export class Menu {
  items: (MenuItem | null)[] = [];
  addItem(build: (item: MenuItem) => void): this {
    const item = new MenuItem(); build(item); this.items.push(item); return this;
  }
  addSeparator(): this { this.items.push(null); return this; }
}

export class PluginSettingTab {
  containerEl = { addClass(_name: string): void {} };
  constructor(_app: unknown, _plugin: unknown) {}
  update(): void {}
}

export function getIconIds(): string[] { return ["folder", "folders", "archive", "box", "library", "book-open", "folder-heart", "folder-cog", "folder-tree", "layout-grid", "gallery-horizontal", "images", "film", "clapperboard", "palette", "home", "house", "lucide-folder", "camera", "alarm-clock"]; }
export class Modal { constructor(_app: unknown) {} open(): void {} close(): void {} }

export class Notice {
  static messages: string[] = [];
  constructor(message: string) { Notice.messages.push(message); }
}
