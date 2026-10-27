// ===== AUDIO =====
// Adapted from MSR local recovery source 3c6fbd1d; separately validated for UKR.
const audio = new Audio();
const STREAM_URL = window.UKR_CONFIG?.streamUrl || '';
const NOW_PLAYING_URL = window.UKR_CONFIG?.nowPlayingUrl || '';
const IS_IOS_WEBKIT = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const PLAYER_OWNER_KEY = 'ukr-active-player-owner';
const PLAYER_INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const MAX_RECONNECT_ATTEMPTS = 6;
const CONNECT_TIMEOUT_MS = 14000;
const RECONNECT_BASE_DELAY_MS = 1200;
const WATCHDOG_INTERVAL_MS = 5000;
const STALE_PLAYBACK_MS = 18000;
const RESUME_RECONNECT_AFTER_MS = 2500;
const PLAYER_STATUS_TEXT = {
  idle: 'Ready to play',
  loading: 'Connecting to the live stream…',
  playing: 'Live stream playing',
  paused: 'Playback paused',
  error: 'Stream unavailable right now.'
};
let isPlaying = false;
let playerState = 'idle';
let userWantsPlayback = false;
let reconnectTimer = null;
let connectTimer = null;
let watchdogTimer = null;
let reconnectAttempts = 0;
let lastHealthyAt = 0;
let hiddenAt = 0;
let suppressNextNativePause = false;
let iosSoftPaused = false;
let playbackAttempt = 0;
let metadataController=null;
let lastPlaybackTime = 0;
const volumeControl = document.getElementById('vol');
function setVolume(value) {
  const n=Number(value), level=Number.isFinite(n)?Math.min(100,Math.max(0,n)):70;
  audio.volume=level/100; audio.muted=iosSoftPaused || level===0;
  if(volumeControl){ volumeControl.value=String(level); volumeControl.setAttribute('aria-valuetext', level===0?'Muted':`${level}% volume`); }
  try{localStorage.setItem('ukr-volume',String(level));}catch(_){}
}
let savedVolume=null;
try{savedVolume=localStorage.getItem('ukr-volume');}catch(_){}
setVolume(savedVolume===null?(volumeControl?.value ?? 70):savedVolume);
volumeControl?.addEventListener('input',e=>setVolume(e.target.value));
audio.preload = 'none';

function getFreshStreamUrl() {
  const url=new URL(STREAM_URL, location.href); url.searchParams.set('cb',`${Date.now()}-${playbackAttempt}`); return url.href;
}

function setPlayerState(nextState) {
  playerState=nextState; isPlaying=nextState==='playing';
  const button=document.getElementById('play'), status=document.getElementById('stxt');
  const pending=nextState==='loading', active=isPlaying||pending;
  if(button){button.disabled=false; button.setAttribute('aria-busy',String(pending)); button.setAttribute('aria-pressed',String(active)); button.setAttribute('aria-label',!STREAM_URL?'Stream coming soon':pending?'Cancel connecting stream':isPlaying?'Pause stream':'Play stream');}
  const icon=document.getElementById('ico');
  if(icon)icon.innerHTML=`<path d="${active?'M6 4h4v16H6zM14 4h4v16h-4z':'M7 4l13 8-13 8z'}"/>`;
  document.body?.classList.toggle('playing',isPlaying);
  document.getElementById('status')?.classList.toggle('live',isPlaying);
  if(status){status.dataset.state=nextState; status.textContent=!STREAM_URL?'Coming soon':!navigator.onLine&&userWantsPlayback?'Offline · reconnecting':pending?'Connecting…':isPlaying?'On air':nextState==='error'?(userWantsPlayback?'Reconnecting…':'Tap Play to retry'):nextState==='paused'?'Paused':'Ready to play';}
  const retry=document.getElementById('playerRetry'); if(retry)retry.hidden=nextState!=='error'||!STREAM_URL;
}

