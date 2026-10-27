(() => {
 if(window.frameElement?.dataset.ukrEmbedded==='true'){
  document.addEventListener('click',event=>{
   const a=event.target.closest('a[href]');if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.target==='_blank'||a.hasAttribute('download')||a.getAttribute('href').startsWith('#'))return;
   const url=new URL(a.href);if(url.origin!==location.origin||!['/','/index.html','/events.html','/community.html'].includes(url.pathname))return;
   event.preventDefault();window.parent.postMessage({type:'ukr-navigate',href:url.href},location.origin);
  });return;
 }
 const header=document.querySelector('header');
 if(header){const measure=()=>document.documentElement.style.setProperty('--header-space',Math.ceil(header.getBoundingClientRect().height)+'px');measure();if('ResizeObserver' in window)new ResizeObserver(measure).observe(header);else window.addEventListener('resize',measure,{passive:true});}
 const base=new URL(location.href),main=document.querySelector('main'),footer=document.querySelector('footer'),title=document.title;
 const paths=new Set(['/','/index.html','/events.html','/community.html']);let panel,frame,opener;
 function clear(){if(!panel)return;panel.remove();panel=null;frame=null;main.hidden=false;if(footer)footer.hidden=false;document.body.classList.remove('ukr-route-open');document.title=title;opener?.focus();}
 function show(url){
  clear();main.hidden=true;if(footer)footer.hidden=true;document.body.classList.add('ukr-route-open');
  panel=document.createElement('section');panel.id='ukrRoute';panel.setAttribute('aria-label',url.pathname.includes('events')?'Kanto Events':url.pathname.includes('community')?'Kanto Community':'Urban Kanto Radio');
  const back=document.createElement('button');back.type='button';back.className='btn';back.textContent='← Back';back.addEventListener('click',()=>history.back());
  frame=document.createElement('iframe');frame.dataset.ukrEmbedded='true';frame.title=panel.getAttribute('aria-label');frame.src=url.href;
  frame.addEventListener('load',()=>{try{document.title=frame.contentDocument.title;}catch(_){}});
  panel.append(back,frame);document.body.append(panel);back.focus();
 }
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
  const raw=anchor.getAttribute('href'),url=new URL(raw,base);if(url.origin!==base.origin)return;
  if(raw.startsWith('#')&&panel){event.preventDefault();clear();history.pushState(null,'',url);document.querySelector(url.hash||'#top')?.scrollIntoView();return;}
  if(!paths.has(url.pathname))return;
  if(url.pathname===base.pathname){event.preventDefault();clear();history.pushState(null,'',url);if(url.hash)document.querySelector(url.hash)?.scrollIntoView();return;}
  event.preventDefault();opener=anchor;history.pushState({ukrPanel:true},'',url);show(url);
 });
 window.addEventListener('message',event=>{
  if(event.origin!==base.origin||event.source!==frame?.contentWindow||event.data?.type!=='ukr-navigate')return;
  let url;try{url=new URL(event.data.href)}catch{return}
  if(url.origin!==base.origin||!paths.has(url.pathname))return;
  if(url.pathname===base.pathname){clear();history.replaceState(null,'',url);if(url.hash)document.querySelector(url.hash)?.scrollIntoView();return;}
  history.replaceState({ukrPanel:true},'',url);show(url);
 });
 window.addEventListener('popstate' ,()=>{const url=new URL(location.href);if(paths.has(url.pathname)&&url.pathname!==base.pathname)show(url);else clear()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel)history.back()});
})();
