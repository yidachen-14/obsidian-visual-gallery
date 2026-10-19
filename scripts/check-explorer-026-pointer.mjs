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
const mouse = async (position, button = "left", clickCount = 1) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...position });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...position, button, clickCount });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...position, button, clickCount });
};
const explorer = `app.workspace.getLeavesOfType('visual-gallery-explorer')[0].view`;
const gallery = `app.workspace.getLeavesOfType('visual-gallery-view')[0].view`;
const folderSelector = '.visual-gallery-explorer .nav-folder-title[data-path="Projects"]';
const fileSelector = '.visual-gallery-explorer .nav-file-title[data-path="Projects/Note.md"]';
try {
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  assert(await evaluate(`app.vault.adapter.basePath.includes('visual-gallery-explorer-')`), "Disposable vault required");
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getRoot());window.vgTrustedClick=null;document.addEventListener('click',e=>{window.vgTrustedClick=e.isTrusted;},{capture:true,once:true});})()`);
  await evaluate(`(async()=>{const n=${explorer}.fileItems.Projects;if(!n.collapsed&&!n.childrenEl.isConnected){await n.setCollapsed(true,false);await n.setCollapsed(false,false);}})()`);
  // Test the reference interaction with real pointer hover, not synthetic CSS classes.
  const appearance = () => evaluate(`(()=>{const v=${explorer},n=v.fileItems.Projects;
    const visible=el=>!!el&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
    return {collapsed:n.collapsed,expanded:n.selfEl.getAttribute('aria-expanded'),
      closed:visible(n.selfEl.querySelector('.visual-gallery-explorer-folder-closed')),
      open:visible(n.selfEl.querySelector('.visual-gallery-explorer-folder-open')),
      arrow:visible(n.collapseEl.querySelector(':scope > svg')),
      transform:getComputedStyle(n.collapseEl.querySelector(':scope > svg')).transform,
      folderTransform:getComputedStyle(n.selfEl.querySelector('.visual-gallery-explorer-folder-open svg')).transform,
      total:n.selfEl.querySelector('.visual-gallery-explorer-folder-count').textContent};})()`);
  await evaluate(`(async()=>{await ${explorer}.fileItems.Projects.setCollapsed(false,false);})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:950,y:40});
  let state=await appearance();assert(state.open&&!state.closed&&!state.arrow&&state.folderTransform==='none','Open folder artwork incorrect');
  assert(state.total==='5','Recursive folder total incorrect');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...await point(folderSelector+' .tree-item-inner')});
  state=await appearance();assert(state.arrow&&!state.open&&!state.closed&&['none','matrix(1, 0, 0, 1, 0, 0)'].includes(state.transform),'Expanded hover is not a down arrow');
  await mouse(await point(folderSelector+' .collapse-icon'));
  await wait(`!${explorer}.fileItems.Projects.childrenEl.isConnected`);
  state=await appearance();assert(state.collapsed&&state.arrow&&state.transform!=='none'&&state.expanded==='false','Collapsed hover is not a right arrow');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:950,y:40});
  state=await appearance();assert(state.closed&&!state.open&&!state.arrow,'Closed folder artwork incorrect after pointer leaves');
  await evaluate(`app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Projects/Nested'),false)`);
  await mouse(await point('.visual-gallery-explorer-home'));
  await wait(`${gallery}.getState().folderPath===app.vault.getRoot().path`);
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Projects/Nested'),false);${explorer}.containerEl.querySelector('.visual-gallery-explorer-home').focus();})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`${gallery}.getState().folderPath===app.vault.getRoot().path`);
  const oldFolder = await evaluate(`${gallery}.getState().folderPath`);
  const collapsed = await evaluate(`${explorer}.fileItems.Projects.collapsed`);
  await mouse(await point(folderSelector + " .collapse-icon"));
  assert(await evaluate(`${explorer}.fileItems.Projects.collapsed`) !== collapsed, "Disclosure input failed");
  await wait(`${explorer}.fileItems.Projects.childrenEl.isConnected===${collapsed}`);
  await wait(`${explorer}.fileItems.Projects.childrenEl.style.overflowY!=='clip'`);
  assert(await evaluate(`${gallery}.getState().folderPath`) === oldFolder, "Disclosure unexpectedly navigated");
  await mouse(await point(folderSelector + " .tree-item-inner"));
  await wait(`${gallery}.getState().folderPath==='Projects'`);
  if (await evaluate(`${explorer}.fileItems.Projects.collapsed`)) {
    await wait(`!${explorer}.fileItems.Projects.childrenEl.isConnected`);
    await mouse(await point(folderSelector + " .collapse-icon"));
  }
  assert(await evaluate(`${explorer}.fileItems.Projects.collapsed`) === false, "Arrow did not expand");
  for (const closed of [false,true]) {
    await evaluate(`(async()=>{await ${explorer}.fileItems.Projects.setCollapsed(${closed},false);})()`);
    for (const part of [' .tree-item-inner',' .visual-gallery-explorer-folder-count',' .tree-item-inner']) {
      await evaluate(`app.plugins.plugins['visual-gallery'].openGallery(app.vault.getRoot(),false)`);
      await mouse(await point(folderSelector+part));
      await wait(`${gallery}.getState().folderPath==='Projects'`);
      assert(await evaluate(`${explorer}.fileItems.Projects.collapsed`)===closed, 'Folder label/count changed fold state');
      assert(await evaluate(`${explorer}.tree.selectedDoms.has(${explorer}.fileItems.Projects)`), 'Folder click did not select');
    }
    const destination=await evaluate(`${gallery}.getState().folderPath`);
    await mouse(await point(folderSelector+' .collapse-icon'));
    assert(await evaluate(`${explorer}.fileItems.Projects.collapsed`)!==closed,'Arrow did not toggle');
    assert(await evaluate(`${gallery}.getState().folderPath`)===destination,'Arrow navigated');
    await wait(`${explorer}.fileItems.Projects.childrenEl.isConnected===${closed}`);
    await wait(`${explorer}.fileItems.Projects.childrenEl.style.overflowY!=='clip'`);
  }
  await evaluate(`(async()=>{await ${explorer}.fileItems.Projects.setCollapsed(false,false);})()`);
  await mouse(await point('.visual-gallery-explorer .nav-folder-title[data-path="Other"] .tree-item-inner'));
  await wait(`${gallery}.getState().folderPath==='Other'`);
  assert(await evaluate(`${explorer}.tree.selectedDoms.has(${explorer}.fileItems.Other)`),'Empty folder did not select');
  await mouse(await point(folderSelector+' .tree-item-inner'));
  await wait(`${gallery}.getState().folderPath==='Projects'`);
  await wait(`document.querySelector(${JSON.stringify(fileSelector)})?.isShown()`);
  await wait(`${explorer}.fileItems.Projects.childrenEl.style.overflowY!=='clip'`);
  const aligned = await evaluate(`(()=>{const v=${explorer};const a=v.fileItems.Other,b=v.fileItems.Projects;return Math.abs(a.selfEl.querySelector('.tree-item-inner').getBoundingClientRect().left-b.selfEl.querySelector('.tree-item-inner').getBoundingClientRect().left)<.5&&Math.abs(a.collapseEl.getBoundingClientRect().left-b.collapseEl.getBoundingClientRect().left)<.5;})()`);
  assert(aligned,'Collapsed and expanded sibling rows are misaligned');
  const count = () => evaluate(`(()=>{let count=0;app.workspace.iterateRootLeaves(()=>{count++;});return count;})()`);
  const before = await count();
  const position = await point(fileSelector + " .tree-item-inner");
  await mouse(position);
  assert(await count() === before, "Trusted single click opened a tab");
  assert(await evaluate(`${explorer}.tree.selectedDoms.has(${explorer}.fileItems['Projects/Note.md'])`), "Trusted click did not select");
  await mouse(position, "left", 2);
  await wait(`app.workspace.activeLeaf.view.file?.path==='Projects/Note.md'`);
  assert(await count() === before + 1, "Trusted double click did not open exactly one new tab");
  assert(await evaluate("window.vgTrustedClick") === true, "Input was not trusted renderer input");
  await evaluate(`window.vgPointerMenuRef=app.workspace.on('file-menu',(menu,item,source)=>{menu.useNativeMenu=false;window.vgPointerMenuSource=source;menu.addItem(entry=>entry.setTitle('QA third-party action').onClick(()=>{window.vgPointerExtensionCalled=true;}));});void 0;`);
  await mouse(await point(fileSelector), "right");
  await wait(`!![...document.querySelectorAll('.menu-item')].find(el=>el.textContent.includes('QA third-party action'))`);
  const menuPosition = await evaluate(`(()=>{const el=[...document.querySelectorAll('.menu-item')].find(el=>el.textContent.includes('QA third-party action'));const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await mouse(menuPosition);
  assert(await evaluate("window.vgPointerExtensionCalled") === true, "Third-party menu action failed");
  assert(await evaluate("window.vgPointerMenuSource") === "file-explorer-context-menu", "Wrong menu integration source");
  await evaluate("app.workspace.offref(window.vgPointerMenuRef);void 0");
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getFolderByPath('Projects'));const v=${gallery};v.revealItem('Projects/Note.md');})()`);
  await wait(`!!document.querySelector('.visual-gallery-card.is-selected')`);
  await evaluate(`window.vg026OriginalFavorites=app.plugins.plugins['visual-gallery'].sync.favorites();window.vg026FavoriteMenuRef=app.workspace.on('file-menu',menu=>{menu.useNativeMenu=false;});void 0`);
  await evaluate(`(async()=>{const p=app.plugins.plugins['visual-gallery'];if(p.sync.favorites().includes('Projects'))await p.toggleFavorite('Projects');})()`);
  await mouse(await point(folderSelector), 'right');
  await wait(`!![...document.querySelectorAll('.menu-item')].find(el=>el.textContent===app.plugins.plugins['visual-gallery'].t('pinFolder'))`);
  await mouse(await evaluate(`(()=>{const el=[...document.querySelectorAll('.menu-item')].find(el=>el.textContent===app.plugins.plugins['visual-gallery'].t('pinFolder'));const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`));
  const favoriteSelector='.visual-gallery-explorer-favorite-row[data-path="Projects"]';
  await wait(`!!document.querySelector(${JSON.stringify(favoriteSelector)})`);
  assert(await evaluate(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(favoriteSelector+' .visual-gallery-explorer-favorite')}));return s.justifyContent==='flex-start'&&s.backgroundColor==='rgba(0, 0, 0, 0)';})()`),'Favorite shortcuts did not retain native transparent/left alignment');
  const tabCount=await count();
  await evaluate(`app.plugins.plugins['visual-gallery'].openGallery(app.vault.getRoot(),false)`);
  await mouse(await point(favoriteSelector+' .visual-gallery-explorer-favorite'));
  await wait(`${gallery}.getState().folderPath==='Projects'`);
  assert(await count()===tabCount,'Favorite pointer opened extra tab');
  await evaluate(`(async()=>{await app.plugins.plugins['visual-gallery'].openGallery(app.vault.getRoot(),false);document.querySelector(${JSON.stringify(favoriteSelector+' .visual-gallery-explorer-favorite')}).focus();})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`${gallery}.getState().folderPath==='Projects'`);
  assert(await count()===tabCount,'Favorite Enter opened native focused file');
  await evaluate(`document.querySelector(${JSON.stringify(favoriteSelector+' .visual-gallery-explorer-unpin')}).focus();void 0`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`!document.querySelector(${JSON.stringify(favoriteSelector)})`);
  assert(await count()===tabCount,'Unpin Enter opened native focused file');
  await evaluate(`(async()=>{const p=app.plugins.plugins['visual-gallery'];for(const path of ['Projects','Other'])if(!p.sync.favorites().includes(path))await p.toggleFavorite(path);})()`);
  await mouse(await point('.visual-gallery-explorer-favorites-heading'));
  assert(await evaluate(`document.querySelector('.visual-gallery-explorer-favorites-heading').getAttribute('aria-expanded')==='false'`),'Favorites collapse pointer failed');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert(await evaluate(`document.querySelector('.visual-gallery-explorer-favorites-heading').getAttribute('aria-expanded')==='true'`),'Favorites expand Enter failed');
  const artifacts = new URL("../artifacts/", import.meta.url);
  for (const mode of ["light", "dark"]) {
    await evaluate(`(async()=>{document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-${mode}');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(new URL(`gallery-0.1.26-${mode}.png`, artifacts), Buffer.from(screenshot.data, "base64"));
  }
  const sidebarSize = await evaluate(`(()=>{const v=${explorer};return {width:v.containerEl.style.width};})()`);
  for (const width of [180,250,360]) {
    await evaluate(`(async()=>{const v=${explorer};v.containerEl.style.width='${width}px';v.tree.infinityScroll.invalidateAll();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    assert(await evaluate(`(()=>{const v=${explorer},home=v.containerEl.querySelector('.visual-gallery-explorer-home'),r=v.containerEl.getBoundingClientRect(),hr=home.getBoundingClientRect();return hr.right<=r.right+.5&&home.scrollWidth<=home.clientWidth+1;})()`),'Home overflows narrow sidebar');
    assert(await evaluate(`(()=>{const v=${explorer};return ['Other','Projects','Projects/Nested'].every(p=>{const n=v.fileItems[p],c=n.selfEl.querySelector('.visual-gallery-explorer-folder-count');return !n.selfEl.isShown()||c.getBoundingClientRect().right<=n.selfEl.getBoundingClientRect().right+.5;});})()`),'Folder count overflows narrow sidebar');
  }
  await evaluate(`(async()=>{const v=${explorer};v.containerEl.style.width='250px';v.tree.infinityScroll.invalidateAll();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  for (const mode of ['light','dark']) {
    await evaluate(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-${mode}');void 0`);
    for (const open of [false,true]) for (const hover of [false,true]) {
      await evaluate(`(async()=>{await ${explorer}.fileItems.Projects.setCollapsed(${!open},false);})()`);
      if (hover) await send('Input.dispatchMouseEvent',{type:'mouseMoved',...await point(folderSelector+' .tree-item-inner')});
      else await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:950,y:40});
      await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const clip=await evaluate(`(()=>{const r=${explorer}.containerEl.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:Math.min(r.height,600),scale:1};})()`);
      const screenshot=await send('Page.captureScreenshot',{format:'png',clip});
      await fs.writeFile(new URL(`gallery-0.1.26-sidebar-${mode}-${open?'open':'closed'}${hover?'-hover':''}.png`,artifacts),Buffer.from(screenshot.data,'base64'));
    }
  }
  await evaluate(`(async()=>{const v=${explorer};v.containerEl.style.width=${JSON.stringify(sidebarSize.width)};await v.fileItems.Projects.setCollapsed(false,false);v.tree.infinityScroll.invalidateAll();})()`);
  const result = { host: "Obsidian 1.14.4", version: await evaluate("app.plugins.plugins['visual-gallery'].manifest.version"),
    trustedRendererInput: true, rendererFocusEmulated: true, physicalHardware: false, nativePinMenu: true, favoritePointer: true, favoriteKeyboard: true, unpinKeyboard: true, favoriteCollapse: true, narrowWidths: [180,250,360], disclosure: true, folderNavigation: true, folderLabelsPreserveBothFoldStates: true, countClickPreservesFolds: true, emptyFolderSelection: true,
    closedOpenFolderIcons: true, hoverRightDownArrows: true, recursiveCounts: true, vaultHomeButton: true, vaultHomeKeyboard: true,
    singleClickSelection: true, doubleClickOneNewTab: true, nativeContextSource: true, thirdPartyMenuAction: true };
  await fs.writeFile(new URL("gallery-0.1.26-pointer.json", artifacts), JSON.stringify(result, null, 2) + "\n");
  console.log(result);
} finally {
  await evaluate(`(async()=>{if(window.vg026FavoriteMenuRef)app.workspace.offref(window.vg026FavoriteMenuRef);if(window.vg026OriginalFavorites){const p=app.plugins.plugins['visual-gallery'];for(const path of p.sync.favorites())if(!window.vg026OriginalFavorites.includes(path))await p.toggleFavorite(path);for(const path of window.vg026OriginalFavorites)if(!p.sync.favorites().includes(path))await p.toggleFavorite(path);}})()`).catch(()=>{});
  await evaluate("if(window.vgPointerMenuRef)app.workspace.offref(window.vgPointerMenuRef);void 0").catch(() => {});
  socket.close();
}