function updateMediaSessionPlaybackState(state) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.playbackState = state;
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  if (typeof MediaMetadata !== 'undefined') {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Urban Kanto Radio',
      artist: 'Live Stream',
      album: 'Local roots. Global rhythm.',
      artwork: [
        { src: '/assets/ukr-pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/assets/ukr-pwa-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });
  }

  try {
    if (IS_IOS_WEBKIT) {
      // Keep the live media connection active while silent so iOS does not
      // suspend the installed PWA before the next lock-screen Play command.
      navigator.mediaSession.setActionHandler('play', resumeFromMediaControl);
      navigator.mediaSession.setActionHandler('pause', pauseForIosMediaControl);
      navigator.mediaSession.setActionHandler('stop', stopPlayback);
    } else {
      navigator.mediaSession.setActionHandler('play', resumeFromMediaControl);
      navigator.mediaSession.setActionHandler('pause', stopPlayback);
      navigator.mediaSession.setActionHandler('stop', stopPlayback);
    }
  } catch (_) {}
}

function clearPlayerTimers() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (connectTimer) clearTimeout(connectTimer);
  reconnectTimer = null;
  connectTimer = null;
}

function markPlaybackHealthy() {
  if (audio.paused || audio.currentTime <= lastPlaybackTime) return;
  lastPlaybackTime = audio.currentTime;
  lastHealthyAt = Date.now();
}

function claimPlaybackOwnership() {
  try {
    localStorage.setItem(PLAYER_OWNER_KEY, PLAYER_INSTANCE_ID);
  } catch (_) {}
}

function resetAudioSource(useFreshStream = false) {
  try {
    suppressNextNativePause = !audio.paused;
    audio.pause();
    if (useFreshStream || !audio.currentSrc) {
      audio.src = getFreshStreamUrl();
    }
    audio.load();
  } catch (_) {}
}

function scheduleReconnect(reason = 'stream') {
  if (!userWantsPlayback || reconnectTimer) return;

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    // Retain listener intent through outages longer than the fast retry window.
    // One probe every 15 seconds keeps restoration recoverable without a reload.
    setPlayerState('error');
    updateMediaSessionPlaybackState('none');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!userWantsPlayback) return;
      if (!navigator.onLine) return;
      playerState = 'idle';
      beginPlayback({ fresh: true, reason: 'recovery-probe' });
    }, 15000);
    return;
  }

  reconnectAttempts += 1;
  setPlayerState('loading');

  const delay = Math.min(RECONNECT_BASE_DELAY_MS * reconnectAttempts, 6000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!userWantsPlayback) return;
    if (!navigator.onLine) {
      setPlayerState('loading');
      return;
    }
    if (playerState === 'playing' && Date.now() - lastHealthyAt < STALE_PLAYBACK_MS) return;
    playerState = 'idle';
    beginPlayback({ fresh: true, reason });
  }, delay);
}

function startPlaybackWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (!userWantsPlayback || !navigator.onLine) return;
    // iOS suspends media timing events while the screen is locked even when
    // native audio is healthy. Never infer a stall from hidden-page timers.
    if (IS_IOS_WEBKIT && document.visibilityState === 'hidden') return;

    const stalledTooLong = lastHealthyAt && Date.now() - lastHealthyAt > STALE_PLAYBACK_MS;
    const unusableAudio = audio.paused || audio.ended || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;

    if (unusableAudio || stalledTooLong) {
      scheduleReconnect('watchdog');
    }
  }, WATCHDOG_INTERVAL_MS);
}

function stopPlaybackWatchdog() {
  if (!watchdogTimer) return;
  clearInterval(watchdogTimer);
  watchdogTimer = null;
}

