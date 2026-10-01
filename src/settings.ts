import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { GALLERY_SORTS, type GalleryFilter, type GallerySort } from "./browser/VaultBrowser";
import { LANGUAGE_OPTIONS, sortLabel, translate, validLanguage, type UiLanguage, type TranslationKey } from "./i18n";
import { FOLDER_ICONS, NAVIGATION_ICONS, renderGalleryIcon } from "./gallery/Icons";
import type { VisualGallerySettings } from "./SettingsModel";
export { DEFAULT_SETTINGS, type VisualGallerySettings } from "./SettingsModel";

export class VisualGallerySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly getSettings: () => VisualGallerySettings,
    private readonly updateSettings: (settings: VisualGallerySettings) => Promise<void>,
    private readonly cachePath: string,
    private readonly clearCache: () => Promise<void>,
  ) {
    super(app, plugin);
  }

  display(): void {
    const settings = this.getSettings();
    const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);
    const save = (patch: Partial<VisualGallerySettings>) => this.updateSettings({
      ...this.getSettings(),
      ...patch,
    });
    this.containerEl.empty();
    this.containerEl.addClass("visual-gallery-settings");
    const heading = (key: TranslationKey) => {
      const row = new Setting(this.containerEl).setName(t(key)).setHeading();
      row.settingEl.dataset.section = key;
    };
    heading("sectionInterface");

    new Setting(this.containerEl)
      .setName(t("settingLanguage"))
      .setDesc(t("settingLanguageDesc"))
      .addDropdown((dropdown) => dropdown
        .addOptions(LANGUAGE_OPTIONS)
        .setValue(settings.language)
        .onChange((value) => void save({ language: validLanguage(value) }).then(() => this.display())));

    new Setting(this.containerEl).setName(t("settingTitle")).setDesc(t("settingTitleDesc"))
      .addText(input => input.setPlaceholder(t("viewTitle")).setValue(settings.galleryTitle)
        .onChange(value => void save({ galleryTitle: value })));

    heading("sectionLayout");
    new Setting(this.containerEl)
      .setName(t("settingCardWidth"))
      .setDesc(t("settingCardWidthDesc"))
      .addSlider(slider => slider.setLimits(190, 360, 10).setValue(settings.cardWidth)
        .setDynamicTooltip().onChange(value => void save({ cardWidth: value })));

    new Setting(this.containerEl)
      .setName(t("settingMetadata"))
      .setDesc(t("settingMetadataDesc"))
      .addToggle(toggle => toggle.setValue(settings.showMetadata)
        .onChange(value => void save({ showMetadata: value })));

    heading("sectionBrowsing");
    new Setting(this.containerEl)
      .setName(t("settingDefaultFilter"))
      .setDesc(t("settingDefaultFilterDesc"))
      .addDropdown(dropdown => dropdown.addOptions({
        all: t("filterAll"), canvas: t("filterCanvas"), notes: t("filterNotes"),
        images: t("filterImages"), pdf: t("filterPdf"),
      }).setValue(settings.defaultFilter)
        .onChange(value => void save({ defaultFilter: value as GalleryFilter })));

    new Setting(this.containerEl)
      .setName(t("settingDefaultSort"))
      .setDesc(t("settingDefaultSortDesc"))
      .addDropdown(dropdown => dropdown
        .addOptions(Object.fromEntries(GALLERY_SORTS.map(value => [value, sortLabel(settings.language, value)])))
        .setValue(settings.defaultSort)
        .onChange(value => void save({ defaultSort: value as GallerySort })));

    heading("sectionIcons");

    for (const [key, label, choices] of [
      ["folderIcon", "settingFolderIcon", FOLDER_ICONS],
      ["navigationIcon", "settingNavigationIcon", NAVIGATION_ICONS],
    ] as const) {
      const row = new Setting(this.containerEl).setName(t(label));
      row.settingEl.addClass("visual-gallery-icon-setting");
      const group = row.controlEl.createDiv({ cls: "visual-gallery-icon-picker" });
      group.setAttr("role", "radiogroup");
      group.setAttr("aria-label", t(label));
      const buttons: HTMLButtonElement[] = [];
      const choose = (value: string) => {
        buttons.forEach(button => {
          const selected = button.dataset.icon === value;
          button.setAttr("aria-checked", String(selected));
          button.tabIndex = selected ? 0 : -1;
        });
        void save({ [key]: value });
      };
      choices.forEach((icon, index) => {
        const button = group.createEl("button", { cls: "visual-gallery-icon-choice", attr: { type: "button", role: "radio", "aria-label": iconLabel(settings.language, icon), title: iconLabel(settings.language, icon), "aria-checked": String(icon === settings[key]) } });
        button.dataset.icon = icon;
        button.tabIndex = icon === settings[key] ? 0 : -1;
        renderGalleryIcon(button, icon);
        buttons.push(button);
        button.addEventListener("click", () => choose(icon));
        button.addEventListener("keydown", event => {
          let next: number;
          if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % choices.length;
          else if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index + choices.length - 1) % choices.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = choices.length - 1;
          else return;
          event.preventDefault();
          buttons[next]?.focus();
          choose(choices[next]!);
        });
      });
    }

    for (const [heading, colors] of [
      ["folderCoverColors", [["folderLightStart", "folderLightEnd", "lightColors"], ["folderDarkStart", "folderDarkEnd", "darkColors"]]],
      ["noteCoverColors", [["lightStart", "lightEnd", "lightColors"], ["darkStart", "darkEnd", "darkColors"]]],
    ] as const) {
      const title = new Setting(this.containerEl).setName(t(heading)).setHeading();
      title.settingEl.dataset.section = heading;
      for (const [start, end, label] of colors) {
        const row = new Setting(this.containerEl).setName(t(label)).setDesc(t("gradientDesc"))
          .addColorPicker(picker => picker.setValue(settings[start]).onChange(value => void save({ [start]: value })))
          .addColorPicker(picker => picker.setValue(settings[end]).onChange(value => void save({ [end]: value })));
        row.settingEl.addClass("visual-gallery-color-setting");
        row.controlEl.querySelectorAll("input[type=color]").forEach((input, index) => input.setAttr("aria-label", `${t(heading)} · ${t(label)}: ${t(index === 0 ? "gradientStart" : "gradientEnd")}`));
      }
    }

    heading("sectionCache");
    new Setting(this.containerEl).setName(t("cacheLocation")).setDesc(this.cachePath);
    new Setting(this.containerEl).setName(t("commandClear")).setDesc(t("cacheDesc"))
      .addButton(button => button.setButtonText(t("commandClear")).onClick(async () => {
        button.setDisabled(true);
        try { await this.clearCache(); }
        finally { button.setDisabled(false); }
      }));

  }
}

export function iconLabel(language: UiLanguage, icon: string): string {
  const keys: Record<string, TranslationKey> = {
    "legacy-folder": "iconOriginal", folder: "iconFolder", folders: "iconFolders",
    archive: "iconArchive", box: "iconBox", library: "iconLibrary", "book-open": "iconBook",
    "folder-heart": "iconHeart", "folder-cog": "iconCog", "folder-tree": "iconTree",
    "layout-grid": "iconGrid", "gallery-horizontal": "iconGallery", images: "iconImages",
    film: "iconFilm", clapperboard: "iconClapperboard", palette: "iconPalette", home: "iconHome",
  };
  return keys[icon] ? translate(language, keys[icon]) : icon;
}
