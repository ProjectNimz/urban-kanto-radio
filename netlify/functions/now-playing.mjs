import {isIP} from 'node:net';import {json,readJSON} from './_lib/ukr-security.mjs';
let cached=null,until=0,inFlight=null,retryAt=0;
export function normalize(data){const song=data?.now_playing?.song||data;const text=(v,n)=>typeof v==='string'?v.slice(0,n):'';return {show:text(data?.show,160)||'Urban Kanto Radio',artist:text(song?.artist,160),title:text(song?.title,160),artwork:text(song?.art||song?.artwork,2048)}}
export default async request=>{
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const configured=process.env.UKR_METADATA_URL;if(!configured)return json({configured:false},503);
 let url;try{url=new URL(configured);if(url.protocol!=='https:'||url.username||url.password||isIP(url.hostname)||url.hostname==='localhost'||url.hostname.endsWith('.local'))throw Error()}catch{return json({error:'Metadata source unavailable'},503)}
 if(!cached&&Date.now()<retryAt)return json({error:'Metadata temporarily unavailable'},503);
 if(cached&&Date.now()<until)return json(cached,200,{'Cache-Control':'public,max-age=10'});
 if(!inFlight)inFlight=(async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch(url,{signal:controller.signal,redirect:'error'});if(!response.ok)throw Error();const data=normalize(await readJSON(response,96000));retryAt=0;cached={...data,updatedAt:new Date().toISOString(),stale:false};until=Date.now()+10000;return cached}
  catch{retryAt=Date.now()+30000;if(cached){cached={...cached,stale:true};until=retryAt;return cached}throw Error('Metadata unavailable')}
  finally{clearTimeout(timeout);inFlight=null}
 })();
 try{return json(await inFlight)}catch{return json({error:'Metadata temporarily unavailable'},503)}
};
