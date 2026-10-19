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




const view=`app.workspace.getLeavesOfType('visual-gallery-view')[0].view`,plugin=`app.plugins.plugins['visual-gallery']`;
const artifacts=new URL('../artifacts/',import.meta.url),records=[];
const mouse=async p=>{await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
const key=async(key,code,vk)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});};
const frame=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
const prefs=await evaluate(`({...${plugin}.gallerySettings})`);
const font=async size=>{await evaluate(`${plugin}.updateSettings({...${plugin}.gallerySettings,titleFontSize:${size}})`);await wait(`parseFloat(getComputedStyle(document.querySelector('.visual-gallery-card-title')).fontSize)===${size}`);};
try{
 assert(await evaluate(`app.vault.adapter.basePath.includes('visual-gallery-explorer-')`),'QA vault required');
 assert(await evaluate(`${plugin}.manifest.version==='0.1.26'`),'Wrong version');
 await evaluate(`if(app.setting.isOpen)app.setting.close();void 0`);
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1380,height:960,deviceScaleFactor:1,mobile:false});
 await evaluate(`(async()=>{await ${plugin}.openGallery(app.vault.getFolderByPath('Showcase'));const v=${view};v.mode='list';v.sort='name';v.pendingLocalScroll=0;v.localScroll=0;v.reflowAnchor=null;v.render();v.revealItem('Showcase/00 — 混合標題 Sample.md');})()`);
 await wait(`document.querySelectorAll('.visual-gallery-card').length===38`);
 await font(14);await frame();
 const base=await evaluate(`(()=>{const v=${view},c=document.querySelector('.visual-gallery-card:not(.is-selected)'),s=getComputedStyle(c),p=getComputedStyle(c,'::before'),surface=getComputedStyle(c.querySelector('.visual-gallery-card-surface'));return {height:c.getBoundingClientRect().height,font:getComputedStyle(c.querySelector('.visual-gallery-card-title')).fontSize,radius:s.borderRadius,stroke:p.boxShadow,shadow:s.boxShadow,background:surface.backgroundImage,heading:getComputedStyle(v.contentEl.querySelector('h2')).fontSize,headers:[...v.contentEl.querySelectorAll('.visual-gallery-column-button')].map(b=>b.dataset.column)};})()`);
 assert(base.height===56&&base.font==='14px'&&base.heading==='15px','Default type/row dimensions wrong '+JSON.stringify(base));
 assert(base.radius==='0px'&&base.stroke.includes('rgba(0, 0, 0, 0)')&&base.background==='none','List still has card baskets '+JSON.stringify(base));records.push({compactList:base});
 // Seed only this disposable library's local recency; no timestamps are faked in file metadata.
 await evaluate(`(()=>{const v=${view};v.display.remove('Showcase');for(const [n,t] of [[0,1000],[1,9000],[2,5000]])v.display.record('Showcase/'+String(n).padStart(2,'0')+' — 混合標題 Sample.md',t);})()`);
 for(const column of ['name','viewed','modified','created']){
  let prior='';
  for(let press=0;press<2;press++){
   await mouse(await point('.visual-gallery-column-button[data-column="'+column+'"]'));await frame();
   await wait(`document.querySelectorAll('.visual-gallery-card').length===38`);
   const state=await evaluate(`(()=>{const v=${view},sort=v.sort,button=v.contentEl.querySelector('.visual-gallery-column-button[data-column="${column}"]');const files=app.vault.getFolderByPath('Showcase').children.filter(f=>f.extension&&['md','svg','canvas'].includes(f.extension));const recent=v.display.recency();files.sort((a,b)=>{if(sort.startsWith('viewed')){const x=recent.get(a.path),y=recent.get(b.path);if(x===undefined&&y!==undefined)return 1;if(x!==undefined&&y===undefined)return -1;if(x!==undefined&&y!==undefined&&x!==y)return sort==='viewed'?y-x:x-y;}else if(sort.startsWith('modified')||sort.startsWith('created')){const field=sort.startsWith('modified')?'mtime':'ctime',diff=b.stat[field]-a.stat[field];if(diff)return sort.endsWith('-asc')?-diff:diff;}const names=a.basename.localeCompare(b.basename,undefined,{numeric:true,sensitivity:'base'});return sort==='name-desc'?-names:names;});return {sort,direction:button.dataset.direction,active:v.contentEl.querySelectorAll('.visual-gallery-column-button[aria-pressed="true"]').length,selection:v.selection.paths.has('Showcase/00 — 混合標題 Sample.md'),actual:[...v.contentEl.querySelectorAll('.visual-gallery-card:not(.is-folder-card)')].map(c=>c.dataset.itemPath),expected:files.map(f=>f.path)};})()`);
   assert(state.active===1&&state.selection,'Sort lost active/selection');assert(JSON.stringify(state.actual)===JSON.stringify(state.expected),'Wrong '+state.sort+' order');
   if(press)assert(state.direction!==prior,'Column did not reverse');prior=state.direction;
   records.push({column,sort:state.sort,direction:state.direction});
  }
 }
 // Enter toggles the focused column; the new control retains focus after render.
 await evaluate(`document.querySelector('.visual-gallery-column-button[data-column="name"]').focus();void 0`);
 await key('Enter','Enter',13);await frame();
 assert(await evaluate(`document.activeElement?.dataset.column==='name'`),'Header lost keyboard focus');records.push({headerKeyboard:true});

 // Opening a file updates local recency and reorders an already visible recent-first list.
 await evaluate(`(()=>{const v=${view};v.sort='viewed';v.pendingLocalScroll=0;v.localScroll=0;v.render();})()`);
 await evaluate(`(async()=>{window.vgQAOpenedLeaf=app.workspace.getLeaf('tab');await window.vgQAOpenedLeaf.openFile(app.vault.getFileByPath('Showcase/02 — 混合標題 Sample.md'));})()`);
 await wait(`document.querySelector('.visual-gallery-card:not(.is-folder-card)')?.dataset.itemPath==='Showcase/02 — 混合標題 Sample.md'`);
 assert(await evaluate(`${view}.display.viewed('Showcase/02 — 混合標題 Sample.md')>Date.now()-10000`),'Real file-open recency was not recorded');
 await evaluate(`(async()=>{window.vgQAOpenedLeaf.detach();delete window.vgQAOpenedLeaf;await ${plugin}.openGallery(app.vault.getFolderByPath('Showcase'));})()`);
 records.push({realRecencyRefresh:true});
 // Exercise the actual native settings slider with trusted arrow keys.
 await evaluate(`app.setting.open();app.setting.openTabById('visual-gallery');void 0`);

 await wait(`!!app.setting.activeTab.containerEl.querySelector('input[type=range][min="12"][max="22"]')`);
 const settingsTarget=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page'&&t.url==='about:blank');
 assert(settingsTarget,'Native settings popout not found');
 const settingsSocket=new WebSocket(settingsTarget.webSocketDebuggerUrl);await new Promise(r=>settingsSocket.addEventListener('open',r,{once:true}));
 let sid=0;const sp=new Map();settingsSocket.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id){sp.get(r.id)?.(r);sp.delete(r.id);}});
 const ss=(method,params={})=>new Promise((resolve,reject)=>{const id=++sid;sp.set(id,r=>r.error?reject(Error(JSON.stringify(r.error))):resolve(r.result));settingsSocket.send(JSON.stringify({id,method,params}));});
 try{
  await ss('Emulation.setFocusEmulationEnabled',{enabled:true});
  await ss('Runtime.evaluate',{expression:`document.querySelector('input[type=range][min="12"][max="22"]').focus();void 0`});
  for(let i=0;i<4;i++)for(const type of ['keyDown','keyUp'])await ss('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
 }finally{settingsSocket.close();}
 await wait(`${plugin}.gallerySettings.titleFontSize===18`);await evaluate(`app.setting.close();void 0`);await frame();
 for(const mode of ['grid','masonry','list'])for(const size of [12,14,22]){
  await evaluate(`${view}.changeMode('${mode}',false);void 0`);await font(size);await frame();
  const measured=await evaluate(`(()=>{const v=${view},cards=[...v.contentEl.querySelectorAll('.visual-gallery-card')];return cards.every(c=>getComputedStyle(c.querySelector('.visual-gallery-card-title')).fontSize==='${size}px'&&c.querySelector('.visual-gallery-card-details').getBoundingClientRect().height<c.getBoundingClientRect().height);})()`);
  assert(measured,'Font clipped or not applied '+mode+size);
 }
 await font(18);
 await evaluate(`(async()=>{await app.plugins.disablePlugin('visual-gallery');await app.plugins.enablePlugin('visual-gallery');await new Promise(r=>setTimeout(r,100));await ${plugin}.openGallery(app.vault.getFolderByPath('Showcase'));})()`);
 assert(await evaluate(`${plugin}.gallerySettings.titleFontSize===18`),'Font setting did not persist');await font(14);
 records.push({nativeFontSlider:true,fontRange:[12,22],allModes:true,reload:true});
 for(const metadata of [true,false]){
  await evaluate(`${plugin}.updateSettings({...${plugin}.gallerySettings,showMetadata:${metadata}})`);
  await evaluate(`${view}.changeMode('list',false);void 0`);await frame();
  assert(await evaluate(`document.querySelectorAll('.visual-gallery-column-button').length===${metadata?4:1}`),'Metadata columns incorrect');
 }
 await evaluate(`${plugin}.updateSettings({...${plugin}.gallerySettings,showMetadata:true})`);
 for(const viewport of [180,250,360,500,620,720,980]){
  await send('Emulation.setDeviceMetricsOverride',{width:viewport,height:850,deviceScaleFactor:1,mobile:false});
  if(viewport<720)await evaluate(`app.workspace.leftSplit.collapse();void 0`);
  await wait(`(()=>{const r=${view}.contentEl.getBoundingClientRect();return [...document.querySelectorAll('.visual-gallery-mode-button,.visual-gallery-toolbar-button')].every(b=>{const q=b.getBoundingClientRect();return q.left>=r.left-.5&&q.right<=r.right+.5});})()`);

  await wait(`(()=>{const v=${view},r=v.contentEl.getBoundingClientRect(),header=v.contentEl.querySelector('.visual-gallery-list-header'),buttons=[...header.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none');const expected=r.width<=320?1:r.width<=500?2:r.width<=650?3:4;return buttons.length===expected&&buttons.every(b=>{const q=b.getBoundingClientRect();return q.width>0&&q.left>=r.left-.5&&q.right<=r.right+.5;});})()`);
  assert(await evaluate(`(()=>{const v=${view},header=v.contentEl.querySelector('.visual-gallery-list-header'),dates=v.contentEl.querySelector('.visual-gallery-list-dates');return [...header.querySelectorAll('button')].filter(b=>b.dataset.column!=='name'&&getComputedStyle(b).display!=='none').every(b=>{const index={viewed:0,modified:1,created:2}[b.dataset.column];return Math.abs(b.getBoundingClientRect().left-dates.children[index].getBoundingClientRect().left)<1;});})()`),'Narrow date columns misaligned');

 }
 await send('Emulation.clearDeviceMetricsOverride');await evaluate(`app.workspace.leftSplit.expand();void 0`);
 const result={version:'0.1.26',host:'Obsidian 1.14.4',trustedRendererInput:true,physicalHardware:false,records,narrowWidths:[180,250,360,500,620,720,980]};
 await fs.writeFile(new URL('gallery-0.1.26-native.json',artifacts),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{
 await send('Emulation.clearDeviceMetricsOverride').catch(()=>{});
 await evaluate(`if(app.setting.isOpen)app.setting.close();if(window.vgQAOpenedLeaf){window.vgQAOpenedLeaf.detach();delete window.vgQAOpenedLeaf;}void 0`).catch(()=>{});
 await evaluate(`${plugin}.updateSettings(${JSON.stringify(prefs)})`).catch(()=>{});
 socket.close();
}
