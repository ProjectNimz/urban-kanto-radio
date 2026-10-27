# Kanto Events — hip-hop only

Publish only Philippine rap performances, cyphers/battles, beat/producer showcases and hip-hop DJ nights. General R&B, pop, indie, jazz, and unrelated club events do not qualify. Removed the previously listed Another Level and Malcolm Todd shows because their verified listings did not establish a hip-hop event.

Search widely, but require official venue, organizer or ticket evidence for date, location, lineup AND hip-hop relevance before publishing. Do not infer genre solely from artist popularity or an event aggregator. Do not pad empty slots. No verified qualifying dates are currently published.

Add records to events-data.js with genre: 'hip-hop', status: 'upcoming', and type: 'Rap / Live', 'Cypher / Battle', 'Beats / Producers', or 'Hip-hop DJ Night'. Include title, city, location, venue, dates (YYYY-MM-DD Manila calendar dates), lineup, summary, price, source, sourceUrl, ticketUrl, checked. Extend the allowlist in events.js only for verified official domains. Never invent prices or start times.

Cancelled/postponed records stay out of upcoming lists. Dates expire after their Manila calendar day. Discovery and verification are manual; no automatic scraping or monitoring is configured. npm run build prepares both pages.

Homepage cards show up to four upcoming events. Optional image must be an HTTPS poster URL cleared for use; omit it for the branded fallback. Keep important poster text away from edges because card thumbnails crop to 16:9. Full details remain on the event guide and official ticket page.
