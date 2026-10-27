(() => {
 const $=id=>document.getElementById(id),config=window.UKR_CONFIG?.dj,status=$('djStatus');let profiles=[];
 const say=text=>status.textContent=text;
 if(!config?.enabled){document.querySelectorAll('#djPanel input,#djPanel select,#djPanel button').forEach(e=>e.disabled=true);say('DJ controls are being prepared.');return}
 async function api(body,method='POST'){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(config.endpoint,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Controls unavailable');return data}finally{clearTimeout(timer)}
 }
 function shows(){const profile=profiles.find(p=>p.id===$('djSelect').value);$('djShow').replaceChildren(...(profile?.shows||[]).map(show=>new Option(show,show)))}
 async function refresh(){try{const data=await api(null,'GET');profiles=data.profiles||[];$('djSelect').replaceChildren(...profiles.map(p=>new Option(p.name,p.id)));shows();say(data.isLive?`${data.djName} · ${data.show}`:'No DJ broadcast is marked live.')}catch(e){say(e.message)}}
 $('djSelect').addEventListener('change',shows);
 $('djLogin').addEventListener('submit',async event=>{event.preventDefault();const password=$('djPassword').value;$('djPassword').value='';try{await api({action:'login',password});say('Signed in. Select your show.')}catch(e){say(e.message)}});
 $('djStart').addEventListener('click',async()=>{try{await api({djId:$('djSelect').value,show:$('djShow').value});await refresh()}catch(e){say(e.message)}});
 $('djStop').addEventListener('click',async()=>{try{await api(null,'DELETE');await refresh()}catch(e){say(e.message)}});
 $('djLogout').addEventListener('click',async()=>{try{await api({action:'logout'});say('Signed out.')}catch(e){say(e.message)}});
 if(window.UKR_CONFIG.requests?.enabled){
  $('djInboxPanel').hidden=false;
  const inbox=async()=>{if(document.hidden)return;try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(window.UKR_CONFIG.requests.endpoint,{signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();$('djInbox').textContent=data.requests?.length?data.requests.map(r=>`${r.nickname}: ${r.kind==='shoutout'?r.message:[r.song,r.artist,r.message].filter(Boolean).join(' · ')}`).join('\n\n'):'No requests yet today.';}finally{clearTimeout(timer)}}catch{$('djInbox').textContent='Sign in to read requests.';}};
  inbox();setInterval(inbox,30000);
 }
 refresh();
})();
