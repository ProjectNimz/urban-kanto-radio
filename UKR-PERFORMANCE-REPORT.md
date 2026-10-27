# UKR performance and validation report

October 27, 2026. **No live-stream certification or measured MSR performance parity is claimed.**

| Item | Result |
|---|---|
| Automated suite | 51 passed, 0 failed; node --test tests/*.test.mjs |
| Static deployment build | 33 files; 607,470 bytes uncompressed, including extra pages, chat SDK, fonts and icons |
| Referenced entry source accounting | 164,437 bytes uncompressed, including all four local font files and the dynamically loaded player |
| Local font files | 4 WOFF2 files, 85,400 bytes; no Google Fonts request needed |
| Supabase SDK | 218,252 bytes on disk; only loaded after chat is enabled/initialized, not on the homepage |
| Dependency audit at install | 0 vulnerabilities reported; 74 packages audited |
| RSS local load harness | 2,500 handler calls, 2 mocked upstream requests, about 209ms printed in final harness run |
| Metadata local harness | 50 concurrent requests, one mocked upstream fetch |
| Chat reconciliation unit workload | 100 synthetic signals during one blocked history read result in one follow-up read |
| Player cancel regression | 100 rapid start/cancel cycles; late events/rejections cannot restart playback |
| Browser layout/navigation | Chromium 320/390/1440px; single outer player, zero embedded player scripts; Events city filter; one-step nested Back |
| Narrow width observation | At 320px, measured document/body scrollWidth both 320px |
| Lighthouse / Slow 3G LCP / CLS | NOT measured |
| Cold/warm actual network transfer | NOT measured |
| Player readiness / decoded startup | NOT measured against a UKR stream |
| Actual stream bitrate / endurance | Pending provisioned UKR stream |
| Three real 30s transport interruptions | Pending; historical MSR recovery results are not UKR evidence |
| Actual 10/50/100-user Supabase workloads | Pending independent authorized UKR staging; unit signals are not user workloads |
| Push delivery / unsubscribe on devices | Local contract tests only; real test subscribers absent |
| PWA clean install / upgrade / offline browser | VM cache/deferral/expiry regressions pass; full browser/device acceptance pending |

## Interpreting the byte counts

Entry source accounting is a filesystem-derived sum, not an observed transfer, LCP result or proof of meeting the 250KB target. It excludes HTTP overhead, remote publisher photos, manifest icon fetch choices, RSS API traffic and service-worker installation requests. HTTP compression/cache state changes actual bytes. The full dist size is not the homepage download. Background worker installation starts after 12 seconds and waits while listening intent is active; it fetches only the essential shell. Other public assets are cached on use. This scheduling prioritizes startup and must still be measured in staging rather than excluded from reporting.

## Method and limits

Automated tests use controlled Node/vm media doubles, in-memory service stores and mocked upstream responses. They do not establish native decoded-audio progress, Supabase capacity, Netlify Blobs correctness under deployed load, web-push delivery or audible sound. No production load test, real listener account, public message or notification was created. Browser checks used viewport changes in the local in-app Chromium browser, not real Android/iOS devices or a Safari compatibility test. Source/contract checks of the SQL are not PostgreSQL execution.

## Required live acceptance protocol

Use comparable latency and CPU throttling, record actual UKR codec/bitrate, cold/warm entry-relative LCP, bytes, ready time and decoded startup. Run 5min at each of 400/250/200/400/1000Kbps, 30s severed transport, then 4min30s at 400Kbps. Record media-time/decoded activity, stalls, native state and UI/intent throughout. Repeat at least three independent interruptions; require fresh audio responses, advancing media time, decoded activity, 20s sustained playback and functional Stop/restart. An HTTP200 response alone is insufficient.

Run authorized real UKR staging chat workloads of 10/50/100 users, measuring order, duplicates, reconnect reconciliation and audio impact; push with test subscribers only; PWA install and cache-version upgrades on desktop plus representative phones. Include slow notification delivery/runtime limits and failure after live-state persistence. Record misses and causes rather than substituting these local unit results.
