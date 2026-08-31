# One Minute Human

A premium 3D animated stranger-conversation concept. Each match gets a ten-minute chat, and either person can choose **Next human** at any time.

## Open in VS Code

1. Extract this ZIP.
2. Open the extracted `One-Minute-Human-VS-Code` folder in VS Code.
3. Open the VS Code terminal and run:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production check

```powershell
npm run build
```

## Publish under your own name

Create a new GitHub repository, commit this folder, and push it. Import that repository into Vercel. Vercel detects Next.js automatically; keep the default build settings and deploy.

## Connect Supabase

1. Run the main database SQL supplied during setup.
2. Run `SUPABASE_FINAL_SQL.sql` once in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and add your Project URL and publishable key.
4. Restart `npm run dev`.

The connected version supports anonymous sign-in, random matching, protected answer reveal, realtime messages, a ten-minute timer, Next Human, block, and report.

Before a large public launch, add automated moderation, rate limiting, admin review tools, legal/privacy pages, and professional safety testing.
