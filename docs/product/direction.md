# Nalu product direction (agreed with Josh, Oct 11, 2026)

**The promise:** you never have to leave Nalu to understand your trip. One question, one screen: the options side by side with a rough cost, a pick with one plain reason, and exactly how to do it — door to door. Nalu decides and explains; Google/Apple Maps (and Uber/Lyft) are hand-offs, not competitors.

**Why (Josh's own trip, Oct 2026):** Union Square → 751 Kearney St, Benicia, CA. He used Google Maps and Apple Maps, then BART's website for stations, maps and which platform, then Uber and Lyft to compare prices, and still had to plan Concord BART → Benicia himself. Uber/Lyft the whole way was $80+; BART was about $7 one way. Three apps and a website, and it was still confusing.

**Order: Hawaiʻi first.** California later (see docs/cities/plan.md). Build in this order:

1. **Fast and right.** No false "No Skyline trip" (open alert in docs/maintenance/alerts.md) and answers in seconds, not 12–30 s. Nothing below ships ahead of this.
2. **A cost line on every option.** e.g. "TheBus $X · Skyline + bus $X · Uber/Lyft about $Y–Z · Drive (parking not included)". Fares from published TheBus/Skyline prices; rideshare as a clearly labelled estimate with a button to check the real price in Uber/Lyft. Never present an estimate as a quote.
3. **Plain how-to in the names riders see and hear.** Which station or stop, which direction/platform (the destination shown on the train or bus), where to change, where to get off, how to pay (HOLO card / tap to pay). Use rider-facing names, not database names — e.g. the GTFS stop "KAHAUIKI KALIHI TRANSIT CENTER STATION" is **"Kalihi Transit Center"** on Skyline (confirmed by Josh). Other stations: use the official station list or Josh's notes; never guess a name.
4. **Door to door, first and last stretch included.** Plan and price the bit between home/hotel/airport and the station, and from the station to the real destination — walk, bus or rideshare — and show the trip total (e.g. "rail + Uber ≈ $27 vs Uber all the way ≈ $80").

**Out of scope (Josh, Oct 11):** gas-cost calculators and household features — people work those out themselves. No turn-by-turn navigation and no own map/search competing with Google/Apple.

**Design-around trips (Oʻahu):** airport → Waikīkī; getting to a game/event at the stadium; Kapolei → downtown (the daily commute Nalu was built for).

**Quality bar:** real data only; say "can't check" instead of guessing; every cost labelled as a fare or an estimate; transit-accuracy review for every claim.
