import { App, Modal, Notice, Setting, TFolder, type TAbstractFile } from "obsidian";
import { translate, type UiLanguage } from "../i18n";

export class DeleteSelectionModal extends Modal {
  constructor(app: App, private readonly language: UiLanguage, private readonly items: readonly TAbstractFile[], private readonly remove: () => Promise<void>) { super(app); }
  onOpen(): void {
    const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(this.language, key, values);
    this.titleEl.setText(t("confirmDeleteTitle", { count: this.items.length }));
    this.contentEl.createEl("p", { text: t("confirmDeleteDesc", { count: this.items.length }) });
    const list = this.contentEl.createEl("ul", { cls: "visual-gallery-delete-items" });
    for (const item of this.items) list.createEl("li", { text: item.name, cls: item instanceof TFolder ? "is-folder" : "" });
    const error = this.contentEl.createDiv({ cls: "visual-gallery-error", attr: { role: "alert" } });
    let busy = false;
    new Setting(this.contentEl)
      .addButton(cancel => { cancel.setButtonText(t("cancel")).onClick(() => { if (!busy) this.close(); }); window.setTimeout(() => cancel.buttonEl.focus(), 0); })
      .addButton(button => button.setButtonText(t("delete")).setDestructive().onClick(async () => {
        if (busy) return;
        busy = true; button.setDisabled(true); error.empty();
        try { await this.remove(); this.close(); }
        catch (cause) {
          const message = cause instanceof Error ? cause.message : t("deleteFailed");
          if (this.contentEl.isConnected) error.setText(message); else new Notice(message);
        }
        finally { busy = false; button.setDisabled(false); }
      }));
  }
  onClose(): void { this.contentEl.empty(); }
}
