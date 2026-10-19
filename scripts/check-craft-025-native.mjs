// Trusted Chromium pointer/key input in a real, isolated Obsidian renderer.
// This is desktop host integration, not a physical mouse hardware test.
import fs from "node:fs/promises";

const port = Number(process.argv[2] || 9237);
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



const view=`app.workspace.getLeavesOfType('visual-gallery-view')[0].view`;
const note='Showcase/00 — 混合標題 Sample.md';
const artifacts=new URL('../artifacts/',import.meta.url);
const shot=async name=>{const result=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(new URL(name,artifacts),Buffer.from(result.data,'base64'));};
const modes=['grid','masonry','list'];
const records=[];
const switchMode=async mode=>{
  await mouse(await point('.visual-gallery-mode-button[data-mode="'+mode+'"]'));
  await wait(`${view}.mode==='${mode}'&&document.querySelectorAll('.visual-gallery-card').length===38`);
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
};
const mouse=async(position,count=1)=>{
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...position});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...position,button:'left',clickCount:count});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...position,button:'left',clickCount:count});
};
try {
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  assert(await evaluate(`app.vault.adapter.basePath.includes('visual-gallery-explorer-')`),'QA vault only');
  await send('Emulation.setDeviceMetricsOverride',{width:1380,height:960,deviceScaleFactor:1,mobile:false});
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Showcase'));${view}.pendingLocalScroll=null;${view}.contentEl.scrollTop=0;${view}.localScroll=0;})()`);
  await wait(`document.querySelectorAll('.visual-gallery-card').length===38&&document.querySelectorAll('.visual-gallery-document').length>0`);
  await evaluate(`${view}.revealItem(${JSON.stringify(note)});void 0`);
  const before=await evaluate(`${view}.getState()`);
  for(const mode of modes){
    await switchMode(mode);
    assert(await evaluate(`${view}.selection.paths.has(${JSON.stringify(note)})`),'Selection lost on switch');
    assert(await evaluate(`${view}.getState().folderPath`)===before.folderPath,'Switch changed folder');
    const boxes=await evaluate(`(()=>{const v=${view};return [...v.contentEl.querySelectorAll('.visual-gallery-card')].map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});})()`);
    if(mode==='grid')assert(new Set(boxes.map(b=>b.height.toFixed(2))).size===1,'Grid heights differ');
    if(mode==='masonry'){
      assert(new Set(boxes.map(b=>b.x.toFixed(2))).size===3,'Fractional width lost a column');
      assert(new Set(boxes.map(b=>b.height.toFixed(2))).size>1,'Masonry has no variable heights');
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.width<=b.x+.1||b.x+b.width<=a.x+.1||a.y+a.height<=b.y+.1||b.y+b.height<=a.y+.1,'Overlapping masonry cards');}
    }
    if(mode==='list')assert(new Set(boxes.map(b=>b.x.toFixed(2))).size===1,'List columns differ');
    for(const theme of ['light','dark']){
      await evaluate(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-${theme}');void 0`);
      await shot('gallery-0.1.25-'+mode+'-'+theme+'.png');
    }
    records.push({mode,selectionRetained:true,cards:boxes.length});
  }
  assert(await evaluate(`document.querySelectorAll('.visual-gallery-document table').length>0`),'Formatted table missing');
  assert(await evaluate(`document.querySelectorAll('.visual-gallery-document ul').length>0`),'Formatted list missing');
  await evaluate(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getFileByPath(${JSON.stringify(note)}));leaf.detach();await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Showcase'));})()`);
  assert(await evaluate(`!!${view}.display.viewed(${JSON.stringify(note)})`),'Last-viewed time was not recorded');
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Projects'));${view}.changeMode('masonry',false);await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Showcase'));})()`);
  assert(await evaluate(`${view}.mode==='list'`),'Folder-specific mode lost');
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Projects'));})()`);
  assert(await evaluate(`${view}.mode==='masonry'`),'Other folder mode lost');
  await evaluate(`app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Showcase'))`);
  await evaluate(`(async()=>{await app.plugins.disablePlugin('visual-gallery');await app.plugins.enablePlugin('visual-gallery');await new Promise(r=>setTimeout(r,100));await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Showcase'));})()`);
  assert(await evaluate(`${view}.mode==='list'`),'Mode not restored after plugin reload');
  assert(await evaluate(`!!${view}.display.viewed(${JSON.stringify(note)})`),'Recent state lost on reload');
  await wait(`document.querySelectorAll('.visual-gallery-card').length===38`);
  const keyPoint=await point('.visual-gallery-mode-button[data-mode="list"]');await mouse(keyPoint);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  await wait(`${view}.mode==='grid'`);
  assert(await evaluate(`document.activeElement?.dataset.mode==='grid'`),'Switcher keyboard focus lost');
  for(const viewport of [180,250,360,720,980]){
    await send('Emulation.setDeviceMetricsOverride',{width:viewport,height:850,deviceScaleFactor:1,mobile:false});
    await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const fit=await evaluate(`(()=>{const v=${view},r=v.contentEl.getBoundingClientRect(),buttons=[...v.contentEl.querySelectorAll('.visual-gallery-mode-button,.visual-gallery-toolbar-button')];return {width:r.width,visible:buttons.every(b=>{const q=b.getBoundingClientRect();return q.width>=17&&q.left>=r.left-.5&&q.right<=r.right+.5;})};})()`);
    // Sidebar itself consumes space in a full application. Collapse it for narrow pane QA.
    if(!fit.visible)await evaluate(`app.workspace.leftSplit.collapse();void 0`);
    await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    await wait(`(()=>{const v=${view},r=v.contentEl.getBoundingClientRect();return [...v.contentEl.querySelectorAll('.visual-gallery-mode-button,.visual-gallery-toolbar-button')].every(b=>{const q=b.getBoundingClientRect();return q.width>=17&&q.left>=r.left-.5&&q.right<=r.right+.5;});})()`);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`app.workspace.leftSplit.expand();void 0`);
  await evaluate(`${view}.changeMode('grid',false);void 0`);
  const result={version:'0.1.25',host:'Obsidian 1.14.4',trustedRendererInput:true,physicalHardware:false,records,formattedNotes:true,localPerFolderModes:true,lastViewed:true,pluginReload:true,keyboardSwitch:true,narrowToolbars:[180,250,360,720,980]};
  await fs.writeFile(new URL('gallery-0.1.25-native.json',artifacts),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await send('Emulation.clearDeviceMetricsOverride').catch(()=>{});socket.close();}
