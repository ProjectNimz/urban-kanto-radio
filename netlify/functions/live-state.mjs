import {randomUUID,createHash} from 'node:crypto';import {getStore} from '@netlify/blobs';
import {DJ_PROFILES} from '../../station-roster.mjs';
import {json,sameOrigin,readJSON,adminConfigured,admin,equal,sessionCookie,clearCookie} from './_lib/ukr-security.mjs';
import {sendLiveNotification} from './_lib/ukr-push.mjs';
export const defaultState=()=>({isLive:false,djId:null,djName:'',photo:'',show:'',publicTitle:'',revision:null,updatedAt:null});
const getStoreForStation=()=>getStore({name:'ukr-live-state',consistency:'strong'});
export function createHandler({storeFactory=getStoreForStation,profiles=DJ_PROFILES,notify=sendLiveNotification}={}){return async (request,context={})=>{
 if(process.env.UKR_DJ_ENABLED!=='true')return json({enabled:false,...defaultState()},503);
 if(request.method==='GET'){try{return json({...defaultState(),...await storeFactory().get('current',{type:'json'}),profiles})}catch{return json({error:'Station status unavailable'},503)}}
 if(!['POST','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
 if(!sameOrigin(request))return json({error:'Origin rejected'},403);
 if(!adminConfigured())return json({error:'Controls not configured'},503);
 let payload={};if(request.method==='POST')try{payload=await readJSON(request)}catch{return json({error:'Invalid payload'},400)}
 if(payload.action==='logout')return json({ok:true},200,{'Set-Cookie':clearCookie});
 if(payload.action==='login'){
  // Netlify supplies context.ip. Without it, use one conservative shared bucket.
  const key='login/'+createHash('sha256').update(String(context.ip||'unknown')).digest('hex');
  try{
   const store=storeFactory();let allowed=false;
   for(let i=0;i<3;i++){
    const record=await store.getWithMetadata(key,{type:'json'}),prev=record?.data;
    const current=prev&&prev.until>Date.now()?prev:{count:0,until:Date.now()+900000};
    if(current.count>=5)return json({error:'Too many sign-in attempts. Try again later.'},429);
    const result=await store.setJSON(key,{count:current.count+1,until:current.until},record?.etag?{onlyIfMatch:record.etag}:{onlyIfNew:true});
    if(result.modified){allowed=true;break}
   }
   if(!allowed)return json({error:'Sign-in is busy. Try again.'},429);
  }catch{return json({error:'Sign-in protection unavailable'},503)}

  if(!equal(payload.password||'',process.env.UKR_DJ_PASSWORD))return json({error:'Not authorized'},401);
  return json({ok:true},200,{'Set-Cookie':sessionCookie()});
 }
 if(!admin(request))return json({error:'Not authorized'},401);
 const profile=profiles.find(p=>p.id===payload.djId),stop=request.method==='DELETE';
 if(!stop&&(!profile||!profile.shows?.includes(payload.show)))return json({error:'Choose a confirmed presenter and show'},400);
 try{
  const store=storeFactory();
  for(let i=0;i<3;i++){
   const current=await store.getWithMetadata('current',{type:'json'}),prev=current?.data||defaultState();
   const next=stop?defaultState():{isLive:true,djId:profile.id,djName:profile.name,photo:profile.photo||'',show:payload.show,publicTitle:`${profile.name} | ${payload.show}`};
   if(prev.isLive===next.isLive&&prev.djId===next.djId&&prev.show===next.show)return json(prev);
   next.revision=randomUUID();next.updatedAt=new Date().toISOString();
   const written=await store.setJSON('current',next,current?.etag?{onlyIfMatch:current.etag}:{onlyIfNew:true});
   if(!written.modified)continue;
   // A failed notification does not pretend the persisted broadcast state failed.
   let notifications={sent:0};if(next.isLive)try{notifications=await notify(next,{isCurrent:async()=>{const live=await store.get('current',{type:'json'});return live?.isLive&&live.revision===next.revision}})}catch{notifications={sent:0,failed:true}}
   return json({...next,notifications});
  }
  return json({error:'Status changed concurrently; refresh and retry'},409);
 }catch{return json({error:'Station status storage unavailable'},503)}
}}
export default createHandler();
