// Trusted Chromium pointer/key input in a real, isolated Obsidian renderer.
// This is desktop host integration, not a physical mouse hardware test.
import fs from "node:fs/promises";

const port = Number(process.argv[2] || 9237);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(target => target.type === "page" && target.url.includes("index.html") && target.title.includes("visual-gallery-030-qa"));
if (!target) throw Error("No disposable Obsidian renderer");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
const pending = new Map();
let sequence = 0;
socket.addEventListener("message", event => {
  const response = JSON.parse(event.data);
  if (response.id) { pending.get(response.id)?.(response); pending.delete(response.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, response => response.error ? reject(Error(JSON.stringify(response.error))) : resolve(response.result));
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const assert = (ok, message) => { if (!ok) throw Error(message); };
const wait = expression => evaluate(`(async()=>{for(let i=0;i<600;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,25));}throw Error(${JSON.stringify("Timed out: " + expression)});})()`);
const point = selector => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||!el.isShown())throw Error('Missing visible target');const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);





const records=[];
const p="app.plugins.plugins['visual-gallery']";
const docs=`[document,${p}.settingTab.containerEl.ownerDocument]`;
const notices=`${docs}.flatMap(d=>[...d.querySelectorAll('.notice')]).map(e=>e.textContent).join(' ')`;
const row = key => `${p}.settingTab.containerEl.querySelectorAll('.setting-item')`;
try {
 assert(await evaluate(`app.vault.adapter.basePath.startsWith('/tmp/visual-gallery-explorer-030/')&&${p}.manifest.version==='0.1.30'`),'QA version only');
 await evaluate(`(async()=>{await ${p}.updateSettings({...${p}.gallerySettings,language:'en'});app.setting.open();app.setting.openTabById('visual-gallery');})()`);
 await wait(`!!${p}.settingTab.containerEl.querySelector('input')`);
 await evaluate(`(()=>{const p=${p},s=p.sync.storage;window.qa030={write:s.files.write,files:s.files,clear:p.thumbnails.clearCaches,update:p.updateSettings,failures:0};s.files.write=async function(path,value){if(path===s.directory+'/'+s.device+'.json'&&!window.qa030.failures++){throw Error('QA simulated disk busy');}return window.qa030.write.call(this,path,value);};const r=[...p.settingTab.containerEl.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent===p.t('settingTitle')),i=r.querySelector('input');i.value='Retry gallery';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait(`${notices}.includes('Could not save settings')`);
 assert(await evaluate(`${p}.gallerySettings.galleryTitle==='Retry gallery'`),'Local edit lost');
 await wait(`(async()=>{const s=${p}.sync.storage;return(await s.files.read(s.directory+'/'+s.device+'.json')).includes('Retry gallery');})()`);
 await evaluate(`window.qa030.files.write=window.qa030.write;void 0`);
 records.push({settingsWriteFailureNotice:true,localEditRetained:true,automaticRetryPersisted:true});
 await evaluate(`(()=>{const p=${p};p.thumbnails.clearCaches=async()=>{throw Error('QA simulated cache error');};const r=[...p.settingTab.containerEl.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent===p.t('commandClear'));window.qa030.cacheButton=r.querySelector('button');window.qa030.cacheButton.click();})()`);
 await wait(`${notices}.includes('Could not clear the thumbnail cache')&&!window.qa030.cacheButton.disabled`);
 await evaluate(`${p}.thumbnails.clearCaches=window.qa030.clear;window.qa030.cacheButton.click();void 0`);
 await wait(`${notices}.includes(${p}.t('cacheCleared'))&&!window.qa030.cacheButton.disabled`);
 records.push({cacheFailureNotice:true,cacheRetrySucceeded:true});
 await evaluate(`(()=>{const p=${p};p.updateSettings=async()=>{throw Error('QA icon save failed');};[...p.settingTab.containerEl.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent===p.t('settingFolderIcon')).querySelector('button').click();})()`);
 const iconDoc=`${docs}.find(d=>d.querySelector('.visual-gallery-icon-library'))`;
 await wait(`!!(${iconDoc})`);
 await evaluate(`(()=>{window.qa030.iconDoc=${iconDoc};window.qa030.iconButton=window.qa030.iconDoc.querySelector('.visual-gallery-icon-option[data-icon="lucide-camera"]')||window.qa030.iconDoc.querySelector('.visual-gallery-icon-option');window.qa030.iconButton.click();})()`);
 await wait(`window.qa030.iconDoc.querySelector('.visual-gallery-error')?.textContent.includes('Could not save settings')&&!window.qa030.iconButton.disabled`);
 await evaluate(`${p}.updateSettings=window.qa030.update;window.qa030.iconButton.click();void 0`);
 await wait(`!window.qa030.iconDoc.querySelector('.visual-gallery-icon-library')`);
 records.push({iconFailureVisible:true,iconRetrySucceeded:true});
 await evaluate(`app.setting.close();app.vault.setConfig('trashOption','local');void 0`);
 // Exercise production grouping/naming handlers with a real file move that fails halfway.
 for(const keep of [false,true]) {
  await evaluate(`(async()=>{await app.vault.create('A${keep}.md','A original');await app.vault.create('B${keep}.md','B original');const fm=app.fileManager;window.qa030.rename=fm.renameFile;window.qa030.trash=fm.trashFile;window.qa030.trashes=[];fm.renameFile=async function(file,path){if(file.path==='B${keep}.md'){if(${keep})await app.vault.create('Bundle${keep}/Keep.md','keep original');throw Error('QA move interrupted');}return window.qa030.rename.call(this,file,path);};fm.trashFile=async function(file){window.qa030.trashes.push({path:file.path,count:file.children?.length});return window.qa030.trash.call(this,file);};const v=app.workspace.getLeavesOfType('visual-gallery-view')[0].view;v.groupSelection([app.vault.getAbstractFileByPath('A${keep}.md'),app.vault.getAbstractFileByPath('B${keep}.md')]);})()`);
  await wait(`!!document.querySelector('.modal input[type=text]')`);
  await evaluate(`(()=>{const m=document.querySelector('.modal'),i=m.querySelector('input[type=text]');i.value='Bundle${keep}';i.dispatchEvent(new Event('input',{bubbles:true}));[...m.querySelectorAll('button')].find(b=>b.textContent==='Create').click();})()`);
  await wait(`document.querySelector('.modal .visual-gallery-error')?.textContent.includes('Could not finish grouping')`);
  const result=await evaluate(`(async()=>({a:await app.vault.read(app.vault.getFileByPath('A${keep}.md')),b:await app.vault.read(app.vault.getFileByPath('B${keep}.md')),trashes:window.qa030.trashes,folder:!!app.vault.getFolderByPath('Bundle${keep}'),kept:!!app.vault.getFileByPath('Bundle${keep}/Keep.md')}))()`);
  assert(result.a==='A original'&&result.b==='B original','Originals damaged');
  if(keep)assert(result.kept&&result.trashes.length===0,'New folder content lost');
  else assert(!result.folder&&result.trashes.length===1&&result.trashes[0].count===0,'Empty cleanup not using FileManager');
  records.push({groupingRollback:true,keep, ...result});
  await evaluate(`app.fileManager.renameFile=window.qa030.rename;app.fileManager.trashFile=window.qa030.trash;[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Cancel')?.click();void 0`);
 }
 const report={version:'0.1.30',host:'Obsidian 1.14.5',isolatedVault:true,productionHandlers:true,programmaticDomEvents:true,physicalHardware:false,records};
 await fs.writeFile(new URL('../artifacts/gallery-0.1.30-native.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{
 await evaluate(`(()=>{const p=${p},q=window.qa030;if(q){q.files.write=q.write;p.thumbnails.clearCaches=q.clear;p.updateSettings=q.update;if(q.rename)app.fileManager.renameFile=q.rename;if(q.trash)app.fileManager.trashFile=q.trash;}app.setting.close();})()`).catch(()=>{});socket.close();
}
