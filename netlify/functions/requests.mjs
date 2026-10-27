import {randomUUID,createHash} from 'node:crypto';import {getStore} from '@netlify/blobs';
import {json,readJSON,sameOrigin,admin} from './_lib/ukr-security.mjs';
const manilaDay=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const getInbox=()=>getStore({name:'ukr-dj-inbox',consistency:'strong'});
const getLive=()=>getStore({name:'ukr-live-state',consistency:'strong'});
async function authenticate(request){
 const base=process.env.UKR_SUPABASE_URL,key=process.env.UKR_SUPABASE_PUBLIC_KEY,token=request.headers.get('authorization');
 if(!base||!key||!token?.startsWith('Bearer '))return null;
 let url;try{url=new URL(base);if(url.protocol!=='https:'||!/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)||url.username||url.password)return null}catch{return null}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{const res=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,Authorization:token},signal:controller.signal});if(!res.ok)return null;const user=await res.json();return /^[0-9a-f-]{36}$/i.test(user?.id||'')?user.id:null}finally{clearTimeout(timeout)}
}
export function createHandler({storeFactory=getInbox,liveFactory=getLive,identify=authenticate}={}){return async request=>{
 if(process.env.UKR_REQUESTS_ENABLED!=='true')return json({enabled:false},503);
 if(request.method==='GET'){
  if(!admin(request))return json({error:'Not authorized'},401);
  try{const store=storeFactory(),prefix='messages/'+manilaDay()+'/';const {blobs}=await store.list({prefix});const records=await Promise.all(blobs.sort((a,b)=>b.key.localeCompare(a.key)).slice(0,50).map(b=>store.get(b.key,{type:'json'})));return json({requests:records.filter(Boolean)})}catch{return json({error:'Inbox unavailable'},503)}
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(!sameOrigin(request))return json({error:'Origin rejected'},403);
 try{
  const userId=await identify(request);if(!userId)return json({error:'Sign in to the community first'},401);
  const live=await liveFactory().get('current',{type:'json'});if(!live?.isLive)return json({error:'Requests open during live DJ shows'},409);
  const body=await readJSON(request),kind=body.kind==='shoutout'?'shoutout':'request';
  const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
  const nickname=text(body.nickname,40),song=text(body.song,80),artist=text(body.artist,80),message=text(body.message,160);
  if(nickname.length<2||(kind==='request'&&!song)||(kind==='shoutout'&&!message))return json({error:'Complete the request fields'},400);
  const store=storeFactory(),key='rate/'+createHash('sha256').update(userId).digest('hex'),old=await store.getWithMetadata(key,{type:'json'});
  if(old?.data?.until>Date.now())return json({error:'Please wait two minutes before sending again'},429);
  const allowed=await store.setJSON(key,{until:Date.now()+120000},old?.etag?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(!allowed.modified)return json({error:'Please wait before sending again'},429);
  const createdAt=new Date().toISOString(),record={id:randomUUID(),kind,nickname,song,artist,message,djId:live.djId,createdAt};
  await store.setJSON('messages/'+manilaDay()+'/'+createdAt+'/'+record.id,record);return json({ok:true},201);
 }catch(error){return json({error:'Request could not be saved. Try again later.'},error.message?.includes('JSON')||error.message?.includes('large')?400:503)}
}}
export default createHandler();
