import { Platform, TFolder, type App, type TFile } from "obsidian";

// The native Files view imports through this host API. Keep the private API
// boundary here, including capability checks, rather than copying vault files.
interface Attachment {
  name: string;
  extension: string;
  filepath: string;
  data: Promise<ArrayBuffer> | null;
  isDirectory?: boolean;
}
interface ImportHost extends App {
  importAttachments?(files: Attachment[], folder: TFolder): Promise<TFile[]>;
  dragManager?: { draggable: unknown };
}

function desktopPath(file: File): string {
  if (!Platform.isMobile) {
    try {
      const electron = require("electron") as { webUtils?: { getPathForFile(file: File): string } };
      const path = electron.webUtils?.getPathForFile(file);
      if (path) return path;
    } catch { /* Browser/mobile File data remains available without Electron. */ }
  }
  return (file as File & { path?: string }).path ?? "";
}

function attachments(data: DataTransfer, pathForFile: (file: File) => string): Attachment[] {
  // Snapshot protected drag data synchronously, while the drop event is active.
  const items = Array.from(data.items ?? []).filter(item => item.kind === "file");
  const files = items.length
    ? items.map(item => ({ file: item.getAsFile(), directory: item.webkitGetAsEntry?.()?.isDirectory === true }))
    : Array.from(data.files).map(file => ({ file, directory: false }));
  return files.flatMap<Attachment>(({ file, directory }) => {
    if (!file) return [];
    const filepath = pathForFile(file);
    if (directory) {
      if (!filepath) throw new Error("Directory import requires a local file path");
      return [{ name: file.name, extension: "", filepath, data: null, isDirectory: true }];
    }
    const dot = file.name.lastIndexOf(".");
    return [{ name: dot > 0 ? file.name.slice(0, dot) : file.name,
      extension: dot > 0 ? file.name.slice(dot + 1) : "", filepath, data: file.arrayBuffer() }];
  });
}

/** Share a serial import queue across all drop targets in one gallery view. */
export class ExternalFileDrop {
  private queue: Promise<void> = Promise.resolve();
  private readonly host: ImportHost;
  constructor(
    app: App,
    private readonly completed: () => void,
    private readonly failed: (error: unknown) => void,
    private readonly pathForFile: (file: File) => string = desktopPath,
  ) { this.host = app as ImportHost; }

  private current(folder: TFolder | null): folder is TFolder {
    return !!folder && (folder.isRoot() ? this.host.vault.getRoot() : this.host.vault.getAbstractFileByPath(folder.path)) === folder;
  }

  private accepts(event: DragEvent): boolean {
    return !event.defaultPrevented && !this.host.dragManager?.draggable
      && typeof this.host.importAttachments === "function" && !!event.dataTransfer
      && (Array.from(event.dataTransfer.types).includes("Files")
        || Array.from(event.dataTransfer.items ?? []).some(item => item.kind === "file"));
  }

  attach(element: HTMLElement, target: () => TFolder | null): () => void {
    const over = (event: DragEvent) => {
      if (!this.accepts(event) || !this.current(target())) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
      element.addClass("is-drop-target");
      // Keep bubbling to the host's drag manager and ghost cleanup listeners.
    };
    const leave = (event: DragEvent) => {
      if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget)) element.removeClass("is-drop-target");
    };
    const drop = (event: DragEvent) => {
      element.removeClass("is-drop-target");
      if (!this.accepts(event)) return;
      const folder = target();
      if (!this.current(folder)) return;
      event.preventDefault();
      try {
        const files = attachments(event.dataTransfer!, this.pathForFile);
        // Observe reads immediately, including batches waiting behind an import.
        const ready = Promise.all(files.map(async file => ({ ...file, data: file.data ? await file.data : null })));
        void ready.catch(() => {});
        this.queue = this.queue.then(async () => {
          const values = await ready;
          if (!this.current(folder)) throw new Error("Import destination no longer exists");
          await this.host.importAttachments!(values.map(file => ({ ...file, data: file.data ? Promise.resolve(file.data) : null })), folder);
          this.completed();
        }).catch(this.failed);
      } catch (error) { this.failed(error); }
    };
    element.addEventListener("dragenter", over);
    element.addEventListener("dragover", over);
    element.addEventListener("dragleave", leave);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragenter", over);
      element.removeEventListener("dragover", over);
      element.removeEventListener("dragleave", leave);
      element.removeEventListener("drop", drop);
      element.removeClass("is-drop-target");
    };
  }
}
