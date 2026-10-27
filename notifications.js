(() => {
 const button=document.getElementById('pushToggle'),status=document.getElementById('pushStatus');if(!button)return;
 const config=window.UKR_CONFIG?.push;
 const say=text=>{if(status)status.textContent=text};
 if(!config?.enabled){button.disabled=true;say('Station alerts are coming soon.');return}
 if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){button.disabled=true;say('Notifications are unavailable in this browser.');return}
 const request=async(body,method='POST')=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(config.endpoint,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal});if(!response.ok)throw Error('Registration unavailable');return response.json()}finally{clearTimeout(timer)}
 };
 const keyBytes=key=>Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 let busy=false;
 button.addEventListener('click',async()=>{
  if(busy)return;busy=true;button.disabled=true;
  try{
   const registration=await navigator.serviceWorker.getRegistration();if(!registration?.active)throw Error('App is not ready');
   let subscription=await registration.pushManager.getSubscription();
   const tokenKey='ukr-push-manage';let token;try{token=localStorage.getItem(tokenKey)}catch{}
   if(subscription&&button.dataset.enabled==='true'){
    if(!token)throw Error('Re-enable alerts to restore subscription management');
    await request({subscription:subscription.toJSON(),manageToken:token},'DELETE');await subscription.unsubscribe();
    try{localStorage.removeItem(tokenKey)}catch{}button.dataset.enabled='false';button.textContent='Enable station alerts';say('Station alerts disabled.');return;
   }
   // Permission is requested only after this explicit click.
   const info=await request(null,'GET');if(!info.supported)throw Error('Station alerts are unavailable');
   if(await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted');
   subscription=subscription||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(info.publicKey)});
   const result=await request({subscription:subscription.toJSON()});if(!result.ok||!result.manageToken)throw Error('Registration incomplete');
   try{localStorage.setItem(tokenKey,result.manageToken)}catch{await subscription.unsubscribe();throw Error('Enable browser storage to manage station alerts')}
   button.dataset.enabled='true';button.textContent='Disable station alerts';say('Station alerts enabled.');
  }catch(error){say(error.name==='AbortError'?'Connection timed out. Try again.':error.message||'Station alerts are unavailable.')}finally{busy=false;button.disabled=false}
 });
 // Never request permission or subscribe on page load. Restore only a confirmed local registration.
 navigator.serviceWorker.getRegistration().then(async registration=>{
  const subscription=await registration?.pushManager.getSubscription();let token;try{token=localStorage.getItem('ukr-push-manage')}catch{}
  if(subscription&&token){const result=await request({subscription:subscription.toJSON()});if(result.ok){try{localStorage.setItem('ukr-push-manage',result.manageToken)}catch{}button.dataset.enabled='true';button.textContent='Disable station alerts';say('Station alerts enabled on this device.');}}
 }).catch(()=>{});
})();
