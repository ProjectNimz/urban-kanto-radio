# UKR technology transfer report

October 27, 2026. **Development implementation is in place; complete live acceptance and performance parity remain pending. Nothing was committed, pushed, deployed or launched. No live backend was changed.**

## Sources and recovery provenance

UKR: `C:\Projects\URBAN-KANTO-RADIO`.
MSR A: `C:\Users\tenke\OneDrive\Desktop\MSR\TAMBAYAN-RADIO`.
MSR B: `C:\Projects\TAMBAYAN-RADIO`.

Both divergent working copies were inspected. A contains the local recovery work and browser-recovery artifacts; B contains newer separate mobile chat, performance helpers, licensed local assets and manual DJ controls. MSR remains unchanged. UKR has no Git checkout in its project root; this work is local development with source backups, not a claimed integration branch.

The brief's exact `fe90c3e590118dac3db11098a7e89ac2f2129f110a3d82d065726ba811769003` candidate was not found. Searches covered 657 eligible files and 5,129 Git blobs in A, and 116 files and 3,731 Git blobs in B (Git blob scans capped at 1 MB per blob). The operator authorized continuing with the located A/radio-player.js after this discrepancy was explained. Its hash is `3c6fbd1db8e9a1c01fdca08c733374f6c15dd708fc504f7e8d6d2b7317db6bb0`. Its eight Node recovery regressions pass. Saved A reports describe successful local real-stream recoveries of 7.193/8.205 and later 8.784/9.745 seconds. These are historical MSR results, not the brief's three faster trials and not UKR certification. The older production script that failed Sea Trial 2 was not copied.

UKR-SOURCE-INVENTORY.json records source fingerprints and the adapted UKR player hash. UKR-VALIDATION-RESULTS.json records current local results.

## Migration matrix and implemented inventory

| Component | MSR source | UKR implementation | Verification / risk |
|---|---|---|---|
| Audio controls and recovery | A radio-player.js | Shared radio-player.js on all pages; six fast retries, then 15s probes; 14s connection timeout; 5s watchdog with 18s stale threshold; online/resume recovery; persistent intent during outages | Eight ported regressions plus UKR races pass; actual UKR stream absent |
| Fresh sources / cancellation | A attempt IDs, load/reset, manual retry | Fresh Play/Retry sources preserve existing query parameters; cancel stays enabled while connecting; Stop releases source; late play rejections and native errors cannot revive/corrupt stopped state | 100 rapid cycles, late events and URL query tests pass |
| Volume and ownership | A cross-tab ownership + UKR saved volume | UKR-only storage keys, clamped real media volume, mute persistence, blocked-storage fallback, cross-tab cancel including pending recovery | Local tests pass; no audible-volume claim without a stream |
| Media Session / background | A native actions and iOS soft pause | UKR identity/icons; Play/Pause/Stop, iOS soft pause and resume; volume-zero remains muted | Native OS/iPhone/Android acceptance pending |
| Persistent navigation | MSR seamless navigation practice | navigation.js + player-loader.js retain one outer player across Home/Events/Community; nested first-party navigation uses one history layer; embedded pages do not create another Audio/Media Session | Browser verified one outer player, zero embedded player scripts and Back behavior; real audio continuity pending |
| Now-playing / artwork | MSR now-playing/cover-art patterns | Independent optional now-playing function: AzuraCast or flat metadata, bounded JSON, timeout, shared warm fetch, stale fallback/cooldown; Media Session artwork allowlist and 256px CDN requests | 50 concurrent mocked metadata calls coalesce to one; own metadata endpoint/CDN hosts missing |
| Realtime community | B pwa-chat.js | community.html + community-chat.js: anonymous auth, display names, presence, emoji, mentions, replies, history, UUID sends, reactions and removal | Disabled by default; actual Supabase integration pending |
| History / reconciliation | B bounded keyed rendering and reconnect | 30-message history, stable created_at/id ordering, keyed rendering, reconnect refresh, coalesced updates and catch-up after an in-flight read | 100 synthetic realtime signals coalesce to two reads; this is not a 100-user integration test |
| Moderation / chat security | B SQL and nickname admin RPC | Proposed UKR SQL uses operator-provisioned admin UUIDs, no shared-passcode claim; RLS-backed moderator deletion, own inserts/reactions/uploads; 4s database cooldown serialized per user | Draft migration NOT applied or validated in PostgreSQL; provider signup abuse controls remain required |
| Avatar optimization | B performance-utils.js | 160px crop, <=40KiB output, WebP preferred with PNG fallback; 120px Netlify thumbnails; lazy images/initials fallback | Independent UKR bucket and exact CDN origin allowlist needed |
| PWA | B atomic install/versioned public shell | UKR manifest, 192/512 PNG icons, owned-cache cleanup, branded offline fallback; core install atomic, other public assets cached on use; API/auth/chat data/audio/admin bypass worker caches | VM tests pass; real install/upgrade and physical devices pending |
| PWA bandwidth | B public shell / loading improvements | Registration deferred 12s after load and while playback intent is active; no eager community SDK precache | Deferral regression passes; constrained-bandwidth timing pending |
| Push | B Push API + Blobs + web-push | Explicit opt-in, backend-confirmed registration, user-controlled unsubscribe token, one UKR record per endpoint, allowed provider/curve-key validation, 300s TTL, expiry handling, 404/410 cleanup | All defaults off; local function doubles only, no real subscription/delivery |
| DJ / live controls | B manual live-state and auth | dj.html, dj-panel.js, empty station-roster.mjs, own signed HttpOnly/Secure/SameSite cookie, durable sign-in throttle, CAS live updates, duplicate-alert suppression, Stop/logout | Local auth/concurrency tests pass; no presenters or credentials invented |
| Requests / shoutouts | B song-request functionality | Independent private DJ inbox: UKR community JWT checked by own Supabase Auth, live-show gating, 2min per-identity cooldown, bounded fields; inbox reads require DJ auth; Manila-day last 50 records | Disabled; local authorization/cooldown tests pass; real auth/storage pending |
| Fonts/icons/dependencies | B local licensed assets and lazy SDK | Original UKR typefaces locally hosted (4 WOFF2 files, 85,400 bytes) with three OFL licenses; original SVG identity retained; pinned lazy Supabase SDK with license | Browser rendering checked; Latin subset uses system fallback for other scripts |
| RSS/editorial/events | Existing UKR systems | Preserved Bandcamp/Bandwagon feeds, source credits, image fallbacks, coalescing, size limits and stale snapshot; hip-hop-only curated Events stays above Dispatch | Existing regressions pass; no fake event dates or automatic discovery added |
| Hosting/security | Netlify functions/Blobs/env patterns | Explicit static build; own service flags and server env template; no-cache worker, no-sniff/referrer/permissions/SAMEORIGIN headers | Deployment preview and actual backend validation pending |