function beginPlayback(options = {}) {
  if(!STREAM_URL){userWantsPlayback=false;setPlayerState('idle');return;}
  if (IS_IOS_WEBKIT && iosSoftPaused) {
    resumeFromMediaControl();
    return;
  }
  if (playerState === 'loading' || playerState === 'playing') return;

  clearPlayerTimers();
  const attempt = ++playbackAttempt;
  if(!navigator.onLine){userWantsPlayback=true;setPlayerState('loading');return;}
  claimPlaybackOwnership();
  userWantsPlayback = true;
  setPlayerState('loading');
  updateMediaSessionPlaybackState('none');
  startPlaybackWatchdog();

  if (options.fresh || audio.error || audio.ended || !audio.currentSrc) {
    resetAudioSource(true);
  }
  lastPlaybackTime = audio.currentTime;
  lastHealthyAt = Date.now();

  connectTimer = setTimeout(() => {
    if (playerState !== 'loading') return;
    scheduleReconnect('connect-timeout');
  }, CONNECT_TIMEOUT_MS);

  audio.play().catch((error) => {
    // load()/pause() rejects the previous play promise asynchronously.
    // A superseded attempt must not cancel a newer reconnect or user action.
    if (attempt !== playbackAttempt || !userWantsPlayback) return;
    if (error?.name === 'NotAllowedError') {
      userWantsPlayback = false;
      clearPlayerTimers();
      stopPlaybackWatchdog();
      setPlayerState('error');
      updateMediaSessionPlaybackState('none');
      return;
    }
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = null;
    if (userWantsPlayback && navigator.onLine) {
      scheduleReconnect('play-rejected');
    } else if (userWantsPlayback) {
      // Preserve explicit listener intent while Android/Chrome is suspended.
      // The resume and online handlers will retry when playback is permitted.
      setPlayerState('loading');
      updateMediaSessionPlaybackState('none');
    } else {
      setPlayerState('error');
      updateMediaSessionPlaybackState('none');
      stopPlaybackWatchdog();
    }

    const btn = document.getElementById('play');
    if (btn) {
      btn.style.background = '#555';
      setTimeout(() => btn.style.background = '', 1200);
    }
  });
}

function stopPlayback() {
  playbackAttempt += 1;
  iosSoftPaused = false;
  audio.muted = audio.volume === 0;
  userWantsPlayback = false;
  reconnectAttempts = 0;
  clearPlayerTimers();
  stopPlaybackWatchdog();
  audio.pause();
  audio.removeAttribute('src'); audio.load();
  if(metadataController){metadataController.abort();metadataController=null;}
  setPlayerState('paused');
  updateMediaSessionPlaybackState('paused');
}

function togglePlay() {
  if (playerState === 'loading' || playerState === 'playing') {
    stopPlayback();
    return;
  }

  retryPlayback();
}

function pauseForIosMediaControl() {
  if (!IS_IOS_WEBKIT) {
    stopPlayback();
    return;
  }

  iosSoftPaused = true;
  playbackAttempt += 1;
  userWantsPlayback = false;
  reconnectAttempts = 0;
  clearPlayerTimers();
  stopPlaybackWatchdog();
  audio.muted = true;
  setPlayerState('paused');
  updateMediaSessionPlaybackState('paused');
}

function retryPlayback() {
  if(!STREAM_URL){userWantsPlayback=false;setPlayerState('idle');return;}
  userWantsPlayback = true;
  if (!navigator.onLine) {
    setPlayerState('loading');
    return;
  }
  userWantsPlayback = true;
  reconnectAttempts = 0;
  playerState = 'idle';
  beginPlayback({ fresh: true, reason: 'manual-retry' });
}

audio.addEventListener('playing', () => {
  if (!userWantsPlayback) { audio.pause(); return; }
  clearPlayerTimers();
  reconnectAttempts = 0;
  markPlaybackHealthy();
  setPlayerState('playing');
  updateMediaSessionPlaybackState('playing');
  refreshMetadata();
});

audio.addEventListener('play', () => {
  if (!IS_IOS_WEBKIT) return;
  if(!userWantsPlayback){audio.pause();return;}
  claimPlaybackOwnership();
  startPlaybackWatchdog();
  if (playerState !== 'playing') setPlayerState('loading');
});

