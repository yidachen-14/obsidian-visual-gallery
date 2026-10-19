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
const records=[];const artifacts=new URL('../artifacts/',import.meta.url);
const frame=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
try{
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 assert(await evaluate(`app.vault.adapter.basePath.includes('visual-gallery-explorer-')`),'QA vault only');
 await send('Emulation.setDeviceMetricsOverride',{width:1380,height:960,deviceScaleFactor:1,mobile:false});
 await evaluate(`(async()=>{await app.plugins.disablePlugin('visual-gallery');await app.plugins.enablePlugin('visual-gallery');await new Promise(r=>setTimeout(r,100));await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Showcase'));})()`);
 // Sorted/filter state and source anchor must survive mode changes on a long page.
 await evaluate(`${view}.sort='name';${view}.filter='all';${view}.changeMode('list',false);void 0`);
 await wait(`document.querySelectorAll('.visual-gallery-card').length===38`);
 await evaluate(`${view}.pendingLocalScroll=null;${view}.pendingAnchor=null;${view}.reflowAnchor=null;${view}.contentEl.scrollTop=1400;${view}.localScroll=1400;void 0`);await frame();
 for(const mode of ['grid','masonry','list']){
  const before=await evaluate(`(()=>{const v=${view};v.pendingLocalScroll=null;return v.captureAnchor();})()`);
  await evaluate(`${view}.changeMode('${mode}',false);void 0`);
  await wait(`document.querySelectorAll('.visual-gallery-card').length===38`);await frame();
  const after=await evaluate(`(()=>{const v=${view},c=[...v.contentEl.querySelectorAll('.visual-gallery-card')].find(c=>c.dataset.itemPath===${JSON.stringify(before?.path)});return {sort:v.sort,filter:v.filter,offset:c.getBoundingClientRect().top-v.contentEl.getBoundingClientRect().top,scroll:v.contentEl.scrollTop};})()`);
  assert(after.sort==='name'&&after.filter==='all','Sort/filter lost');
  assert(Math.abs(after.offset-before.offset)<3,'Scroll anchor lost: '+JSON.stringify({mode,before,after}));records.push({mode,anchor:true});
 }
 // Capture native hover, selected keyboard focus and native drop-target stroke.
 for(const mode of ['grid','masonry','list'])for(const theme of ['light','dark']){
  await evaluate(`(()=>{const v=${view};v.mode='${mode}';v.pendingAnchor=null;v.pendingLocalScroll=0;v.localScroll=0;v.render();document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-${theme}');})()`);
  await wait(`document.querySelectorAll('.visual-gallery-card').length===38`);await frame();
  await evaluate(`(()=>{const v=${view};v.revealItem('Showcase/00 — 混合標題 Sample.md');const c=v.contentEl.querySelector('.visual-gallery-card.is-selected');c.focus({preventScroll:true});})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...await point('.visual-gallery-card.is-folder-card')});await frame();
  const focus=await evaluate(`(()=>{const c=document.querySelector('.visual-gallery-card.is-selected'),s=getComputedStyle(c);return{outline:s.outlineStyle,before:getComputedStyle(c,'::before').boxShadow,after:getComputedStyle(c,'::after').content};})()`);
  assert(focus.outline==='none'&&['none','normal'].includes(focus.after),'Duplicate focus outline');
  let shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(new URL('gallery-0.1.26-'+mode+'-'+theme+'-focus-hover.png',artifacts),Buffer.from(shot.data,'base64'));
  await evaluate(`(()=>{const v=${view},note=v.contentEl.querySelector('.visual-gallery-card.is-selected'),folder=v.contentEl.querySelector('.visual-gallery-card.is-folder-card'),dt=new DataTransfer();note.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));folder.querySelector('.visual-gallery-folder-icon').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:420,clientY:320}));window.vgQADrag={note,dt};})()`);
  assert(await evaluate(`!!document.querySelector('.visual-gallery-card.is-drop-target')`),'Drop target not highlighted');
  shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(new URL('gallery-0.1.26-'+mode+'-'+theme+'-drop.png',artifacts),Buffer.from(shot.data,'base64'));
  await evaluate(`(()=>{const{note,dt}=window.vgQADrag;note.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));app.dragManager.onDragEnd();delete window.vgQADrag;})()`);
  records.push({mode,theme,focus:true,hover:true,drop:true});
 }
 const result={version:'0.1.26',host:'Obsidian 1.14.4',records,physicalHardware:false};
 await fs.writeFile(new URL('gallery-0.1.26-states.json',artifacts),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await send('Emulation.clearDeviceMetricsOverride').catch(()=>{});socket.close();}
