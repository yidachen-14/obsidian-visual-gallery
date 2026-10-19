import { Component, MarkdownRenderer, type App } from "obsidian";
import { AsyncQueue } from "../utils/AsyncQueue";
/** Bound preview work; do not expand note embeds or execute query fences. */
export function previewMarkdown(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  text = text.split(/\r?\n/).slice(0, 100).join("\n").slice(0, 8000);
  text = text.replace(/```(?:dataviewjs|dataview|tasks|query)\b[^\n]*\n[\s\S]*?(?:```|$)/gi, "");
  text = text.replace(/!\[\[([^\]]+)\]\]/g, (match, target: string) => /\.(?:png|jpe?g|gif|webp|svg|avif|bmp)(?:[|#]|$)/i.test(target) ? match : `[[${target}]]`);
  text = text.replace(/!\[([^\]]*)\]\(\s*<?(?:https?:)?\/\/[^)]+\)/gi, "$1");
  text = text.replace(/<(script|iframe|object|embed|style|video|audio)\b[\s\S]*?<\/\1\s*>/gi, "");
  text = text.replace(/<img\b[^>]*src\s*=\s*["']?(?:https?:)?\/\/[^>]*>/gi, "");
  if ((text.match(/^```/gm)?.length ?? 0) % 2) text += "\n```";
  return text.trim();
}
export class NotePreviewRenderer {
  private readonly queue = new AsyncQueue(2);
  private readonly children = new Set<Component>();
  private generation = 0;
  constructor(private readonly app: App) {}
  clear(): void { this.generation++; for (const child of this.children) child.unload(); this.children.clear(); }
  async render(markdown: string, host: HTMLElement, path: string, current: () => boolean): Promise<void> {
    const generation = this.generation;
    await this.queue.add(async () => {
      if (generation !== this.generation || !current()) return;
      const child = new Component(); child.load(); this.children.add(child);
      try {
        host.inert = true; host.setAttribute("aria-hidden", "true");
        await MarkdownRenderer.render(this.app, previewMarkdown(markdown), host, path, child);
        if (generation !== this.generation || !current()) { child.unload(); this.children.delete(child); return; }
        // Native Markdown may render interactive controls. Preview stays inert.
        host.querySelectorAll("a,input,button,textarea,select").forEach(element => element.setAttribute("tabindex", "-1"));
      } catch (error) { child.unload(); this.children.delete(child); throw error; }
    });
  }
}