['canplay', 'canplaythrough', 'progress', 'timeupdate'].forEach((eventName) => {
  audio.addEventListener(eventName, markPlaybackHealthy);
});

audio.addEventListener('pause', () => {
  if (suppressNextNativePause) {
    suppressNextNativePause = false;
    return;
  }

  if (IS_IOS_WEBKIT && userWantsPlayback && !audio.error && playerState === 'playing') {
    userWantsPlayback = false;
    reconnectAttempts = 0;
    clearPlayerTimers();
    stopPlaybackWatchdog();
  }

  if (!userWantsPlayback && playerState !== 'error') {
    setPlayerState('paused');
    updateMediaSessionPlaybackState('paused');
  }
});

audio.addEventListener('waiting', () => {
  if (userWantsPlayback) setPlayerState('loading');
});

audio.addEventListener('stalled', () => {
  if (IS_IOS_WEBKIT && document.visibilityState === 'hidden') return;
  scheduleReconnect('stalled');
});

audio.addEventListener('ended', () => {
  if (IS_IOS_WEBKIT && document.visibilityState === 'hidden') return;
  scheduleReconnect('ended');
});

audio.addEventListener('emptied', () => {
  if (userWantsPlayback) setPlayerState('loading');
});

audio.addEventListener('error', () => {
  if (connectTimer) clearTimeout(connectTimer);
  connectTimer = null;
  if (!userWantsPlayback) {
    if(playerState==='paused'||!STREAM_URL)return;
    setPlayerState('error');
    updateMediaSessionPlaybackState('none');
    return;
  }

  scheduleReconnect('error');
});

window.addEventListener('online', () => {
  setPlayerState(userWantsPlayback ? 'loading' : playerState);
  if (!userWantsPlayback || playerState === 'playing') return;
  playerState = 'idle';
  beginPlayback({ fresh: true, reason: 'online' });
});

window.addEventListener('offline', () => {
  setPlayerState(userWantsPlayback ? 'loading' : playerState);
  if (!userWantsPlayback) return;
  clearPlayerTimers();
  suppressNextNativePause = !audio.paused;
  audio.pause();
  setPlayerState('loading');
  updateMediaSessionPlaybackState('none');
});

function recoverPlaybackAfterResume(forceFresh = false) {
  if (!userWantsPlayback) return;

  claimPlaybackOwnership();
  clearPlayerTimers();

  const wasHiddenLongEnough = !IS_IOS_WEBKIT && hiddenAt && Date.now() - hiddenAt > RESUME_RECONNECT_AFTER_MS;
  if (forceFresh || wasHiddenLongEnough || audio.paused || playerState !== 'playing') {
    playerState = 'idle';
    beginPlayback({ fresh: true, reason: 'resume' });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    return;
  }
  recoverPlaybackAfterResume(!IS_IOS_WEBKIT);
});

window.addEventListener('pagehide', () => {
  hiddenAt = Date.now();
});

window.addEventListener('pageshow', () => {
  recoverPlaybackAfterResume(!IS_IOS_WEBKIT);
});

document.addEventListener('freeze', () => {
  hiddenAt = Date.now();
});

document.addEventListener('resume', () => {
  recoverPlaybackAfterResume(!IS_IOS_WEBKIT);
});

window.addEventListener('storage', (event) => {
  if (event.key !== PLAYER_OWNER_KEY || event.newValue === PLAYER_INSTANCE_ID) return;
  if (userWantsPlayback || iosSoftPaused) stopPlayback();
});

if (navigator.connection && typeof navigator.connection.addEventListener === 'function') {
  navigator.connection.addEventListener('change', () => {
    if (!userWantsPlayback || !navigator.onLine) return;
    if (audio.paused || playerState !== 'playing') recoverPlaybackAfterResume(true);
  });
}

