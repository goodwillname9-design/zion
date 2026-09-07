"use client";

import { useState } from "react";
import { Headphones, Mic } from "lucide-react";
import { ControlBar, LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { supabase } from "@/lib/supabase";

export function GameVoice({ gameId }: { gameId: string }) {
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const join = async () => {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Login required.");
      const response = await fetch("/api/game-voice-token", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ gameId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Voice chat unavailable.");
      setToken(result.token); setServerUrl(result.serverUrl);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Voice chat unavailable.");
    } finally { setBusy(false); }
  };
  if (!token || !serverUrl)
    return <div className="game-voice-join"><Headphones/><span><b>Private game voice</b><small>Active players only · encrypted transport</small></span><button onClick={() => void join()} disabled={busy}><Mic/>{busy ? "Joining…" : "Join Voice"}</button>{error ? <em>{error}</em> : null}</div>;
  return <div className="game-voice-live" data-lk-theme="default"><span><i/> Voice connected</span><LiveKitRoom token={token} serverUrl={serverUrl} connect audio video={false} onDisconnected={() => setToken("")}><RoomAudioRenderer/><ControlBar controls={{ camera: false, screenShare: false, chat: false, leave: true }}/></LiveKitRoom></div>;
}
