ZION V80 — Fullscreen chat and camera switching
Base: saved ZION-COMPLETE-V79.zip (latest saved Zion file found).

Changes
- Private friend calls fill the available window. Remote video uses contain, preserving the picture without stretch or crop.
- Active video calls have Back camera / Front camera controls. The outgoing WebRTC track is replaced without starting a new call; camera-off state is retained. Camera acquisition errors are shown, and cancelled calls dispose of a newly acquired track.
- Fullscreen button requests browser fullscreen; unsupported browsers retain a full-window layout. Back to chat exits fullscreen without deliberately ending the call.
- Private chats use the full window and respond to the mobile visual viewport when the keyboard opens.
- Stranger chat defaults to full-window with an Exit full screen toggle.
- Video requests 720p at up to 30fps; browsers may select lower settings. Audio requests echo cancellation, noise suppression, automatic gain control and mono speech capture. Actual clarity depends on device/network. No AI upscaling or guaranteed HD is claimed.

Validation
TypeScript check and production build passed. Three mocked camera-switch tests cover success/mute preservation, permission failure retaining the old track, and disposal when a call ends during capture. Two-device calls, iOS camera switching and real microphone quality require physical-device testing. Existing private-call STUN configuration is retained; restrictive networks may require a separately configured TURN relay. LiveKit meetings/game call controls are unchanged.

Install
Back up your current project. Merge this full source project into the existing Zion folder; retain your local .env and Vercel secrets. Do not delete user data or reset Supabase.
Run npm ci, then npm run build. To run the camera tests: node --test tests/v80-call.cjs.
Review git diff, commit the changed app files and tests, and push to your existing deployment branch. No production deployment or database migration was performed here.
