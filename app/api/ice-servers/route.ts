import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildIceServers, hasTurn } from "@/lib/ice-servers";

export const runtime = "nodejs";

// Returns STUN (+ TURN when configured) for private calls. Login required so TURN credentials stay private.
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Service is not configured." }, { status: 503 });
  if (!bearer) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(bearer);
  if (error || !data.user) return NextResponse.json({ error: "Invalid login session." }, { status: 401 });
  const iceServers = buildIceServers(process.env);
  return NextResponse.json({ iceServers, relay: hasTurn(iceServers) }, { headers: { "Cache-Control": "private, no-store" } });
}
