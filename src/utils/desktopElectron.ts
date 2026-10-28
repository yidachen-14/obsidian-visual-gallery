import { Platform } from "obsidian";

interface DesktopElectron {
  webUtils?: { getPathForFile(file: File): string };
  shell?: { showItemInFolder(path: string): void };
  remote?: { shell?: { showItemInFolder(path: string): void } };
}

/** Electron is exposed by the desktop host only; never import it on mobile. */
export function desktopElectron(): DesktopElectron | null {
  if (Platform.isMobile || typeof window === "undefined") return null;
  const host = window as Window & { require?: (name: "electron") => DesktopElectron };
  return host.require?.("electron") ?? null;
}
