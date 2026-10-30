import { IconLibraryModal } from "./gallery/IconLibraryModal";
import { App, Notice, Plugin, PluginSettingTab, type Setting, type SettingDefinitionGroup, type SettingDefinitionItem, type SettingDefinitionRender } from "obsidian";
import { GALLERY_SORTS, type GalleryFilter, type GallerySort } from "./browser/VaultBrowser";
import { LANGUAGE_OPTIONS, sortLabel, translate, validLanguage, type UiLanguage, type TranslationKey } from "./i18n";
import { renderGalleryIcon } from "./gallery/Icons";
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

  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.getSettings();
    const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);
    const save = (patch: Partial<VisualGallerySettings>) => this.updateSettings({ ...this.getSettings(), ...patch });
    const apply = (patch: Partial<VisualGallerySettings>, after?: () => void) => {
      void save(patch).then(() => after?.()).catch(error => {
        console.error("[Visual Gallery] Settings update failed", error);
        new Notice(t("settingsSaveFailed"));
      });
    };
    this.containerEl?.addClass("visual-gallery-settings");
    const groups: SettingDefinitionGroup[] = [];
    let items: SettingDefinitionRender[] = [];
    const heading = (key: TranslationKey) => {
      items = [];
      groups.push({ type: "group", heading: t(key), items });
    };
    const row = (key: Parameters<typeof translate>[1], desc: Parameters<typeof translate>[1] | undefined, render: (setting: Setting) => void): SettingDefinitionRender => ({
      name: t(key), desc: desc ? t(desc) : undefined, render: setting => { render(setting); },
    });
    heading("sectionInterface");
    items.push(row("settingLanguage", "settingLanguageDesc", row => { row.addDropdown(dropdown => dropdown
      .addOptions(LANGUAGE_OPTIONS).setValue(settings.language)
      .onChange(value => apply({ language: validLanguage(value) }, () => this.update()))); }));
    items.push(row("settingTitle", "settingTitleDesc", row => { row.addText(input => input
      .setPlaceholder(t("viewTitle")).setValue(settings.galleryTitle).onChange(value => apply({ galleryTitle: value }))); }));

    items.push(row("settingHomeName", "settingHomeNameDesc", row => { row.addText(input => input
      .setPlaceholder(this.app.vault.getName()).setValue(settings.vaultHomeName).onChange(value => apply({ vaultHomeName: value }))); }));

    items.push(row("settingHeadingFontSize", "settingHeadingFontSizeDesc", row => { row.addSlider(slider => slider
      .setLimits(18, 40, 1).setValue(settings.headingFontSize).onChange(value => apply({ headingFontSize: value }))); }));

    heading("sectionLayout");
    items.push(row("settingCardWidth", "settingCardWidthDesc", row => { row.addSlider(slider => slider
      .setLimits(190, 360, 10).setValue(settings.cardWidth).onChange(value => apply({ cardWidth: value }))); }));
    items.push(row("settingTitleFontSize", "settingTitleFontSizeDesc", row => { row.addSlider(slider => slider
      .setLimits(12, 22, 1).setValue(settings.titleFontSize).onChange(value => apply({ titleFontSize: value }))); }));
    items.push(row("settingMetadata", "settingMetadataDesc", row => { row.addToggle(toggle => toggle
      .setValue(settings.showMetadata).onChange(value => apply({ showMetadata: value }))); }));

    heading("sectionBrowsing");
    items.push(row("settingDefaultFilter", "settingDefaultFilterDesc", row => { row.addDropdown(dropdown => dropdown.addOptions({
      all: t("filterAll"), canvas: t("filterCanvas"), notes: t("filterNotes"), images: t("filterImages"), pdf: t("filterPdf"),
    }).setValue(settings.defaultFilter).onChange(value => apply({ defaultFilter: value as GalleryFilter }))); }));
    items.push(row("settingDefaultSort", "settingDefaultSortDesc", row => { row.addDropdown(dropdown => dropdown
      .addOptions(Object.fromEntries(GALLERY_SORTS.map(value => [value, sortLabel(settings.language, value)])))
      .setValue(settings.defaultSort).onChange(value => apply({ defaultSort: value as GallerySort }))); }));

    heading("sectionIcons");
    for (const [key, label] of [["folderIcon", "settingFolderIcon"], ["navigationIcon", "settingNavigationIcon"]] as const) {
      items.push(row(label, undefined, row => {
        row.settingEl.addClass("visual-gallery-icon-setting");
        const preview = row.controlEl.createSpan({ cls: "visual-gallery-selected-icon", attr: { "aria-hidden": "true" } });
        renderGalleryIcon(preview, settings[key]);
        row.addButton(button => button.setButtonText(t("chooseIcon")).setTooltip(iconLabel(settings.language, settings[key]))
          .onClick(() => new IconLibraryModal(this.app, settings.language, this.getSettings()[key], async icon => {
            await save({ [key]: icon });
            this.update();
          }).open()));
      }));
    }

    for (const [section, colors] of [
      ["folderCoverColors", [["folderLightStart", "folderLightEnd", "lightColors"], ["folderDarkStart", "folderDarkEnd", "darkColors"]]],
      ["noteCoverColors", [["lightStart", "lightEnd", "lightColors"], ["darkStart", "darkEnd", "darkColors"]]],
    ] as const) {
      heading(section);
      for (const [start, end, label] of colors) items.push(row(label, "gradientDesc", row => {
        row.addColorPicker(picker => picker.setValue(settings[start]).onChange(value => apply({ [start]: value })))
          .addColorPicker(picker => picker.setValue(settings[end]).onChange(value => apply({ [end]: value })));
        row.settingEl.addClass("visual-gallery-color-setting");
        row.controlEl.querySelectorAll("input[type=color]").forEach((input, index) => input.setAttr("aria-label", `${t(section)} · ${t(label)}: ${t(index === 0 ? "gradientStart" : "gradientEnd")}`));
      }));
    }
    heading("sectionCache");
    items.push({ name: t("cacheLocation"), desc: this.cachePath, render: () => {} });
    items.push(row("commandClear", "cacheDesc", row => { row.addButton(button => button
      .setButtonText(t("commandClear")).onClick(async () => {
        button.setDisabled(true);
        try { await this.clearCache(); }
        catch (error) { console.error("[Visual Gallery] Cache cleanup failed", error); new Notice(t("cacheClearFailed")); }
        finally { button.setDisabled(false); }
      })); }));
    return groups;
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
