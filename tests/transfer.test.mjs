import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function worker(failed=false){
 const events={},deleted=[],added=[],store=new Map();
 const context={URL,Promise,fetch:async()=>new Response('fresh'),self:{location:{origin:'https://ukr.test'},addEventListener:(name,fn)=>events[name]=fn,clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async urls=>{if(failed)throw Error('partial install');added.push(...urls)},put:async(k,v)=>store.set(k,v)}),keys:async()=>['ukr-shell-old','ukr-shell-'+read('sw.js').match(/CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1],'other-app'],delete:async key=>deleted.push(key),match:async key=>store.get(key)}};
 vm.createContext(context);vm.runInContext(read('sw.js'),context);
 return {context,events,deleted,added,store};
}
test('independent config defaults never connect to MSR or start unprovisioned chat/push',()=>{
 const c={window:{}};vm.runInNewContext(read('station-config.js'),c);
 assert.equal(c.window.UKR_CONFIG.streamUrl,'');assert.equal(c.window.UKR_CONFIG.chat.enabled,false);assert.equal(c.window.UKR_CONFIG.chat.url,'');assert.equal(c.window.UKR_CONFIG.push.enabled,false);
 for(const name of ['station-config.js','radio-player.js','community-chat.js','performance-utils.js','sw.js','manifest.webmanifest']) assert.doesNotMatch(read(name),/manilasoundradio|clxogzpflanshmosmllr|msr-active-player|a9\.asurahosting/i);
});
test('PWA install rejects missing essentials; activation deletes only old UKR caches',async()=>{
 const broken=worker(true);let promise;broken.events.install({waitUntil:p=>promise=p});await assert.rejects(promise,/partial/);
 const w=worker();w.events.install({waitUntil:p=>promise=p});await promise;assert.ok(w.added.includes('/index.html'));
 w.events.activate({waitUntil:p=>promise=p});await promise;assert.deepEqual(w.deleted,['ukr-shell-old']);
});
test('worker excludes media, APIs, cross-origin and mutations; exact page works offline',async()=>{
 const w=worker();for(const url of ['https://ukr.test/api/dispatch','https://ukr.test/audio.mp3','https://ukr.test/.netlify/functions/live-state','https://other.test/index.html']){
 let intercepted=false;w.events.fetch({request:{url,method:'GET'},respondWith(){intercepted=true}});assert.equal(intercepted,false);
 }
 let response;w.events.fetch({request:{url:'https://ukr.test/',method:'GET'},respondWith:p=>response=p});assert.equal(await(await response).text(),'fresh');
 w.context.fetch=async()=>{throw Error('offline')};w.events.fetch({request:{url:'https://ukr.test/',method:'GET'},respondWith:p=>response=p});assert.equal(await(await response).text(),'fresh');
});
test('staged chat and helper scripts parse; anonymous identity creation remains behind enabled flag',()=>{
 for(const name of ['community-chat.js','performance-utils.js'])new vm.Script(read(name));
 assert.ok(read('community-chat.js').indexOf('if (!window.UKR_CONFIG?.chat?.enabled)')<read('community-chat.js').indexOf('await window.UKRPerformance.loadChatSdk()'));
});

test('worker rejects expired, malformed and external notification targets',async()=>{
 const w=worker();const shown=[];w.context.self.registration={showNotification:async(...args)=>shown.push(args)};
 for(const data of [{expiresAt:Date.now()-1,url:'/'},{expiresAt:Date.now()+10000,url:'https://evil.test/'},{expiresAt:Date.now()+10000,url:'http://['}])w.events.push({data:{json:()=>data},waitUntil(){throw Error('must ignore')}});
 let pending;w.events.push({data:{json:()=>({title:'Test only',body:'Fixture',url:'/',expiresAt:Date.now()+10000})},waitUntil:p=>pending=p});await pending;assert.equal(shown.length,1);assert.equal(shown[0][1].data.url,'https://ukr.test/');
});
