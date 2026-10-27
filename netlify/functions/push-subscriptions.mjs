import {json,sameOrigin,readJSON} from './_lib/ukr-security.mjs';
import {pushConfigured,pushStore,subscriptionKey,validSubscription,manageToken,validManageToken} from './_lib/ukr-push.mjs';
export function createHandler(storeFactory=pushStore){return async request=>{
 if(!pushConfigured())return json({supported:false},503);
 if(request.method==='GET')return json({supported:true,publicKey:process.env.UKR_VAPID_PUBLIC_KEY});
 if(!['POST','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
 if(!sameOrigin(request))return json({error:'Origin rejected'},403);
 let body;try{body=await readJSON(request)}catch{return json({error:'Invalid payload'},400)}
 const s=body?.subscription;if(!validSubscription(s))return json({error:'Invalid subscription'},400);
 if(request.method==='DELETE'&&!validManageToken(s.endpoint,body.manageToken))return json({error:'Not authorized'},403);
 const key=subscriptionKey(s.endpoint);
 try{
  const store=storeFactory();
  if(request.method==='POST'){await store.setJSON(key,{subscription:{endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}},updatedAt:new Date().toISOString()});return json({ok:true,manageToken:manageToken(s.endpoint)})}
  if(!validManageToken(s.endpoint,body.manageToken))return json({error:'Not authorized'},403);
  await store.delete(key);return json({ok:true});
 }catch{return json({error:'Subscription storage unavailable'},503)}
}}
export default createHandler();
