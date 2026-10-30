import { afterEach, describe, expect, it, vi } from "vitest";
import type { Setting, SettingDefinitionGroup, SettingDefinitionRender } from "obsidian";
import { Notice } from "./obsidian-stub";
import { VisualGallerySettingTab } from "../src/settings";
import { DEFAULT_SETTINGS } from "../src/SettingsModel";
import { translate } from "../src/i18n";
function tab(save: () => Promise<void>, clear: () => Promise<void> = async () => {}) {
  return new VisualGallerySettingTab({} as never, {} as never, () => ({...DEFAULT_SETTINGS,language:"zh-TW"}), save, "cache", clear);
}
function row(t: VisualGallerySettingTab, name: Parameters<typeof translate>[1]) {
  return (t.getSettingDefinitions() as SettingDefinitionGroup[]).flatMap(g=>g.items??[]).find(r=>r.name===translate("zh-TW",name)) as SettingDefinitionRender;
}
afterEach(()=>{ vi.restoreAllMocks();Notice.messages=[]; });
describe("visible settings failures",()=>{
  it("reports a rejected settings write and allows the next edit to succeed",async()=>{
    vi.spyOn(console,"error").mockImplementation(()=>{});
    const save=vi.fn().mockRejectedValueOnce(Error("disk full")).mockResolvedValue(undefined), t=tab(save);
    let change!:(value:string)=>void;
    const text={setPlaceholder(){return this;},setValue(){return this;},onChange(fn:typeof change){change=fn;return this;}};
    row(t,"settingTitle").render({addText(fn:(c:typeof text)=>void){fn(text);return this;}} as unknown as Setting,{} as never);
    expect(change("Title A")).toBeUndefined();
    await vi.waitFor(()=>expect(Notice.messages).toEqual([translate("zh-TW","settingsSaveFailed")]));
    change("Title B");await vi.waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
    expect(Notice.messages).toHaveLength(1);
  });
  it("reports a failed cache clear, restores the button and permits retry",async()=>{
    vi.spyOn(console,"error").mockImplementation(()=>{});
    const clear=vi.fn().mockRejectedValueOnce(Error("disk busy")).mockResolvedValue(undefined), t=tab(async()=>{},clear);
    let click!:()=>Promise<void>;
    const disabled:boolean[]=[],button={setButtonText(){return this;},setDisabled(value:boolean){disabled.push(value);return this;},onClick(fn:typeof click){click=fn;return this;}};
    row(t,"commandClear").render({addButton(fn:(c:typeof button)=>void){fn(button);return this;}} as unknown as Setting,{} as never);
    await click();expect(disabled).toEqual([true,false]);expect(Notice.messages).toEqual([translate("zh-TW","cacheClearFailed")]);
    await click();expect(clear).toHaveBeenCalledTimes(2);expect(disabled).toEqual([true,false,true,false]);expect(Notice.messages).toHaveLength(1);
  });
});
