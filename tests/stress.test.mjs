import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const rss='<rss><channel><item><title>Independent hip-hop</title><link>https://daily.bandcamp.com/features/stress</link><description>jazz rap</description></item></channel></rss>';
const atom='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Manila indie artists</title><link href="https://www.bandwagon.asia/articles/stress"/><content>Filipino music</content></entry></feed>';
const request=()=>new Request('https://example.test/api/dispatch');
test('500 concurrent cold requests share two upstream fetches; 2000 warm requests reuse cache',async()=>{
 const {default:handler}=await import('../netlify/functions/dispatch.mjs?load');const original=fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;await new Promise(r=>setTimeout(r,10));return new Response(url.includes('bandwagon')?atom:rss)};
 try{const start=performance.now();const responses=await Promise.all(Array.from({length:500},()=>handler(request())));
 for(const response of responses){assert.equal(response.status,200);const data=await response.json();assert.equal(data.stories.length,2);assert.equal(data.stale,false);}
 assert.equal(calls,2);
 for(let batch=0;batch<20;batch++){const results=await Promise.all(Array.from({length:100},()=>handler(request())));assert.ok(results.every(r=>r.status===200));}
 assert.equal(calls,2);console.log(`Stress: 2500 handler requests, ${calls} upstream requests, ${Math.round(performance.now()-start)} ms (local mocked upstream).`);
 }finally{globalThis.fetch=original;}
});
test('full outage: request bursts get saved data without repeated upstream retries',async()=>{
 const {default:handler}=await import('../netlify/functions/dispatch.mjs?outage');const original=fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('offline')};
 try{await Promise.all(Array.from({length:100},()=>handler(request())));for(let i=0;i<100;i++){const data=await(await handler(request())).json();assert.equal(data.stale,true);assert.ok(Array.isArray(data.stories));}assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
test('partial outage preserves local source while international feed updates',async()=>{
 const {default:handler}=await import('../netlify/functions/dispatch.mjs?partial');const original=fetch;
 globalThis.fetch=async url=>{if(url.includes('bandwagon'))throw Error('offline');return new Response(rss)};
 try{const data=await(await handler(request())).json();assert.equal(data.stale,true);assert.ok(data.stories.some(s=>s.title==='Independent hip-hop'));assert.ok(data.sources.find(s=>s.name==='Bandwagon').stale);}finally{globalThis.fetch=original;}
});
test('oversized upstream is rejected; malformed and hostile feeds do not reach UI',async()=>{
 const {default:handler,parseFeed}=await import('../netlify/functions/dispatch.mjs?oversized');const original=fetch;
 assert.throws(()=>parseFeed('x'.repeat(2_000_001)));assert.throws(()=>parseFeed('<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>'));
 assert.equal(parseFeed('<rss><channel><item><title>hip-hop</title><link>javascript:alert(1)</link></item></channel></rss>').length,0);
 globalThis.fetch=async()=>new Response('x'.repeat(2_000_001));try{assert.equal((await(await handler(request())).json()).stale,true);}finally{globalThis.fetch=original;}
});
