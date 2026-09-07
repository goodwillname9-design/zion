# ZION V61 — Whispering Pines prototype

Base: the user's uploaded ZION-COMPLETE-V60(1).zip. No SQL, authentication, admin, chat, meeting or encryption code changed.

Open Games → Whispering Pines, or /forest. This is a public, single-player local simulation, not multiplayer. It does not save progress. Graphics switching resets the trail.

Controls: WASD/arrows move/steer, Shift gallops. Touch directional pad works on touch devices. Ride/Walk switches modes; remount summons the prototype horse. Pause stops simulation. Back returns to ZION and releases WebGL resources. The river is only crossable on the wooden bridge. Discover three glowing rings in sequence.

Graphics: original procedural trees, terrain, rocks, horse and rider placeholders. Horse gait and rider motion are procedural, not captured animations. No downloaded photorealistic assets or Red Dead Redemption assets are included. This is NOT a finished realistic game or RDR2-quality demonstration. Photorealistic horse, rider, foliage, textures and retargeted animations remain future asset work.

Low graphics disables shadows and reduces resolution. Performance depends on hardware. Desktop build verification is not a substitute for testing actual iPhone/Android devices. Check movement, touch release/cancel, pause/resume, graphics switch, all three checkpoints, repeated enter/exit and portrait/landscape on your devices before release.

Deploy: preserve your environment variables, npm ci, npm run build, then commit/push to the existing Vercel-linked repository. No new Supabase SQL or API keys are required for this game. Three.js is installed locally as a dependency; no CDN is needed at runtime.
