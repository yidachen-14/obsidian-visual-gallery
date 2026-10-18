import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../SettingsModel";
import { GALLERY_FILTERS, validSort, type GalleryFilter, type GallerySort } from "../browser/VaultBrowser";
export interface BrowserState { folderPath: string; filter: GalleryFilter; sort: GallerySort; scrollTop: number }
export interface LocalBrowsing {
  device: string;
  read: () => BrowserState | null;
  save: (state: BrowserState) => void;
}
export function validCardWidth(width: unknown): number {
  return typeof width === "number" && Number.isFinite(width) && width >= 180 && width <= 360 ? width : DEFAULT_SETTINGS.cardWidth;
}
export function parseBrowserState(value: unknown): BrowserState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<BrowserState>;
  if (typeof state.folderPath !== "string" || !GALLERY_FILTERS.includes(state.filter!)) return null;
  return { folderPath: state.folderPath, filter: state.filter!, sort: validSort(state.sort), scrollTop: typeof state.scrollTop === "number" && Number.isFinite(state.scrollTop) ? Math.max(0, state.scrollTop) : 0 };
}
export function localDevice(app: App): string {
  const key = "visual-gallery-device", saved: unknown = app.loadLocalStorage(key);
  if (typeof saved === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(saved)) return saved;
  // Some mobile WebViews expose getRandomValues without randomUUID.
  const device = typeof crypto.randomUUID === "function" ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  app.saveLocalStorage(key, device);
  return device;
}

/** Native Files stores folds under its separate device-local tree ID. Keep
 * its view preferences local too when Obsidian restores a synced workspace. */
export function installLocalExplorerState(app: App, view: import("../gallery/GalleryExplorer").NativeExplorer, device: string): void {
  const key = "visual-gallery-tree-state";
  const getState = view.getState.bind(view), setState = view.setState.bind(view);
  let initialized = false;
  let timer: number | null = null;
  const scrollKey = "visual-gallery-tree-scroll";
  const savedScroll: unknown = app.loadLocalStorage(scrollKey);
  let scrollTop = typeof savedScroll === "number" && Number.isFinite(savedScroll) ? Math.max(0, savedScroll) : 0;
  view.registerDomEvent(view.navFileContainerEl, "scroll", () => {
    if (!initialized || view.navFileContainerEl.clientHeight <= 0) return;
    scrollTop = view.navFileContainerEl.scrollTop;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => { timer = null; app.saveLocalStorage(scrollKey, scrollTop); }, 150);
  });
  view.register(() => {
    if (timer !== null) window.clearTimeout(timer);
    if (initialized) app.saveLocalStorage(scrollKey, scrollTop);
  });
  view.getState = () => {
    const state = getState();
    if (initialized) app.saveLocalStorage(key, state);
    return { ...state, deviceId: device };
  };
  view.setState = async (incoming, result) => {
    const state = incoming && typeof incoming === "object" ? incoming as Record<string, unknown> : {};
    const local: unknown = app.loadLocalStorage(key);
    const restore = state.deviceId !== device && local && typeof local === "object" ? local : state;
    await setState(restore, result);
    if (!initialized && typeof savedScroll === "number" && Number.isFinite(savedScroll)) {
      // The virtual tree finishes its first layout after setState resolves.
      const restoreTimer = window.setTimeout(() => { view.navFileContainerEl.scrollTop = Math.max(0, savedScroll); }, 50);
      view.register(() => window.clearTimeout(restoreTimer));
    }
    initialized = true;
    app.saveLocalStorage(key, getState());
  };
}
