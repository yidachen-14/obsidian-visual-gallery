import { describe, expect, it } from "vitest";
import { toolbarDefinitions, TOOLBAR_ACTIONS } from "../src/gallery/Toolbar";
import { GALLERY_FILTERS, GALLERY_SORTS } from "../src/browser/VaultBrowser";
import { UI_LANGUAGES, translate, filterLabel, sortLabel } from "../src/i18n";

describe("three icon-only toolbar actions with one shared creation menu", () => {
  it.each(UI_LANGUAGES)("preserves action order and translated current state in %s", language => {
    for (const filter of GALLERY_FILTERS) for (const sort of GALLERY_SORTS) {
      const actions = toolbarDefinitions(language, filter, sort);
      expect(actions.map(action => action.action)).toEqual(TOOLBAR_ACTIONS);
      expect(actions.map(action => action.action)).toEqual(["create", "sort", "filter"]);
      expect(actions.map(action => action.icon)).toEqual(["plus", "arrow-up-narrow-wide", "list-filter"]);
      expect(actions[0]?.label).toBe(translate(language, "create"));
      expect(actions[1]?.label).toBe(`${translate(language, "sortAria")}: ${sortLabel(language, sort)}`);
      expect(actions[2]?.label).toBe(`${translate(language, "filterAria")}: ${filterLabel(language, filter)}`);
      expect(new Set(actions.map(action => action.icon)).size).toBe(3);
    }
  });
});