function resumeFromMediaControl() {
  if(!STREAM_URL){setPlayerState('idle');return;}
  userWantsPlayback = true;
  reconnectAttempts = 0;

  if (!navigator.onLine) {
    setPlayerState('loading');
    updateMediaSessionPlaybackState('none');
    return;
  }

  if (IS_IOS_WEBKIT && iosSoftPaused && document.visibilityState === 'visible') {
    // The iOS decoder can sound corrupted after a muted background session is
    // brought forward. A visible user Play action permits a clean live reload.
    iosSoftPaused = false;
    audio.muted = audio.volume === 0;
    clearPlayerTimers();
    playerState = 'idle';
    beginPlayback({ fresh: true, reason: 'ios-foreground-resume' });
    return;
  }

  if (IS_IOS_WEBKIT && iosSoftPaused && !audio.paused) {
    iosSoftPaused = false;
    audio.muted = audio.volume === 0;
    markPlaybackHealthy();
    setPlayerState('playing');
    updateMediaSessionPlaybackState('playing');
    startPlaybackWatchdog();
    return;
  }

  iosSoftPaused = false;
  audio.muted = audio.volume === 0;

  // Android may deliver Play while Chrome still has the page in a stale
  // loading state. Reset only our state machine; keep the buffered source.
  clearPlayerTimers();
  playerState = 'idle';
  beginPlayback({ reason: 'media-session' });
}

setupMediaSession();
setPlayerState('idle');



function metadataArtwork(value){
 const fallback=[{src:'/assets/ukr-pwa-512.png',sizes:'512x512',type:'image/png'}];
 if(typeof value!=='string')return fallback;
 try{const url=new URL(value,location.href),origin=new URL(location.href).origin;
  if(url.origin===origin&&url.pathname.startsWith('/assets/'))return [{src:url.href}];
  if(url.protocol!=='https:'||url.username||url.password||!(window.UKR_CONFIG.artworkHosts||[]).includes(url.hostname))return fallback;
  return [{src:'/.netlify/images?'+new URLSearchParams({url:url.href,w:'256',h:'256',fit:'cover',fm:'webp',q:'70'})}];
 }catch{return fallback}
}
async function refreshMetadata(){
 if(!NOW_PLAYING_URL||playerState!=='playing'||document.hidden||metadataController)return;
 const controller=new AbortController(),attempt=playbackAttempt;metadataController=controller;
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(NOW_PLAYING_URL,{signal:controller.signal});if(!response.ok)return;
  const data=await response.json();if(playerState!=='playing'||attempt!==playbackAttempt)return;
  const title=String(data.show||'Urban Kanto Radio').slice(0,160), track=[data.artist,data.title].filter(Boolean).join(' — ').slice(0,240);
  const show=document.getElementById('npShow'), text=document.getElementById('npTrack');
  if(show)show.textContent=title;if(text)text.textContent=track;
  if('mediaSession' in navigator && typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({title:String(data.title||title),artist:String(data.artist||'Urban Kanto Radio'),album:'Local roots. Global rhythm.',artwork:metadataArtwork(data.artwork)});
 }catch(_){}finally{clearTimeout(timeout);if(metadataController===controller)metadataController=null;}
}
if(NOW_PLAYING_URL)setInterval(refreshMetadata,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMetadata();});
document.getElementById('play')?.addEventListener('click',togglePlay);
document.getElementById('playerRetry')?.addEventListener('click',retryPlayback);
document.querySelectorAll('[data-listen]').forEach(button=>button.addEventListener('click',()=>{if(playerState!=='playing'&&playerState!=='loading')retryPlayback();document.getElementById('play')?.focus();}));
document.getElementById('stxt')?.setAttribute('role','status');
if('ResizeObserver' in window)new ResizeObserver(entries=>document.documentElement.style.setProperty('--player-space',`${Math.ceil(entries[0].target.getBoundingClientRect().height)+24}px`)).observe(document.getElementById('player'));
window.UKRPlayer=Object.freeze({play:retryPlayback,stop:stopPlayback,retry:retryPlayback,setVolume,snapshot:()=>({state:playerState,intent:userWantsPlayback,attempt:playbackAttempt,volume:audio.volume,muted:audio.muted})});
