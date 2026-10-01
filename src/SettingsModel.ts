import { validSort, type GalleryFilter, type GallerySort } from "./browser/VaultBrowser";
import { FOLDER_ICONS, NAVIGATION_ICONS, validIcon } from "./gallery/Icons";
import { validLanguage, type UiLanguage } from "./languages";

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
  folderLightStart: string;
  folderLightEnd: string;
  folderDarkStart: string;
  folderDarkEnd: string;
  folderIcon: string;
  navigationIcon: string;
  appearanceDefaultsVersion: number;
}

export const DEFAULT_SETTINGS: VisualGallerySettings = {
  language: "en", cardWidth: 250, defaultFilter: "all", defaultSort: "modified",
  showMetadata: true, galleryTitle: "",
  lightStart: "#f7f7f5", lightEnd: "#eeeeeb", darkStart: "#262626", darkEnd: "#222222",
  folderLightStart: "#f7f7f5", folderLightEnd: "#eeeeeb", folderDarkStart: "#262626", folderDarkEnd: "#222222",
  folderIcon: "folder", navigationIcon: "layout-grid", appearanceDefaultsVersion: 1,
};

export function loadGallerySettings(saved: Partial<VisualGallerySettings> = {}): VisualGallerySettings {
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  settings.language = validLanguage(saved.language);
  settings.defaultSort = validSort(saved.defaultSort);
  if (saved.appearanceDefaultsVersion === undefined && saved.darkStart?.toLowerCase() === "#4a4a4a") {
    settings.darkStart = DEFAULT_SETTINGS.darkStart;
  }
  settings.appearanceDefaultsVersion = DEFAULT_SETTINGS.appearanceDefaultsVersion;
  settings.folderIcon = validIcon(saved.folderIcon, FOLDER_ICONS, DEFAULT_SETTINGS.folderIcon);
  settings.navigationIcon = validIcon(saved.navigationIcon, NAVIGATION_ICONS, DEFAULT_SETTINGS.navigationIcon);
  // Old releases shared these colors. Copy them for folders once, then retain
  // independently saved folder values on every subsequent load.
  for (const [folder, note] of COVER_COLOR_PAIRS) settings[folder] = saved[folder] ?? settings[note];
  return settings;
}

export const COVER_COLOR_PAIRS = [
  ["folderLightStart", "lightStart"], ["folderLightEnd", "lightEnd"],
  ["folderDarkStart", "darkStart"], ["folderDarkEnd", "darkEnd"],
] as const;

export const COVER_COLOR_KEYS = ["lightStart", "lightEnd", "darkStart", "darkEnd", "folderLightStart", "folderLightEnd", "folderDarkStart", "folderDarkEnd"] as const;
