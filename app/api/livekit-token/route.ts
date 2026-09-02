import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!livekitUrl || !apiKey || !apiSecret || !supabaseUrl || !supabaseKey)
    return NextResponse.json(
      { error: "Meeting service is not configured." },
      { status: 503 },
    );

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!bearer)
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(bearer);
  if (error || !data.user)
    return NextResponse.json(
      { error: "Invalid login session." },
      { status: 401 },
    );

  const body = await request.json().catch(() => ({}));
  const meetingId = clean(body.meetingId, 40).toUpperCase();
  const passcode = clean(body.passcode, 64);
  if (!/^[A-Z0-9-]{6,40}$/.test(meetingId) || passcode.length < 6)
    return NextResponse.json(
      {
        error:
          "Use a valid Meeting ID and a passcode of at least 6 characters.",
      },
      { status: 400 },
    );

  const roomName = `zion-${createHmac("sha256", apiSecret)
    .update(`${meetingId}:${passcode}`)
    .digest("hex")
    .slice(0, 32)}`;
  const { data: profile } = await authClient
    .from("profiles")
    .select("username")
    .eq("id", data.user.id)
    .maybeSingle();
  const token = new AccessToken(apiKey, apiSecret, {
    identity: data.user.id,
    name: clean(profile?.username, 40) || "ZION participant",
    ttl: "2h",
    metadata: JSON.stringify({ meetingId }),
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return NextResponse.json({
    token: await token.toJwt(),
    serverUrl: livekitUrl,
  });
}
