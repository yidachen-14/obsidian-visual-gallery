import { App, Modal, Setting, TAbstractFile, TFile } from "obsidian";
import { translate, type UiLanguage } from "../i18n";
import { renameDestination } from "./Rename";

export class RenameModal extends Modal {
  constructor(app: App, private item: TAbstractFile, private language: UiLanguage) { super(app); }
  onOpen(): void {
    const t = (key: Parameters<typeof translate>[1]) => translate(this.language, key);
    this.titleEl.setText(t("rename"));
    let value = this.item instanceof TFile ? this.item.basename : this.item.name;
    const error = this.contentEl.createDiv({ cls: "visual-gallery-error" });
    error.setAttr("role", "alert");
    let busy = false;
    const submit = async () => {
      if (busy) return;
      const path = renameDestination(this.item, value);
      if (!path) { error.setText(t("invalidName")); return; }
      if (path === this.item.path) { this.close(); return; }
      if (this.app.vault.getAbstractFileByPath(path)) { error.setText(t("nameConflict")); return; }
      busy = true;
      try { await this.app.fileManager.renameFile(this.item, path); this.close(); }
      catch { error.setText(t("renameFailed")); }
      finally { busy = false; }
    };
    new Setting(this.contentEl).setName(t("fileName")).setDesc(t("extensionKept")).addText(input => {
      input.setValue(value).onChange(next => { value = next; });
      input.inputEl.addEventListener("keydown", event => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); void submit(); } });
      window.setTimeout(() => { input.inputEl.focus(); input.inputEl.select(); }, 0);
    });
    new Setting(this.contentEl).addButton(button => button.setButtonText(t("cancel")).onClick(() => this.close()))
      .addButton(button => button.setButtonText(t("rename")).setCta().onClick(() => void submit()));
  }
  onClose(): void { this.contentEl.empty(); }
}
