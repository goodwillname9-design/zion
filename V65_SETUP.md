# V65 — Gulf District prototype expansion

Based on V64. Its duplicate-invite, auto-launch and LiveKit fixes are retained.

## Added

- A fictional Kuwait-inspired city/desert boundary, with a desert trail labelled on the map. It is NOT a geographically accurate Kuwait map.
- Eighteen parked vehicles, including motorcycles, with additional generated car mirrors, door seams, handles and grille detail.
- Thirty-two walking NPCs, five camels, eight dogs/cats with simple leg motion. These remain procedural prototype models, not realistic licensed character/animal assets.
- A visible gun purchased for $300 game money at S, a 12-round magazine, 60 reserve rounds, R / Reload, a firing cooldown and free ammunition resupply at the shop.
- Local non-graphic NPC combat: two hits disable an NPC, which respawns after twelve seconds. Building geometry blocks shots; firing is on foot. Range-target hits progress qualification.
- Nine missions in total: the previous five contracts plus qualification, desert supply, camel trail and coastal return. Existing browser progress migrates with default ammo values.

## Online scope

V63 private four-player exploration remains available after its SQL migration. Player positions, names and vehicle type sync. Guns, NPC damage, animals, traffic, cash and missions remain local; this release does not implement shared PvP, synchronized NPC combat or authoritative anti-cheat/vehicle physics. No real-money transactions. The new models are not photorealistic or GTA-quality assets. Desert scenery is mostly visual; this is not a suspension/terrain-physics simulation.

## Install

No NEW Supabase SQL or Vercel keys are needed for V65. If not already applied, V63 City SQL is required for friend rooms, and V64 Invites SQL is required for database duplicate prevention. Do not run account-reset scripts.

Extract into your current ZION repository, preserving your Git history/local environment secrets. For V64 → V65:

```bash
npm ci
node tests/v64.cjs
node tests/v65.cjs
npm run build
git add app/city app/friend-games.tsx public/sw.js V65_SETUP.md tests/v65.cjs
git commit -m "Expand Gulf District missions, gun gameplay and desert scenery"
git push
```

## Controls

WASD/arrows to move/steer; E to enter a nearby parked vehicle; Space to brake; Shift to run; B to buy/resupply at S; F to fire; R to reload. Touch controls provide the same actions. Aim by turning your character to face a target. Fullscreen/rotation lock remains browser-dependent.

## Verification

Production build/TypeScript and the V64/V65 regression tests are run during preparation. No real-device, two-account or visual-render performance verification is claimed for this update. A future realistic-art release needs detailed licensed meshes/textures, rigged animation and further optimization; this ZIP does not claim to complete that larger goal.
