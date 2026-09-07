import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";
import { livekitConfig } from '@/lib/livekit-config';

export const runtime = "nodejs";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  let config:ReturnType<typeof livekitConfig>;
  try {config=livekitConfig(process.env);} catch {
    return NextResponse.json({error:'Meeting service settings are missing or invalid. The owner must check the LiveKit URL, API key and secret in Vercel, then redeploy.',code:'MEETING_CONFIG_INVALID'},{status:503});
  }
  const {serverUrl:livekitUrl,apiUrl,apiKey,apiSecret}=config;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    global: { headers: { Authorization: `Bearer ${bearer}` } },
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
    .select("username,is_banned")
    .eq("id", data.user.id)
    .maybeSingle();
  if(!profile||profile.is_banned)return NextResponse.json({error:'An active ZION profile is required.'},{status:403});
  // Verify that the deployed URL and key pair are accepted by that LiveKit server.
  // This read-only preflight does not create a room or send the secret to the browser.
  const serviceToken=new AccessToken(apiKey,apiSecret,{ttl:'1m'});
  serviceToken.addGrant({roomList:true});
  try {
    const check=await fetch(`${apiUrl}/twirp/livekit.RoomService/ListRooms`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await serviceToken.toJwt()}`},
      body:JSON.stringify({names:[roomName]}),signal:AbortSignal.timeout(7000),cache:'no-store',redirect:'error',
    });
    if(check.status===401||check.status===403)return NextResponse.json({error:'LiveKit rejected the server credentials. The owner must replace the LiveKit key and secret using the same project as the URL, then redeploy. Changing the meeting password will not fix this.',code:'LIVEKIT_CREDENTIALS_REJECTED'},{status:503});
    if(!check.ok)return NextResponse.json({error:'Meeting server is unavailable. Please retry later.',code:'LIVEKIT_UNAVAILABLE'},{status:503});
  }catch{return NextResponse.json({error:'Could not reach the meeting server. Check the LiveKit URL and retry.',code:'LIVEKIT_UNREACHABLE'},{status:503});}
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
  }, {headers:{'Cache-Control':'no-store'}});
}
