import { App, Modal, Setting, getIconIds } from "obsidian";
import { translate, type UiLanguage } from "../i18n";
import { renderGalleryIcon } from "./Icons";

export function matchingIcons(ids: readonly string[], query: string, language: UiLanguage): string[] {
  const needle = query.trim().toLocaleLowerCase();
  const aliases: [string, string][] = [
    ["folder", translate(language, "iconFolder")], ["house", translate(language, "iconHome")],
    ["home", translate(language, "iconHome")], ["book", translate(language, "iconBook")],
    ["image", translate(language, "iconImages")], ["film", translate(language, "iconFilm")],
    ["archive", translate(language, "iconArchive")], ["box", translate(language, "iconBox")],
  ];
  return [...new Set(ids)].filter(id => !needle || id.toLocaleLowerCase().replaceAll("-", " ").includes(needle.replaceAll("-", " "))
    || aliases.some(([prefix, label]) => id.includes(prefix) && label.toLocaleLowerCase().includes(needle)));
}

export class IconLibraryModal extends Modal {
  constructor(app: App, private readonly language: UiLanguage, private readonly selected: string, private readonly choose: (icon: string) => Promise<void>) { super(app); }
  onOpen(): void {
    const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(this.language, key, values);
    this.modalEl.addClass("visual-gallery-icon-library");
    this.titleEl.setText(t("iconLibrary"));
    const ids = [...new Set([this.selected, ...getIconIds().filter(id => id !== this.selected).sort()])];
    let query = "", results = ids, rendered = 0, busy = false;
    const searchRow = new Setting(this.contentEl).setName(t("searchIcons"));
    const viewport = this.contentEl.createDiv({ cls: "visual-gallery-icon-viewport" });
    const grid = viewport.createDiv({ cls: "visual-gallery-icon-grid", attr: { role: "listbox", "aria-label": t("iconLibrary") } });
    const more = viewport.createEl("button", { cls: "visual-gallery-icon-more", text: t("loadMoreIcons"), attr: { type: "button" } });
    const error = this.contentEl.createDiv({ cls: "visual-gallery-error", attr: { role: "alert" } });
    const append = () => {
      const end = Math.min(results.length, rendered + 120);
      for (; rendered < end; rendered++) {
        const id = results[rendered]!;
        const button = grid.createEl("button", { cls: "clickable-icon visual-gallery-icon-option", attr: {
          type: "button", role: "option", "aria-selected": String(id === this.selected),
          "aria-label": t("chooseNamedIcon", { icon: id }), title: t("chooseNamedIcon", { icon: id }),
        } });
        button.dataset.icon = id;
        button.tabIndex = rendered === 0 || id === this.selected ? 0 : -1;
        renderGalleryIcon(button, id);
        button.addEventListener("click", async () => {
          if (busy) return;
          busy = true; button.disabled = true;
          try { await this.choose(id); this.close(); }
          catch { error.setText(t("createFailed")); busy = false; button.disabled = false; }
        });
      }
      more.hidden = rendered === results.length;
    };
    const render = () => {
      results = matchingIcons(ids, query, this.language); rendered = 0; grid.empty(); viewport.scrollTop = 0; error.empty();
      if (!results.length) grid.createDiv({ cls: "visual-gallery-empty-icons", text: t("noIcons") });
      append();
    };
    searchRow.addSearch(search => {
      search.setPlaceholder(t("searchIcons")).onChange(value => { query = value; render(); });
      search.inputEl.setAttribute("aria-label", t("searchIcons"));
      search.inputEl.addEventListener("keydown", event => {
        if (event.key === "ArrowDown") { event.preventDefault(); grid.querySelector<HTMLButtonElement>("button")?.focus(); }
      });
      window.setTimeout(() => search.inputEl.focus(), 0);
    });
    more.addEventListener("click", append);
    viewport.addEventListener("scroll", () => { if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 80) append(); });
    grid.addEventListener("keydown", event => {
      const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
      const index = buttons.indexOf(grid.ownerDocument.activeElement as HTMLButtonElement);
      if (index < 0) return;
      const columns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").length);
      const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : 0;
      if (!delta && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? results.length - 1 : Math.max(0, Math.min(results.length - 1, index + delta));
      while (rendered <= next && rendered < results.length) append();
      const target = grid.querySelectorAll<HTMLButtonElement>("button")[next];
      buttons.forEach(button => { button.tabIndex = -1; });
      if (target) { target.tabIndex = 0; target.focus(); }
    });
    render();
  }
  onClose(): void { this.contentEl.empty(); }
}
