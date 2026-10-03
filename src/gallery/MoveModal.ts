import { Modal, Setting, TFolder, type App } from "obsidian";
import { translate, type UiLanguage } from "../i18n";
/** Navigate the vault tree without a desktop path picker or unbounded folder list. */
export class MoveModal extends Modal {
  private folder: TFolder;
  private busy = false;
  constructor(app: App, private language: UiLanguage, private allowed: (folder: TFolder) => boolean,
    private move: (folder: TFolder) => Promise<boolean>) { super(app); this.folder = app.vault.getRoot(); }
  onOpen(): void { this.titleEl.setText(translate(this.language, "moveTitle")); this.render(); }
  private render(): void {
    this.contentEl.empty();
    const current = this.folder.isRoot() ? this.app.vault.getName() : this.folder.path;
    new Setting(this.contentEl).setName(current).addButton(button => button.setButtonText(translate(this.language, "moveHere"))
      .setCta().setDisabled(this.busy || !this.allowed(this.folder)).onClick(() => void this.submit()));
    if (this.folder.parent) {
      const parent = this.folder.parent;
      new Setting(this.contentEl).setName("..").addButton(button => button.setIcon("arrow-up").setDisabled(this.busy)
        .setTooltip(parent.isRoot() ? this.app.vault.getName() : parent.path).onClick(() => { this.folder = parent; this.render(); }));
    }
    for (const folder of this.folder.children.filter((item): item is TFolder => item instanceof TFolder).sort((a, b) => a.name.localeCompare(b.name))) {
      new Setting(this.contentEl).setName(folder.name).addButton(button => button.setIcon("folder").setDisabled(this.busy)
        .setTooltip(translate(this.language, "open")).onClick(() => { this.folder = folder; this.render(); }));
    }
    new Setting(this.contentEl).addButton(button => button.setButtonText(translate(this.language, "cancel")).setDisabled(this.busy).onClick(() => this.close()));
  }
  private async submit(): Promise<void> {
    if (this.busy || !this.allowed(this.folder)) return;
    this.busy = true; this.render();
    try { if (await this.move(this.folder)) this.close(); }
    finally { this.busy = false; if (this.contentEl.isConnected) this.render(); }
  }
  onClose(): void { this.contentEl.empty(); }
}