## UKR identity and independent configuration

The original header, logo, palette, typography, desktop hero, tight mobile layout, compact player, email/social links and editorial content remain UKR's. No MSR artwork, presenter roster, real identities, chat records, push subscribers, stream URL or credentials were copied.

station-config.js contains PUBLIC configuration only: blank stream/metadata/site URLs; chat/push/DJ/requests flags off; own empty roster and artwork host list. Server values are listed in .env.example. The optional scripts/generate-ukr-secrets.mjs writes a new ignored .local file without printing values; it was NOT run. Actual keys and services are not provisioned.

Dependencies added: @netlify/blobs 10.7.13 and web-push 3.6.7. The existing fast-xml-parser dependency remains. npm install's audit reported zero vulnerabilities across 74 packages at installation; this is not a guarantee about future advisories. The chat SDK is loaded only when independent chat is enabled and initialized. Server dependencies are not browser bundles.

## Security boundaries and remaining limits

- No service-role key is required by the current request adapter; it verifies listener tokens through the independent UKR Auth endpoint. Private VAPID/session/password values stay server-side and are excluded from dist.
- Chat history is intentionally a public community conversation for authenticated listeners, not private messaging. Presence/nicknames are not proof of real-world identity. Actual RLS, Realtime authorization and bucket policies must be inspected after provisioning.
- The proposed SQL migration is a local template, not an applied or PostgreSQL-certified migration. Configure anonymous-signup limits/CAPTCHA, retention, moderator UUIDs and operational moderation before enabling public chat.
- DJ authorization is station-wide, not per-presenter access control. Sign-in throttling uses Netlify context.ip and a conservative shared bucket if unavailable; verify that binding on staging.
- Push subscription registration remains a public opt-in endpoint. Add platform abuse limits before launch. Bulk delivery is synchronous, four at a time with a 1,000-record cap; a large/slow audience needs a background/queued dispatch path and runtime-limit tests. Persisted live state survives a notification failure, but a crash after state persistence can miss an alert; it is not a transactional outbox.
- The independent UKR avatar bucket and any album-art host must be added to Netlify's exact remote-image allowlist after their domains are known. No broad MSR or all-Supabase allowlist is supplied. Failed thumbnails fall back rather than downloading full originals.
- Stream intent survives faults/background/in-app routes; a full page reload requires a new listener gesture. Actual iOS lock-screen behavior and audibility remain unverified.

## Validation and remaining acceptance work

51 automated tests pass; build succeeds. Responsive Chromium checks covered 320/390/1440px, inactive services, Events filtering, nested navigation and single-player ownership; observed checks had no console errors. This is not cross-browser or live service certification.

Still required: provision independent UKR stream/metadata, Supabase and Netlify settings; review/apply SQL only to approved UKR staging; configure presenters, VAPID/admin credentials and image hosts; run real audio bitrate/startup/endurance/three transport trials with sustained decoded playback; run authorized actual UKR chat 10/50/100-user workloads, test-subscriber push tests, Lighthouse and PWA install/upgrade/physical-device checks. Radio imaging and newsletter connection remain separate prelaunch work. Do not launch on the strength of these local tests alone.
