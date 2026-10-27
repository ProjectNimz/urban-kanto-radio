// Public configuration only. Never put server secrets here.
window.UKR_CONFIG = Object.freeze({
  stationName: "Urban Kanto Radio",
  streamUrl: "",
  nowPlayingUrl: "",
  artworkHosts: Object.freeze([]),
  siteUrl: "",
  chat: Object.freeze({enabled:false, url:"", key:"", chatTable:"chat_messages", reactionsTable:"chat_reactions", avatarBucket:"chat-avatars", presenceChannel:"ukr-live-chat", maxMessages:30}),
  push: Object.freeze({enabled:false, endpoint:"/.netlify/functions/push-subscriptions"}),
  requests: Object.freeze({enabled:false,endpoint:'/.netlify/functions/requests'}),
  dj: Object.freeze({enabled:false,endpoint:'/.netlify/functions/live-state'}),
  djProfiles: Object.freeze([])
});
window.UKR_SUPABASE_CONFIG = window.UKR_CONFIG.chat;
