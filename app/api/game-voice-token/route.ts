import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!livekitUrl || !apiKey || !apiSecret || !supabaseUrl || !supabaseKey)
    return NextResponse.json({ error: "Voice service is not configured." }, { status: 503 });

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser(bearer);
  if (authError || !auth.user)
    return NextResponse.json({ error: "Invalid login session." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const gameId = typeof body.gameId === "string" ? body.gameId : "";
  if (!/^[0-9a-f-]{36}$/i.test(gameId))
    return NextResponse.json({ error: "Invalid game room." }, { status: 400 });
  const { data: game } = await client
    .from("friend_games")
    .select("id,status,participant_ids")
    .eq("id", gameId)
    .contains("participant_ids", [auth.user.id])
    .maybeSingle();
  if (!game || game.status !== "active" || !game.participant_ids?.includes(auth.user.id))
    return NextResponse.json({ error: "This voice room is unavailable." }, { status: 403 });

  const { data: profile } = await client.from("profiles").select("username").eq("id", auth.user.id).maybeSingle();
  const room = `zion-game-${createHmac("sha256", apiSecret).update(game.id).digest("hex").slice(0, 32)}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: auth.user.id,
    name: String(profile?.username || "ZION player").slice(0, 40),
    ttl: "3h",
    metadata: JSON.stringify({ gameId: game.id }),
  });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false });
  return NextResponse.json({ token: await token.toJwt(), serverUrl: livekitUrl });
}
