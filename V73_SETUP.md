# V73 town services

Apply SUPABASE_V73_LIFE.sql AFTER V72. Do not reapply older game migrations afterwards. No new environment keys.

Includes server-stored career gun ownership ($300 at S:42,7), $25 first aid at station (7,42), fines and payment from career savings. School zone near (7,-30): 20 km/h; other areas 60 km/h. Server measures speed from accepted position updates; $50 fine at most once per 20 seconds. This is game telemetry, not a real-world traffic simulation. Vehicle humps at (7,-43) and (7,-17) slow the normal client. Humps are not server-enforced anti-cheat.

Police players can arrest a player within 5 metres with at least $150 unpaid fines. Server checks membership, role, distance, fine balance. Custody is 30 seconds at (7,46), clears fines, then automatically ends. Choosing Police is open to users, but cannot arrest without the defined offence. No automatic NPC police pursuit, court system or jail interiors. Guns remain usable only in private combat rounds; public job worlds remain peaceful.

Simple station, school and gun-shop exterior models and jail bars are included; school lessons, lifelike buildings, real world maps and landmarks are not included. Prior health/respawn system remains; first aid is added. Not all previously requested real-life simulation features are complete.

```sh
npm ci
npm run build
git add app/city public/sw.js SUPABASE_V73_LIFE.sql V73_SETUP.md
git commit -m "ZION V73 town services and traffic rules"
git push
```

Production build and local database fixture checks passed. No physical-device graphics, server load or live multiplayer test performed. Keep matching LiveKit credentials for existing calls. Previous unresolved upload issues are not claimed fixed.
