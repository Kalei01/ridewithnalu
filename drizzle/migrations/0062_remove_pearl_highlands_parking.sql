-- 0036 seeded station_parking with a "Park & Ride garage" at Pearl Highlands
-- (Waiawa station). The City's Skyline Stations and Parking page (checked
-- October 5, 2026) lists park-and-ride lots only at Keoneʻae, Honouliuli,
-- Hālawa and Kahauiki; Waiawa has none, so the app was showing riders a
-- garage that doesn't exist. Applied to production on 2026-10-05 with the
-- owner's approval. Previous row, for reference:
--   ('pearl highlands', 'available', 'Park & Ride garage')

DELETE FROM public.station_parking WHERE name_match = 'pearl highlands';
