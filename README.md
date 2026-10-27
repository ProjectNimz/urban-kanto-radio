# Urban Kanto Radio

## Netlify deployment
Connect this project repository to Netlify. netlify.toml configures the build and function automatically:
- Build command: npm run build
- Publish directory: dist
- Functions directory: netlify/functions

Use a repository-connected deployment or the Netlify CLI so functions are included. Dragging dist into Netlify alone does not deploy the RSS backend. No API keys required. This project has not been deployed.

## RSS behavior
/api/dispatch fetches Bandcamp Daily RSS, filters hip-hop/soul/jazz/beat stories, and returns original headlines, dates, author credits and publisher-supplied image URLs. Photos are loaded remotely from bcbits.com; unavailable images fall back to the station graphic. Full articles are not copied. Verify publisher image/syndication terms before public launch.

The open page checks every five minutes and when returning to the tab. Netlify's CDN and warm function cache fresh results for 30 minutes. Refresh is request-driven, not a scheduled background job. Failed requests use the last warm cache or bundled saved snapshot, labeled as saved headlines. Cold starts do not retain runtime cache across deploys; the bundled snapshot provides the fallback. Pinoy Scene can be empty until relevant stories appear or another source is added.

## Local preview
Run python server.py then open http://127.0.0.1:8787. This optional local server uses Python standard library. python server.py --refresh updates the bundled saved snapshot and photos before a deploy. Opening index.html directly uses that snapshot without live refresh.

## Checks
npm install
npm test
npm run build

## Before launch
Set streamUrl and optional nowPlayingUrl in station-config.js. Replace contact/social placeholders and connect newsletter. Add confirmed guest sessions.

## Filipino coverage
Bandwagon Atom is combined with Bandcamp RSS. Pinoy Scene includes Philippine music and local concert stories across genres, detected from headline and opening text. Each card credits its actual publisher. A source outage retains that source’s saved stories; it does not erase the other source. Bandwagon photos appear only when the feed supplies a supported image URL; otherwise station artwork is used.

## Kanto Events
Homepage picks and events.html share reviewed data in events-data.js. City/type filters and Manila-date expiry run in events.js. Review official sources before adding or changing listings; see EVENTS-EDITORIAL.md. Discovery is manual, not an unattended web scraper.

## Technology transfer — development implementation
See UKR-TECH-TRANSFER-REPORT.md, UKR-PERFORMANCE-REPORT.md, UKR-DEPLOYMENT-CHECKLIST.md, UKR-SHARED-TECH-REFERENCE.md and UKR-VALIDATION-RESULTS.json. The shared recovery player, persistent section navigation, community UI/client, private DJ/request backend, opt-in push architecture, local fonts/icons and offline shell are implemented. Chat, push, DJ and requests default off; stream/metadata settings remain empty. Independent infrastructure and live acceptance are still required. No deployment was performed.
