// Native names make the language picker usable even before switching locale.
// Codes match Intl locales; catalog is shared by settings, loading and QA.
export const LANGUAGE_OPTIONS = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
  uk: "Українська",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  th: "ไทย",
} as const;

export type UiLanguage = keyof typeof LANGUAGE_OPTIONS;
export const UI_LANGUAGES = Object.keys(LANGUAGE_OPTIONS) as UiLanguage[];

export function validLanguage(value: unknown): UiLanguage {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGE_OPTIONS, value) ? value as UiLanguage : "en";
}
