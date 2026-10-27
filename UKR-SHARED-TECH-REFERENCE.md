# MSR / UKR shared technology reference

October 27, 2026. Maintain reviewed practices/modules across stations while keeping their live identities and data independent.

| Shared practice | Reference | UKR adaptation |
|---|---|---|
| Audio recovery state machine | MSR A radio-player.js and eight regression cases | radio-player.js; UKR controls/config, preserved volume/mute, query-safe fresh URLs, canceled-event guards and own storage keys |
| Media Session/background | MSR A native action handlers/iOS soft pause | UKR identity/artwork; actual OS testing still needed |
| Persistent listening navigation | MSR seamless navigation principle | navigation.js and player-loader.js; first-party sections use one outer player, isolated frame initialization and same-origin message validation |
| Chat history/reactions/reconnect | MSR B pwa-chat.js | community-chat.js: bounded keyed history, UUID sends, stable order, coalesced reconciliation, replies/emoji/mentions and moderator removal |
| Avatar / bounded fetch helpers | MSR B performance-utils.js | performance-utils.js; 160px small uploads, 120px thumbnails and UKR bucket configuration |
| Identity and RLS | MSR B SQL as starting point | Proposed UKR schema replaces shared-passcode admin claiming with operator UUID assignment and adds database message cadence. Not yet applied or DB-tested |
| PWA public-shell lifecycle | MSR B sw.js | UKR manifest/icons, atomic core, on-use public cache, owned cleanup, deferred registration, offline fallback; no private/API/media/admin caching |
| Push | MSR B web-push/Blobs patterns | ukr-push helper, subscriptions function and notifications.js: per-endpoint objects, provider/key validation, unsubscribe capability, expiry and cleanup |
| DJ status and private requests | MSR B manual live controls/request capability | Own roster, signed cookie, sign-in throttling, CAS transitions, notification suppression, authenticated live-show inbox |
| Station metadata | MSR now-playing/cover-art patterns | Own optional metadata URL, payload normalization, bounded fetch/cache/coalescing/cooldown and artwork-host allowlist |
| Efficient browser assets | MSR B pinned SDK/local fonts/icons | UKR's own licensed fonts, original SVG identity, small PNG PWA icons and lazy SDK |
| Resilient discovery feeds | Existing UKR dispatch | Retain UKR-specific RSS parsing, relevance, cache/size limits, source credits and fallbacks rather than replacing it with MSR editorial data |

Prefer small local modules and reviewed patches over a complex shared package. Keep source fingerprints and behavioral tests with each station. Do not make either station import from the other checkout, share browser storage namespaces, use a shared production Supabase, copy subscribers/users, or share VAPID/admin credentials. Independent UKR settings remain empty/off until provisioned.

The exact fe90c3e... recovery artifact was not found; the operator authorized adopting the located 3c6fbd1d... implementation after its provenance and eight passing tests were explained. Historical MSR results do not certify UKR. Maintain new tests for mute, source query parameters, late callbacks, concurrent live changes, chat catch-up, request privacy and worker boundaries alongside the original regressions.

Known next engineering work after provisioning: actual staging integrations and physical-device tests, image-host allowlists, platform subscription abuse controls, provider signup limits/retention, and background/transactional-outbox delivery if scale requires it. Do not promote local fixture results into production capacity or recovery guarantees.
