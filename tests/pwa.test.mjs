import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../pwa.js',import.meta.url),'utf8');
function fixture(){
 const events={},clicks={},nodes=[],button={hidden:true,addEventListener:(n,f)=>clicks[n]=f},help={hidden:false};
 const context={window:{frameElement:null,isSecureContext:false,addEventListener:(n,f)=>events[n]=f},navigator:{onLine:true},matchMedia:()=>({matches:false}),document:{querySelector:s=>s==='#installApp'?button:s==='#pwaInstall'?help:s==='header'?{after:n=>nodes.push(n)}:null,createElement:()=>({setAttribute(){}})}};
 vm.runInNewContext(source,context);return {context,events,clicks,nodes,button,help};
}
test('native install opens only after an explicit click and cannot reuse a consumed prompt',async()=>{
 const f=fixture();let prompted=0,prevented=0;assert.equal(f.button.hidden,true);
 f.events.beforeinstallprompt({preventDefault(){prevented++},async prompt(){prompted++},userChoice:Promise.resolve({outcome:'dismissed'})});
 assert.equal(prevented,1);assert.equal(f.button.hidden,false);assert.equal(prompted,0);
 await f.clicks.click();await f.clicks.click();assert.equal(prompted,1);assert.equal(f.button.hidden,true);
 f.events.appinstalled();assert.equal(f.help.hidden,true);
});
test('offline notice is announced once and hides when the connection returns',()=>{
 const f=fixture();f.context.navigator.onLine=false;f.events.offline();f.events.offline();assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].hidden,false);
 f.context.navigator.onLine=true;f.events.online();assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].hidden,true);
});
