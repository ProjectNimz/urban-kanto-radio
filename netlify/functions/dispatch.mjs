import {XMLParser, XMLValidator} from 'fast-xml-parser';
import fallback from '../../dispatch-cache.json' with {type:'json'};
const FEED='https://daily.bandcamp.com/feed';
const LOCAL_FEED='https://www.bandwagon.asia/feeds/articles.atom';
const TTL=30*60*1000;
let cache=null,inFlight=null,retryAfter=0;
const MAX_FEED_BYTES=2_000_000;
function validateXML(xml){if(typeof xml!=='string'||Buffer.byteLength(xml)>MAX_FEED_BYTES||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Invalid or oversized feed');}
const parser=new XMLParser({ignoreAttributes:false,processEntities:true,htmlEntities:true,parseTagValue:false});
const relevant=/hip[ -]?hop|rap(?:per|ping)?\b|boom[ -]?bap|beat(?:maker|making| tape|s)\b|neo[ -]?soul|soul(?:ful)?\b|jazz|instrumental|shabazz/i;
const array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='object'?String(v?.['#text']||''):String(v||'');
export function safeImage(value){try{const u=new URL(value);return u.protocol==='https:'&&/^(?:[a-z0-9-]+\.)?bcbits\.com$/.test(u.hostname)?u.href:null;}catch{return null;}}
export function parseBandwagon(xml){
 validateXML(xml);
 const feed=parser.parse(xml)?.feed;if(!feed)throw Error('Missing Atom feed');
 const seen=new Set();return array(feed.entry).flatMap(item=>{
 const title=text(item.title).trim(),html=text(item.content||item.summary),intro=html.replace(/<[^>]*>/g,' ').slice(0,700);
 // Geographic mentions late in an international story are not enough to classify it as local.
 if(!/filipin|philippines|pinoy|manila|cebu|ben(?:&|&amp;)ben/i.test(title+' '+intro))return [];
 const link=array(item.link).find(l=>!l['@_rel']||l['@_rel']==='alternate');const url=link?.['@_href'];
 try{const u=new URL(url);if(u.protocol!=='https:'||!['www.bandwagon.asia','bandwagon.asia'].includes(u.hostname)||seen.has(url))return [];}catch{return [];}
 seen.add(url);const tags=['pinoy'];if(/release|album|single|ep\b/i.test(title))tags.push('releases');
 const image=html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
 return [{title,url,date:text(item.published||item.updated),author:text(item.author?.name)||'Bandwagon',source:'Bandwagon',tags,type:'Philippine music',image:safeImage(image),imageAlt:`Artwork accompanying ${title}`}];
 }).slice(0,12);
}
export function parseFeed(xml){
 validateXML(xml);
 const channel=parser.parse(xml)?.rss?.channel;if(!channel)throw Error('Missing RSS channel');
 const seen=new Set(),stories=[];
 for(const item of array(channel.item)){
  const title=text(item.title).trim(),url=text(item.link).trim();
  let link;try{link=new URL(url);}catch{continue;}
  if(!title||link.protocol!=='https:'||link.hostname!=='daily.bandcamp.com'||seen.has(url))continue;
  const html=text(item.description),description=html.replace(/<[^>]*>/g,' ');
  if(!relevant.test(title+' '+description))continue;
  seen.add(url);const categories=array(item.category).map(text),tags=['worldwide'];
  if(/filipin|philippines|pinoy|manila|cebu/i.test(title+' '+description))tags.push('pinoy');
  if(categories.some(c=>/release|album|review/i.test(c))||url.includes('/album-of-the-day/'))tags.push('releases');
  const match=html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  const media=array(item['media:content']).find(v=>safeImage(v?.['@_url']));
  stories.push({title,url,date:text(item.pubDate),author:text(item['dc:creator'])||'Bandcamp Daily',source:'Bandcamp Daily',tags,type:categories[0]||'Music discovery',image:safeImage(match?.[1]||media?.['@_url']),imageAlt:`Artwork accompanying ${title}`});
 }
 return stories.slice(0,18);
}
async function fetchSource(url,parse){
 const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0 (compatible; UrbanKantoRadio/1.0; RSS reader)'}});
 if(!response.ok)throw Error('Upstream unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw Error('RSS too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const xml=Buffer.concat(chunks).toString('utf8');
 return parse(xml);
}
async function refresh(){
 const sources=[{name:'Bandcamp Daily',url:FEED,parse:parseFeed},{name:'Bandwagon',url:LOCAL_FEED,parse:parseBandwagon}];
 const results=await Promise.allSettled(sources.map(s=>fetchSource(s.url,s.parse)));
 const previous=cache||fallback,seen=new Set(),stories=[],statuses=[];
 results.forEach((result,i)=>{
 const source=sources[i],ok=result.status==='fulfilled';statuses.push({name:source.name,stale:!ok});
 const items=ok?result.value:previous.stories.filter(s=>s.source===source.name);
 for(const item of items){if(!seen.has(item.url)){seen.add(item.url);stories.push(item);}}
 });
 if(results.every(r=>r.status==='rejected'))throw Error('Feeds unavailable');
 stories.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
 cache={stories:stories.slice(0,30),updatedAt:new Date().toISOString(),stale:statuses.some(s=>s.stale),sources:statuses};return cache;
}
export default async function handler(request){
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 let data;
 try{
  if(Date.now()<retryAfter)data={...(cache||fallback),stale:true};
  else if(cache&&Date.now()-Date.parse(cache.updatedAt)<TTL)data=cache;
  else{if(!inFlight)inFlight=refresh().finally(()=>{inFlight=null;});data=await inFlight;}
 }catch{retryAfter=Date.now()+60000;data={...(cache||fallback),stale:true};}
 return Response.json(data,{headers:{'Cache-Control':'public, max-age=60','Netlify-CDN-Cache-Control':data.stale?'public, max-age=60':'public, max-age=1800, stale-while-revalidate=60','X-Content-Type-Options':'nosniff'}});
}
