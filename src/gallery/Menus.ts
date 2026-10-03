import { Menu } from "obsidian";
import { GALLERY_FILTERS, GALLERY_SORTS, type GalleryFilter, type GallerySort } from "../browser/VaultBrowser";
import { filterLabel, sortLabel, translate, type UiLanguage } from "../i18n";
import type { NewItemKind } from "./ItemActions";

export function sortMenu(language: UiLanguage, current: GallerySort, choose: (sort: GallerySort) => void): Menu {
  const menu = new Menu();
  GALLERY_SORTS.forEach((value, index) => {
    if (index === 2 || index === 4) menu.addSeparator();
    menu.addItem(item => item.setTitle(sortLabel(language, value)).setChecked(value === current).onClick(() => choose(value)));
  });
  return menu;
}

export function filterMenu(language: UiLanguage, current: GalleryFilter, choose: (filter: GalleryFilter) => void): Menu {
  const menu = new Menu();
  for (const value of GALLERY_FILTERS) {
    menu.addItem(item => item.setTitle(filterLabel(language, value)).setChecked(value === current).onClick(() => choose(value)));
  }
  return menu;
}

export function cardMenu(language: UiLanguage, finder: boolean, revealEnabled: boolean,
  rename: (() => void) | null, remove: () => void, reveal: () => void): Menu {
  const menu = new Menu();
  if (rename) menu.addItem(item => item.setTitle(translate(language, "rename")).setIcon("pencil").onClick(rename));
  menu.addItem(item => item.setTitle(translate(language, finder ? "showInFinder" : "showInSystem"))
    .setIcon("folder-search").setDisabled(!revealEnabled).onClick(reveal));
  menu.addSeparator();
  menu.addItem(item => item.setTitle(translate(language, "delete")).setIcon("trash-2").setWarning(true).onClick(remove));
  return menu;
}

export function creationMenu(language: UiLanguage, create: (kind: NewItemKind) => void): Menu {
  const menu = new Menu();
  menu.addItem(item => item.setTitle(translate(language, "newNote")).setIcon("file-plus").onClick(() => create("note")));
  menu.addItem(item => item.setTitle(translate(language, "newCanvas")).setIcon("layout-dashboard").onClick(() => create("canvas")));
  menu.addItem(item => item.setTitle(translate(language, "newFolder")).setIcon("folder-plus").onClick(() => create("folder")));
  return menu;
}

export function mobileCardMenu(language: UiLanguage, count: number, actions: {
  open: () => void; selectAll: () => void; clear: () => void; move: () => void;
  rename: (() => void) | null; remove: () => void;
}): Menu {
  const menu = new Menu();
  menu.addItem(item => item.setTitle(translate(language, "open")).setIcon("file").onClick(actions.open));
  menu.addItem(item => item.setTitle(translate(language, "selectAll")).setIcon("check-check").onClick(actions.selectAll));
  menu.addItem(item => item.setTitle(translate(language, "clearSelection")).setIcon("x").onClick(actions.clear));
  menu.addItem(item => item.setTitle(translate(language, "moveSelection")).setIcon("folder-input").setDisabled(count === 0).onClick(actions.move));
  if (actions.rename) menu.addItem(item => item.setTitle(translate(language, "rename")).setIcon("pencil").onClick(actions.rename!));
  menu.addSeparator();
  menu.addItem(item => item.setTitle(translate(language, "delete")).setIcon("trash-2").setWarning(true).onClick(actions.remove));
  return menu;
}
