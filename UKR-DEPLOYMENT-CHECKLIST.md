# UKR deployment checklist — PRELAUNCH / HOLD

No deployment or live-service mutation was performed. Obtain explicit operator authorization before commit/push/deploy or applying live configuration/migrations.

## Configuration and independent infrastructure

- [x] Local implementation and 51-test suite; original UKR identity preserved.
- [x] Empty independent service defaults in station-config.js; no MSR values copied.
- [ ] Provision UKR's own stream. Set public streamUrl; verify the actual endpoint, codec and bitrate.
- [ ] Configure optional server UKR_METADATA_URL. Set public nowPlayingUrl to the UKR now-playing function only after verified; it supports flat or AzuraCast song payloads.
- [ ] Provision an independent UKR Supabase development/staging project. Set public chat.url/key and server UKR_SUPABASE_URL / UKR_SUPABASE_PUBLIC_KEY to that same project. Never use a service-role key in browser files.
- [ ] Review supabase/001-community-review.sql and apply ONLY to approved UKR staging. No migration has been executed. Verify actual schema, grants, RLS, Realtime tables/presence and bucket policies afterward.
- [ ] Configure provider anonymous-signup abuse controls, retention and moderators. Assign approved admin auth UUIDs through the privileged operator console; there is no self-claim passcode RPC.
- [ ] Add the exact UKR public avatar bucket origin to Netlify remote_images, then test bounded WebP thumbnails. Add album-art hosts to public artworkHosts AND Netlify's exact remote-image allowlist only after verified. No project/domain ID is invented in this setup.
- [ ] Add only confirmed UKR presenters/shows in station-roster.mjs. The roster is intentionally empty.

## Server settings

- UKR_DJ_ENABLED=false until ready. Configure independent UKR_DJ_PASSWORD (>=16 characters) and UKR_DJ_SESSION_SECRET (>=32). Browser config dj.enabled must also be deliberately enabled. Authorization grants station-wide controls/inbox access.
- UKR_PUSH_ENABLED=false until ready. Configure independent UKR_VAPID_PUBLIC_KEY, UKR_VAPID_PRIVATE_KEY and UKR_VAPID_SUBJECT. Browser push.enabled must also be enabled. Do not reuse MSR keys/subscribers.
- UKR_REQUESTS_ENABLED=false until ready. Configure UKR Supabase auth URL/public key, enable browser requests and DJ control flags only after staging validation. Requests do not enqueue tracks in the streaming host.
- UKR_METADATA_URL remains empty until a verified UKR JSON endpoint exists.
- Netlify's own UKR site supplies Blobs identity. Stores use ukr-* names. Never connect temporary UKR actions to the MSR production site.
- Optional manual helper: node scripts/generate-ukr-secrets.mjs. It was NOT run. It writes .local/ukr-server-secrets.env with exclusive creation and does not print values. Protect the directory with OS permissions first (on Windows, mode bits alone do not establish a private ACL). Transfer values securely to UKR server environment settings; never commit or publish the file.

## Hosting and acceptance

- [ ] Use an independent Netlify site/deploy preview; npm run build publishes dist, functions remain netlify/functions. A dist-only drag/drop omits server functions.
- [ ] Review deployment preview URLs, env separation, signed cookies, Netlify context.ip rate-limit binding, CSP/security requirements and image transformations.
- [ ] Add platform abuse limits to public push subscription registration and verify subscription deletion capability handling.
- [ ] Test actual Blobs CAS/concurrency, partial failures, logout/Stop, request privacy/rate limits, malformed/oversized payloads and service kill switches.
- [ ] Test pushes with test subscribers only: permission, subscribe confirmation, disable/unsubscribe, 404/410 cleanup, expiry, key rotation, slow/failing delivery and notification clicks. No MSR subscriber tests.
- [ ] For large audiences, implement/test queued or background bulk delivery; synchronous dispatch has runtime/partial-delivery limits and is not a durable outbox.
- [ ] Run authorized actual UKR Supabase 10/50/100-user workloads; validate moderation, reactions, deletion, avatar policies, ordering and reconnect behavior.
- [ ] Verify one persistent outer player through Home/Events/Community with real audio; full reload requires a new gesture. Test iOS lock-screen/soft-pause, Android background, mobile composer/keyboard and actual volume.
- [ ] Verify clean PWA installation, old-worker waiting/activation and owned-cache cleanup. Current worker version is ukr-shell-20261027-5. Close old app pages for a waiting update to activate. Admin/auth/audio/private data must never be cached.
- [ ] Run Lighthouse, cold/warm transfers and full endurance/three transport trials described in UKR-PERFORMANCE-REPORT.md.
- [ ] Complete newsletter integration and radio imaging separately. This work is not launch approval.

## Rollback

For the pre-transfer public site, restore index.html, events.html, build.mjs, server.py, netlify.toml and README.md from backups/before-tech-transfer-20261027. An additional backups/before-player-transfer-20261027 checkpoint exists for player integration. Disable UKR server service flags first if they were enabled later; no live services are enabled now. Rebuild and restart local preview. New unused source modules/docs can remain for diagnosis; the restored build excludes them. If removing added npm dependencies, uninstall only @netlify/blobs and web-push and review the package/lockfile diff. No original dependency lockfile backup is claimed.

For a browser that installed the development worker, unregister that UKR worker and remove only ukr-shell-* caches on the UKR origin, then reload. No production rollback was needed or performed. Future database rollback must be designed for the reviewed applied migration and preserve listener data; no database was changed here.
