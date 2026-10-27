(function () {
  const CHAT_NICKNAME_KEY = "ukr-pwa-chat-nickname";
  const CHAT_NICKNAME_CUSTOM_KEY = "ukr-pwa-chat-nickname-custom";
  const CHAT_AVATAR_SEED_KEY = "ukr-pwa-chat-avatar-seed";
  const CHAT_AVATAR_URL_KEY = "ukr-pwa-chat-avatar-url";
  const CHAT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const CHAT_REFRESH_INTERVAL_MS = 60000;
  const CHAT_RESUME_REFRESH_DEBOUNCE_MS = 1500;
  const RESERVED_CHAT_NAME_TERMS = [
    "admin", "administrator", "mod", "moderator", "staff", "support",
    "official", "system", "owner", "dj", "host", "ukr",
    "urbankantoradio", "urban kanto radio",
    "station admin"
  ];
  const BLOCKED_CHAT_TERMS = [
    "fuck", "shit", "bitch", "asshole", "bastard", "slut", "whore",
    "dick", "pussy", "cunt", "nigga", "nigger", "puta", "gago", "ulol"
  ];

  const fallbackChatMessages = [];
  const CHAT_EMOJIS = [
    "🔥",
    "🎶",
    "❤️",
    "🇵🇭",
    "PH",
    "🙌",
    "😂",
    "👏",
    "✨",
    "🎧",
    "📻",
    "💃",
    "🕺",
    "🎤",
    "🎵",
    "🌟",
    "💛",
    "🤘",
    "🥳",
    "👋"
  ];
  const CHAT_REACTIONS = ["❤️", "🔥", "😂", "👏", "🇵🇭", "🤪", "😎", "🥳", "🤯", "😭", "😅", "🙃", "🫶", "🕺", "💃"];
  const chatState = {
    client: null,
    presenceChannel: null,
    messagesChannel: null,
    reactionsChannel: null,
    nickname: "",
    avatarSeed: "",
    avatarUrl: "",
    pendingAvatarFile: null,
    pendingAvatarPreviewUrl: "",
    avatarMarkedForRemoval: false,
    userId: "",
    chatTable: "chat_messages",
    hasCustomNickname: false,
    nicknameEditing: false,
    connecting: false,
    retryTimer: null,
    reconcileTimer:null, reconcilePending:false,
    retryAttempt: 0,
    bound: false,
    realtimeReady: false,
    pendingSend: null,
    historySignature: "",
    nicknameSaving: false,
    maxMessages: 30,
    lastSentAt: 0,
    sendCooldownMs: 4000,
    lastRefreshAt: 0,
    isRefreshing: false,
    refreshTimer: null,
    isReady: false,
    initialized: false,
    messageIds: new Set(),
    reactionsByMessage: new Map(),
    reactionsEnabled: true,
    reactionsTable: "chat_reactions",
    replyTo: null,
    adminNickname: "",
    onlineNicknames: [],
    onlineListOpen: false,
    mentionQuery: null,
    emojiPickerOpen: false
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getChatConfig() {
    const config = window.UKR_SUPABASE_CONFIG || {};
    return {
      url: String(config.url || "").trim(),
      key: String(config.key || "").trim(),
      chatTable: String(config.chatTable || "chat_messages").trim(),
      reactionsTable: String(config.reactionsTable || "chat_reactions").trim(),
      avatarBucket: String(config.avatarBucket || "chat-avatars").trim(),
      presenceChannel: String(config.presenceChannel || "ukr-live-chat").trim(),
      maxMessages: Number(config.maxMessages) > 0 ? Number(config.maxMessages) : 30
    };
  }

  function getChatElements() {
    return {
      messages: document.getElementById("chatMessages"),
      input: document.getElementById("chatInput"),
      button: document.querySelector(".chat-send"),
      onlineCount: document.getElementById("onlineCount"),
      status: document.getElementById("chatStatus"),
      nickbar: document.getElementById("chatNickbar"),
      nickCurrent: document.getElementById("chatNickCurrent"),
      nickInput: document.getElementById("chatNickInput"),
      nickSave: document.getElementById("chatNickSave"),
      nickEdit: document.getElementById("chatNickEdit"),
      avatarPreview: document.getElementById("chatAvatarPreview"),
      avatarUpload: document.getElementById("chatAvatarUpload"),
      avatarFile: document.getElementById("chatAvatarFile"),
      avatarClear: document.getElementById("chatAvatarClear"),
      uploadWrap: document.getElementById("chatUploadWrap"),
      onlineToggle: document.getElementById("chatOnlineToggle"),
      onlineList: document.getElementById("chatOnlineList"),
      replyPreview: document.getElementById("chatReplyPreview")
    };
  }

  function formatChatTimestamp(value) {
    if (!value) return "Just now";
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "Just now";
    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes === 1) return "1 min ago";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function createAvatarDataUrl(seed) {
    const safeSeed = String(seed || "UKR").slice(0, 32);
    let hash = 0;
    for (const char of safeSeed) {
      hash = char.charCodeAt(0) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const initials = safeSeed.split(/[\s_.-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "M";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="${escapeHtml(initials)}"><rect width="56" height="56" rx="28" fill="hsl(${hue} 78% 46%)"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" fill="#fff8ef" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeHtml(initials)}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function getChatAvatarSrc(item) {
    return window.UKRPerformance.thumbnailUrl(String(item?.avatar_url || "").trim()) || createAvatarDataUrl(item?.avatar_seed || item?.nickname);
  }

  function createGuestNickname() {
    const prefixes = ["listener", "ukr", "beats", "sound", "radio", "pinoy"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    return `${prefix}_${suffix}`;
  }

  function isGeneratedNickname(value) {
    return /^(listener|msr|opm|sound|radio|pinoy)_\d{4}$/i.test(String(value || "").trim());
  }

  function normalizeNickname(value) {
    return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  }

  function normalizeFilterText(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[^\w\s]|_/g, " ").replace(/\s+/g, " ").trim();
  }

  function containsBlockedTerm(value, blockedTerms) {
    const normalized = ` ${normalizeFilterText(value)} `;
    return blockedTerms.some((term) => normalized.includes(` ${normalizeFilterText(term)} `));
  }

  function normalizeAdminNickname(value) {
    return normalizeFilterText(value);
  }

  function isProtectedAdminNickname(value) {
    return normalizeAdminNickname(value) === "station admin";
  }

  function isAdminNicknameUnlocked(value) {
    return isProtectedAdminNickname(value) && chatState.adminNickname === "station admin";
  }

  function getNicknameValidationError(value) {
    if (value.length < 2) return "Nickname must be at least 2 characters.";
    if (!/^[a-zA-Z0-9._ -]+$/.test(value)) return "Nickname can only use letters, numbers, spaces, dots, dashes, and underscores.";
    if (containsBlockedTerm(value, RESERVED_CHAT_NAME_TERMS) && !isAdminNicknameUnlocked(value)) return "That nickname is reserved. Please choose a different handle.";
    if (containsBlockedTerm(value, BLOCKED_CHAT_TERMS)) return "Please choose a cleaner nickname.";
    return "";
  }

  function getMessageValidationError(value) {
    if (!value) return "";
    if (containsBlockedTerm(value, BLOCKED_CHAT_TERMS)) return "Please keep the chat clean and radio-friendly.";
    return "";
  }

  function persistChatIdentity() {
    try {
      localStorage.setItem(CHAT_NICKNAME_KEY, chatState.nickname);
      localStorage.setItem(CHAT_AVATAR_SEED_KEY, chatState.avatarSeed);
      localStorage.setItem(CHAT_AVATAR_URL_KEY, chatState.avatarUrl);
      localStorage.setItem(CHAT_NICKNAME_CUSTOM_KEY, chatState.hasCustomNickname ? "1" : "0");
    } catch (_) {}
  }

  function setChatStatus(message, tone = "info") {
    const { status } = getChatElements();
    if (!status) return;
    status.textContent = message;
    status.className = "chat-status";
    if (tone) status.classList.add(`is-${tone}`);
  }

  function ensureChatIdentity() {
    try {
      const storedNickname = normalizeNickname(localStorage.getItem(CHAT_NICKNAME_KEY));
      const storedAvatarSeed = localStorage.getItem(CHAT_AVATAR_SEED_KEY);
      const storedAvatarUrl = localStorage.getItem(CHAT_AVATAR_URL_KEY);
      const storedCustom = localStorage.getItem(CHAT_NICKNAME_CUSTOM_KEY) === "1";
      chatState.nickname = storedNickname || createGuestNickname();
      chatState.avatarSeed = storedAvatarSeed || chatState.nickname;
      chatState.avatarUrl = storedAvatarUrl || "";
      chatState.hasCustomNickname = storedCustom && !isGeneratedNickname(chatState.nickname);
      chatState.nicknameEditing = false;
      persistChatIdentity();
    } catch (_) {
      chatState.nickname = createGuestNickname();
      chatState.avatarSeed = chatState.nickname;
      chatState.avatarUrl = "";
      chatState.hasCustomNickname = false;
      chatState.nicknameEditing = true;
    }
  }

  function applyChatNicknameUI() {
    const { nickbar, nickCurrent, nickInput, avatarPreview, avatarUpload, uploadWrap } = getChatElements();
    if (!nickbar || !nickCurrent || !nickInput) return;
    nickCurrent.textContent = chatState.nickname;
    nickInput.value = chatState.nicknameEditing ? (chatState.hasCustomNickname ? chatState.nickname : "") : chatState.nickname;
    const previewSrc = chatState.pendingAvatarPreviewUrl || (!chatState.avatarMarkedForRemoval ? chatState.avatarUrl : "");
    if (avatarPreview) avatarPreview.src = (previewSrc ? (previewSrc.startsWith("blob:") ? previewSrc : window.UKRPerformance.thumbnailUrl(previewSrc)) || createAvatarDataUrl(chatState.nickname) : "assets/urban-kanto-icon.svg");
    avatarUpload?.classList.toggle("has-preview", Boolean(previewSrc));
    uploadWrap?.classList.toggle("has-preview", Boolean(previewSrc));
    nickbar.classList.toggle("is-locked", !chatState.nicknameEditing);
    nickbar.classList.toggle("is-editing", chatState.nicknameEditing);
  }

  async function updatePresenceNickname() {
    if (!chatState.presenceChannel) return;
    try {
      await chatState.presenceChannel.track({ nickname: chatState.nickname, avatar_url: chatState.avatarUrl, joined_at: new Date().toISOString() });
    } catch (error) {
      console.warn("Presence nickname update failed:", error);
    }
  }

  async function loadChatAdminIdentity() {
    if (!chatState.client || !chatState.userId) return;
    try {
      const response = await chatState.client.rpc("get_chat_admin_name");
      if (!response.error) chatState.adminNickname = normalizeAdminNickname(response.data || "");
    } catch (error) {
      console.warn("Admin chat identity check failed:", error);
    }
    if (isProtectedAdminNickname(chatState.nickname) && !isAdminNicknameUnlocked(chatState.nickname)) {
      chatState.nickname = createGuestNickname();
      chatState.avatarSeed = chatState.nickname;
      chatState.hasCustomNickname = false;
      chatState.nicknameEditing = true;
      persistChatIdentity();
      applyChatNicknameUI();
    }
  }

  async function claimChatAdminNickname(nextNickname) {
    if (!isProtectedAdminNickname(nextNickname)) return false;
    await loadChatAdminIdentity();
    return isAdminNicknameUnlocked(nextNickname);
  }

  async function saveChatNickname() {
    const { nickInput, nickSave } = getChatElements();
    if (!nickInput) return;
    if (chatState.nicknameSaving) return;

    const nextNickname = normalizeNickname(nickInput.value);
    if (isProtectedAdminNickname(nextNickname) && !isAdminNicknameUnlocked(nextNickname)) {
      const claimed = await claimChatAdminNickname(nextNickname);
      if (!claimed) return;
    }

    const nicknameError = getNicknameValidationError(nextNickname);
    if (nicknameError) {
      setChatStatus(nicknameError, "warning");
      return;
    }

    chatState.nicknameSaving = true;
    if (nickSave) nickSave.disabled = true;

    try {
      chatState.nickname = nextNickname;
      chatState.avatarSeed = nextNickname;
      chatState.hasCustomNickname = true;
      chatState.nicknameEditing = false;
      if (chatState.avatarMarkedForRemoval) chatState.avatarUrl = "";

      persistChatIdentity();
      applyChatNicknameUI();
      updateChatComposer(chatState.isReady ? "ready" : "fallback");

      if (chatState.pendingAvatarFile) {
        setChatStatus(`Nickname saved as ${chatState.nickname}. Uploading avatar...`, "info");
        const uploaded = await uploadChatAvatar(chatState.pendingAvatarFile);
        if (uploaded) clearPendingChatAvatar();
        persistChatIdentity();
        applyChatNicknameUI();
        if (uploaded) setChatStatus(`Nickname saved as ${chatState.nickname}.`, chatState.isReady ? "ready" : "info");
        else {
          chatState.nicknameEditing = true;
          applyChatNicknameUI();
        }
      } else {
        clearPendingChatAvatar();
        persistChatIdentity();
        applyChatNicknameUI();
        setChatStatus(`Nickname saved as ${chatState.nickname}.`, chatState.isReady ? "ready" : "info");
      }

      await updatePresenceNickname();
    } finally {
      chatState.nicknameSaving = false;
      if (nickSave) nickSave.disabled = false;
    }
  }

  function startChatNicknameEdit() {
    chatState.nicknameEditing = true;
    applyChatNicknameUI();
    const { nickInput } = getChatElements();
    if (nickInput) {
      nickInput.focus();
      nickInput.select();
    }
  }

  function getAvatarValidationError(file) {
    if (!file) return "Choose an image first.";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return "Please choose a JPG, PNG, WebP, or GIF image.";
    if (file.size > CHAT_AVATAR_MAX_BYTES) return "Avatar image must be 2 MB or smaller.";
    return "";
  }

  function getAvatarExtension(file) {
    return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] || "jpg";
  }

  async function uploadChatAvatar(file) {
    if (!chatState.client || !chatState.userId) {
      setChatStatus("Connect live chat before uploading an avatar.", "warning");
      return false;
    }
    const avatarError = getAvatarValidationError(file);
    if (avatarError) {
      setChatStatus(avatarError, "warning");
      return false;
    }
    const { avatarUpload } = getChatElements();
    if (avatarUpload) avatarUpload.disabled = true;
    setChatStatus("Uploading your avatar...", "info");
    try {
      file = await window.UKRPerformance.prepareAvatar(file);
      const config = getChatConfig();
      const path = `${chatState.userId}/avatar.${getAvatarExtension(file)}`;
      const upload = await chatState.client.storage.from(config.avatarBucket).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true
      });
      if (upload.error) throw upload.error;
      const publicUrl = chatState.client.storage.from(config.avatarBucket).getPublicUrl(path).data?.publicUrl;
      if (!publicUrl) throw new Error("Avatar URL was not returned.");
      chatState.avatarUrl = `${publicUrl}?v=${Date.now()}`;
      return true;
    } catch (error) {
      console.warn("Avatar upload failed:", error);
      const detail = String(error?.message || "");
      let reason = "Photo upload failed. Check your connection and tap Save to retry.";
      if (/row.level|policy|unauthorized|permission/i.test(detail)) reason = "Photo upload was denied by storage permissions. Your nickname is saved; the avatar storage policy needs checking.";
      else if (/bucket.*not found|no such bucket/i.test(detail)) reason = "The chat avatar storage bucket is unavailable. Your nickname is saved.";
      else if (/mime|content.type|file type/i.test(detail)) reason = "Avatar storage rejected the image format. The bucket must allow WebP images.";
      else if (/decode|image|bitmap|small avatar/i.test(detail)) reason = "This photo could not be processed. Try a different JPG or PNG.";
      setChatStatus(reason, "error");
      return false;
    } finally {
      if (avatarUpload) avatarUpload.disabled = false;
    }
  }

  function previewChatAvatar(file) {
    const avatarError = getAvatarValidationError(file);
    if (avatarError) {
      setChatStatus(avatarError, "warning");
      return;
    }
    if (chatState.pendingAvatarPreviewUrl) URL.revokeObjectURL(chatState.pendingAvatarPreviewUrl);
    chatState.pendingAvatarFile = file;
    chatState.pendingAvatarPreviewUrl = URL.createObjectURL(file);
    chatState.avatarMarkedForRemoval = false;
    applyChatNicknameUI();
  }

  function clearPendingChatAvatar() {
    if (chatState.pendingAvatarPreviewUrl) URL.revokeObjectURL(chatState.pendingAvatarPreviewUrl);
    chatState.pendingAvatarFile = null;
    chatState.pendingAvatarPreviewUrl = "";
    chatState.avatarMarkedForRemoval = false;
  }

  function removeChatAvatarPreview() {
    clearPendingChatAvatar();
    chatState.avatarMarkedForRemoval = true;
    applyChatNicknameUI();
  }

  function updateChatComposer(mode) {
    const { input, button } = getChatElements();
    const emojiToggle = document.getElementById("chatEmojiToggle");
    if (!input || !button) return;
    if (mode === "ready") {
      input.disabled = false;
      button.disabled = false;
      if (emojiToggle) emojiToggle.disabled = false;
      input.placeholder = `Say something as ${chatState.nickname}...`;
      setChatStatus(`Connected as ${chatState.nickname}. Keep it kind and radio-friendly.`, "ready");
      return;
    }
    input.disabled = true;
    button.disabled = true;
    if (emojiToggle) emojiToggle.disabled = true;
    setEmojiPickerOpen(false);
    input.placeholder = "Chat opens soon";
  }

  function setOnlineCount(value) {
    const { onlineCount } = getChatElements();
    if (!onlineCount) return;
    onlineCount.textContent = String(value);
  }

  function getPresenceNicknames(presenceState) {
    const names = [];
    Object.values(presenceState || {}).forEach((items) => {
      (Array.isArray(items) ? items : []).forEach((item) => {
        const nickname = normalizeNickname(item?.nickname);
        if (nickname) names.push(nickname);
      });
    });

    const seen = new Set();
    return names.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.localeCompare(b));
  }

  function renderOnlineNicknames() {
    const { onlineList, onlineToggle } = getChatElements();
    if (!onlineList) return;
    const mentionOpen = chatState.mentionQuery !== null;
    const listOpen = chatState.onlineListOpen || mentionOpen;
    const query = String(chatState.mentionQuery || "").replace(/_/g, " ").toLowerCase();
    const visibleNames = mentionOpen
      ? chatState.onlineNicknames.filter((name) => name.toLowerCase().includes(query))
      : chatState.onlineNicknames;
    onlineList.hidden = !listOpen;
    if (onlineToggle) onlineToggle.setAttribute("aria-expanded", chatState.onlineListOpen ? "true" : "false");
    if (!listOpen) return;

    if (onlineToggle) {
      const toggleRect = onlineToggle.getBoundingClientRect();
      onlineList.style.top = `${Math.min(window.innerHeight - 190, toggleRect.bottom + 6)}px`;
      onlineList.style.right = `${Math.max(12, window.innerWidth - toggleRect.right)}px`;
    }

    if (!visibleNames.length) {
      onlineList.innerHTML = `<div class="chat-online-name is-empty">${mentionOpen ? "No matching listeners" : "No nicknames yet"}</div>`;
      return;
    }

    onlineList.innerHTML = `<div class="chat-online-names" aria-label="Online nicknames">${visibleNames.map((name) => `<button type="button" class="chat-online-name" data-mention-name="${escapeHtml(name)}" aria-label="Mention ${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}</div>`;
  }

  function updateMentionSuggestions() {
    const { input } = getChatElements();
    if (!input) return;
    const beforeCursor = input.value.slice(0, input.selectionStart ?? input.value.length);
    const match = beforeCursor.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
    chatState.mentionQuery = match ? match[1] : null;
    renderOnlineNicknames();
  }

  function insertChatMention(name) {
    const { input } = getChatElements();
    if (!input || input.disabled || !name) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const beforeCursor = input.value.slice(0, start);
    const match = beforeCursor.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
    const mention = `@${String(name).replace(/\s+/g, "_")} `;
    const replaceStart = match ? start - match[0].trimStart().length : start;
    input.setRangeText(mention, replaceStart, end, "end");
    chatState.mentionQuery = null;
    chatState.onlineListOpen = false;
    renderOnlineNicknames();
    input.focus();
  }

  function formatChatMessageHtml(message) {
    return escapeHtml(message).replace(/@([A-Za-z0-9_.-]+)/g, (mention, handle) => {
      const mentionedName = handle.replace(/_/g, " ");
      const isSelf = mentionedName.toLowerCase() === chatState.nickname.toLowerCase();
      return `<span class="chat-mention${isSelf ? " is-self" : ""}">${mention}</span>`;
    });
  }

  function setOnlineUsers(nicknames) {
    chatState.onlineNicknames = Array.isArray(nicknames) ? nicknames : [];
    setOnlineCount(chatState.onlineNicknames.length);
    renderOnlineNicknames();
  }

  function toggleOnlineNicknames() {
    chatState.mentionQuery = null;
    chatState.onlineListOpen = !chatState.onlineListOpen;
    renderOnlineNicknames();
  }

  function setEmojiPickerOpen(isOpen) {
    const picker = document.getElementById("chatEmojiPicker");
    const toggle = document.getElementById("chatEmojiToggle");
    if (!picker || !toggle) return;
    chatState.emojiPickerOpen = Boolean(isOpen);
    picker.hidden = !chatState.emojiPickerOpen;
    toggle.setAttribute("aria-expanded", chatState.emojiPickerOpen ? "true" : "false");
  }

  function insertChatEmoji(emoji) {
    const { input } = getChatElements();
    if (!input || input.disabled || !emoji) return;
    const maxLength = Number(input.getAttribute("maxlength")) || 120;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const prefix = input.value.slice(0, start);
    const suffix = input.value.slice(end);
    const spacerBefore = prefix && !/\s$/.test(prefix) ? " " : "";
    const spacerAfter = suffix && !/^\s/.test(suffix) ? " " : "";
    const nextValue = `${prefix}${spacerBefore}${emoji}${spacerAfter}${suffix}`.slice(0, maxLength);
    const nextCursor = Math.min((prefix + spacerBefore + emoji + spacerAfter).length, nextValue.length);
    input.value = nextValue;
    input.focus();
    input.setSelectionRange(nextCursor, nextCursor);
    setEmojiPickerOpen(false);
  }

  function bindEmojiPicker() {
    const { input } = getChatElements();
    const inputWrap = input?.closest(".chat-input-wrap");
    if (!input || !inputWrap || document.getElementById("chatEmojiToggle")) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "chat-emoji-toggle";
    toggle.id = "chatEmojiToggle";
    toggle.setAttribute("aria-label", "Open emoji picker");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "😊";
    const picker = document.createElement("div");
    picker.className = "chat-emoji-picker";
    picker.id = "chatEmojiPicker";
    picker.hidden = true;
    picker.setAttribute("aria-label", "Chat emoji picker");
    picker.innerHTML = CHAT_EMOJIS.map((emoji) => {
      const label = emoji === "🇵🇭" ? "🇵🇭 PH" : emoji;
      return `<button type="button" class="chat-emoji-option${emoji === "🇵🇭" ? " is-flag" : ""}" data-emoji="${escapeHtml(emoji)}" aria-label="Add ${escapeHtml(label)}">${escapeHtml(label)}</button>`;
    }).join("");
    inputWrap.insertBefore(toggle, inputWrap.querySelector(".chat-send"));
    inputWrap.appendChild(picker);
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setEmojiPickerOpen(!chatState.emojiPickerOpen);
    });
    picker.addEventListener("click", (event) => {
      const option = event.target.closest(".chat-emoji-option");
      if (!option) return;
      insertChatEmoji(option.dataset.emoji || "");
    });
    document.addEventListener("click", (event) => {
      if (!chatState.emojiPickerOpen || inputWrap.contains(event.target)) return;
      setEmojiPickerOpen(false);
    });
  }

  function truncateChatReply(value, limit = 72) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
  }

  function buildReplyQuoteHtml(item) {
    if (!item?.reply_to_message) return "";
    return `<button type="button" class="chat-reply-quote" data-reply-target-id="${escapeHtml(item.reply_to_id || "")}" aria-label="View replied message"><span class="chat-reply-quote-name">${escapeHtml(item.reply_to_nickname || "Listener")}</span><span class="chat-reply-quote-text">${escapeHtml(item.reply_to_message)}</span></button>`;
  }

  function buildReplyActionHtml(item) {
    if (!item?.id) return "";
    return `<button type="button" class="chat-reply-trigger" data-message-id="${escapeHtml(item.id)}" data-nickname="${escapeHtml(item.nickname)}" data-message="${escapeHtml(item.message)}" aria-label="Reply to ${escapeHtml(item.nickname || "message")}">↩</button>`;
  }

  function renderReplyPreview() {
    let { replyPreview } = getChatElements();
    const { input } = getChatElements();
    const inputWrap = input?.closest(".chat-input-wrap");
    if (!inputWrap) return;
    if (!replyPreview) {
      replyPreview = document.createElement("div");
      replyPreview.id = "chatReplyPreview";
      replyPreview.className = "chat-reply-preview";
      inputWrap.parentNode?.insertBefore(replyPreview, inputWrap);
    }
    if (!chatState.replyTo) {
      replyPreview.hidden = true;
      replyPreview.innerHTML = "";
      return;
    }
    replyPreview.hidden = false;
    replyPreview.innerHTML = `<div class="chat-reply-preview-copy"><span class="chat-reply-preview-label">Replying to ${escapeHtml(chatState.replyTo.nickname)}</span><span class="chat-reply-preview-text">${escapeHtml(chatState.replyTo.message)}</span></div><button type="button" class="chat-reply-cancel" aria-label="Cancel reply">×</button>`;
  }

  function setChatReply(reply) {
    if (!reply?.id) return;
    chatState.replyTo = reply;
    renderReplyPreview();
    getChatElements().input?.focus();
  }

  function clearChatReply() {
    chatState.replyTo = null;
    renderReplyPreview();
  }

  function getReactionState(messageId) {
    if (!chatState.reactionsByMessage.has(messageId)) {
      chatState.reactionsByMessage.set(messageId, {
        counts: Object.fromEntries(CHAT_REACTIONS.map((reaction) => [reaction, 0])),
        mine: new Set()
      });
    }
    return chatState.reactionsByMessage.get(messageId);
  }

  function getReactionTriggerState(state) {
    const activeReactions = CHAT_REACTIONS
      .map((reaction) => ({ reaction, count: state.counts?.[reaction] || 0 }))
      .filter((entry) => entry.count > 0);
    const totalCount = activeReactions.reduce((total, entry) => total + entry.count, 0);
    const myReaction = [...state.mine][0];
    const visibleReactions = [
      ...(myReaction ? [myReaction] : []),
      ...activeReactions.map((entry) => entry.reaction).filter((reaction) => reaction !== myReaction)
    ].slice(0, 3);
    return {
      totalCount,
      visibleReactions: visibleReactions.length ? visibleReactions : ["☺"]
    };
  }

  function buildReactionChoices(messageId) {
    const state = getReactionState(messageId);
    return CHAT_REACTIONS.map(reaction => {
      const count = state.counts?.[reaction] || 0;
      return `<button type="button" class="chat-reaction${state.mine?.has(reaction) ? ' is-active' : ''}" data-message-id="${escapeHtml(messageId)}" data-reaction="${escapeHtml(reaction)}" aria-label="React ${escapeHtml(reaction)}">${escapeHtml(reaction)}${count ? `<span>${count}</span>` : ''}</button>`;
    }).join('');
  }

  function buildReactionControls(messageId, open = false) {
    const trigger = getReactionTriggerState(getReactionState(messageId));
    return `<button type="button" class="chat-reaction-trigger${trigger.totalCount ? ' has-reaction' : ''}" data-message-id="${escapeHtml(messageId)}" aria-label="Open reactions" aria-expanded="${open}"><span class="chat-reaction-trigger-icons">${trigger.visibleReactions.map(escapeHtml).join('')}</span>${trigger.totalCount > trigger.visibleReactions.length ? `<span class="chat-reaction-trigger-count">${trigger.totalCount}</span>` : ''}</button><div class="chat-reaction-tray" role="group" aria-label="Message reactions">${open ? buildReactionChoices(messageId) : ''}</div>`;
  }

  function buildReactionButtonsHtml(item) {
    if (!chatState.reactionsEnabled || !item?.id) return '';
    return `<div class="chat-reactions" data-message-id="${escapeHtml(item.id)}">${buildReactionControls(item.id)}</div>`;
  }

  function updateMessageReactionDom(messageId) {
    const { messages } = getChatElements();
    const row = messages && [...messages.children].find(node => node.dataset.chatMessageId === String(messageId));
    const target = row?.querySelector('.chat-reactions');
    if (target) target.innerHTML = buildReactionControls(messageId, target.classList.contains('is-open'));
  }

  function positionReactionTray(reactions) {
    const tray = reactions?.querySelector(".chat-reaction-tray");
    const bubble = reactions?.closest(".chat-bubble");
    const message = reactions?.closest(".chat-msg");
    const messages = message?.parentElement;
    if (!tray || !bubble || !message || !messages) return;

    const bubbleRect = bubble.getBoundingClientRect();
    const trayRect = tray.getBoundingClientRect();
    const trayWidth = trayRect.width || 300;
    const trayHeight = trayRect.height || 100;
    const edgeGap = 12;
    const halfWidth = trayWidth / 2;
    const centeredLeft = bubbleRect.left + (bubbleRect.width / 2);
    const safeLeft = Math.min(
      window.innerWidth - halfWidth - edgeGap,
      Math.max(halfWidth + edgeGap, centeredLeft)
    );

    const isLatestMessage = message === messages.lastElementChild;
    reactions.classList.toggle("opens-above", isLatestMessage);
    tray.style.setProperty("--reaction-tray-left", `${safeLeft}px`);
    tray.style.setProperty(
      "--reaction-tray-top",
      `${isLatestMessage ? Math.max(edgeGap, bubbleRect.top - trayHeight - 8) : bubbleRect.bottom + 8}px`
    );
  }

  async function loadChatReactionsForMessages(messageIds) {
    if (!chatState.client || !chatState.reactionsEnabled || !messageIds.length) return;
    try {
      const response = await chatState.client
        .from(chatState.reactionsTable)
        .select("message_id,user_id,reaction")
        .in("message_id", messageIds);
      if (response.error) throw response.error;
      const nextMap = new Map();
      messageIds.forEach((id) => {
        nextMap.set(id, {
          counts: Object.fromEntries(CHAT_REACTIONS.map((reaction) => [reaction, 0])),
          mine: new Set()
        });
      });
      (response.data || []).forEach((row) => {
        if (!CHAT_REACTIONS.includes(row.reaction)) return;
        const state = nextMap.get(row.message_id) || {
          counts: Object.fromEntries(CHAT_REACTIONS.map((reaction) => [reaction, 0])),
          mine: new Set()
        };
        state.counts[row.reaction] = (state.counts[row.reaction] || 0) + 1;
        if (row.user_id === chatState.userId) state.mine.add(row.reaction);
        nextMap.set(row.message_id, state);
      });
      messageIds.forEach((id) => chatState.reactionsByMessage.set(id, nextMap.get(id)));
    } catch (error) {
      if (["42P01", "PGRST205"].includes(error?.code)) chatState.reactionsEnabled = false;
      console.warn("Chat reactions unavailable:", error);
    }
  }

  async function refreshVisibleChatReactions() {
    if (!chatState.reactionsEnabled) return;
    const ids = [...chatState.messageIds].filter(Boolean);
    await loadChatReactionsForMessages(ids);
    ids.forEach(updateMessageReactionDom);
  }

  async function toggleChatReaction(messageId, reaction) {
    if (!chatState.client || !chatState.isReady || !chatState.reactionsEnabled || !messageId || !CHAT_REACTIONS.includes(reaction)) return;
    const state = getReactionState(messageId);
    const hasReaction = state.mine.has(reaction);
    try {
      const query = chatState.client.from(chatState.reactionsTable);
      const deleteResponse = await query.delete().eq("message_id", messageId).eq("user_id", chatState.userId);
      if (deleteResponse.error) throw deleteResponse.error;
      if (!hasReaction) {
        const insertResponse = await chatState.client.from(chatState.reactionsTable).insert({ message_id: messageId, user_id: chatState.userId, reaction });
        if (insertResponse.error) throw insertResponse.error;
      }
      await loadChatReactionsForMessages([messageId]);
      updateMessageReactionDom(messageId);
    } catch (error) {
      if (["42P01", "PGRST205"].includes(error?.code)) chatState.reactionsEnabled = false;
      console.warn("Chat reaction failed:", error);
      setChatStatus("Could not update that reaction. Please try again.", "warning");
    }
  }

  function scrollPwaChatToBottom() {
    const messages = document.getElementById('chatMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  window.scrollPwaChatToBottom = scrollPwaChatToBottom;

  function renderChatMessageHtml(item) {
    const isSelf = chatState.userId && item.user_id === chatState.userId;
    return `<div class="chat-msg${isSelf ? ' is-self' : ''}" data-chat-message-id="${escapeHtml(item.id)}"><img class="chat-avatar" src="${escapeHtml(getChatAvatarSrc(item))}" alt="${escapeHtml(item.nickname)}" width="60" height="60" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${escapeHtml(createAvatarDataUrl(item.avatar_seed || item.nickname))}';"><div class="chat-bubble">${buildReplyQuoteHtml(item)}<div class="chat-name">${escapeHtml(item.nickname)}</div><div class="chat-text">${formatChatMessageHtml(item.message)}</div><div class="chat-ts">${escapeHtml(formatChatTimestamp(item.created_at))}</div>${buildReplyActionHtml(item)}${chatState.adminNickname?`<button type="button" class="chat-delete" data-delete-id="${escapeHtml(item.id)}">Remove message</button>`:""}${buildReactionButtonsHtml(item)}</div></div>`;
  }

  function renderChatMessages(items) {
    const { messages } = getChatElements();
    if (!messages) return;
    const signature = JSON.stringify(items);
    if (signature === chatState.historySignature) return;
    const stayAtBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
    const oldTop = messages.scrollTop;
    const oldNodes = new Map([...messages.children].map(node => [node.dataset.chatMessageId, node]));
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      let node = oldNodes.get(String(item.id));
      if (!node) { const template = document.createElement('template'); template.innerHTML = renderChatMessageHtml(item); node = template.content.firstElementChild; }
      fragment.append(node);
    });
    messages.replaceChildren(fragment);
    chatState.historySignature = signature;
    chatState.messageIds = new Set(items.map(item => String(item.id)));
    for (const id of chatState.reactionsByMessage.keys()) if (!chatState.messageIds.has(id)) chatState.reactionsByMessage.delete(id);
    if (stayAtBottom) { scrollPwaChatToBottom(); } else messages.scrollTop = oldTop;
  }

  function appendChatMessage(item) {
    const { messages } = getChatElements();
    if (!messages || !item?.id || chatState.messageIds.has(item.id)) return;
    chatState.messageIds.add(item.id);
    messages.insertAdjacentHTML("beforeend", renderChatMessageHtml(item));
    while (messages.children.length > chatState.maxMessages) {
      const firstChild = messages.firstElementChild;
      if (!firstChild) break;
      chatState.messageIds.delete(firstChild.dataset.chatMessageId);
      chatState.reactionsByMessage.delete(firstChild.dataset.chatMessageId);
      messages.removeChild(firstChild);
    }
    scrollPwaChatToBottom();
  }

  function renderFallbackChat(reason = "missing_config") {
    chatState.isReady = false;
    updateChatComposer("fallback");
    applyChatNicknameUI();
    renderChatMessages([]);
    setOnlineUsers([]);
    const reasonText = {
      missing_config: "The conversation opens soon. Follow the station for updates.",
      sdk_unavailable: "Chat is unavailable offline. It will reconnect when you are online.",
      auth_failed: "Sign-in is unavailable. Please try again later.",
      load_failed: "The conversation could not load. Please try again later.",
      connect_failed: "Live chat is reconnecting. Your draft will stay here."
    };
    setChatStatus(reasonText[reason] || reasonText.connect_failed, "warning");
  }

  function sanitizeChatMessage(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
  }

  async function ensureSupabaseSession(client) {
    const existing = await client.auth.getSession();
    if (existing?.data?.session?.user?.id) {
      return existing.data.session.user.id;
    }

    const anonymous = await client.auth.signInAnonymously();
    return anonymous?.data?.user?.id || "";
  }

  async function loadRecentChatMessages(client, tableName) {
    const response = await client.from(tableName).select("id,user_id,nickname,avatar_seed,avatar_url,message,reply_to_id,reply_to_nickname,reply_to_message,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(chatState.maxMessages);
    if (response.error && !window.UKRPerformance.isSchemaError(response.error)) throw response.error;
    if (response.error) {
      const fallback = await client.from(tableName).select("id,user_id,nickname,avatar_seed,message,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(chatState.maxMessages);
      if (fallback.error) throw response.error;
      const fallbackItems = Array.isArray(fallback.data) ? fallback.data.slice().reverse() : [];
      await loadChatReactionsForMessages(fallbackItems.map((item) => item.id).filter(Boolean));
      renderChatMessages(fallbackItems);
      return;
    }
    const items = Array.isArray(response.data) ? response.data.slice().reverse() : [];
    if (JSON.stringify(items) !== chatState.historySignature) await loadChatReactionsForMessages(items.map((item) => item.id).filter(Boolean));
    renderChatMessages(items);
  }

  async function refreshLiveChatMessages(options = {}) {
    if (!chatState.client || !chatState.isReady) return;
    if(chatState.isRefreshing){chatState.reconcilePending=true;return;}
    if (options.reason === "poll" && (document.visibilityState !== "visible" || !navigator.onLine)) return;
    const now = Date.now();
    if (now - chatState.lastRefreshAt < CHAT_RESUME_REFRESH_DEBOUNCE_MS) {
      if(!chatState.reconcileTimer)chatState.reconcileTimer=setTimeout(()=>{chatState.reconcileTimer=null;refreshLiveChatMessages({reason:'queued'});},CHAT_RESUME_REFRESH_DEBOUNCE_MS-(now-chatState.lastRefreshAt));
      return;
    }
    chatState.lastRefreshAt = now;
    chatState.isRefreshing = true;
    try {
      await loadRecentChatMessages(chatState.client, chatState.chatTable);
    } catch (error) {
      console.warn("Live chat refresh failed:", error);
    } finally {
      chatState.isRefreshing = false;
      if(chatState.reconcilePending){chatState.reconcilePending=false;refreshLiveChatMessages({reason:'queued'});}
    }
  }

  function startChatAutoRefresh() {
    if (chatState.refreshTimer) return;
    chatState.refreshTimer = setInterval(() => {
      refreshLiveChatMessages({ reason: "poll" });
    }, CHAT_REFRESH_INTERVAL_MS);
  }

  function refreshChatAfterResume() {
    refreshLiveChatMessages({ reason: "resume" });
    updatePresenceNickname();
  }

  function bindChatAutoRefreshEvents() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshChatAfterResume();
    });
    window.addEventListener("focus", refreshChatAfterResume);
    window.addEventListener("pageshow", refreshChatAfterResume);
    window.addEventListener("online", refreshChatAfterResume);
  }

  function subscribeToChatPresence(client, channelName) {
    chatState.presenceChannel = client.channel(channelName, { config: { presence: { key: chatState.userId || chatState.nickname } } });
    chatState.presenceChannel.on("presence", { event: "sync" }, () => {
      const state = chatState.presenceChannel.presenceState();
      setOnlineUsers(getPresenceNicknames(state));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await chatState.presenceChannel.track({ nickname: chatState.nickname, avatar_url: chatState.avatarUrl, joined_at: new Date().toISOString() });
      }
    });
  }

  function subscribeToChatMessages(client, tableName) {
    chatState.messagesChannel = client.channel(`public:${tableName}`)
      .on('postgres_changes', { event:'*', schema:'public', table:tableName }, () => refreshLiveChatMessages({reason:'realtime'}))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          chatState.realtimeReady = true;
          if (chatState.isReady) {
            setChatStatus(`Connected as ${chatState.nickname}. Keep it kind and radio-friendly.`, 'ready');
            refreshLiveChatMessages({reason:'realtime'});
          }
        } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
          chatState.realtimeReady = false;
          if (chatState.isReady && !chatState.connecting) setChatStatus('Chat is reconnecting. Your draft stays here.', 'warning');
        }
      });
    chatState.reactionsChannel = client.channel(`public:${chatState.reactionsTable}`)
      .on('postgres_changes', {event:'*',schema:'public',table:chatState.reactionsTable}, refreshVisibleChatReactions).subscribe();
  }

  async function sendChatMessage() {
    const { input, button } = getChatElements();
    if (!input || !button || button.disabled || !chatState.client || !chatState.isReady) return;
    const message = sanitizeChatMessage(input.value);
    if (!message) return;
    const validation = getMessageValidationError(message);
    if (validation) { setChatStatus(validation, 'warning'); return; }
    if (!navigator.onLine) { setChatStatus('Offline. Your draft is saved here.', 'warning'); return; }
    const waitMs = chatState.sendCooldownMs - (Date.now() - chatState.lastSentAt);
    if (waitMs > 0) { setChatStatus(`Please wait ${Math.ceil(waitMs / 1000)}s before sending another message.`, 'warning'); return; }
    const reply = chatState.replyTo;
    const signature = JSON.stringify([message, reply?.id || '']);
    if (chatState.pendingSend?.signature !== signature) chatState.pendingSend = { signature, id: crypto.randomUUID() };
    const id = chatState.pendingSend.id;
    const payload = { id, user_id: chatState.userId, nickname: chatState.nickname, avatar_seed: chatState.avatarSeed, avatar_url: chatState.avatarUrl, message,
      reply_to_id: reply?.id || null, reply_to_nickname: reply?.nickname || '', reply_to_message: reply?.message || '' };
    button.disabled = true;
    setChatStatus('Sending your message...', 'info');
    try {
      const table = getChatConfig().chatTable;
      let response = await chatState.client.from(table).insert(payload).select('*').single();
      if (window.UKRPerformance.isSchemaError(response.error)) response = await chatState.client.from(table).insert({ id, user_id: payload.user_id, nickname: payload.nickname, avatar_seed: payload.avatar_seed, message }).select('*').single();
      if (response.error?.code === '23505') response = await chatState.client.from(table).select('*').eq('id', id).eq('user_id', chatState.userId).single();
      if (response.error || !response.data?.id) throw response.error || new Error('No receipt returned');
      appendChatMessage(response.data);
      chatState.lastSentAt = Date.now();
      chatState.pendingSend = null;
      if (input.value.trim() === message) { input.value = ''; clearChatReply(); }
      setChatStatus(`Live as ${chatState.nickname}. Message sent.`, 'ready');
    } catch (error) {
      console.warn('Chat send failed:', error);
      setChatStatus('Unable to confirm delivery. Your draft is here; retry when connected.', 'error');
    } finally { button.disabled = false; }
  }

  function bindChatComposer() {
    const { input, button, messages, nickInput, nickSave, nickEdit, avatarUpload, avatarFile, avatarClear, onlineToggle } = getChatElements();
    if (!input || !button) return;
    bindEmojiPicker();
    renderReplyPreview();
    button.addEventListener("click", sendChatMessage);
    input.addEventListener("input", updateMentionSuggestions);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendChatMessage();
      }
    });
    if (nickSave) nickSave.addEventListener("click", saveChatNickname);
    if (nickEdit) nickEdit.addEventListener("click", startChatNicknameEdit);
    if (nickInput) {
      nickInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveChatNickname();
        }
      });
      nickInput.addEventListener("blur", () => {
        const nextNickname = normalizeNickname(nickInput.value);
        if (chatState.nicknameEditing && nextNickname && nextNickname !== chatState.nickname) {
          saveChatNickname();
        }
      });
    }
    if (avatarUpload) avatarUpload.addEventListener("click", () => avatarFile?.click());
    if (avatarFile) {
      avatarFile.addEventListener("change", () => {
        const file = avatarFile.files?.[0];
        if (file) previewChatAvatar(file);
        avatarFile.value = "";
      });
    }
    if (avatarClear) avatarClear.addEventListener("click", removeChatAvatarPreview);
    if (onlineToggle) onlineToggle.addEventListener("click", toggleOnlineNicknames);
    document.getElementById("chatOnlineList")?.addEventListener("click", (event) => {
      const mentionButton = event.target.closest("[data-mention-name]");
      if (mentionButton) insertChatMention(mentionButton.dataset.mentionName || "");
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".chat-reply-cancel")) clearChatReply();
    });
    document.addEventListener("click", (event) => {
      if (!chatState.onlineListOpen && chatState.mentionQuery === null) return;
      if (event.target.closest("#chatOnlineToggle") || event.target.closest("#chatOnlineList")) return;
      chatState.onlineListOpen = false;
      chatState.mentionQuery = null;
      renderOnlineNicknames();
    });
    if (messages) {
      messages.addEventListener("click", (event) => {
        const replyTrigger = event.target.closest(".chat-reply-trigger");
        if (replyTrigger) {
          setChatReply({
            id: replyTrigger.dataset.messageId || "",
            nickname: truncateChatReply(replyTrigger.dataset.nickname || "Listener", 24),
            message: truncateChatReply(replyTrigger.dataset.message || "", 90)
          });
          return;
        }

        const replyQuote = event.target.closest(".chat-reply-quote");
        if (replyQuote?.dataset.replyTargetId) {
          const escapeSelector = window.CSS?.escape || ((value) => String(value).replace(/["\\]/g, "\\$&"));
          messages.querySelector(`[data-chat-message-id="${escapeSelector(replyQuote.dataset.replyTargetId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }

        const reactionTrigger = event.target.closest(".chat-reaction-trigger");
        if (reactionTrigger) {
          const reactions = reactionTrigger.closest(".chat-reactions");
          const willOpen = !reactions?.classList.contains("is-open");
          messages.querySelectorAll(".chat-reactions.is-open").forEach((item) => {
            item.classList.remove("is-open");
            item.querySelector('.chat-reaction-tray')?.replaceChildren();
            item.querySelector(".chat-reaction-trigger")?.setAttribute("aria-expanded", "false");
          });
          if (reactions && willOpen) {
            reactions.querySelector('.chat-reaction-tray').innerHTML = buildReactionChoices(reactionTrigger.dataset.messageId);
            reactions.classList.add("is-open");
            positionReactionTray(reactions);
            reactionTrigger.setAttribute("aria-expanded", "true");
          }
          return;
        }

        const removal=event.target.closest('.chat-delete');
        if(removal&&chatState.adminNickname){
          chatState.client.from(chatState.chatTable).delete().eq('id',removal.dataset.deleteId).then(({error})=>{if(error)setChatStatus('Message could not be removed.','error');else refreshLiveChatMessages({reason:'moderated'});}).catch(()=>setChatStatus('Message could not be removed.','error'));return;
        }
        const reactionButton = event.target.closest(".chat-reaction");
        if (!reactionButton) return;
        reactionButton.closest(".chat-reactions")?.classList.remove("is-open");
        toggleChatReaction(reactionButton.dataset.messageId || "", reactionButton.dataset.reaction || "");
      });
      document.addEventListener("click", (event) => {
        if (event.target.closest(".chat-reactions")) return;
        messages.querySelectorAll(".chat-reactions.is-open").forEach((item) => {
          item.classList.remove("is-open");

          item.querySelector('.chat-reaction-tray')?.replaceChildren();
          item.querySelector(".chat-reaction-trigger")?.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  function bindRequests(){
    const config=window.UKR_CONFIG?.requests,panel=document.getElementById('requestPanel'),form=document.getElementById('requestForm'),status=document.getElementById('requestStatus');
    if(!config?.enabled||!form||chatState.requestsBound)return;
    chatState.requestsBound=true;panel.hidden=false;
    const refresh=async()=>{if(document.hidden)return;try{const state=await window.UKRPerformance.fetchJSON(window.UKR_CONFIG.dj.endpoint);form.querySelectorAll('input,select,button').forEach(e=>e.disabled=!state.isLive||!chatState.isReady);status.textContent=state.isLive?'The DJ is taking requests.':'Requests open during live DJ shows.';}catch{form.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);status.textContent='Requests are temporarily unavailable.';}};
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
      try{const session=await chatState.client.auth.getSession();const token=session.data?.session?.access_token;if(!token)throw Error('Join the community first.');
       await window.UKRPerformance.fetchJSON(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({kind:document.getElementById('requestKind').value,nickname:chatState.nickname,song:document.getElementById('requestSong').value,artist:document.getElementById('requestArtist').value,message:document.getElementById('requestMessage').value})});
       form.reset();status.textContent='Sent to the DJ. Thanks for being part of the sound.';
      }catch{status.textContent='Could not send. Check that requests are open, and allow two minutes between messages.';}finally{button.disabled=false}
    });refresh();setInterval(refresh,30000);
  }

  async function initPwaLiveChat() {
    if (chatState.connecting || chatState.isReady) return;
    if (!chatState.bound) {
      chatState.bound = true;
      ensureChatIdentity();
      applyChatNicknameUI();
      bindChatComposer();
      window.addEventListener('online', () => { clearTimeout(chatState.retryTimer); chatState.retryTimer = null; if (!chatState.isReady) initPwaLiveChat(); });
      window.addEventListener('offline', () => setChatStatus('Offline. Your draft is saved here.', 'warning'));
    }
    chatState.initialized = true;
    if (!chatState.autoRefreshBound) { chatState.autoRefreshBound = true; bindChatAutoRefreshEvents(); }
    if (!window.UKR_CONFIG?.chat?.enabled) {
      const online=document.getElementById('chatOnlineToggle');if(online)online.hidden=true;
      renderFallbackChat("missing_config"); return;
    }
    const config = getChatConfig();
    chatState.maxMessages = config.maxMessages;
    chatState.chatTable = config.chatTable;
    chatState.reactionsTable = config.reactionsTable;
    setChatStatus("Connecting live chat...", "info");
    if (!config.url || !config.key) {
      renderFallbackChat("missing_config");
      return;
    }
    if (!navigator.onLine) { renderFallbackChat('sdk_unavailable'); return; }
    chatState.connecting = true;
    clearTimeout(chatState.retryTimer);
    try {
      await window.UKRPerformance.loadChatSdk();
      chatState.client = chatState.client || window.supabase.createClient(config.url, config.key, {
        global: { fetch: window.UKRPerformance.fetchWithTimeout },
        auth: { persistSession: true, autoRefreshToken: true }
      });
      chatState.userId = await ensureSupabaseSession(chatState.client);
      if (!chatState.userId) throw new Error("auth_failed");
      await loadChatAdminIdentity();
      await loadRecentChatMessages(chatState.client, config.chatTable);
      const oldChannels = [chatState.presenceChannel, chatState.messagesChannel, chatState.reactionsChannel].filter(Boolean);
      await Promise.all(oldChannels.map(channel => chatState.client.removeChannel(channel).catch(() => {})));
      subscribeToChatPresence(chatState.client, config.presenceChannel);
      subscribeToChatMessages(chatState.client, config.chatTable);
      chatState.isReady = true;
      chatState.retryAttempt = 0;
      updateChatComposer("ready");
      applyChatNicknameUI();
      startChatAutoRefresh();
      bindRequests();
      refreshLiveChatMessages({reason:"subscribed"});
      scrollPwaChatToBottom();
    } catch (error) {
      console.warn("Supabase chat init failed:", error);
      const reason = String(error?.message || "").includes("auth_failed") ? "auth_failed" : "connect_failed";
      renderFallbackChat(reason);
      if (navigator.onLine) {
        const delay = Math.min(30000, 1500 * 2 ** Math.min(chatState.retryAttempt++, 5)) + Math.random() * 500;
        chatState.retryTimer = setTimeout(initPwaLiveChat, delay);
      }
    } finally {
      chatState.connecting = false;
    }
  }


  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPwaLiveChat, { once: true }); else initPwaLiveChat();
})();
