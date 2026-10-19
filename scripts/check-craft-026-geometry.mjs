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




try {
  assert(await evaluate(`app.vault.adapter.basePath.includes('visual-gallery-explorer-')`),'QA vault only');
  const original=await fs.readFile(new URL('check-card-geometry.js',import.meta.url),'utf8');
  const legacy=await evaluate(original);assert(legacy.failures===0,JSON.stringify(legacy));
  const records=[];
  for(const mode of ['grid','masonry','list'])for(const font of [12,14,22]){
    const fixture=original.replace('class="visual-gallery-view"','class="visual-gallery-view is-craft"')
      .replace('class="visual-gallery-grid"','class="visual-gallery-grid" data-mode="'+mode+'"')
      .replace("view.style.setProperty('--vg-card-width', width + 'px');","view.style.setProperty('--vg-card-width', width + 'px');view.style.setProperty('--vg-title-font-size','"+font+"px');")
      .replace('const grid = view.firstElementChild;', 'const grid = view.firstElementChild;'+(mode==='list'?"grid.style.width=width+'px';":''))
      .replace("grid.append(card);", "card.style.height=(width*1.35+.375)+'px';grid.append(card);");
    const result=await evaluate(fixture);assert(result.failures===0,mode+JSON.stringify(result));records.push({mode,font,...result});
  }
  const result={host:'Obsidian 1.14.4',legacy,craft:records,fixtureOnly:true,fractionalHeights:true};
  await fs.writeFile(new URL('../artifacts/gallery-0.1.26-geometry.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{socket.close();}
