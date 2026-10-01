import { App, Modal, Setting, TFolder, type TAbstractFile } from "obsidian";
import { translate, type UiLanguage } from "../i18n";
import { createGalleryItem, newItemDestination, type NewItemKind } from "./ItemActions";

export class CreateItemModal extends Modal {
  constructor(app: App, private folder: TFolder, private kind: NewItemKind, private language: UiLanguage,
    private created: (item: TAbstractFile) => void) { super(app); }

  onOpen(): void {
    const t = (key: Parameters<typeof translate>[1]) => translate(this.language, key);
    this.titleEl.setText(t(this.kind === "note" ? "newNote" : this.kind === "canvas" ? "newCanvas" : "newFolder"));
    let value = t(this.kind === "note" ? "untitledNote" : this.kind === "canvas" ? "untitledCanvas" : "untitledFolder");
    const error = this.contentEl.createDiv({ cls: "visual-gallery-error" });
    error.setAttr("role", "alert");
    let busy = false;
    const submit = async () => {
      if (busy) return;
      const path = newItemDestination(this.folder, value, this.kind);
      if (!path) { error.setText(t("invalidName")); return; }
      if (this.app.vault.getAbstractFileByPath(path)) { error.setText(t("nameConflict")); return; }
      busy = true;
      try {
        const item = await createGalleryItem(this.app, this.folder, value, this.kind);
        this.close();
        this.created(item);
      } catch { error.setText(t("createFailed")); }
      finally { busy = false; }
    };
    new Setting(this.contentEl).setName(t("fileName")).addText(input => {
      input.setValue(value).onChange(next => { value = next; });
      input.inputEl.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); void submit(); }
      });
      window.setTimeout(() => { input.inputEl.focus(); input.inputEl.select(); }, 0);
    });
    new Setting(this.contentEl).addButton(button => button.setButtonText(t("cancel")).onClick(() => this.close()))
      .addButton(button => button.setButtonText(t("create")).setCta().onClick(() => void submit()));
  }

  onClose(): void { this.contentEl.empty(); }
}
