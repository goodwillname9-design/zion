"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  LockKeyhole,
  LogIn,
  Plus,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import { supabase } from "@/lib/supabase";

const makeCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => (value % 36).toString(36))
    .join("")
    .toUpperCase();
};

export function MeetingRoom() {
  const [meetingId, setMeetingId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inviteUrl = useMemo(
    () =>
      meetingId
        ? `${typeof window === "undefined" ? "" : window.location.origin}/meeting?id=${encodeURIComponent(meetingId)}`
        : "",
    [meetingId],
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setMeetingId(id.toUpperCase());
  }, []);

  const createMeeting = () => {
    setMeetingId(makeCode());
    setPasscode(makeCode());
    setError("");
  };
  const connect = async () => {
    if (!supabase) return setError("Supabase is not configured.");
    if (meetingId.trim().length < 6 || passcode.length < 6)
      return setError(
        "Enter the Meeting ID and a passcode of at least 6 characters.",
      );
    setBusy(true);
    setError("");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setBusy(false);
      return setError("Open ZION and log in before joining a meeting.");
    }
    const response = await fetch("/api/livekit-token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ meetingId, passcode }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok)
      return setError(result.error || "Could not join meeting.");
    setToken(result.token);
    setServerUrl(result.serverUrl);
  };

  if (token && serverUrl)
    return (
      <main className="zion-meeting-active" data-lk-theme="default">
        <div className="meeting-secure-label">
          <ShieldCheck /> Secure ZION meeting · {meetingId}
        </div>
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          audio
          video
          onDisconnected={() => setToken("")}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </main>
    );

  return (
    <main className="meeting-shell">
      <section className="meeting-card">
        <a href="/" className="meeting-brand">
          ♥ <b>ZION</b>
        </a>
        <div className="meeting-icon">
          <Video />
        </div>
        <span className="mini-label">PRIVATE BUSINESS MEETINGS</span>
        <h1>
          Meet securely.
          <br />
          Share clearly.
        </h1>
        <p>
          Group video and audio calls with protected room access and screen
          sharing.
        </p>
        <label>
          Meeting ID
          <input
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value.toUpperCase())}
            placeholder="Example: A8K2QZ"
            maxLength={40}
          />
        </label>
        <label>
          <span>
            <LockKeyhole /> Meeting passcode
          </span>
          <input
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            type="password"
            placeholder="Minimum 6 characters"
            maxLength={64}
          />
        </label>
        {error ? <p className="meeting-error">{error}</p> : null}
        <div className="meeting-actions">
          <button onClick={createMeeting}>
            <Plus /> Create meeting
          </button>
          <button
            className="primary"
            onClick={() => void connect()}
            disabled={busy}
          >
            <LogIn /> {busy ? "Connecting…" : "Join meeting"}
          </button>
        </div>
        {inviteUrl ? (
          <div className="meeting-invite">
            <div>
              <Users />
              <span>
                <b>Invite link ready</b>
                <small>Share the passcode separately.</small>
              </span>
            </div>
            <button
              onClick={() => void navigator.clipboard.writeText(inviteUrl)}
            >
              <Copy /> Copy link
            </button>
          </div>
        ) : null}
        <small className="meeting-note">
          <ShieldCheck /> Only authenticated ZION users receive a short-lived
          meeting token.
        </small>
      </section>
    </main>
  );
}
