import {createHash,createHmac,ECDH} from 'node:crypto';
import {getStore} from '@netlify/blobs';import webpush from 'web-push';
import {equal} from './ukr-security.mjs';
export const pushStore=()=>getStore({name:'ukr-push-subscriptions',consistency:'strong'});
export function pushConfigured(){return process.env.UKR_PUSH_ENABLED==='true'&&!!process.env.UKR_VAPID_PUBLIC_KEY&&!!process.env.UKR_VAPID_PRIVATE_KEY&&!!process.env.UKR_VAPID_SUBJECT}
export const subscriptionKey=endpoint=>createHash('sha256').update(endpoint).digest('hex');
export function validSubscription(s){try{
 if(!/^[A-Za-z0-9_-]{87}$/.test(s?.keys?.p256dh||''))return false;
 ECDH.convertKey(Buffer.from(s.keys.p256dh,'base64url'),'prime256v1');
 const url=new URL(s.endpoint);const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
 const provider=hosts.includes(url.hostname)||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.notify.windows.com');
 return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&provider&&s.endpoint.length<=2048&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||'');
}catch{return false}}
export const manageToken=endpoint=>createHmac('sha256',process.env.UKR_VAPID_PRIVATE_KEY||'').update('ukr-unsubscribe:'+endpoint).digest('base64url');
export function validManageToken(endpoint,token){return !!token&&equal(token,manageToken(endpoint))}
export async function sendLiveNotification(state,{store,send=webpush.sendNotification.bind(webpush),isCurrent=async()=>true}={}){
 if(!pushConfigured())return {sent:0,skipped:true};
 store ||= pushStore();
 webpush.setVapidDetails(process.env.UKR_VAPID_SUBJECT,process.env.UKR_VAPID_PUBLIC_KEY,process.env.UKR_VAPID_PRIVATE_KEY);
 const payload=JSON.stringify({title:`${state.djName} is live`,body:`${state.show} on Urban Kanto Radio`,url:'/',tag:'ukr-live',expiresAt:Date.now()+300000});
 let sent=0,expired=0,failed=0,visited=0;
 for await(const page of store.list({paginate:true})){
  for(let i=0;i<page.blobs.length;i+=4){
   if(visited>=1000||!await isCurrent())return {sent,expired,failed,limited:visited>=1000};
   await Promise.all(page.blobs.slice(i,i+4).map(async({key})=>{
    visited++;const record=await store.get(key,{type:'json'});if(!record?.subscription||!validSubscription(record.subscription))return;
    try{await send(record.subscription,payload,{TTL:300,urgency:'normal',timeout:10000});sent++}catch(e){if([404,410].includes(e.statusCode)){await store.delete(key);expired++}else failed++}
   }));
  }
 }
 return {sent,expired,failed};
}
