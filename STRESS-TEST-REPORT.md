# Urban Kanto Radio — optimization and stress checks

Date: October 23, 2026 (America/Phoenix)

## Improvements
- Deployment output reduced from 10,982,742 bytes to 49,480 bytes by including only referenced website assets. Original artwork and social exports remain in the project.
- Added a 60-second retry cooldown after all RSS sources fail.
- Enforced a 2 MB input limit before XML parsing, including direct parser calls.
- Identical news refreshes no longer rebuild cards and disturb keyboard focus.
- Increased the local Python preview server connection queue to 128 after a burst exposed connection refusals.

## Results
- 13 automated tests pass.
- Simulated Netlify function: 500 concurrent cold requests, then 2,000 warm requests; only two mocked upstream fetches in one function instance. Approximately 193 ms locally; this is not real upstream latency or production capacity.
- Full outage: 200 requests return fallback data with only two failed upstream attempts during the cooldown.
- Partial source failure retains fallback content for that source.
- Oversized XML, malformed XML, entity declarations and unsafe destinations are rejected.
- 100 rapid playback start/cancel cycles, stream rejection, and media errors pass using a mock audio element.
- Real local HTTP homepage check after queue fix: 100 requests, concurrency 25, zero failures; p95 approximately 2,691 ms on this Windows preview server.
- Browser checked at 320, 390, 650, 768, 1024 and 1440 pixels: no horizontal document overflow. Mobile hero hidden through 650px; mobile news initially limited to three cards. Show more/fewer works. No captured browser console errors.
- Netlify build passes and outputs four required static files.

## Limits
Not deployed to Netlify. CDN behavior, deployed function bundling and production traffic capacity still require hosted verification. External fonts and news images are separate network resources and are not included in the 49 KB static payload. No audio stream is configured, so audible playback is unverified. Newsletter remains a demo. Browser checks use the available Chromium-based in-app browser, not physical iOS/Android devices.
