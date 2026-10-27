import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{parseFeed,parseBandwagon,safeImage} from '../netlify/functions/dispatch.mjs';
const rss=`<rss><channel><item><title>Manila hip-hop record</title><link>https://daily.bandcamp.com/album-of-the-day/test</link><description><![CDATA[<img src="https://f4.bcbits.com/img/test.jpg"><p>Filipino hip-hop</p>]]></description><category>Album of the Day</category></item><item><title>Pop song</title><link>https://daily.bandcamp.com/pop</link></item></channel></rss>`;
test('RSS extraction, relevance, photos and categories',()=>{const items=parseFeed(rss);assert.equal(items.length,1);assert.equal(items[0].image,'https://f4.bcbits.com/img/test.jpg');assert.deepEqual(items[0].tags,['worldwide','pinoy','releases']);});
test('reject unsafe image destinations and malformed XML',()=>{assert.equal(safeImage('https://bcbits.com.evil.test/a'),null);assert.equal(safeImage('javascript:alert(1)'),null);assert.throws(()=>parseFeed('<rss>'));assert.throws(()=>parseFeed('<!DOCTYPE rss><rss/>'));});
test('reject non-GET requests',async()=>{assert.equal((await handler(new Request('https://example.test/api/dispatch',{method:'POST'}))).status,405);});
test('serve fallback on outage, fresh feed on recovery, then cached feed',async()=>{
 const original=globalThis.fetch,originalNow=Date.now;try{
 globalThis.fetch=async()=>{throw Error('offline')};let response=await handler(new Request('https://example.test/api/dispatch'));assert.equal((await response.json()).stale,true);
 Date.now=()=>originalNow()+61000;
 let calls=0;globalThis.fetch=async url=>{calls++;return new Response(url.includes('bandwagon')?'<feed xmlns="http://www.w3.org/2005/Atom"></feed>':rss)};
 response=await handler(new Request('https://example.test/api/dispatch'));const data=await response.json();assert.equal(data.stale,false);assert.equal(data.stories.length,1);
 await handler(new Request('https://example.test/api/dispatch'));assert.equal(calls,2);assert.match(response.headers.get('Netlify-CDN-Cache-Control'),/1800/);
 }finally{globalThis.fetch=original;Date.now=originalNow;}
});

test('Bandwagon selects Philippine stories and excludes incidental later mentions',()=>{
 const atom=`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Manila indie release</title><link href="https://www.bandwagon.asia/articles/local" rel="alternate"/><published>2026-10-23T13:00:00+08:00</published><content>Filipino artists</content></entry><entry><title>International pop</title><link href="https://www.bandwagon.asia/articles/global"/><content>Music elsewhere</content></entry></feed>`;
 const items=parseBandwagon(atom);assert.equal(items.length,1);assert.equal(items[0].source,'Bandwagon');assert.ok(items[0].tags.includes('pinoy'));
});
