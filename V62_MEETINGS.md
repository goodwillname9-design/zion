# V62 meeting password and invitation update

Choose a password of at least six characters before pressing Create & join. Creation now retains the chosen password instead of generating a replacement. Show/Hide password and Copy invite + password are available. Send that invitation to intended participants only. Recipients open the link, enter the shared password and press Join meeting. ZION login is required. The invitation does not embed the password in the URL.

The screenshot's invalid-token error means LiveKit rejected the connection token. This UI change cannot fix incorrect deployment credentials. Verify LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET against the same LiveKit project and current key pair. Save to the deployment's environment and redeploy. Never share API secrets in chat or commit them. Actual production credentials and live multi-device calls were not verified here.

Existing architecture derives the room from Meeting ID and password: a mistyped password can lead to a different room, not a wrong-password response. This release preserves that architecture; it does not introduce registered meeting records or host-controlled admissions.

Network failures and a 20-second token request timeout now unlock controls with a retry message. No new Supabase migration is needed. V61 forest prototype remains included, and unrelated ZION features are preserved.
