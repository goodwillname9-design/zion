# V75 — Explorer and meadow visuals

Replaces the white Cesium sample character at runtime with an original rounded explorer assembled from shared geometry, facial details, boots, backpack and articulated limbs. Removes that character asset download from startup. Existing assets/credits remain in the archive for historical features.

Adds instanced grass blades, six foliage clusters per tree, stone-textured lodges with roofs and windows, and balanced-quality sunlight shadows. Reuses the existing seeded tree/rock layout so gameplay collision coordinates remain compatible. Distant hills and terrain texture from V74 remain. No Mario character or external game assets included. Vehicles and the map layout remain the existing procedural models.

Low graphics reduces grass, disables shadows. Balanced mode can reduce grass/shadows/resolution when measured frame rate drops. This does not guarantee smooth performance on every device; GPU/mobile testing is outstanding. No rendered comparison with the reference screenshot has been completed, so this is not a claim of matching its quality.

No new SQL or environment variables. Retain previous V72/V73 migrations for careers and life services. This is a complete source ZIP based on V74.

```sh
npm ci
npm run build
git add app/city/city-game.tsx public/sw.js V75_SETUP.md
git commit -m "ZION V75 explorer grass foliage and lodge visuals"
git push
```

After deployment close/reopen the game. Use Balanced initially; use Low if frame rate is poor. Production compilation passed. Exact world landmarks, realistic traffic and full role-specific simulation remain unfinished.
