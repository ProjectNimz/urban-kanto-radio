// Defer background installation so it does not compete with initial audio startup.
if('serviceWorker' in navigator&&window.isSecureContext){
 window.addEventListener('load',()=>{
  const register=()=>{
   if(window.UKRPlayer?.snapshot().intent){setTimeout(register,5000);return;}
   if(!navigator.onLine){window.addEventListener('online',register,{once:true});return;}
   navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
  };
  setTimeout(register,12000);
 },{once:true});
}

// Keep installation optional; browsers without a native prompt retain menu instructions.
if(typeof document!=='undefined'&&!window.frameElement){
 const button=document.querySelector('#installApp'),help=document.querySelector('#pwaInstall');let pendingInstall;
 const installed=()=>matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
 if(help&&installed())help.hidden=true;
 window.addEventListener('beforeinstallprompt',event=>{if(!button||installed())return;event.preventDefault();pendingInstall=event;button.hidden=false;});
 button?.addEventListener('click',async()=>{if(!pendingInstall)return;const prompt=pendingInstall;pendingInstall=null;button.hidden=true;try{await prompt.prompt();await prompt.userChoice;}catch(_){} });
 window.addEventListener('appinstalled',()=>{pendingInstall=null;if(button)button.hidden=true;if(help)help.hidden=true;});
 let status;
 function connection(){
  if(!status){status=document.createElement('p');status.className='ukr-offline-status';status.setAttribute('role','status');status.textContent='You’re offline. Live radio needs a connection; saved pages are still available.';const header=document.querySelector('header');if(header)header.after(status);else document.body.prepend(status);}
  status.hidden=navigator.onLine;
 }
 window.addEventListener('offline',connection);window.addEventListener('online',connection);if(!navigator.onLine)connection();
}
