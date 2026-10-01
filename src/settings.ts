import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { GALLERY_SORTS, type GalleryFilter, type GallerySort } from "./browser/VaultBrowser";
import { sortLabel, translate, type UiLanguage } from "./i18n";
import { FOLDER_ICONS, NAVIGATION_ICONS, renderGalleryIcon } from "./gallery/Icons";

export interface VisualGallerySettings {
  language: UiLanguage;
  cardWidth: number;
  defaultFilter: GalleryFilter;
  defaultSort: GallerySort;
  showMetadata: boolean;
  galleryTitle: string;
  lightStart: string;
  lightEnd: string;
  darkStart: string;
  darkEnd: string;
  folderIcon: string;
  navigationIcon: string;
  appearanceDefaultsVersion: number;
}

export const DEFAULT_SETTINGS: VisualGallerySettings = {
  language: "en",
  cardWidth: 250,
  defaultFilter: "all",
  defaultSort: "modified",
  showMetadata: true,
  galleryTitle: "",
  lightStart: "#f7f7f5",
  lightEnd: "#eeeeeb",
  darkStart: "#262626",
  darkEnd: "#222222",
  folderIcon: "folder",
  navigationIcon: "layout-grid",
  appearanceDefaultsVersion: 1,
};

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
    this.containerEl.createEl("h2", { text: t("viewTitle") });

    new Setting(this.containerEl)
      .setName(t("settingLanguage"))
      .setDesc(t("settingLanguageDesc"))
      .addDropdown((dropdown) => dropdown
        .addOptions({ en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文", ja: "日本語" })
        .setValue(settings.language)
        .onChange((value) => void save({ language: value as UiLanguage }).then(() => this.display())));

    new Setting(this.containerEl).setName(t("settingTitle")).setDesc(t("settingTitleDesc"))
      .addText(input => input.setPlaceholder(t("viewTitle")).setValue(settings.galleryTitle)
        .onChange(value => void save({ galleryTitle: value })));

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

    for (const [start, end, label] of [["lightStart", "lightEnd", "lightColors"], ["darkStart", "darkEnd", "darkColors"]] as const) {
      const row = new Setting(this.containerEl).setName(t(label)).setDesc(t("gradientDesc"))
        .addColorPicker(picker => picker.setValue(settings[start]).onChange(value => void save({ [start]: value })))
        .addColorPicker(picker => picker.setValue(settings[end]).onChange(value => void save({ [end]: value })));
      row.settingEl.addClass("visual-gallery-color-setting");
      row.controlEl.querySelectorAll("input[type=color]").forEach((input, index) => input.setAttr("aria-label", `${t(label)}: ${t(index === 0 ? "gradientStart" : "gradientEnd")}`));
    }

    new Setting(this.containerEl).setName(t("cacheLocation")).setDesc(this.cachePath);
    new Setting(this.containerEl).setName(t("commandClear")).setDesc(t("cacheDesc"))
      .addButton(button => button.setButtonText(t("commandClear")).onClick(async () => {
        button.setDisabled(true);
        try { await this.clearCache(); }
        finally { button.setDisabled(false); }
      }));

    new Setting(this.containerEl)
      .setName(t("settingCardWidth"))
      .setDesc(t("settingCardWidthDesc"))
      .addSlider((slider) => slider
        .setLimits(190, 360, 10)
        .setValue(settings.cardWidth)
        .setDynamicTooltip()
        .onChange((value) => void save({ cardWidth: value })));

    new Setting(this.containerEl)
      .setName(t("settingDefaultFilter"))
      .setDesc(t("settingDefaultFilterDesc"))
      .addDropdown((dropdown) => dropdown
        .addOptions({
          all: t("filterAll"),
          canvas: t("filterCanvas"),
          notes: t("filterNotes"),
          images: t("filterImages"),
          pdf: t("filterPdf"),
        })
        .setValue(settings.defaultFilter)
        .onChange((value) => void save({
          defaultFilter: value as GalleryFilter,
        })));

    new Setting(this.containerEl)
      .setName(t("settingDefaultSort"))
      .setDesc(t("settingDefaultSortDesc"))
      .addDropdown((dropdown) => dropdown
        .addOptions(Object.fromEntries(GALLERY_SORTS.map(value => [value, sortLabel(settings.language, value)])))
        .setValue(settings.defaultSort)
        .onChange((value) => void save({
          defaultSort: value as GallerySort,
        })));

    new Setting(this.containerEl)
      .setName(t("settingMetadata"))
      .setDesc(t("settingMetadataDesc"))
      .addToggle((toggle) => toggle
        .setValue(settings.showMetadata)
        .onChange((value) => void save({ showMetadata: value })));
  }
}

function iconLabel(language: UiLanguage, icon: string): string {
  const labels: Record<string, [string, string, string, string]> = {
    "legacy-folder": ["Original folder icon", "原版資料夾圖示", "原版文件夹图标", "従来のフォルダーアイコン"],
    folder: ["Folder", "資料夾", "文件夹", "フォルダー"],
    folders: ["Folders", "多個資料夾", "多个文件夹", "複数のフォルダー"], archive: ["Archive", "封存盒", "归档盒", "アーカイブ"],
    box: ["Box", "盒子", "盒子", "ボックス"], library: ["Library", "書庫", "书库", "ライブラリ"], "book-open": ["Open book", "書本", "书本", "本"],
    "folder-heart": ["Favorite folder", "愛心資料夾", "爱心文件夹", "お気に入りフォルダー"],
    "folder-cog": ["Folder settings", "齒輪資料夾", "齿轮文件夹", "設定フォルダー"],
    "folder-tree": ["Folder tree", "資料夾樹", "文件夹树", "フォルダーツリー"],
    "layout-grid": ["Grid", "網格", "网格", "グリッド"], "gallery-horizontal": ["Gallery", "圖庫", "图库", "ギャラリー"],
    images: ["Images", "圖片", "图片", "画像"], film: ["Film", "底片", "胶片", "フィルム"], clapperboard: ["Clapperboard", "場記板", "场记板", "カチンコ"],
    palette: ["Palette", "調色盤", "调色盘", "パレット"], home: ["Home", "首頁", "首页", "ホーム"],
  };
  return labels[icon]?.[language === "en" ? 0 : language === "zh-TW" ? 1 : language === "ja" ? 3 : 2] ?? icon;
}
