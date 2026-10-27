/* Shared lightweight helpers for mobile/desktop chat and bounded network requests. */
(() => {
  async function request(url, options = {}, read = async response => { await response.clone().arrayBuffer(); return response; }) {
    const { timeoutMs = 12000, ...init } = options;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    else init.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try { return await read(await fetch(url, { ...init, signal: controller.signal })); }
    finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
  }
  function thumbnailUrl(source, size = 120) {
    if (!source) return '';
    try {
      const url = new URL(source, location.origin);
      const config = window.UKR_SUPABASE_CONFIG;
      const storageOrigin = config?.url ? new URL(config.url).origin : '';
      const local = url.origin === location.origin && /^\/images\//.test(url.pathname);
      const avatar = url.origin === storageOrigin && url.pathname.startsWith('/storage/v1/object/public/chat-avatars/');
      if (!local && !avatar) return '';
      return '/.netlify/images?' + new URLSearchParams({ url: local ? url.pathname + url.search : url.href, w: String(size), h: String(size), fit: 'cover', fm: 'webp', q: '70' });
    } catch { return ''; }
  }
  async function prepareAvatar(file) {
    let image, objectUrl;
    try {
      if (typeof createImageBitmap === 'function') image = await createImageBitmap(file);
      else { objectUrl = URL.createObjectURL(file); image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = objectUrl; }); }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      const context = canvas.getContext('2d');
      const width = image.width, height = image.height, side = Math.min(width, height);
      context.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 160, 160);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.78));
      if (!blob || blob.size > 40 * 1024) throw new Error('Unable to create a small avatar. Try another photo.');
      return new File([blob], 'avatar.' + (blob.type === 'image/webp' ? 'webp' : 'png'), { type: blob.type });
    } finally { image?.close?.(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
  }
  const updateVisibility = () => document.documentElement.classList.toggle('ukr-page-hidden', document.visibilityState !== 'visible');
  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility();
  let sdkPromise;
  function loadChatSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/supabase-2.118.0.min.js'; script.async = true;
      const timer = setTimeout(() => { script.remove(); reject(new Error('Chat SDK timed out')); }, 12000);
      script.onload = () => { clearTimeout(timer); window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Chat SDK unavailable')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Chat SDK unavailable')); };
      document.head.append(script);
    }).catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }
  function isSchemaError(error) { return ['PGRST204', '42703'].includes(error?.code); }
  window.UKRPerformance = {
    fetchWithTimeout: request,
    fetchJSON: (url, options) => request(url, options, async response => { if (!response.ok) throw new Error(`Request failed (${response.status})`); return response.json(); }),
    thumbnailUrl, prepareAvatar, loadChatSdk, isSchemaError
  };
})();
