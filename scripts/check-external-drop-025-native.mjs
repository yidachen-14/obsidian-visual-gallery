// Trusted Chromium pointer/key input in a real, isolated Obsidian renderer.
// This is desktop host integration, not a physical mouse hardware test.
import fs from "node:fs/promises";

const port = Number(process.argv[2] || 9237);
const mode=process.env.VG_QA_MODE||'grid';
if(!['grid','masonry','list'].includes(mode))throw Error('Invalid mode');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(target => target.type === "page" && target.url.includes("index.html"));
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
const wait = expression => evaluate(`(async()=>{for(let i=0;i<120;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,25));}throw Error(${JSON.stringify("Timed out: " + expression)});})()`);
const point = selector => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||!el.isShown())throw Error('Missing visible target');const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);

const view = `app.workspace.getLeavesOfType('visual-gallery-view')[0].view`;
const explorer = `app.workspace.getLeavesOfType('visual-gallery-explorer')[0].view`;
const { tmpdir } = await import('node:os');
const external=await fs.mkdtemp(tmpdir()+'/visual-gallery-import-025-');
let vaultRoot='',created=false;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4N8AAAAASUVORK5CYII=','base64');
const records=[];
const drag = async (selector,names,loc) => {
  const position=loc||await point(selector);
  const payload={...position,data:{items:[],files:names.map(n=>external+'/'+n),dragOperationsMask:1}};
  for(const type of ['dragEnter','dragOver','drop'])await send('Input.dispatchDragEvent',{type,...payload});
};
const saved=[];
try {
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  vaultRoot=await evaluate('app.vault.adapter.basePath');
  assert(typeof vaultRoot==='string'&&/visual-gallery-(?:qa|drag|explorer-)/.test(vaultRoot),'Explicitly named disposable vault required');
  assert(!await evaluate(`!!app.vault.getAbstractFileByPath('QA025')`),'QA025 already exists; preserve it and use a clean test vault');
  await evaluate(`(async()=>{await app.vault.createFolder('QA025');})()`);created=true;
  await evaluate(`(async()=>{for(const type of ['visual-gallery-explorer','visual-gallery-view'])for(const l of app.workspace.getLeavesOfType(type))await l.loadIfDeferred();await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('QA025'));})()`);
  await fs.writeFile(external+'/Baseline.png',png);
  if(process.argv.includes('--baseline')) {
    await drag('.visual-gallery-view',['Baseline.png']);
    await new Promise(r=>setTimeout(r,400));
    const exists=await evaluate(`!!app.vault.getFileByPath('QA025/Baseline.png')`);
    assert(!exists,'Baseline unexpectedly imports');
    console.log({version:await evaluate(`app.plugins.plugins['visual-gallery'].manifest.version`),baselineMissingExternalDrop:true});
  } else {
    assert(await evaluate(`app.plugins.plugins['visual-gallery'].manifest.version==='0.1.25'`),'Wrong plugin version');
    await evaluate(`${view}.changeMode('${mode}',false);void 0`);
    for(const [name,data]of [['Finder 圖片.png',png],['Finder Note.md',Buffer.from('# External note\nOriginal content\n')],['unsupported.bin',Buffer.from([0,255,1,2])],['On-card.png',png],['Crumb.png',png],['On-note.png',png]]){await fs.writeFile(external+'/'+name,data);saved.push([name,data]);}
    await drag('.visual-gallery-view',['Finder 圖片.png','Finder Note.md','unsupported.bin']);
    await wait(`['Finder 圖片.png','Finder Note.md','unsupported.bin'].every(n=>app.vault.getFileByPath('QA025/'+n))`);
    records.push('blank current folder imports all file types');
    await wait(`!!document.querySelector('.visual-gallery-card[data-item-path="QA025/Finder 圖片.png"]')`);
    await drag('.visual-gallery-card[data-item-path="QA025/Finder Note.md"] .visual-gallery-card-title',['On-note.png']);
    await wait(`!!app.vault.getFileByPath('QA025/On-note.png')`);records.push('note-card descendant falls back to current folder');
    await evaluate(`(async()=>{await app.vault.createFolder('QA025/Sub');})()`);
    await wait(`!!document.querySelector('.visual-gallery-card[data-item-path="QA025/Sub"]')`);
    await drag('.visual-gallery-card[data-item-path="QA025/Sub"] .visual-gallery-folder-icon',['On-card.png']);
    await wait(`!!app.vault.getFileByPath('QA025/Sub/On-card.png')`);
    assert(!(await evaluate(`!!app.vault.getFileByPath('QA025/On-card.png')`)),'Nested target also imported in parent');records.push('folder cover descendant imports once in child');
    await drag('.visual-gallery-card[data-item-path="QA025/Sub"] .visual-gallery-card-title',['On-card.png']);
    await wait(`app.vault.getFolderByPath('QA025/Sub').children.filter(f=>f.extension==='png').length===2`);
    const names=await evaluate(`app.vault.getFolderByPath('QA025/Sub').children.map(f=>f.name)`);records.push('native collision naming preserves both copies: '+names.join(', '));
    await evaluate(`app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('QA025/Sub'))`);
    const crumbs=await evaluate(`(()=>{const cs=[...document.querySelectorAll('.visual-gallery-crumb')],c=cs.find(c=>c.textContent==='QA025');const r=c.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await drag(null,['Crumb.png'],crumbs);await wait(`!!app.vault.getFileByPath('QA025/Crumb.png')`);
    assert(!(await evaluate(`!!app.vault.getFileByPath('QA025/Sub/Crumb.png')`)),'Breadcrumb import duplicated');records.push('ancestor breadcrumb imports once into ancestor');
    await fs.mkdir(external+'/Folder.with.dots',{recursive:true});await fs.writeFile(external+'/Folder.with.dots/Inside.md','nested original');
    await drag('.visual-gallery-view',['Folder.with.dots']);await wait(`!!app.vault.getFileByPath('QA025/Sub/Folder.with.dots/Inside.md')`);records.push('directory import preserves nested file and folder name');
    await evaluate(`app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('QA025'))`);
    await wait(`!!${explorer}.fileItems['QA025/Finder Note.md']?.selfEl.querySelector('.visual-gallery-explorer-note-tag')`);
    assert(await evaluate(`${explorer}.fileItems['QA025/Finder Note.md'].selfEl.querySelectorAll('.visual-gallery-explorer-note-tag').length===1`),'Duplicate NOTE badges');
    await evaluate(`app.fileManager.renameFile(app.vault.getFileByPath('QA025/Finder Note.md'),'QA025/Finder Note.canvas')`);
    await wait(`!${explorer}.fileItems['QA025/Finder Note.canvas']?.selfEl.querySelector('.visual-gallery-explorer-note-tag')`);
    await evaluate(`app.fileManager.renameFile(app.vault.getFileByPath('QA025/Finder Note.canvas'),'QA025/Finder Note.md')`);
    await wait(`!!${explorer}.fileItems['QA025/Finder Note.md']?.selfEl.querySelector('.visual-gallery-explorer-note-tag')`);records.push('NOTE badge handles create and type-changing rename');
    for(const[name,data]of saved){assert((await fs.readFile(external+'/'+name)).equals(data),'External original changed: '+name);}
    for(const name of ['Finder 圖片.png','Finder Note.md','unsupported.bin'])assert((await fs.readFile(vaultRoot+'/QA025/'+name)).equals(await fs.readFile(external+'/'+name)),'Imported bytes differ: '+name);
    records.push('originals untouched; imported bytes identical');
    await evaluate(`(async()=>{await ${explorer}.fileItems.QA025.setCollapsed(false,false);${explorer}.tree.infinityScroll.invalidateAll();})()`);
    const artifacts=new URL('../artifacts/',import.meta.url);await fs.mkdir(artifacts,{recursive:true});
    for(const theme of ['light','dark']){
      await evaluate(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-${theme}');void 0`);
      const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(new URL('gallery-0.1.25-drop-'+mode+'-'+theme+'.png',artifacts),Buffer.from(shot.data,'base64'));
    }
    const result={mode,version:'0.1.25',host:'macOS Obsidian 1.14.4',trustedChromiumExternalFileDrop:true,physicalFinderDrag:false,records};
    await fs.writeFile(new URL('gallery-0.1.25-external-drop-'+mode+'.json',artifacts),JSON.stringify(result,null,2)+'\n');console.log(result);
  }
} finally {
  if(created&&!process.argv.includes('--keep'))await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getRoot());const folder=app.vault.getFolderByPath('QA025');if(folder)await app.vault.delete(folder,true);})()`).catch(()=>{});
  await fs.rm(external,{recursive:true,force:true});
  socket.close();
}
