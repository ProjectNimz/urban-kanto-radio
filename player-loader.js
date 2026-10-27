// Embedded first-party sections use the outer page's single persistent player.
if(window.frameElement?.dataset.ukrEmbedded==='true'){document.documentElement.classList.add('ukr-embedded');document.querySelectorAll('[data-listen]').forEach(button=>button.addEventListener('click',()=>{window.parent.UKRPlayer?.play();window.parent.document.getElementById('play')?.focus();}));}
else {const script=document.createElement('script');script.src='/radio-player.js';document.body.append(script);}
