# V74 visual and role access update

Adds a Choose job button during online play, opening the existing role selector. Players can change their own role during play. No CEO/admin privileges are assigned by a game role.

Visual changes: textured terrain, brighter sky and longer atmospheric depth, distant instanced hill silhouettes, edge smoothing on lower-density displays. Distant remote-player animation updates are skipped past 55 metres to reduce CPU work. Existing adaptive resolution remains. This is a modest procedural visual improvement, not a photorealistic asset replacement; no measured FPS gain or zero-lag claim.

Includes V73 life changes: gun purchase from career savings, first aid, traffic fines, police arrest based on unpaid fines, 30-second jail and simple school/station models with speed humps. See V73_SETUP.md for rules and limitations.

Run SUPABASE_V73_LIFE.sql after V72 if not yet applied. V74 adds no further SQL. Keep existing LiveKit configuration.

```sh
npm ci
npm run build
git add app/city public/sw.js SUPABASE_V73_LIFE.sql V73_SETUP.md V74_SETUP.md
git commit -m "ZION V74 life services role access and terrain visuals"
git push
```

Production build and V73 local SQL checks passed. No live multiplayer or physical-device visual/FPS test completed. Exact real-world landmarks and lifelike character/vehicle assets remain unimplemented.
