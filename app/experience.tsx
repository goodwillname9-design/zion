"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Clapperboard,
  Gamepad2,
  Globe2,
  Heart,
  MessageCircle,
  Search,
  Send,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ensureAnonymousUser, supabase } from "@/lib/supabase";
import { decryptText, encryptText, isE2EEEnvelope } from "@/lib/e2ee";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Stage = "welcome" | "matching" | "question" | "reveal" | "chat";
type MatchRow = {
  match_status: "waiting" | "matched";
  conversation_id: string | null;
  shared_question: string | null;
  conversation_expires_at: string | null;
};
type ChatMessage = {
  id: number;
  sender_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  display_message?: string;
  encrypted?: boolean;
};
export type ZionProfile = {
  id: string;
  username: string;
  gender: string;
  country: string;
  avatar: string;
  avatar_url?: string | null;
  created_at?: string;
  is_banned: boolean;
  ban_reason: string | null;
  allow_audio_calls?: boolean;
  show_country?: boolean;
  show_online_status?: boolean;
  profile_edit_used?: boolean;
  is_admin?: boolean;
  last_seen_at?: string;
  follower_base_count?: number;
};

export function Experience({
  profile,
  onOpenFriends,
  onOpenNotifications,
  onOpenCommunities,
  onOpenReels,
  onOpenProfile,
  onOpenFindFriends,
  onOpenGames,
  notificationCount = 0,
  onOpenAccountManager,
}: {
  profile?: ZionProfile;
  onOpenFriends?: () => void;
  onOpenNotifications?: () => void;
  onOpenCommunities?: () => void;
  onOpenReels?: () => void;
  onOpenProfile?: () => void;
  onOpenFindFriends?: () => void;
  onOpenGames?: () => void;
  notificationCount?: number;
  onOpenAccountManager?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [showZionIntro, setShowZionIntro] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [userId, setUserId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [partnerAnswer, setPartnerAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [seconds, setSeconds] = useState(600);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [friendNotice, setFriendNotice] = useState("");
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const profileHoldTimer = useRef<number | null>(null);
  const profileLongPressed = useRef(false);
  const startProfileHold = () => {
    profileLongPressed.current = false;
    profileHoldTimer.current = window.setTimeout(() => {
      profileLongPressed.current = true;
      onOpenAccountManager?.();
    }, 650);
  };
  const cancelProfileHold = () => {
    if (profileHoldTimer.current) window.clearTimeout(profileHoldTimer.current);
    profileHoldTimer.current = null;
  };
  const messageListRef = useRef<HTMLDivElement>(null);
  const randomChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const startMatching = useCallback(async () => {
    setError("");
    try {
      const user = await ensureAnonymousUser();
      setUserId(user.id);
      setConversationId("");
      setPartnerId("");
      setQuestion("");
      setAnswer("");
      setPartnerAnswer("");
      setAnswerSubmitted(false);
      setSubmittingAnswer(false);
      setMessages([]);
      setMessage("");
      setPartnerLeft(false);
      setPartnerOnline(false);
      setPartnerTyping(false);
      setSeconds(600);
      setStage("matching");
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Connection failed.",
      );
    }
  }, []);

  useEffect(() => {
    if (stage !== "matching" || !userId || !supabase) return;
    const client = supabase;
    let stopped = false;
    let matchingRequestRunning = false;

    const findMatch = async () => {
      if (matchingRequestRunning) return;
      matchingRequestRunning = true;
      try {
        const { data, error: matchError } = await client.rpc(
          "find_random_match",
          {
            p_language: "en",
          },
        );
        if (stopped) return;
        if (matchError) {
          setError(matchError.message);
          return;
        }
        const match = (data as MatchRow[] | null)?.[0];
        if (match?.match_status !== "matched" || !match.conversation_id) return;

        const { data: conversation } = await client
          .from("conversations")
          .select("user_a,user_b")
          .eq("id", match.conversation_id)
          .single();
        if (stopped) return;
        setConversationId(match.conversation_id);
        setQuestion(match.shared_question ?? "What made you smile today?");
        setExpiresAt(match.conversation_expires_at ?? "");
        const matchedPartner = conversation
          ? conversation.user_a === userId
            ? conversation.user_b
            : conversation.user_a
          : "";
        if (matchedPartner) setPartnerId(matchedPartner);
        const { data: existingAnswer } = await client
          .from("conversation_answers")
          .select("answer")
          .eq("conversation_id", match.conversation_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (stopped) return;
        if (existingAnswer?.answer) {
          setAnswer(
            (await decryptText(
              existingAnswer.answer,
              userId,
              matchedPartner,
              `random:${match.conversation_id}`,
            )) ?? "",
          );
          setAnswerSubmitted(true);
        }
        setStage("question");
      } finally {
        matchingRequestRunning = false;
      }
    };

    void findMatch();
    const interval = window.setInterval(() => void findMatch(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [stage, userId]);

  useEffect(() => {
    if (
      !answerSubmitted ||
      !conversationId ||
      stage !== "question" ||
      !supabase
    )
      return;
    const client = supabase;
    let stopped = false;

    const checkAnswers = async () => {
      const { data } = await client
        .from("conversation_answers")
        .select("user_id,answer")
        .eq("conversation_id", conversationId);
      if (stopped || !data || data.length < 2) return;
      const theirs = data.find((item) => item.user_id !== userId);
      if (theirs) {
        setPartnerAnswer(
          (await decryptText(
            theirs.answer,
            userId,
            theirs.user_id,
            `random:${conversationId}`,
          )) ?? "",
        );
        setStage("reveal");
      }
    };

    const initial = window.setTimeout(() => void checkAnswers(), 0);
    const channel = client
      .channel(`conversation-answers-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_answers",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void checkAnswers(),
      )
      .subscribe();
    return () => {
      stopped = true;
      window.clearTimeout(initial);
      void client.removeChannel(channel);
    };
  }, [answerSubmitted, conversationId, stage, userId]);

  useEffect(() => {
    if (stage !== "chat" || !expiresAt) return;
    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setSeconds(remaining);
      if (remaining === 0) {
        setError("Your 10-minute conversation has ended.");
        setStage("welcome");
      }
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, stage]);

  useEffect(() => {
    if (stage !== "chat" || !conversationId || !supabase) return;
    const client = supabase;
    let stopped = false;

    const refreshMessages = async () => {
      await client.rpc("mark_conversation_messages_read", {
        p_conversation_id: conversationId,
      });
      const { data } = await client
        .from("messages")
        .select("id,sender_id,message,created_at,read_at")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (!stopped) {
        const decrypted = await Promise.all(
          ((data as ChatMessage[] | null) ?? []).map(async (item) => ({
            ...item,
            display_message:
              (await decryptText(
                item.message,
                userId,
                partnerId,
                `random:${conversationId}`,
              )) ?? "",
            encrypted: isE2EEEnvelope(item.message),
          })),
        );
        if (!stopped) setMessages(decrypted);
      }
    };

    const initial = window.setTimeout(() => void refreshMessages(), 0);

    const channel = client
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (event) => {
          const incoming = event.new as ChatMessage;
          incoming.display_message =
            (await decryptText(
              incoming.message,
              userId,
              partnerId,
              `random:${conversationId}`,
            )) ?? "";
          incoming.encrypted = isE2EEEnvelope(incoming.message);
          setMessages((current) =>
            current.some((item) => item.id === incoming.id)
              ? current
              : [...current, incoming],
          );
          if (incoming.sender_id !== userId) {
            void client.rpc("mark_conversation_messages_read", {
              p_conversation_id: conversationId,
            });
          }
        },
      )
      .subscribe();
    return () => {
      stopped = true;
      window.clearTimeout(initial);
      void client.removeChannel(channel);
    };
  }, [conversationId, partnerId, stage, userId]);

  useEffect(() => {
    if (
      !conversationId ||
      !supabase ||
      !["question", "reveal", "chat"].includes(stage)
    )
      return;
    const client = supabase;
    let stopped = false;
    const checkConversation = async () => {
      const { data } = await client
        .from("conversations")
        .select("status")
        .eq("id", conversationId)
        .maybeSingle();
      if (!stopped && data?.status === "ended") setPartnerLeft(true);
    };
    const initial = window.setTimeout(() => void checkConversation(), 0);
    const channel = client
      .channel(`conversation-status-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (event) => {
          const row = event.new as { status?: string };
          if (row.status === "ended") setPartnerLeft(true);
        },
      )
      .subscribe();
    return () => {
      stopped = true;
      window.clearTimeout(initial);
      void client.removeChannel(channel);
    };
  }, [conversationId, stage]);

  useEffect(() => {
    if (
      !conversationId ||
      !userId ||
      !supabase ||
      !["question", "reveal", "chat"].includes(stage)
    )
      return;
    const client = supabase;
    const channel = client.channel(`random-room-${conversationId}`, {
      config: { private: true, presence: { key: userId } },
    });
    randomChannelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPartnerOnline(Boolean(partnerId && state[partnerId]));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== userId)
          setPartnerTyping(Boolean(payload.typing));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online: true });
      });
    return () => {
      randomChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [conversationId, partnerId, stage, userId]);

  const announceRandomTyping = () => {
    void randomChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, typing: true },
    });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      void randomChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, typing: false },
      });
    }, 900);
  };

  useEffect(() => {
    if (stage !== "chat" || !messageListRef.current) return;
    messageListRef.current.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, stage]);

  const submitAnswer = async () => {
    if (
      !supabase ||
      answer.trim().length < 3 ||
      submittingAnswer ||
      answerSubmitted
    )
      return;
    setError("");
    setSubmittingAnswer(true);
    setAnswerSubmitted(true);
    if (!partnerId) {
      setError("Secure connection is still being prepared.");
      setAnswerSubmitted(false);
      setSubmittingAnswer(false);
      return;
    }
    try {
      const encryptedAnswer = await encryptText(
        answer.trim(),
        userId,
        partnerId,
        `random:${conversationId}`,
      );
      const { error: submitError } = await supabase.rpc(
        "submit_conversation_answer",
        {
          p_conversation_id: conversationId,
          p_answer: encryptedAnswer,
        },
      );
      if (submitError) throw submitError;
    } catch {
      setError("ZION could not connect. Please try again.");
      setAnswerSubmitted(false);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const sendMessage = async () => {
    if (!supabase || !message.trim() || partnerLeft || !partnerId) return;
    const text = message.trim();
    try {
      const encrypted = await encryptText(
        text,
        userId,
        partnerId,
        `random:${conversationId}`,
      );
      const { error: sendError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        message: encrypted,
      });
      if (sendError) throw sendError;
      setMessage("");
    } catch {
      setError("ZION could not connect. Please try again.");
    }
  };

  const nextHuman = async () => {
    if (supabase && conversationId) {
      await supabase.rpc("leave_random_conversation", {
        p_conversation_id: conversationId,
      });
    }
    await startMatching();
  };

  const blockAndReport = async () => {
    if (!supabase || !partnerId || !conversationId) return;
    const reason = window.prompt("Briefly tell us what happened:");
    if (!reason?.trim()) return;
    await supabase.from("conversation_reports").insert({
      conversation_id: conversationId,
      reporter_id: userId,
      reported_user_id: partnerId,
      reason: reason.trim().slice(0, 200),
    });
    await supabase
      .from("user_blocks")
      .insert({ blocker_id: userId, blocked_id: partnerId });
    await nextHuman();
  };

  const addCurrentFriend = async () => {
    if (!supabase || !partnerId) return;
    setFriendNotice("");
    const { data, error: friendError } = await supabase.rpc(
      "request_zion_friend",
      {
        p_user_id: partnerId,
      },
    );
    setFriendNotice(
      friendError
        ? friendError.message
        : data === "accepted"
          ? "You are now friends."
          : "Friend request sent.",
    );
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => setShowZionIntro(true)}
          aria-label="Open ZION welcome animation"
        >
          <span className="brand-mark">
            <Heart size={17} fill="currentColor" />
          </span>
          <span>ZION</span>
        </button>
        <div className="topbar-actions">
          <button className="friends-nav" type="button" onClick={onOpenFriends}>
            <Users size={16} />
            <b>Friends</b>
          </button>
          <button
            className="friends-nav"
            type="button"
            onClick={onOpenFindFriends}
          >
            <Search size={16} />
            <b>Find Friends</b>
          </button>
          <button className="friends-nav" type="button" onClick={onOpenGames}>
            <Gamepad2 size={16} />
            <b>Games</b>
          </button>
          <button
            className="friends-nav community-nav"
            type="button"
            onClick={onOpenCommunities}
          >
            <Globe2 size={16} />
            <b>Communities</b>
          </button>
          <button
            className="friends-nav reels-nav"
            type="button"
            onClick={onOpenReels}
          >
            <Clapperboard size={16} />
            <b>Reels</b>
          </button>
          <button
            className="friends-nav notification-nav"
            type="button"
            onClick={onOpenNotifications}
          >
            <Bell size={16} />
            <b>Notifications</b>
            {notificationCount ? <em>{notificationCount}</em> : null}
          </button>
          <button
            className="profile-chip"
            type="button"
            onPointerDown={startProfileHold}
            onPointerUp={cancelProfileHold}
            onPointerCancel={cancelProfileHold}
            onPointerLeave={cancelProfileHold}
            onContextMenu={(event) => {
              event.preventDefault();
              cancelProfileHold();
              onOpenAccountManager?.();
            }}
            onClick={() => {
              if (profileLongPressed.current) {
                profileLongPressed.current = false;
                return;
              }
              onOpenProfile?.();
            }}
            aria-label="Open profile. Hold to add or switch account"
          >
            <span>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" />
              ) : (
                (profile?.avatar ?? "🙂")
              )}
            </span>
            <b>{profile?.username ?? "Profile"}</b>
          </button>
          <div className="nav-note">
            <span className="live-dot" /> Realtime connection
          </div>
        </div>
      </nav>
      {showZionIntro ? (
        <div
          className="zion-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to ZION"
        >
          <button
            className="zion-close"
            type="button"
            onClick={() => setShowZionIntro(false)}
            aria-label="Close animation"
          >
            ×
          </button>
          <div className="zion-stars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="zion-title">
            <span>WELCOME TO</span>
            <strong>ZION</strong>
            <small>Two strangers. One real hello.</small>
          </div>
          <div className="zion-people" aria-hidden="true">
            <div className="zion-person zion-boy">
              <div className="hi-bubble">Hi!</div>
              <div className="person-head">
                <i className="hair" />
                <i className="eye eye-one" />
                <i className="eye eye-two" />
                <i className="smile" />
              </div>
              <div className="person-body" />
              <div className="wave-arm" />
            </div>
            <div className="hello-line">
              <i />
              <Heart size={25} fill="currentColor" />
              <i />
            </div>
            <div className="zion-person zion-girl">
              <div className="hi-bubble">Hello!</div>
              <div className="person-head">
                <i className="hair" />
                <i className="eye eye-one" />
                <i className="eye eye-two" />
                <i className="smile" />
              </div>
              <div className="person-body" />
              <div className="wave-arm" />
            </div>
          </div>
          <button
            className="zion-enter"
            type="button"
            onClick={() => setShowZionIntro(false)}
          >
            Start meeting kindly <ArrowRight size={17} />
          </button>
        </div>
      ) : null}
      <section className="hero" id="top">
        <div className="copy-panel">
          <div className="eyebrow">
            <Sparkles size={14} /> A kinder way to meet someone new
          </div>
          <h1>
            One question.
            <br />
            <span>Ten honest minutes.</span>
          </h1>
          <p className="lead">
            Meet a stranger through what they think—not what they look like. No
            followers. No swiping. Just a small, real human moment.
          </p>
          <div className="trust-row">
            <span>
              <Shield size={15} /> 18+ & anonymous
            </span>
            <span>
              <Globe2 size={15} /> Realtime matching
            </span>
          </div>
        </div>
        <div className="scene" aria-hidden="true">
          <div className="orbit orbit-a">
            <span className="satellite sat-a" />
          </div>
          <div className="orbit orbit-b">
            <span className="satellite sat-b" />
          </div>
          <div className="halo" />
          <div className="human-core">
            <div className="core-glow" />
            <MessageCircle size={42} strokeWidth={1.5} />
          </div>
          <div className="avatar-orb avatar-one">A</div>
          <div className="avatar-orb avatar-two">M</div>
          <div className="connection-line" />
          <div className="float-card card-one">
            <Users size={15} /> Two strangers
          </div>
          <div className="float-card card-two">
            <Heart size={15} /> Ten real minutes
          </div>
        </div>
        <div className="experience-card">
          {stage === "welcome" ? (
            <div className="stage welcome-stage">
              <span className="mini-label">Ready when you are</span>
              <h2>Meet a human, not a profile.</h2>
              <p>
                You will both answer the same question before either answer is
                revealed.
              </p>
              <label className="age-check">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(event) => setAgeConfirmed(event.target.checked)}
                />{" "}
                I confirm I am 18 or older
              </label>
              {error ? <p className="error-note">{error}</p> : null}
              <Button
                className="primary-action"
                disabled={!ageConfirmed}
                onClick={() => void startMatching()}
              >
                Meet someone <ArrowRight size={18} />
              </Button>
              <small>
                Be respectful. Never share passwords, money, phone numbers, or
                exact location.
              </small>
            </div>
          ) : null}
          {stage === "matching" ? (
            <div className="stage center-stage">
              <div className="match-visual">
                <span />
                <span />
                <i />
              </div>
              <span className="mini-label">Looking around the world</span>
              <h2>Finding a thoughtful human…</h2>
              <p>Keep this screen open while another person joins.</p>
              {error ? <p className="error-note">{error}</p> : null}
              <Button variant="outline" onClick={() => setStage("welcome")}>
                Cancel
              </Button>
            </div>
          ) : null}
          {stage === "question" ? (
            <div className="stage">
              <div className="step-line">
                <span>01</span>
                <i />
                <b>02</b>
              </div>
              <span className="mini-label">Your shared question</span>
              <div
                className={`random-presence ${partnerOnline ? "online" : "waiting"}`}
              >
                <span>🙂</span>
                <div>
                  <b>
                    {partnerOnline
                      ? "Your stranger is here"
                      : "Waiting for your stranger…"}
                  </b>
                  {partnerTyping ? (
                    <small>
                      <i />
                      <i />
                      <i /> typing an answer
                    </small>
                  ) : (
                    <small>
                      {partnerOnline
                        ? "Ready to answer with you"
                        : "Connecting…"}
                    </small>
                  )}
                </div>
              </div>
              <h2 className="question">“{question}”</h2>
              <textarea
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  announceRandomTyping();
                }}
                placeholder="Write something honest…"
                maxLength={280}
                disabled={answerSubmitted}
                autoFocus
              />
              <div className="input-meta">
                <span>
                  {answerSubmitted
                    ? "Waiting for your stranger…"
                    : "Your stranger sees nothing until both answer"}
                </span>
                <span>{answer.length}/280</span>
              </div>
              {error ? <p className="error-note">{error}</p> : null}
              {partnerLeft ? (
                <div className="partner-left-notice">
                  Your stranger moved to the next chat.
                  <Button variant="outline" onClick={() => void nextHuman()}>
                    Find next human
                  </Button>
                </div>
              ) : null}
              <Button
                className="primary-action"
                disabled={
                  answer.trim().length < 3 ||
                  answerSubmitted ||
                  submittingAnswer
                }
                onClick={() => void submitAnswer()}
              >
                {submittingAnswer
                  ? "Submitting…"
                  : answerSubmitted
                    ? "Answer shared"
                    : "Share my answer"}{" "}
                <ArrowRight size={18} />
              </Button>
              {!partnerLeft ? (
                <Button variant="outline" onClick={() => void nextHuman()}>
                  Skip waiting · Next human
                </Button>
              ) : null}
            </div>
          ) : null}
          {stage === "reveal" ? (
            <div className="stage reveal-stage">
              <span className="mini-label">Both answers are in</span>
              <div className="answer-bubble mine">
                <small>You</small>
                {answer}
              </div>
              <div className="answer-bubble theirs">
                <small>Your stranger</small>
                {partnerAnswer}
              </div>
              {partnerLeft ? (
                <div className="partner-left-notice">
                  Your stranger moved to the next chat.
                  <Button variant="outline" onClick={() => void nextHuman()}>
                    Find next human
                  </Button>
                </div>
              ) : null}
              <Button
                className="primary-action"
                onClick={() => setStage("chat")}
              >
                Start your 10 minutes <MessageCircle size={18} />
              </Button>
            </div>
          ) : null}
          {stage === "chat" ? (
            <div className="stage chat-stage">
              <div className="chat-head">
                <div>
                  <span className="live-dot" /> End-to-end encrypted · Next
                  anytime
                </div>
                <strong>
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </strong>
              </div>
              <div
                className={`random-presence compact ${partnerOnline ? "online" : "waiting"}`}
              >
                <span>🙂</span>
                <div>
                  <b>
                    {partnerOnline
                      ? "Stranger is in this chat"
                      : "Stranger is reconnecting…"}
                  </b>
                  {partnerTyping ? (
                    <small>
                      <i />
                      <i />
                      <i /> typing a message
                    </small>
                  ) : (
                    <small>
                      {partnerOnline ? "Online now" : "Please wait"}
                    </small>
                  )}
                </div>
              </div>
              <div className="chat-window message-list" ref={messageListRef}>
                {messages.length ? (
                  messages.map((item) => (
                    <div
                      key={item.id}
                      className={`answer-bubble ${item.sender_id === userId ? "mine" : "theirs"}`}
                    >
                      <span className="message-text">
                        {item.display_message ?? item.message}
                      </span>
                      {item.sender_id === userId ? (
                        <span
                          className={`message-receipt ${item.read_at ? "read" : "sent"}`}
                          aria-label={item.read_at ? "Read" : "Sent"}
                        >
                          {item.read_at ? "✓✓" : "✓"}
                        </span>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="empty-chat">Say hello with kindness.</p>
                )}
              </div>
              {partnerLeft ? (
                <div className="partner-left-notice">
                  Your stranger has left this chat. Tap Next human to meet
                  someone new.
                </div>
              ) : null}
              <div className="message-compose">
                <input
                  disabled={partnerLeft}
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    announceRandomTyping();
                  }}
                  onKeyDown={(event) =>
                    event.key === "Enter" && void sendMessage()
                  }
                  maxLength={500}
                  placeholder={
                    partnerLeft ? "Partner left the chat" : "Write a message…"
                  }
                />
                <Button
                  disabled={partnerLeft}
                  size="icon"
                  onClick={() => void sendMessage()}
                >
                  <Send size={16} />
                </Button>
              </div>
              {friendNotice ? (
                <div className="friend-notice">{friendNotice}</div>
              ) : null}
              <div className="chat-actions">
                <Button variant="outline" onClick={() => void nextHuman()}>
                  Next human
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void addCurrentFriend()}
                >
                  Add friend
                </Button>
                <Button
                  className="primary-action"
                  onClick={() => void sendMessage()}
                >
                  Send kindness
                </Button>
              </div>
              <button
                className="report-link"
                type="button"
                onClick={() => void blockAndReport()}
              >
                Block and report this conversation
              </button>
            </div>
          ) : null}
        </div>
      </section>
      <footer>
        <Shield size={14} /> No photos · No exact location · No public profiles{" "}
        <span>Designed for kinder internet moments.</span>
      </footer>
    </main>
  );
}
