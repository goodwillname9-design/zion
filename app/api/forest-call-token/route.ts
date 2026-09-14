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
  const {data:allowed,error:accessError}=await client.rpc("zion_game_call_access",{p_room:gameId});
  if(accessError||allowed!==true)return NextResponse.json({error:"Join an active friend game room first. The V71 game-call migration must be installed."},{status:403});
  const { data: profile } = await client.from("profiles").select("username").eq("id", auth.user.id).maybeSingle();
  const room = `zion-forest-${createHmac("sha256", apiSecret).update(gameId).digest("hex").slice(0, 32)}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: auth.user.id,
    name: String(profile?.username || "ZION player").slice(0, 40),
    ttl: "5m",
    metadata: JSON.stringify({ gameId: gameId }),
  });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false });
  return NextResponse.json({ token: await token.toJwt(), serverUrl: livekitUrl });
}
