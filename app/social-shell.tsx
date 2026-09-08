"use client";

import PublicFeed from "./public-feed";
import MessageTime from "./message-time";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  Gamepad2,
  ImagePlus,
  Heart,
  LogOut,
  Mic,
  MicOff,
  Moon,
  Pencil,
  Phone,
  PhoneOff,
  Play,
  Pause,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sun,
  Trash2,
  UserRound,
  UserRoundPlus,
  Users,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {uniqueGameInvites} from "@/lib/game-invites";
import {useGameLaunch} from "@/lib/use-game-launch";
import {
  decryptFile,
  decryptGroupText,
  decryptGroupFile,
  decryptText,
  encryptFile,
  encryptGroupText,
  encryptGroupFile,
  encryptText,
  ensureE2EEIdentity,
  createGroupSecret,
  hasLocalE2EEIdentity,
  isE2EEEnvelope,
} from "@/lib/e2ee";
import { Experience, type ZionProfile } from "./experience";
import { countryLabel, countryOptions } from "./countries";
import { uploadResumable } from "@/lib/resumable-upload";
import { FriendGames } from "./friend-games";
import { ProfileReels, ZionReels } from "./zion-reels";

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  accepted_at?: string | null;
  streak_count: number;
  last_streak_date: string | null;
};
type GameInvite = {
  id: string;
  friendship_id: string;
  inviter_id: string;
  opponent_id: string;
  game_type: "ludo" | "chess" | "tic_tac_toe";
  status: "pending" | "active" | "declined" | "finished";
  participant_ids: string[];
  accepted_ids: string[];
};
type ActivityNotice = {
  id: number;
  actor_id: string;
  kind:
    | "reel_like"
    | "reel_comment"
    | "profile_follow"
    | "profile_follow_request"
    | "story_like"
    | "screenshot_attempt";
  reel_id: string | null;
  follow_request_id: string | null;
  created_at: string;
  read_at: string | null;
};
type FriendMessage = {
  id: number;
  friendship_id: string;
  sender_id: string;
  message: string | null;
  media_path: string | null;
  media_type: "image" | "video" | "audio" | null;
  view_once: boolean;
  viewed_at: string | null;
  hidden_for: string[];
  created_at: string;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: number | null;
  media_url?: string;
  display_message?: string | null;
  encrypted?: boolean;
};
const avatars = ["👨🏽", "👨🏻‍🦱", "👨🏿‍🦲", "🧔🏼", "👩🏽", "👩🏻‍🦱", "👩🏿", "👱🏼‍♀️", "🧑🏾", "🧑🏻‍🦰"];
const ZION_CEO_ID = "fd62030e-f3b8-4c14-bce7-a1f3eedbb74b";
const streakBadge = (count: number) =>
  count >= 360 ? "🖤💛❤️" : count >= 30 ? "❤️" : count >= 10 ? "💛" : "🖤";
const lastSeenLabel = (profile?: ZionProfile, online = false) => {
  if (online) return "Online now";
  if (!profile?.show_online_status || !profile.last_seen_at)
    return "Last seen private";
  const date = new Date(profile.last_seen_at);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 90) return "Last seen just now";
  if (seconds < 3600) return `Last seen ${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `Last seen ${Math.floor(seconds / 3600)} hr ago`;
  return `Last seen ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
};
const DEVICE_ACCOUNTS_KEY = "zion-device-usernames";
const withTimeout = <T,>(promise: PromiseLike<T>, milliseconds: number) =>
  Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      window.setTimeout(
        () => reject(new Error("ZION connection timed out. Please try again.")),
        milliseconds,
      ),
    ),
  ]);
const deviceAccounts = () => {
  if (typeof window === "undefined") return [] as string[];
  try {
    return JSON.parse(
      localStorage.getItem(DEVICE_ACCOUNTS_KEY) || "[]",
    ) as string[];
  } catch {
    return [] as string[];
  }
};
const rememberDeviceAccount = (username: string) => {
  const current = deviceAccounts();
  if (
    !current.some(
      (item) => item.toLocaleLowerCase() === username.toLocaleLowerCase(),
    )
  )
    localStorage.setItem(
      DEVICE_ACCOUNTS_KEY,
      JSON.stringify([...current, username].slice(-2)),
    );
};
const usernameAuthEmail = async (username: string) => {
  const normalized = username.normalize("NFKC").trim().toLocaleLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  // Supabase validates this internal identifier as an email. Keep the local
  // part well below the 64-character email limit; users never see or enter it.
  return `u-${hex.slice(0, 48)}@login.zion-one-nu.vercel.app`;
};
function ProfileAvatar({
  profile,
  className = "",
}: {
  profile?: Partial<ZionProfile>;
  className?: string;
}) {
  return (
    <span className={`profile-avatar ${className}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username ?? "Profile"} />
      ) : (
        (profile?.avatar ?? "🙂")
      )}
    </span>
  );
}
function ProfileDetails({
  profile,
  label = "ZION Profile",
  followerCount,
  followingCount,
  postCount,
  onAvatarClick,
  onFollowersClick,
  onFollowingClick,
  onPostsClick,
}: {
  profile: ZionProfile;
  label?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  onAvatarClick?: () => void;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  onPostsClick?: () => void;
}) {
  const [loadedCounts, setLoadedCounts] = useState({ posts: 0, followers: 0, following: 0 });
  useEffect(() => {
    if (!supabase || (postCount !== undefined && followerCount !== undefined && followingCount !== undefined)) return;
    void (async () => {
      const [posts, followers, following] = await Promise.all([
        supabase!.from("zion_reels").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
        supabase!.from("profile_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.id),
        supabase!.from("profile_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile.id),
      ]);
      setLoadedCounts({ posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 });
    })();
  }, [profile.id, postCount, followerCount, followingCount]);
  const counts = {
    posts: postCount ?? loadedCounts.posts,
    followers: followerCount ?? loadedCounts.followers,
    following: followingCount ?? loadedCounts.following,
  };
  const joined = profile.created_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
        new Date(profile.created_at),
      )
    : "Not available";
  return (
    <div className="profile-details">
      {onAvatarClick ? (
        <button
          className="profile-avatar-edit"
          type="button"
          onClick={onAvatarClick}
          aria-label="Change profile photo"
        >
          <ProfileAvatar profile={profile} />
          <Camera />
        </button>
      ) : (
        <ProfileAvatar profile={profile} />
      )}
      <span className="mini-label">{label}</span>
      <h2>{profile.username}</h2>
      {profile.is_admin ? (
        <span className="admin-profile-badge">ADMIN · ZION OWNER</span>
      ) : null}
      <p className="profile-handle">@{profile.username}</p>
      <div className="profile-social-counts">
        <button type="button" onClick={onPostsClick} disabled={!onPostsClick}>
          <b>{counts.posts}</b>
          <small>Posts</small>
        </button>
        <button type="button" onClick={onFollowersClick} disabled={!onFollowersClick}>
          <b>
            {new Intl.NumberFormat(undefined, {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(counts.followers + (profile.follower_base_count ?? 0))}
          </b>
          <small>Followers</small>
        </button>
        <button type="button" onClick={onFollowingClick} disabled={!onFollowingClick}>
          <b>{counts.following}</b>
          <small>Following</small>
        </button>
      </div>
      <div className="profile-facts">
        <div>
          <b>{countryLabel(profile.country)}</b>
          <small>Country</small>
        </div>
        <div>
          <b className="capitalize">{profile.gender}</b>
          <small>Gender</small>
        </div>
        <div>
          <b>
            <CalendarDays /> {joined}
          </b>
          <small>Account created</small>
        </div>
      </div>
    </div>
  );
}

function SocialConnections({ profileId, initialMode = "followers" }: { profileId: string; initialMode?: "followers" | "following" }) {
  const [mode, setMode] = useState<"followers" | "following">(initialMode);
  const [people, setPeople] = useState<ZionProfile[]>([]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void (async () => {
      const { data } =
        mode === "followers"
          ? await client
              .from("profile_follows")
              .select("follower_id")
              .eq("following_id", profileId)
          : await client
              .from("profile_follows")
              .select("following_id")
              .eq("follower_id", profileId);
      const ids = (data ?? []).map((row) =>
        mode === "followers"
          ? (row as { follower_id: string }).follower_id
          : (row as { following_id: string }).following_id,
      );
      if (!ids.length) return setPeople([]);
      const { data: profiles } = await client
        .from("profiles")
        .select(
          "id,username,avatar,avatar_url,country,gender,is_banned,ban_reason",
        )
        .in("id", ids);
      setPeople((profiles as ZionProfile[] | null) ?? []);
    })();
  }, [mode, profileId]);
  return (
    <section className="social-connections">
      <div>
        <button
          className={mode === "followers" ? "active" : ""}
          onClick={() => setMode("followers")}
        >
          Followers
        </button>
        <button
          className={mode === "following" ? "active" : ""}
          onClick={() => setMode("following")}
        >
          Following
        </button>
      </div>
      {people.map((person) => (
        <article key={person.id}>
          <ProfileAvatar profile={person} />
          <b>{person.username}</b>
          <small>{countryLabel(person.country)}</small>
        </article>
      ))}
      {!people.length ? <p>No {mode} yet.</p> : null}
    </section>
  );
}

export function SocialShell() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ZionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const {gameId:autoGameId,clearGame}=useGameLaunch(user?.id);
  const [friendsInitialTab, setFriendsInitialTab] = useState<
    "friends" | "notifications" | "profile" | "communities" | "find" | "games"
  >("friends");
  useEffect(()=>{if(!autoGameId)return;const t=window.setTimeout(()=>{setFriendsInitialTab("games");setFriendsOpen(true);},0);return()=>window.clearTimeout(t);},[autoGameId]);
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [feedOpen,setFeedOpen] = useState(false);
  const [reelsOpen, setReelsOpen] = useState(false);
  const [error, setError] = useState("");
  const [notificationPrompt, setNotificationPrompt] = useState(false);
  const [notificationToast, setNotificationToast] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [friendUnreadCount, setFriendUnreadCount] = useState(0);
  const seenRealtimeEventsRef = useRef(new Set<string>());
  const notificationSeenAtRef = useRef(
    typeof window === "undefined"
      ? "1970-01-01T00:00:00.000Z"
      : localStorage.getItem("zion-notifications-seen-at") ??
          "1970-01-01T00:00:00.000Z",
  );
  const [openingIntro, setOpeningIntro] = useState(true);
  const [encryptionState, setEncryptionState] = useState<
    "idle" | "checking" | "ready" | "locked"
  >("idle");
  useEffect(() => {
    document.documentElement.dataset.theme =
      localStorage.getItem("zion-theme") === "day" ? "day" : "dark";
  }, []);
  const loadProfile = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser || !supabase) {
      setProfile(null);
      setLoading(false);
      setEncryptionState("idle");
      return;
    }
    setEncryptionState("checking");
    try {
      const { data, error: profileError } = await withTimeout(
        supabase
          .from("profiles")
          .select(
            "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,allow_audio_calls,show_country,show_online_status,profile_edit_used,is_admin,last_seen_at,follower_base_count,is_private",
          )
          .eq("id", nextUser.id)
          .maybeSingle(),
        10_000,
      );
      if (profileError) throw profileError;
      setProfile((data as ZionProfile | null) ?? null);
      if (data?.username) rememberDeviceAccount(data.username);
      const localIdentity = await withTimeout(
        hasLocalE2EEIdentity(nextUser.id),
        4_000,
      ).catch(() => false);
      setEncryptionState(localIdentity ? "ready" : "locked");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "ZION could not connect. Please try again.",
      );
      setUser(null);
      setProfile(null);
      setEncryptionState("idle");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ready = () => setEncryptionState("ready");
    window.addEventListener("zion-e2ee-ready", ready);
    return () => window.removeEventListener("zion-e2ee-ready", ready);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void withTimeout(supabase.auth.getSession(), 8_000)
      .then(({ data }) => loadProfile(data.session?.user ?? null))
      .catch((problem) => {
        setError(
          problem instanceof Error
            ? problem.message
            : "ZION could not connect. Please refresh and try again.",
        );
        setLoading(false);
        setEncryptionState("idle");
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => void loadProfile(session?.user ?? null),
    );
    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!user || !profile || !("Notification" in window)) return;
    const declined =
      Date.now() -
        Number(localStorage.getItem("zion-notifications-declined") || 0) <
      7 * 24 * 60 * 60 * 1000;
    if (Notification.permission === "default" && !declined)
      setNotificationPrompt(true);
  }, [profile, user]);

  useEffect(() => {
    if (!supabase || !user || !profile) return;
    const client = supabase;
    const touch = () => {
      if (document.visibilityState === "visible")
        void client.rpc("touch_zion_last_seen");
    };
    touch();
    const timer = window.setInterval(touch, 45_000);
    document.addEventListener("visibilitychange", touch);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", touch);
      void client.rpc("touch_zion_last_seen");
    };
  }, [profile, user]);

  useEffect(() => {
    if (!supabase || !user || !profile) return;
    const client = supabase;
    const refreshNotificationCount = async () => {
      const [friendRequests, gameInvites, activities, unreadMessages] = await Promise.all([
        client
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("addressee_id", user.id)
          .eq("status", "pending")
          .gt("created_at", notificationSeenAtRef.current),
        client
          .from("friend_games")
          .select("id,inviter_id,game_type,participant_ids,status")
          .contains("participant_ids", [user.id])
          .not("accepted_ids", "cs", `{${user.id}}`)
          .eq("status", "pending")
          .gt("created_at", notificationSeenAtRef.current),
        client
          .from("zion_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .is("read_at", null)
          .neq("kind", "profile_follow_request")
          .gt("created_at", notificationSeenAtRef.current),
        client
          .from("friend_messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", user.id)
          .is("read_at", null),
      ]);
      setNotificationCount(
        (friendRequests.count ?? 0) +
          uniqueGameInvites(gameInvites.data ?? []).length +
          (activities.count ?? 0),
      );
      setFriendUnreadCount(unreadMessages.count ?? 0);
    };
    void refreshNotificationCount();
    const channel = client
      .channel(`friend-request-alerts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_messages" },
        async (payload) => {
          void refreshNotificationCount();
          if (payload.eventType !== "INSERT") return;
          const row = payload.new as { id?: number; sender_id?: string };
          const eventKey = `message:${row.id ?? "unknown"}`;
          if (seenRealtimeEventsRef.current.has(eventKey)) return;
          seenRealtimeEventsRef.current.add(eventKey);
          if (!row.sender_id || row.sender_id === user.id) return;
          const { data: sender } = await client
            .from("profiles")
            .select("username,avatar")
            .eq("id", row.sender_id)
            .maybeSingle();
          const name = sender?.username ?? "A friend";
          setNotificationToast(`${sender?.avatar ?? "💬"} New message from ${name}`);
          window.setTimeout(() => setNotificationToast(""), 5000);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${user.id}`,
        },
        async (payload) => {
          void refreshNotificationCount();
          const row = payload.new as { id?: string; requester_id?: string; status?: string };
          const eventKey = `friend:${payload.eventType}:${row.id ?? row.requester_id ?? "unknown"}:${row.status ?? "unknown"}`;
          if (seenRealtimeEventsRef.current.has(eventKey)) return;
          seenRealtimeEventsRef.current.add(eventKey);
          if (row.status !== "pending" || !row.requester_id) return;
          const { data: sender } = await client
            .from("profiles")
            .select("username,avatar")
            .eq("id", row.requester_id)
            .maybeSingle();
          const name = sender?.username ?? "A ZION user";
          setNotificationToast(
            `${sender?.avatar ?? "🙂"} ${name} sent you a friend request`,
          );
          window.setTimeout(() => setNotificationToast(""), 6000);
          if (Notification.permission === "granted") {
            const registration = await navigator.serviceWorker?.ready;
            await registration?.showNotification("New ZION friend request", {
              body: `${name} wants to be your friend.`,
              icon: "/icons/zion-192.png",
              badge: "/icons/zion-192.png",
              tag: `friend-${row.requester_id}`,
              data: { url: "/" },
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_games",
        },
        async (payload) => {
          void refreshNotificationCount();
          const row = payload.new as {
            id?: string;
            inviter_id?: string;
            game_type?: GameInvite["game_type"];
            status?: string;
          };
          const gameRow = payload.new as unknown as GameInvite;
          if (
            payload.eventType !== "INSERT" ||
            row.status !== "pending" ||
            !row.inviter_id ||
            row.inviter_id === user.id ||
            !gameRow.participant_ids?.includes(user.id)
          )
            return;
          const eventKey = `game:${row.id ?? row.inviter_id}`;
          if (seenRealtimeEventsRef.current.has(eventKey)) return;
          seenRealtimeEventsRef.current.add(eventKey);
          const { data: sender } = await client
            .from("profiles")
            .select("username,avatar")
            .eq("id", row.inviter_id)
            .maybeSingle();
          const name = sender?.username ?? "A ZION friend";
          const gameName =
            row.game_type === "tic_tac_toe"
              ? "Tic-Tac-Toe"
              : row.game_type === "chess"
                ? "Chess"
                : "Ludo";
          setNotificationToast(
            `${sender?.avatar ?? "🎮"} ${name} invited you to ${gameName}`,
          );
          window.setTimeout(() => setNotificationToast(""), 6000);
          if (Notification.permission === "granted") {
            const registration = await navigator.serviceWorker?.ready;
            await registration?.showNotification("New ZION game invitation", {
              body: `${name} invited you to ${gameName}.`,
              icon: "/icons/zion-192.png",
              badge: "/icons/zion-192.png",
              tag: `game-${row.id ?? row.inviter_id}`,
              data: { url: "/" },
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "zion_notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          void refreshNotificationCount();
          if (payload.eventType !== "INSERT") return;
          const row = payload.new as { id?: number; actor_id?: string; kind?: string };
          const eventKey = `activity:${row.id ?? `${row.actor_id}:${row.kind}`}`;
          if (seenRealtimeEventsRef.current.has(eventKey)) return;
          seenRealtimeEventsRef.current.add(eventKey);
          if (!row.actor_id) return;
          const { data: actor } = await client
            .from("profiles")
            .select("username,avatar")
            .eq("id", row.actor_id)
            .maybeSingle();
          const action =
            row.kind === "reel_comment"
              ? "commented on your reel"
              : row.kind === "story_like"
                ? "liked your story"
                : row.kind === "profile_follow_request"
                  ? "requested to follow you"
                  : row.kind === "profile_follow"
                    ? "started following you"
                    : "liked your reel";
          setNotificationToast(
            `${actor?.avatar ?? "❤️"} ${actor?.username ?? "A ZION user"} ${action}`,
          );
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [profile, user]);

  const allowNotifications = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPrompt(false);
    if (result === "granted") {
      const registration = await navigator.serviceWorker?.ready;
      await registration?.showNotification("ZION notifications are ready", {
        body: "Friend requests will appear on this device.",
        icon: "/icons/zion-192.png",
        tag: "zion-ready",
      });
    }
  };
  const declineNotifications = () => {
    localStorage.setItem("zion-notifications-declined", String(Date.now()));
    setNotificationPrompt(false);
  };

  if (openingIntro)
    return <OpeningIntro onEnter={() => setOpeningIntro(false)} />;
  if (loading || encryptionState === "checking")
    return <AuthScreen title="Opening ZION…" />;
  if (!supabase)
    return <AuthScreen title="ZION needs Supabase configuration." />;
  if (!user) return <LoginScreen setError={setError} error={error} />;
  if (!profile) return <ProfileSetup user={user} onSaved={setProfile} />;
  if (profile.is_banned) return <BanScreen reason={profile.ban_reason} />;
  if (encryptionState === "locked")
    return (
      <EncryptionUnlock
        user={user}
        username={profile.username}
        onUnlocked={() => setEncryptionState("ready")}
      />
    );

  return (
    <>
      <Experience
        profile={profile}
        friendUnreadCount={friendUnreadCount}
        onOpenFriends={() => {
          setFriendsInitialTab("friends");
          setFriendsOpen(true);
        }}
        onOpenNotifications={() => {
          const seenAt = new Date().toISOString();
          notificationSeenAtRef.current = seenAt;
          localStorage.setItem("zion-notifications-seen-at", seenAt);
          setNotificationCount(0);
          void supabase?.rpc("mark_all_zion_notifications_read");
          setFriendsInitialTab("notifications");
          setFriendsOpen(true);
        }}
        onOpenCommunities={() => {
          setFriendsInitialTab("communities");
          setFriendsOpen(true);
        }}
        onOpenFeed={() => setFeedOpen(true)}
        onOpenReels={() => setReelsOpen(true)}
        onOpenProfile={() => {
          setFriendsInitialTab("profile");
          setFriendsOpen(true);
        }}
        onOpenFindFriends={() => {
          setFriendsInitialTab("find");
          setFriendsOpen(true);
        }}
        onOpenGames={() => {
          setFriendsInitialTab("games");
          setFriendsOpen(true);
        }}
        notificationCount={notificationCount}
        onOpenAccountManager={() => setAccountManagerOpen(true)}
      />
      {friendsOpen ? (
        <FriendsPanel
          requestedGameId={autoGameId}
          onRequestedGameOpened={clearGame}
          user={user}
          profile={profile}
          initialTab={friendsInitialTab}
          onProfileUpdated={setProfile}
          onNotificationsSeen={(count) =>
            setNotificationCount((current) => Math.max(0, current - count))
          }
          onClose={() => setFriendsOpen(false)}
        />
      ) : null}
      {accountManagerOpen ? (
        <AccountManager
          currentUsername={profile.username}
          onClose={() => setAccountManagerOpen(false)}
        />
      ) : null}
      {feedOpen && <PublicFeed user={user} onClose={()=>setFeedOpen(false)} />}
      {reelsOpen ? (
        <ZionReels user={user} onClose={() => setReelsOpen(false)} />
      ) : null}
      {notificationToast ? (
        <button
          className="notification-toast"
          onClick={() => {
            setFriendsInitialTab("notifications");
            setFriendsOpen(true);
            setNotificationToast("");
          }}
        >
          <Bell />
          {notificationToast}
        </button>
      ) : null}
      {notificationPrompt ? (
        <div className="notification-overlay" role="dialog" aria-modal="true">
          <section className="notification-card">
            <div className="notification-icon">
              <Bell />
            </div>
            <span className="mini-label">ZION Notifications</span>
            <h2>Allow friend request alerts?</h2>
            <p>
              Get an alert on this phone when someone sends you a friend
              request. You can change this later in your device settings.
            </p>
            <div className="install-actions">
              <button onClick={declineNotifications}>Decline</button>
              <button
                className="allow"
                onClick={() => void allowNotifications()}
              >
                Allow notifications
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AuthScreen({ title }: { title: string }) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">♥</div>
        <h1>{title}</h1>
      </div>
    </main>
  );
}

function OpeningIntro({ onEnter }: { onEnter: () => void }) {
  return (
    <main
      className="zion-overlay zion-opening-intro"
      aria-label="Welcome to ZION"
    >
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
        <small>Meet, connect and stay close.</small>
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
      <button className="zion-enter" type="button" onClick={onEnter}>
        Enter ZION <ArrowRight size={17} />
      </button>
    </main>
  );
}

function LoginScreen({
  error,
  setError,
}: {
  error: string;
  setError: (value: string) => void;
}) {
  const [accountMode, setAccountMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const usernameAccount = async () => {
    if (!supabase || username.trim().length < 3 || password.length < 6) return;
    const saved = deviceAccounts();
    const known = saved.some(
      (item) =>
        item.toLocaleLowerCase() === username.trim().toLocaleLowerCase(),
    );
    if (!known && saved.length >= 2) {
      setError(
        "This device already has two ZION accounts. Remove one saved account before adding another.",
      );
      return;
    }
    setAccountBusy(true);
    setError("");
    const authEmail = await usernameAuthEmail(username);
    if (accountMode === "signup") {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: { data: { zion_username: username.trim() } },
      });
      if (signupError)
        setError(
          signupError.message.toLowerCase().includes("registered")
            ? "That username is already registered. Choose another username or log in."
            : signupError.message,
        );
      else if (!data.session)
        setError(
          "Disable Confirm email in Supabase Authentication settings, then try again.",
        );
      else {
        try {
          await ensureE2EEIdentity(data.user!.id, password);
          rememberDeviceAccount(username.trim());
          window.dispatchEvent(new Event("zion-e2ee-ready"));
        } catch (problem) {
          await supabase.auth.signOut();
          setError(
            problem instanceof Error
              ? problem.message
              : "Encryption setup failed.",
          );
        }
      }
    } else {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });
      if (loginError) setError("Incorrect username or password.");
      else {
        try {
          await ensureE2EEIdentity(data.user.id, password);
          rememberDeviceAccount(username.trim());
          window.dispatchEvent(new Event("zion-e2ee-ready"));
        } catch (problem) {
          await supabase.auth.signOut();
          setError(
            problem instanceof Error
              ? problem.message
              : "Encryption setup failed.",
          );
        }
      }
    }
    setAccountBusy(false);
  };
  return (
    <main className="auth-shell">
      <section className="auth-card login-card">
        <div className="auth-logo">♥</div>
        <span className="mini-label">Welcome to ZION</span>
        <h1>Meet kindly. Stay safely.</h1>
        <p>
          Create a private username and password. Use the same details to log in
          on another phone or computer.
        </p>
        <div className="moderation-banner">
          <ShieldAlert size={18} />
          <span>
            Sexual harassment, hate, threats, scams and unwanted explicit
            content can result in an immediate ban.
          </span>
        </div>
        {error ? <p className="error-note">{error}</p> : null}
        <div className="account-mode">
          <button
            className={accountMode === "login" ? "active" : ""}
            onClick={() => setAccountMode("login")}
          >
            Log in
          </button>
          <button
            className={accountMode === "signup" ? "active" : ""}
            onClick={() => setAccountMode("signup")}
          >
            Create account
          </button>
        </div>
        <input
          className="account-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Unique username · any language"
          autoComplete="username"
          maxLength={24}
        />
        <input
          className="account-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void usernameAccount()}
          placeholder="Password · minimum 6 characters"
          autoComplete={
            accountMode === "signup" ? "new-password" : "current-password"
          }
        />
        <Button
          variant="outline"
          disabled={
            accountBusy || username.trim().length < 3 || password.length < 6
          }
          onClick={() => void usernameAccount()}
        >
          {accountBusy
            ? "Please wait…"
            : accountMode === "signup"
              ? "Create ZION account"
              : "Log in to ZION"}
        </Button>
        <small className="device-account-limit">
          Maximum two saved ZION accounts on this device.
        </small>
        <small>
          18+ only · Gender is self-declared, not identity-verified.
        </small>
      </section>
    </main>
  );
}

function EncryptionUnlock({
  user,
  username,
  onUnlocked,
}: {
  user: User;
  username: string;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unlock = async () => {
    if (password.length < 6) return;
    setBusy(true);
    setError("");
    try {
      await ensureE2EEIdentity(user.id, password);
      onUnlocked();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unlock failed.");
    }
    setBusy(false);
  };
  return (
    <main className="auth-shell">
      <section className="auth-card login-card">
        <div className="auth-logo">🔒</div>
        <span className="mini-label">END-TO-END ENCRYPTION</span>
        <h1>Unlock your private chats.</h1>
        <p>Enter the password for @{username}. It never leaves this device.</p>
        {error ? <p className="error-note">{error}</p> : null}
        <input
          className="account-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void unlock()}
          placeholder="Account password"
          autoFocus
        />
        <Button
          disabled={busy || password.length < 6}
          onClick={() => void unlock()}
        >
          {busy ? "Unlocking…" : "Unlock encrypted chats"}
        </Button>
      </section>
    </main>
  );
}

function AccountManager({
  currentUsername,
  onClose,
}: {
  currentUsername: string;
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<string[]>(() => deviceAccounts());
  const continueToLogin = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onClose();
  };
  const forget = (username: string) => {
    const next = accounts.filter((item) => item !== username);
    localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(next));
    setAccounts(next);
  };
  return (
    <div className="notification-overlay" role="dialog" aria-modal="true">
      <section className="notification-card account-manager-card">
        <button
          className="account-manager-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>
        <UserRound className="account-manager-icon" />
        <span className="mini-label">ZION ACCOUNTS</span>
        <h2>Add or switch account</h2>
        <p>Use a username and password to enter from this or another device.</p>
        <div className="saved-account-list">
          {accounts.map((name) => (
            <div key={name}>
              <UserRound />
              <span>
                <b>@{name}</b>
                <small>
                  {name === currentUsername
                    ? "Currently signed in"
                    : "Saved on this device"}
                </small>
              </span>
              {name !== currentUsername ? (
                <button onClick={() => forget(name)}>
                  <Trash2 /> Forget
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          className="account-switch-primary"
          onClick={() => void continueToLogin()}
        >
          <UserRoundPlus />{" "}
          {accounts.length < 2 ? "Add another account" : "Switch account"}
        </button>
        <small>For safety, passwords are never saved in this list.</small>
      </section>
    </div>
  );
}

function ProfileSetup({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (profile: ZionProfile) => void;
}) {
  const accountUsername =
    typeof user.user_metadata?.zion_username === "string"
      ? user.user_metadata.zion_username
      : "";
  const [username, setUsername] = useState(accountUsername);
  const [gender, setGender] = useState("male");
  const [country, setCountry] = useState("");
  const [avatar, setAvatar] = useState(avatars[0]);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const countries = useMemo(() => countryOptions(), []);
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP image under 5 MB.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setProfilePhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  };
  const save = async () => {
    if (!supabase || username.trim().length < 3 || country.trim().length < 2)
      return;
    setSaving(true);
    setError("");
    let avatar_url: string | null = null;
    if (profilePhoto) {
      const extension = profilePhoto.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${user.id}/profile.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, profilePhoto, {
          upsert: true,
          contentType: profilePhoto.type,
        });
      if (uploadError) {
        setSaving(false);
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(path);
      avatar_url = `${data.publicUrl}?v=${Date.now()}`;
    }
    const row = {
      id: user.id,
      username: username.trim(),
      gender,
      country: country.trim(),
      avatar,
      avatar_url,
    };
    const { data, error: saveError } = await supabase
      .from("profiles")
      .upsert(row)
      .select(
        "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason",
      )
      .single();
    setSaving(false);
    if (saveError)
      setError(
        saveError.code === "23505"
          ? "That username is already taken. Choose another one."
          : saveError.message,
      );
    else onSaved(data as ZionProfile);
  };
  return (
    <main className="auth-shell">
      <section className="auth-card profile-card">
        <span className="mini-label">Create your profile</span>
        <h1>Who are you on ZION?</h1>
        <label>
          Unique username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            readOnly={Boolean(accountUsername)}
            maxLength={24}
            placeholder="Any language · 3–24 characters"
          />
        </label>
        <div className="form-grid">
          <label>
            Gender
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Country
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              <option value="">Select your country</option>
              {countries.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.flag} {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="field-label">Choose an avatar</span>
        <input
          ref={photoInputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => choosePhoto(event.target.files?.[0])}
        />
        <button
          type="button"
          className="setup-photo-button"
          onClick={() => photoInputRef.current?.click()}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Selected profile preview" />
          ) : (
            <Camera />
          )}
          <span>
            <b>
              {photoPreview ? "Change gallery photo" : "Choose from gallery"}
            </b>
            <small>JPG, PNG or WebP · Maximum 5 MB</small>
          </span>
        </button>
        <span className="avatar-divider">or choose an avatar</span>
        <div className="avatar-picker">
          {avatars.map((item) => (
            <button
              type="button"
              className={avatar === item ? "selected" : ""}
              onClick={() => {
                setAvatar(item);
                setProfilePhoto(null);
                setPhotoPreview("");
              }}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="profile-note">
          Your username is unique. Malayalam, Arabic, Hindi and other languages
          are supported.
        </p>
        {error ? <p className="error-note">{error}</p> : null}
        <Button
          className="primary-action"
          disabled={saving || username.trim().length < 3 || !country}
          onClick={() => void save()}
        >
          {saving ? "Saving profile…" : "Enter ZION"}
        </Button>
      </section>
    </main>
  );
}

function BanScreen({ reason }: { reason: string | null }) {
  return (
    <main className="auth-shell">
      <section className="auth-card ban-card">
        <ShieldAlert size={42} />
        <h1>Account suspended</h1>
        <p>{reason ?? "This account violated ZION community safety rules."}</p>
        <div className="moderation-banner">
          Threats, hate, scams, harassment and unwanted explicit content are not
          allowed.
        </div>
      </section>
    </main>
  );
}

function FriendsPanel({
  requestedGameId, onRequestedGameOpened,
  user,
  profile,
  initialTab,
  onProfileUpdated,
  onNotificationsSeen,
  onClose,
}: {
  requestedGameId?:string|null;
  onRequestedGameOpened?:()=>void;
  user: User;
  profile: ZionProfile;
  initialTab:
    "friends" | "notifications" | "profile" | "communities" | "find" | "games";
  onProfileUpdated: (profile: ZionProfile) => void;
  onNotificationsSeen: (count: number) => void;
  onClose: () => void;
}) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);
  const [activityNotices, setActivityNotices] = useState<ActivityNotice[]>([]);
  const [gameToOpen, setGameToOpen] = useState<string | null>(null);
  const waitingAcceptedGamesRef = useRef(new Set<string>());
  const [profiles, setProfiles] = useState<Record<string, ZionProfile>>({});
  const [pins, setPins] = useState<string[]>([]);
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Friendship | null>(null);
  const [connectionView, setConnectionView] = useState<{
    profileId: string;
    username: string;
    mode: "followers" | "following";
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "friends"
    | "notifications"
    | "find"
    | "profile"
    | "communities"
    | "games"
    | "admin"
  >(initialTab);
  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<
    (ZionProfile & { friend_status?: string }) | null
  >(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [inspectedProfile, setInspectedProfile] = useState<ZionProfile | null>(
    null,
  );
  const profileFileRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!requestedGameId)return;const timer=window.setTimeout(()=>{setSelected(null);setInspectedProfile(null);setConnectionView(null);setSettingsOpen(false);setGameToOpen(requestedGameId);setActiveTab("games");onRequestedGameOpened?.();},0);return()=>window.clearTimeout(timer);},[requestedGameId,onRequestedGameOpened]);
  const [theme, setTheme] = useState<"dark" | "day">(() =>
    typeof window !== "undefined" &&
    localStorage.getItem("zion-theme") === "day"
      ? "day"
      : "dark",
  );
  const [allowCalls, setAllowCalls] = useState(true);
  const [showCountry, setShowCountry] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [isPrivate, setIsPrivate] = useState(Boolean(profile.is_private));
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editCountry, setEditCountry] = useState(profile.country);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [socialCounts, setSocialCounts] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });
  const load = useCallback(async () => {
    if (!supabase) return;
    const [
      { data: rows },
      { data: pinRows },
      { data: privacy },
      { data: followingRows },
      postCount,
      followerCount,
      followingCount,
      { data: recentMessages },
      { data: inviteRows },
      { data: activityRows },
    ] = await Promise.all([
      supabase
        .from("friendships")
        .select(
          "id,requester_id,addressee_id,status,created_at,accepted_at,streak_count,last_streak_date",
        )
        .order("created_at", { ascending: false }),
      supabase.from("friend_pins").select("friend_id").eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("allow_audio_calls,show_country,show_online_status,is_private")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profile_follows")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("zion_reels")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
      supabase
        .from("profile_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", user.id),
      supabase
        .from("profile_follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", user.id),
      supabase
        .from("friend_messages")
        .select("friendship_id,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("friend_games")
        .select(
          "id,friendship_id,inviter_id,opponent_id,game_type,status,participant_ids,accepted_ids",
        )
        .contains("participant_ids", [user.id])
        .not("accepted_ids", "cs", `{${user.id}}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("zion_notifications")
        .select("id,actor_id,kind,reel_id,follow_request_id,created_at,read_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const list = (rows as Friendship[] | null) ?? [];
    setFriendships(list);
    setPins((pinRows ?? []).map((item) => item.friend_id));
    setFollowingIds((followingRows ?? []).map((item) => item.following_id));
    const recentByFriendship: Record<string, string> = {};
    for (const message of recentMessages ?? []) {
      if (!recentByFriendship[message.friendship_id])
        recentByFriendship[message.friendship_id] = message.created_at;
    }
    setLastMessageAt(recentByFriendship);
    setSocialCounts({
      posts: postCount.count ?? 0,
      followers: followerCount.count ?? 0,
      following: followingCount.count ?? 0,
    });
    setGameInvites(uniqueGameInvites((inviteRows as GameInvite[] | null) ?? []));
    const seenActivityKeys = new Set<string>();
    const activities = ((activityRows as ActivityNotice[] | null) ?? []).filter(
      (notice) => {
        if (notice.kind === "profile_follow_request" && notice.read_at)
          return false;
        const key = `${notice.actor_id}:${notice.kind}:${notice.follow_request_id ?? notice.reel_id ?? ""}`;
        if (seenActivityKeys.has(key)) return false;
        seenActivityKeys.add(key);
        return true;
      },
    );
    setActivityNotices(activities);
    if (privacy) {
      setAllowCalls(privacy.allow_audio_calls);
      setShowCountry(privacy.show_country);
      setShowOnline(privacy.show_online_status);
      setIsPrivate(Boolean(privacy.is_private));
    }
    const ids = [
      ...new Set(
        [
          ...list.flatMap((item) => [item.requester_id, item.addressee_id]),
          ...activities.map((item) => item.actor_id),
        ].filter((id) => id !== user.id),
      ),
    ];
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,allow_audio_calls,show_country,show_online_status,is_admin,last_seen_at,follower_base_count,is_private",
        )
        .in("id", ids);
      setProfiles(
        Object.fromEntries(
          ((data as ZionProfile[] | null) ?? []).map((item) => [item.id, item]),
        ),
      );
    }
  }, [user.id]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const initial = window.setTimeout(() => void load(), 0);
    let debounce: number | null = null;
    const refresh = () => {
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void load(), 180);
    };
    const channel = client
      .channel(`friends-panel-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_games" },
        (payload) => {
          const game = payload.new as GameInvite;
          if (
            game?.status === "active" &&
            game.participant_ids?.includes(user.id) &&
            waitingAcceptedGamesRef.current.has(game.id)
          ) {
            waitingAcceptedGamesRef.current.delete(game.id);
            setGameToOpen(game.id);
            setActiveTab("games");
          }
          refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_messages" },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "zion_notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      window.clearTimeout(initial);
      if (debounce) window.clearTimeout(debounce);
      void client.removeChannel(channel);
    };
  }, [load, user.id]);
  useEffect(() => {
    if (activeTab !== "notifications" || !supabase) return;
    const unread = activityNotices.filter(
      (notice) => !notice.read_at && notice.kind !== "profile_follow_request",
    );
    if (!unread.length) return;
    const timer = window.setTimeout(() => {
      const readAt = new Date().toISOString();
      setActivityNotices((current) =>
        current.map((notice) =>
          !notice.read_at && notice.kind !== "profile_follow_request"
            ? { ...notice, read_at: readAt }
            : notice,
        ),
      );
      onNotificationsSeen(unread.length);
      void supabase!
        .from("zion_notifications")
        .update({ read_at: readAt })
        .in(
          "id",
          unread.map((notice) => notice.id),
        );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeTab, activityNotices, onNotificationsSeen]);
  const otherId = useCallback(
    (item: Friendship) =>
      item.requester_id === user.id ? item.addressee_id : item.requester_id,
    [user.id],
  );
  const accept = async (item: Friendship) => {
    if (!supabase) return;
    await supabase
      .from("friendships")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", item.id);
    await load();
  };
  const decline = async (item: Friendship) => {
    if (!supabase) return;
    await supabase
      .from("friendships")
      .update({ status: "declined" })
      .eq("id", item.id);
    await load();
  };
  const respondToGameInvite = async (
    game: GameInvite,
    acceptInvite: boolean,
  ) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("respond_zion_game", {
      p_game_id: game.id,
      p_accept: acceptInvite,
    });
    if (error) return alert(error.message);
    if (acceptInvite) {
      const updated = (
        Array.isArray(data) ? data[0] : data
      ) as GameInvite | null;
      if (updated?.status === "active") {
        setGameToOpen(game.id);
        setActiveTab("games");
      } else {
        waitingAcceptedGamesRef.current.add(game.id);
        alert(
          "Accepted. The game will open when every invited player accepts.",
        );
      }
    }
    await load();
  };
  const togglePin = async (friendId: string) => {
    if (!supabase) return;
    if (pins.includes(friendId))
      await supabase
        .from("friend_pins")
        .delete()
        .eq("user_id", user.id)
        .eq("friend_id", friendId);
    else
      await supabase
        .from("friend_pins")
        .insert({ user_id: user.id, friend_id: friendId });
    await load();
  };
  const removeFriend = async (item: Friendship) => {
    if (!supabase || !window.confirm("Remove this friend and private chat?"))
      return;
    const { error } = await supabase.rpc("remove_zion_friend", {
      p_friendship_id: item.id,
    });
    if (error) alert(error.message);
    else await load();
  };
  const accepted = useMemo(
    () =>
      friendships
        .filter((item) => item.status === "accepted")
        .sort((a, b) => {
          const pinOrder =
            Number(pins.includes(otherId(b))) -
            Number(pins.includes(otherId(a)));
          if (pinOrder) return pinOrder;
          const latestMessageOrder =
            new Date(lastMessageAt[b.id] ?? 0).getTime() -
            new Date(lastMessageAt[a.id] ?? 0).getTime();
          if (latestMessageOrder) return latestMessageOrder;
          return (
            new Date(b.accepted_at ?? b.created_at).getTime() -
            new Date(a.accepted_at ?? a.created_at).getTime()
          );
        }),
    [friendships, lastMessageAt, otherId, pins],
  );
  const pendingRequests = useMemo(
    () =>
      friendships.filter(
        (item) => item.status === "pending" && item.addressee_id === user.id,
      ),
    [friendships, user.id],
  );
  const setAppTheme = (value: "dark" | "day") => {
    setTheme(value);
    localStorage.setItem("zion-theme", value);
    document.documentElement.dataset.theme = value;
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(()=>{const sync=()=>setTheme(document.documentElement.dataset.theme==="day"?"day":"dark");window.addEventListener("zion-theme-change",sync);return()=>window.removeEventListener("zion-theme-change",sync);},[]);
  const savePrivacy = async () => {
    if (!supabase) return;
    await supabase
      .from("profiles")
      .update({
        allow_audio_calls: allowCalls,
        show_country: showCountry,
        show_online_status: showOnline,
        is_private: isPrivate,
      })
      .eq("id", user.id);
    setSettingsOpen(false);
  };
  const saveOneTimeProfileEdit = async () => {
    if (!supabase || editUsername.trim().length < 3 || !editCountry) return;
    if (profile.is_admin) {
      const { error } = await supabase
        .from("profiles")
        .update({ username: editUsername.trim(), country: editCountry })
        .eq("id", user.id);
      if (error) alert(error.message);
      else
        onProfileUpdated({
          ...profile,
          username: editUsername.trim(),
          country: editCountry,
        });
      return;
    }
    if (profile.profile_edit_used) return;
    const { error } = await supabase.rpc("update_profile_once", {
      p_username: editUsername.trim(),
      p_country: editCountry,
    });
    if (error) alert(error.message);
    else
      onProfileUpdated({
        ...profile,
        username: editUsername.trim(),
        country: editCountry,
        profile_edit_used: true,
      });
  };
  const findFriend = async () => {
    if (!supabase || !searchName.trim()) return;
    setSearching(true);
    setSearchMessage("");
    setSearchResult(null);
    const { data, error } = await supabase
      .rpc("find_zion_user", { p_username: searchName.trim() })
      .maybeSingle();
    if (error) setSearchMessage(error.message);
    else if (!data) setSearchMessage("No exact username found.");
    else setSearchResult(data as ZionProfile & { friend_status?: string });
    setSearching(false);
  };
  const requestFound = async () => {
    if (!supabase || !searchResult) return;
    const { data, error } = await supabase.rpc("request_zion_friend", {
      p_user_id: searchResult.id,
    });
    if (error) setSearchMessage(error.message);
    else {
      setSearchMessage(
        data === "accepted"
          ? "You are now friends."
          : "Friend request sent. They will receive a notification.",
      );
      setSearchResult({
        ...searchResult,
        friend_status: data === "accepted" ? "accepted" : "pending",
      });
      await load();
    }
  };
  const toggleFollow = async (profileId: string) => {
    if (!supabase || profileId === user.id) return;
    if (followingIds.includes(profileId))
      await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);
    else {
      const { error } = await supabase.rpc("request_zion_follow", {
        p_target_id: profileId,
      });
      setSearchMessage(
        error?.message ?? "Follow request sent. They can Accept or Decline it.",
      );
    }
    await load();
  };
  const respondToFollow = async (
    notice: ActivityNotice,
    acceptFollow: boolean,
  ) => {
    if (!supabase || !notice.follow_request_id) return;
    const { error } = await supabase.rpc("respond_zion_follow", {
      p_request_id: notice.follow_request_id,
      p_accept: acceptFollow,
    });
    if (error) alert(error.message);
    else await load();
  };
  const uploadProfilePhoto = async (file?: File) => {
    if (!supabase || !file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      alert("Choose a JPG, PNG or WebP image under 5 MB.");
      return;
    }
    const extension = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${user.id}/profile.${extension}`;
    const { error } = await supabase.storage
      .from("profile-avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      alert(error.message);
      return;
    }
    const { data } = supabase.storage
      .from("profile-avatars")
      .getPublicUrl(path);
    const avatar_url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", user.id);
    if (updateError) {
      alert(updateError.message);
      return;
    }
    onProfileUpdated({ ...profile, avatar_url });
  };
  const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onClose();
  };
  const switchAccount = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onClose();
  };
  if (inspectedProfile && !connectionView)
    return (
      <div className="social-overlay">
        <section className="friends-panel profile-view-panel notification-profile-view">
          <header>
            <button
              className="visible-back"
              onClick={() => setInspectedProfile(null)}
            >
              <ArrowLeft /> <span>Back</span>
            </button>
            <b>Profile</b>
          </header>
          <ProfileDetails
            profile={inspectedProfile}
            label="ZION Profile"
            onFollowersClick={() => setConnectionView({ profileId: inspectedProfile.id, username: inspectedProfile.username, mode: "followers" })}
            onFollowingClick={() => setConnectionView({ profileId: inspectedProfile.id, username: inspectedProfile.username, mode: "following" })}
          />
          <button
            className="edit-profile-main"
            onClick={() => void toggleFollow(inspectedProfile.id)}
          >
            {followingIds.includes(inspectedProfile.id) ? "Unfollow" : "Follow"}
          </button>
          <ProfileReels user={user} profile={inspectedProfile} />
        </section>
      </div>
    );
  if (selected && !connectionView)
    return (
      <FriendChat
        friendship={selected}
        friend={profiles[otherId(selected)]}
        user={user}
        onBack={() => setSelected(null)}
        onOpenConnections={(mode) => {
          const selectedFriend = profiles[otherId(selected)];
          if (selectedFriend)
            setConnectionView({
              profileId: selectedFriend.id,
              username: selectedFriend.username,
              mode,
            });
        }}
      />
    );
  if (connectionView)
    return (
      <div className="social-overlay">
        <section className="friends-panel connections-panel">
          <header>
            <button className="visible-back" onClick={() => setConnectionView(null)}>
              <ArrowLeft /> <span>Back</span>
            </button>
            <b>@{connectionView.username}</b>
          </header>
          <SocialConnections
            key={`${connectionView.profileId}-${connectionView.mode}`}
            profileId={connectionView.profileId}
            initialMode={connectionView.mode}
          />
        </section>
      </div>
    );
  if (settingsOpen)
    return (
      <div className="social-overlay">
        <section className="friends-panel settings-panel">
          <header>
            <div>
              <ProfileAvatar profile={profile} />
              <div>
                <b>Profile & Settings</b>
                <small>@{profile.username}</small>
              </div>
            </div>
            <button
              className="visible-back"
              onClick={() => setSettingsOpen(false)}
            >
              <ArrowLeft /> <span>Back</span>
            </button>
          </header>
          <div className="profile-summary">
            <ProfileAvatar profile={profile} />
            <h2>{profile.username}</h2>
            <p>
              {profile.gender} · {countryLabel(profile.country)}
            </p>
            <p className="profile-joined">
              <CalendarDays /> Account created{" "}
              {profile.created_at
                ? new Intl.DateTimeFormat(undefined, {
                    dateStyle: "long",
                  }).format(new Date(profile.created_at))
                : "date unavailable"}
            </p>
            <input
              ref={profileFileRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                void uploadProfilePhoto(event.target.files?.[0])
              }
            />
            <button
              className="photo-change"
              onClick={() => profileFileRef.current?.click()}
            >
              <Camera /> Add or change profile photo
            </button>
          </div>
          <h3>One-time profile edit</h3>
          {profile.profile_edit_used ? (
            <p className="profile-edit-used">
              Username and country have already been changed once.
            </p>
          ) : (
            <div className="one-time-profile-edit">
              <input
                value={editUsername}
                onChange={(event) => setEditUsername(event.target.value)}
                readOnly={Boolean(user.user_metadata?.zion_username)}
                maxLength={24}
                title={
                  user.user_metadata?.zion_username
                    ? "Login username is permanent"
                    : "New unique username"
                }
              />
              <select
                value={editCountry}
                onChange={(event) => setEditCountry(event.target.value)}
              >
                {countryOptions().map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.flag} {item.name}
                  </option>
                ))}
              </select>
              <button onClick={() => void saveOneTimeProfileEdit()}>
                Save once
              </button>
            </div>
          )}
          <h3>Appearance</h3>
          <div className="theme-switch">
            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setAppTheme("dark")}
            >
              <Moon /> Dark
            </button>
            <button
              className={theme === "day" ? "active" : ""}
              onClick={() => setAppTheme("day")}
            >
              <Sun /> Day
            </button>
          </div>
          <h3>Privacy & Security</h3>
          <label className="setting-row account-privacy-row">
            <span>
              <b>{isPrivate ? "Private account" : "Public account"}</b>
              <small>
                {isPrivate
                  ? "Only approved followers can view your profile posts"
                  : "Anyone can view your profile posts and follow instantly"}
              </small>
            </span>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>
              <b>Audio call requests</b>
              <small>Friends must request your permission</small>
            </span>
            <input
              type="checkbox"
              checked={allowCalls}
              onChange={(e) => setAllowCalls(e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>
              <b>Show country</b>
              <small>Visible to your accepted friends</small>
            </span>
            <input
              type="checkbox"
              checked={showCountry}
              onChange={(e) => setShowCountry(e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>
              <b>Online status</b>
              <small>Let friends see when you are in chat</small>
            </span>
            <input
              type="checkbox"
              checked={showOnline}
              onChange={(e) => setShowOnline(e.target.checked)}
            />
          </label>
          <div className="moderation-banner">
            <ShieldAlert size={17} />
            Block and report harassment, threats, scams or unwanted explicit
            content.
          </div>
          <a className="privacy-policy-link" href="/privacy">Read Privacy &amp; Safety policy</a>
          <Button className="primary-action" onClick={() => void savePrivacy()}>
            Save settings
          </Button>
          <button
            className="account-switch-button"
            onClick={() => void switchAccount()}
          >
            <UserRoundPlus /> Add or switch account
          </button>
          <button className="logout-button" onClick={() => void logout()}>
            <LogOut /> Log out of ZION
          </button>
        </section>
      </div>
    );
  return (
    <div className="social-overlay">
      <section className="friends-panel">
        <header>
          <div>
            <ProfileAvatar profile={profile} />
            <div>
              <b>{profile.username}</b>
              <small>
                {countryLabel(profile.country)} · {profile.gender}
              </small>
            </div>
          </div>
          <button
            className="header-settings"
            onClick={() => setSettingsOpen(true)}
            aria-label="Profile and settings"
          >
            <Settings />
          </button>
          <button className="visible-back" onClick={onClose} aria-label="Back">
            <ArrowLeft /> <span>Back</span>
          </button>
        </header>
        <div className="friends-tabs">
          {profile.is_admin ? (
            <button
              className={
                activeTab === "admin" ? "active admin-tab" : "admin-tab"
              }
              onClick={() => setActiveTab("admin")}
            >
              <ShieldAlert /> Admin
            </button>
          ) : null}
          <button
            className={activeTab === "friends" ? "active" : ""}
            onClick={() => setActiveTab("friends")}
          >
            <Users /> Friends
          </button>
          <button
            className={activeTab === "find" ? "active" : ""}
            onClick={() => setActiveTab("find")}
          >
            <Search /> Find Friends
          </button>
          <button
            className={activeTab === "games" ? "active game-tab" : "game-tab"}
            onClick={() => setActiveTab("games")}
          >
            <Gamepad2 /> Games
          </button>
          <button
            className="meeting-tab"
            onClick={() => {
              window.location.href = "/meeting";
            }}
          >
            <Video /> Meetings
          </button>
        </div>
        {activeTab === "admin" ? (
          <AdminPanel user={user} />
        ) : activeTab === "games" ? (
          <FriendGames
            user={user}
            onBack={() => setActiveTab("friends")}
            initialGameId={gameToOpen}
            onInitialGameOpened={() => setGameToOpen(null)}
            friends={accepted
              .map((item) => ({
                friendshipId: item.id,
                profile: profiles[otherId(item)],
              }))
              .filter(
                (
                  item,
                ): item is { friendshipId: string; profile: ZionProfile } =>
                  Boolean(item.profile),
              )}
          />
        ) : activeTab === "communities" ? (
          <CommunityPanel
            user={user}
            friends={accepted
              .map((item) => profiles[otherId(item)])
              .filter(Boolean)}
          />
        ) : activeTab === "notifications" ? (
          <div className="notification-center">
            <h2>
              <Bell /> Notification Center
            </h2>
            {gameInvites.map((game) => {
              const person = profiles[game.inviter_id];
              const gameName =
                game.game_type === "tic_tac_toe"
                  ? "Tic-Tac-Toe"
                  : game.game_type === "chess"
                    ? "Chess"
                    : "Ludo";
              return (
                <div
                  className="notification-request game-invite-notification"
                  key={game.id}
                >
                  <span className="notification-game-icon">
                    {game.game_type === "ludo"
                      ? "🎲"
                      : game.game_type === "chess"
                        ? "♛"
                        : "✕○"}
                  </span>
                  <div>
                    <b>{person?.username ?? "ZION friend"}</b>
                    <small>invited you to {gameName}</small>
                  </div>
                  <button
                    className="request-decline"
                    onClick={() => void respondToGameInvite(game, false)}
                  >
                    Decline
                  </button>
                  <button
                    className="request-accept"
                    onClick={() => void respondToGameInvite(game, true)}
                  >
                    Accept &amp; Play
                  </button>
                </div>
              );
            })}
            {activityNotices.map((notice) => {
              const actor = profiles[notice.actor_id];
              const action =
                notice.kind === "screenshot_attempt"
                  ? "reported a screenshot attempt in your chat"
                  : notice.kind === "reel_comment"
                  ? "commented on your reel"
                  : notice.kind === "story_like"
                    ? "liked your story"
                    : notice.kind === "profile_follow_request"
                      ? "requested to follow you"
                      : notice.kind === "profile_follow"
                        ? "started following you"
                        : "liked your reel";
              return (
                <div
                  className={`notification-request activity-notice ${notice.read_at ? "" : "unread"}`}
                  key={`activity-${notice.id}`}
                >
                  <button
                    className="notification-actor"
                    onClick={() => actor && setInspectedProfile(actor)}
                  >
                    <ProfileAvatar profile={actor} />
                    <span>
                      <b>{actor?.username ?? "ZION user"}</b>
                      <small>{action}</small>
                    </span>
                  </button>
                  {notice.kind === "profile_follow_request" &&
                  !notice.read_at ? (
                    <>
                      <button
                        className="request-decline"
                        onClick={() => void respondToFollow(notice, false)}
                      >
                        Decline
                      </button>
                      <button
                        className="request-accept"
                        onClick={() => void respondToFollow(notice, true)}
                      >
                        Accept
                      </button>
                    </>
                  ) : (
                    <span>
                      {notice.kind === "screenshot_attempt"
                        ? "🛡️"
                        : notice.kind === "reel_comment"
                        ? "💬"
                        : notice.kind === "profile_follow"
                          ? "➕"
                          : "❤️"}
                    </span>
                  )}
                </div>
              );
            })}
            {pendingRequests.map((item) => {
              const person = profiles[otherId(item)];
              return (
                <div className="notification-request" key={item.id}>
                  <button
                    className="notification-actor"
                    onClick={() => person && setInspectedProfile(person)}
                  >
                    <ProfileAvatar profile={person} />
                    <span>
                      <b>{person?.username ?? "ZION user"}</b>
                      <small>sent you a friend request</small>
                    </span>
                  </button>
                  <button
                    className="request-decline"
                    onClick={() => void decline(item)}
                  >
                    Decline
                  </button>
                  <button
                    className="request-accept"
                    onClick={() => void accept(item)}
                  >
                    Accept
                  </button>
                </div>
              );
            })}
            {!pendingRequests.length &&
            !gameInvites.length &&
            !activityNotices.length ? (
              <div className="empty-friends">
                <Bell />
                <p>No new notifications.</p>
              </div>
            ) : null}
          </div>
        ) : activeTab === "profile" ? (
          <div className="my-profile-page">
            <input
              ref={profileFileRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                void uploadProfilePhoto(event.target.files?.[0])
              }
            />
            <ProfileDetails
              profile={profile}
              label="My ZION Profile"
              followerCount={socialCounts.followers}
              followingCount={socialCounts.following}
              postCount={socialCounts.posts}
              onAvatarClick={() => profileFileRef.current?.click()}
              onPostsClick={() => document.querySelector(".profile-reels")?.scrollIntoView({ behavior: "smooth" })}
              onFollowersClick={() => setConnectionView({ profileId: user.id, username: profile.username, mode: "followers" })}
              onFollowingClick={() => setConnectionView({ profileId: user.id, username: profile.username, mode: "following" })}
            />
            <button
              className="edit-profile-main"
              onClick={() => setSettingsOpen(true)}
            >
              Edit photo, name &amp; country
            </button>
            <ProfileReels user={user} profile={profile} />
          </div>
        ) : activeTab === "find" ? (
          <div className="find-friends">
            <h2>Find Friends</h2>
            <p>
              Enter their exact unique username. All languages are supported.
            </p>
            <div className="friend-search">
              <input
                value={searchName}
                onChange={(event) => setSearchName(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" && void findFriend()
                }
                placeholder="Exact username"
                maxLength={24}
              />
              <button onClick={() => void findFriend()} disabled={searching}>
                <Search />
              </button>
            </div>
            {searchResult ? (
              <div className="search-result">
                <ProfileAvatar profile={searchResult} />
                <div>
                  <b>{searchResult.username}</b>
                  <small>
                    {searchResult.country
                      ? countryLabel(searchResult.country)
                      : "Country private"}{" "}
                    · {searchResult.gender}
                  </small>
                </div>
                <Button
                  disabled={
                    searchResult.friend_status === "pending" ||
                    searchResult.friend_status === "accepted"
                  }
                  onClick={() => void requestFound()}
                >
                  {searchResult.friend_status === "accepted"
                    ? "Friends"
                    : searchResult.friend_status === "pending"
                      ? "Requested"
                      : "Add Friend"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void toggleFollow(searchResult.id)}
                >
                  {followingIds.includes(searchResult.id)
                    ? "Following"
                    : "Follow"}
                </Button>
              </div>
            ) : null}
            {searchMessage ? (
              <p className="search-message">{searchMessage}</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="moderation-banner compact">
              <ShieldAlert size={16} />
              Unsafe or unwanted content: block and report. Serious violations
              can lead to bans.
            </div>
            <h2>
              <Users size={20} /> Friends
            </h2>
            {friendships
              .filter(
                (item) =>
                  item.status === "pending" && item.addressee_id === user.id,
              )
              .map((item) => {
                const person = profiles[otherId(item)];
                return (
                  <div className="friend-row request" key={item.id}>
                    <ProfileAvatar profile={person} />
                    <div>
                      <b>{person?.username ?? "ZION user"}</b>
                      <small>sent a friend request</small>
                    </div>
                    <Button onClick={() => void accept(item)}>Accept</Button>
                  </div>
                );
              })}
            <div className="friends-list">
              {accepted.length ? (
                accepted.map((item) => {
                  const id = otherId(item);
                  const person = profiles[id];
                  return (
                    <div className="friend-row" key={item.id}>
                      <button
                        className="friend-main"
                        onClick={() => setSelected(item)}
                      >
                        <ProfileAvatar profile={person} />
                        <div>
                          <b>{person?.username ?? "ZION friend"}</b>
                          <small>{lastSeenLabel(person)}</small>
                        </div>
                        <em
                          className={`streak-badge streak-${item.streak_count >= 30 ? "red" : item.streak_count >= 10 ? "yellow" : "black"}`}
                        >
                          {streakBadge(item.streak_count)} {item.streak_count}
                        </em>
                      </button>
                      <button
                        className={pins.includes(id) ? "pin active" : "pin"}
                        onClick={() => void togglePin(id)}
                        aria-label="Pin friend"
                      >
                        <Pin size={17} />
                      </button>
                      <button
                        className="remove-friend"
                        onClick={() => void removeFriend(item)}
                        aria-label="Remove friend"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="empty-friends">
                  <UserRoundPlus />
                  <p>
                    Add someone after a random chat or use Find Friends with
                    their exact username.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

type Community = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};
type CommunityMessage = {
  id: number;
  community_id: string;
  sender_id: string;
  ciphertext: string;
  created_at: string;
  media_path?: string | null;
  media_type?: "image" | "video" | null;
  media_url?: string;
  display_message?: string;
};

function CommunityPanel({
  user,
  friends,
}: {
  user: User;
  friends: ZionProfile[];
}) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [secret, setSecret] = useState("");
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const communityFileRef = useRef<HTMLInputElement>(null);
  const communityMediaUrls = useRef(new Map<string, string>());
  useEffect(() => {
    const urls = communityMediaUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const loadCommunities = useCallback(async () => {
    if (!supabase) return;
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", user.id);
    const ids = (memberships ?? []).map((item) => item.community_id);
    if (!ids.length) {
      setCommunities([]);
      return;
    }
    const { data } = await supabase
      .from("communities")
      .select("id,owner_id,name,created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setCommunities((data as Community[] | null) ?? []);
  }, [user.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCommunities(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCommunities]);

  const openCommunity = async (community: Community) => {
    if (!supabase) return;
    setError("");
    const { data, error: keyError } = await supabase
      .from("community_member_keys")
      .select("encrypted_key,wrapped_by,key_version")
      .eq("community_id", community.id)
      .eq("user_id", user.id)
      .single();
    if (keyError || !data) {
      setError("This community encryption key is not available.");
      return;
    }
    const value = await decryptText(
      data.encrypted_key,
      user.id,
      data.wrapped_by,
      `community-key:${community.id}:${data.key_version}`,
    );
    if (!value || value.startsWith("🔒")) {
      setError(value ?? "Unable to unlock this community.");
      return;
    }
    setSecret(value);
    setSelected(community);
  };

  const loadMessages = useCallback(async () => {
    if (!supabase || !selected || !secret) return;
    const { data } = await supabase
      .from("community_messages")
      .select(
        "id,community_id,sender_id,ciphertext,created_at,media_path,media_type",
      )
      .eq("community_id", selected.id)
      .order("created_at")
      .limit(300);
    const decrypted = await Promise.all(
      ((data as CommunityMessage[] | null) ?? []).map(async (item) => {
        const plaintext = await decryptGroupText(
          item.ciphertext,
          secret,
          `community:${selected.id}:1`,
        );
        if (!item.media_path) return { ...item, display_message: plaintext };
        const cached = communityMediaUrls.current.get(item.media_path);
        if (cached) return { ...item, display_message: "", media_url: cached };
        try {
          const metadata = JSON.parse(plaintext) as { mime: string };
          const { data: signed } = await supabase!.storage
            .from("chat-media")
            .createSignedUrl(item.media_path, 3600);
          if (!signed?.signedUrl) throw new Error("Missing media URL");
          const response = await fetch(signed.signedUrl);
          const blob = await decryptGroupFile(
            await response.arrayBuffer(),
            metadata.mime,
            secret,
            `community:${selected.id}:1`,
          );
          const url = URL.createObjectURL(blob);
          communityMediaUrls.current.set(item.media_path, url);
          return { ...item, display_message: "", media_url: url };
        } catch {
          return { ...item, display_message: "🔒 Unable to open attachment" };
        }
      }),
    );
    setMessages(decrypted);
  }, [secret, selected]);

  useEffect(() => {
    if (!selected || !secret || !supabase) return;
    const client = supabase;
    const first = window.setTimeout(() => void loadMessages(), 0);
    const channel = client
      .channel(`community-messages-${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `community_id=eq.${selected.id}`,
        },
        () => void loadMessages(),
      )
      .subscribe();
    return () => {
      window.clearTimeout(first);
      void client.removeChannel(channel);
    };
  }, [loadMessages, secret, selected]);

  const createCommunity = async () => {
    if (!supabase || name.trim().length < 3) return;
    setError("");
    const cleanName = name.trim().slice(0, 60);
    const { data: communityId, error: createError } = await supabase.rpc(
      "create_zion_community",
      { p_name: cleanName },
    );
    if (createError || !communityId) {
      setError(createError?.message ?? "Community creation failed.");
      return;
    }
    const community: Community = {
      id: communityId as string,
      owner_id: user.id,
      name: cleanName,
      created_at: new Date().toISOString(),
    };
    try {
      const groupSecret = createGroupSecret();
      const members = [user.id, ...memberIds];
      if (memberIds.length) {
        const { error: memberError } = await supabase
          .from("community_members")
          .insert(
            memberIds.map((id) => ({
              community_id: community.id,
              user_id: id,
              role: "member",
            })),
          );
        if (memberError) throw memberError;
      }
      const wrapped = await Promise.all(
        members.map(async (id) => ({
          community_id: community.id,
          user_id: id,
          wrapped_by: user.id,
          key_version: 1,
          encrypted_key: await encryptText(
            groupSecret,
            user.id,
            id,
            `community-key:${community.id}:1`,
          ),
        })),
      );
      const { error: keyError } = await supabase
        .from("community_member_keys")
        .insert(wrapped);
      if (keyError) throw keyError;
      setName("");
      setMemberIds([]);
      setCreating(false);
      await loadCommunities();
      await openCommunity(community);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Secure group setup failed.",
      );
    }
  };

  const sendCommunityMessage = async () => {
    if (!supabase || !selected || !secret || !text.trim()) return;
    const value = text.trim();
    const ciphertext = await encryptGroupText(
      value,
      secret,
      `community:${selected.id}:1`,
    );
    const { error: sendError } = await supabase
      .from("community_messages")
      .insert({
        community_id: selected.id,
        sender_id: user.id,
        ciphertext,
        key_version: 1,
      });
    if (sendError) setError(sendError.message);
    else {
      setText("");
      await loadMessages();
    }
  };

  const uploadCommunityMedia = async (file?: File) => {
    if (!supabase || !selected || !secret || !file) return;
    const mediaType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : null;
    if (!mediaType) {
      setError("Choose a photo or video.");
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setError("Maximum encrypted community media size is 250 MB.");
      return;
    }
    setError("");
    setUploadProgress(0);
    try {
      const context = `community:${selected.id}:1`;
      const encrypted = await encryptGroupFile(file, secret, context);
      const metadata = await encryptGroupText(
        JSON.stringify({ mime: file.type, name: file.name, size: file.size }),
        secret,
        context,
      );
      const path = `community/${selected.id}/${user.id}/${crypto.randomUUID()}.e2ee`;
      await uploadResumable({
        bucket: "chat-media",
        path,
        body: encrypted,
        contentType: "application/octet-stream",
        onProgress: setUploadProgress,
      });
      const { error: messageError } = await supabase
        .from("community_messages")
        .insert({
          community_id: selected.id,
          sender_id: user.id,
          ciphertext: metadata,
          media_path: path,
          media_type: mediaType,
          key_version: 1,
        });
      if (messageError) throw messageError;
      await loadMessages();
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Media upload failed.",
      );
    }
    setUploadProgress(null);
    if (communityFileRef.current) communityFileRef.current.value = "";
  };

  if (selected)
    return (
      <div className="community-chat">
        <div className="community-chat-head">
          <button
            onClick={() => {
              setSelected(null);
              setSecret("");
            }}
          >
            <ArrowLeft />
          </button>
          <div>
            <b>{selected.name}</b>
            <small>🔒 End-to-end encrypted group</small>
          </div>
        </div>
        <div className="community-message-list">
          {messages.map((item) => (
            <div
              key={item.id}
              className={
                item.sender_id === user.id
                  ? "community-bubble mine"
                  : "community-bubble"
              }
            >
              <small>
                {item.sender_id === user.id
                  ? "You"
                  : (friends.find((friend) => friend.id === item.sender_id)
                      ?.username ?? "Member")}
              </small>
              {item.media_url && item.media_type === "image" ? (
                <img
                  src={item.media_url}
                  alt="Encrypted community attachment"
                  loading="lazy"
                />
              ) : null}
              {item.media_url && item.media_type === "video" ? (
                <video
                  src={item.media_url}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : null}
              <span>{item.display_message}</span>
              <div className="message-meta"><MessageTime sentAt={item.created_at} /></div>
            </div>
          ))}
          {!messages.length ? (
            <p>Start this private community conversation.</p>
          ) : null}
        </div>
        <div className="friend-compose">
          <input
            ref={communityFileRef}
            hidden
            type="file"
            accept="image/*,video/*"
            onChange={(event) =>
              void uploadCommunityMedia(event.target.files?.[0])
            }
          />
          <button
            className="media-button"
            onClick={() => communityFileRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            <ImagePlus />
            <span>
              {uploadProgress === null ? "Gallery" : `${uploadProgress}%`}
            </span>
          </button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) =>
              event.key === "Enter" && void sendCommunityMessage()
            }
            placeholder="Message community…"
            maxLength={2000}
          />
          <button
            className="send-button"
            onClick={() => void sendCommunityMessage()}
            disabled={!text.trim()}
          >
            <Send />
          </button>
        </div>
      </div>
    );

  return (
    <div className="community-panel">
      <div className="community-title">
        <div>
          <span className="mini-label">ZION COMMUNITIES</span>
          <h2>Private group chats</h2>
        </div>
        <button onClick={() => setCreating((value) => !value)}>
          {creating ? "Cancel" : "+ Create"}
        </button>
      </div>
      {error ? <p className="error-note">{error}</p> : null}
      {creating ? (
        <div className="community-create">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Community name"
            maxLength={60}
          />
          <b>Add trusted friends</b>
          <div className="community-member-picker">
            {friends.map((friend) => (
              <label key={friend.id}>
                <input
                  type="checkbox"
                  checked={memberIds.includes(friend.id)}
                  onChange={(event) =>
                    setMemberIds((current) =>
                      event.target.checked
                        ? [...current, friend.id]
                        : current.filter((id) => id !== friend.id),
                    )
                  }
                />
                <ProfileAvatar profile={friend} />
                <span>{friend.username}</span>
              </label>
            ))}
          </div>
          <Button
            className="primary-action"
            disabled={name.trim().length < 3}
            onClick={() => void createCommunity()}
          >
            Create encrypted community
          </Button>
        </div>
      ) : null}
      <div className="community-list">
        {communities.map((community) => (
          <button
            key={community.id}
            onClick={() => void openCommunity(community)}
          >
            <span>👥</span>
            <div>
              <b>{community.name}</b>
              <small>Encrypted community</small>
            </div>
            <ArrowRight />
          </button>
        ))}
        {!communities.length && !creating ? (
          <div className="empty-friends">
            <Users />
            <p>Create a community and add trusted friends.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AdminPanel({ user }: { user: User }) {
  const [rows, setRows] = useState<ZionProfile[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const load = useCallback(
    async (reset = false) => {
      if (!supabase || loadingMore) return;
      setLoadingMore(true);
      const page = reset ? 0 : pageRef.current;
      const pageSize = 50;
      const { data } = await supabase
        .from("profiles")
        .select(
          "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,is_admin",
        )
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      const next = (data as ZionProfile[] | null) ?? [];
      setRows((current) =>
        reset
          ? next
          : [
              ...current,
              ...next.filter(
                (item) => !current.some((old) => old.id === item.id),
              ),
            ],
      );
      pageRef.current = page + 1;
      setHasMore(next.length === pageSize);
      setLoadingMore(false);
    },
    [loadingMore],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || query) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && void load(),
      { rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, load, query]);
  const toggleBan = async (profile: ZionProfile) => {
    if (!supabase || profile.id === user.id) return;
    setBusy(true);
    const next = !profile.is_banned;
    const reason = next
      ? window.prompt(
          "Ban reason",
          profile.ban_reason ?? "Community safety violation",
        )
      : null;
    if (next && reason === null) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.rpc("moderate_zion_profile", {
      p_target_id: profile.id,
      p_banned: next,
      p_reason: next ? reason : null,
    });
    if (error) alert(error.message);
    else
      setRows((current) =>
        current.map((item) =>
          item.id === profile.id
            ? { ...item, is_banned: next, ban_reason: next ? reason : null }
            : item,
        ),
      );
    setBusy(false);
  };
  const filtered = rows.filter((item) =>
    item.username.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="admin-panel">
      <div className="admin-heading">
        <div>
          <span className="mini-label">OWNER CONTROLS</span>
          <h2>
            <ShieldAlert /> Admin profiles
          </h2>
        </div>
        <small>{rows.length} accounts</small>
      </div>
      <p className="admin-warning">
        Only the ceo mubieeyy owner account can use these controls.
      </p>
      <input
        className="admin-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search username"
      />{" "}
      <div className="admin-list">
        {filtered.map((item) => (
          <div className="admin-row" key={item.id}>
            <ProfileAvatar profile={item} />
            <div>
              <b>{item.username}</b>
              <small>
                {countryLabel(item.country)} · {item.gender}
              </small>
            </div>
            {item.id === user.id ? (
              <em>ADMIN</em>
            ) : (
              <button
                disabled={busy}
                className={item.is_banned ? "unban" : "ban"}
                onClick={() => void toggleBan(item)}
              >
                {item.is_banned ? "Unban" : "Ban"}
              </button>
            )}
          </div>
        ))}
        {!filtered.length ? (
          <p className="admin-empty">No matching profiles.</p>
        ) : null}
        {!query && hasMore ? (
          <button
            ref={loadMoreRef}
            className="admin-load-more"
            disabled={loadingMore}
            onClick={() => void load()}
          >
            {loadingMore ? "Loading accounts…" : "Load older accounts"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function VoiceNotePlayer({ src, onPlaybackError }: { src: string; onPlaybackError: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const format = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  };
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch { onPlaybackError(); }
  };
  const changeSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };
  return <div className="zion-voice-note">
    <audio ref={audioRef} src={src} preload="auto" playsInline
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); setCurrent(0); }}
      onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
      onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onError={onPlaybackError} />
    <button className="voice-play" onClick={() => void toggle()} aria-label={playing ? "Pause voice note" : "Play voice note"}>{playing ? <Pause /> : <Play />}</button>
    <div className="voice-track">
      <div className="voice-wave" aria-hidden>{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 7) % 17)}px` }} />)}</div>
      <input aria-label="Voice note position" type="range" min="0" max={duration || 1} step="0.05" value={Math.min(current, duration || 1)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} />
      <small>{format(current)} / {format(duration)}</small>
    </div>
    <button className="voice-speed" onClick={changeSpeed}>{speed}×</button>
  </div>;
}

function FriendChat({
  friendship,
  friend,
  user,
  onBack,
  onOpenConnections,
}: {
  friendship: Friendship;
  friend?: ZionProfile;
  user: User;
  onBack: () => void;
  onOpenConnections: (mode: "followers" | "following") => void;
}) {
  const friendId = friend?.id ?? "";
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [friendUploadProgress, setFriendUploadProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [mediaChoice, setMediaChoice] = useState<File | null>(null);
  const [openedOnceIds, setOpenedOnceIds] = useState<number[]>([]);
  const [messageMenu, setMessageMenu] = useState<FriendMessage | null>(null);
  const [mediaPreview, setMediaPreview] = useState<FriendMessage | null>(null);
  const [friendOnline, setFriendOnline] = useState(false);
  const [friendLastSeen, setFriendLastSeen] = useState(friend?.last_seen_at);
  const [friendTyping, setFriendTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<FriendMessage | null>(null);
  const [showFriendProfile, setShowFriendProfile] = useState(false);
  const [callState, setCallState] = useState<
    "idle" | "requesting" | "incoming" | "connecting" | "active"
  >("idle");
  const [callError, setCallError] = useState("");
  const [callKind, setCallKind] = useState<"audio" | "video">("audio");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [chatShielded, setChatShielded] = useState(false);
  const [securityNotice, setSecurityNotice] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const messageHoldRef = useRef<number | null>(null);
  const viewOnceTimerRef = useRef<number | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callKindRef = useRef<"audio" | "video">("audio");
  const liveRef = useRef<RealtimeChannel | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const remoteTypingRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const mediaUrlsRef = useRef(new Map<string, string>());
  useEffect(() => {
    if (!supabase || !friendId) return;
    const refresh = async () => {
      const { data } = await supabase!
        .from("profiles")
        .select("last_seen_at")
        .eq("id", friendId)
        .maybeSingle();
      if (data?.last_seen_at) setFriendLastSeen(data.last_seen_at);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [friendId]);
  const load = useCallback(async () => {
    if (!supabase || !friendId) return;
    // Reading state must not block the first paint of the conversation.
    void supabase.rpc("mark_friend_messages_read", {
      p_friendship_id: friendship.id,
    }).then(() => liveRef.current?.send({
      type: "broadcast",
      event: "messages-read",
      payload: { userId: user.id, at: new Date().toISOString() },
    }));
    const { data } = await supabase
      .from("friend_messages")
      .select(
        "id,friendship_id,sender_id,message,media_path,media_type,view_once,viewed_at,hidden_for,created_at,read_at,edited_at,deleted_at,reply_to_id",
      )
      .eq("friendship_id", friendship.id)
      .order("created_at", { ascending: false })
      .limit(60);
    const rows = ((data as FriendMessage[] | null) ?? [])
      .filter((item) => !item.hidden_for?.includes(user.id))
      .reverse();
    const readyMessages = await Promise.all(
      rows.map(async (item): Promise<FriendMessage> => {
        const encrypted = isE2EEEnvelope(item.message);
        const decrypted = await decryptText(
          item.message,
          user.id,
          friendId,
          `friend:${friendship.id}`,
        );
        if (!item.media_path)
          return { ...item, display_message: decrypted, encrypted };
        const cachedUrl = mediaUrlsRef.current.get(item.media_path);
        if (cachedUrl)
          return {
            ...item,
            display_message: null,
            media_url: cachedUrl,
            encrypted,
          };
        return { ...item, display_message: null, encrypted };
      }),
    );

    // Text appears immediately. Attachments are resolved progressively in the
    // background, so a large history can never hold the chat screen hostage.
    setMessages(readyMessages);
    void Promise.all(
      readyMessages.map(async (item) => {
        // View-once media is never prefetched with normal chat history.
        if (!item.media_path || item.media_url || item.view_once) return;
        const { data: signed } = await supabase!.storage
          .from("chat-media")
          .createSignedUrl(item.media_path, 3600);
        if (!signed?.signedUrl) return;
        let mediaUrl = signed.signedUrl;
        let mediaError: string | null = null;
        if (!item.encrypted) {
          setMessages((current) =>
            current.map((message) =>
              message.id === item.id
                ? { ...message, media_url: mediaUrl }
                : message,
            ),
          );
          return;
        }
        try {
          const decryptedMetadata = await decryptText(
            item.message,
            user.id,
            friendId,
            `friend:${friendship.id}`,
          );
          const metadata = JSON.parse(decryptedMetadata ?? "{}") as { mime?: string };
          const response = await fetch(signed.signedUrl);
          const blob = await decryptFile(
            await response.arrayBuffer(),
            metadata.mime ?? "application/octet-stream",
            user.id,
            friendId,
            `friend:${friendship.id}`,
          );
          mediaUrl = URL.createObjectURL(blob);
          mediaUrlsRef.current.set(item.media_path, mediaUrl);
        } catch {
          mediaError = "🔒 Unable to decrypt this attachment";
        }
        setMessages((current) =>
          current.map((message) =>
            message.id === item.id
              ? {
                  ...message,
                  display_message: mediaError,
                  media_url: mediaError ? undefined : mediaUrl,
                }
              : message,
          ),
        );
      }),
    );
  }, [friendId, friendship.id, user.id]);
  const stopCall = useCallback(
    (notify = true) => {
      if (notify)
        void liveRef.current?.send({
          type: "broadcast",
          event: "call-end",
          payload: { userId: user.id },
        });
      peerRef.current?.close();
      peerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        remoteVideoRef.current.muted = false;
      }
      if (callTimeoutRef.current) window.clearTimeout(callTimeoutRef.current);
      setMuted(false);
      setCameraOn(true);
      setSpeakerOn(true);
      setCallState("idle");
    },
    [user.id],
  );
  const ensurePeer = useCallback(
    async (kind = callKindRef.current) => {
      if (peerRef.current) return peerRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video:
          kind === "video"
            ? {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
      });
      streamRef.current = stream;
      if (kind === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        void localVideoRef.current.play().catch(() => undefined);
      }
      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.onicecandidate = (event) => {
        if (event.candidate)
          void liveRef.current?.send({
            type: "broadcast",
            event: "rtc-ice",
            payload: { userId: user.id, candidate: event.candidate.toJSON() },
          });
      };
      peer.ontrack = (event) => {
        if (kind === "video" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          void remoteVideoRef.current.play().catch(() => undefined);
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          void remoteAudioRef.current.play().catch(() => undefined);
        }
        setCallState("active");
      };
      peer.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(peer.connectionState))
          stopCall(false);
      };
      peerRef.current = peer;
      return peer;
    },
    [stopCall, user.id],
  );
  useEffect(() => {
    if (callState !== "active") return;
    const keepAwake = async () => {
      try {
        const wakeLockNavigator = navigator as Navigator & {
          wakeLock?: {
            request: (
              type: "screen",
            ) => Promise<{ release: () => Promise<void> }>;
          };
        };
        wakeLockRef.current =
          (await wakeLockNavigator.wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "An audio call is active.";
    };
    void keepAwake();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [callState]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  useEffect(() => {
    if (!supabase || !friendId) return;
    const client = supabase;
    const mediaUrls = mediaUrlsRef.current;
    const channel = client
      .channel(`friend-live-${friendship.id}`, {
        config: { private: true, presence: { key: user.id } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_messages",
          filter: `friendship_id=eq.${friendship.id}`,
        },
        () => void load(),
      )
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        setFriendOnline(Boolean(presence[friendId]));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        setFriendTyping(Boolean(payload.typing));
        if (remoteTypingRef.current)
          window.clearTimeout(remoteTypingRef.current);
        if (payload.typing)
          remoteTypingRef.current = window.setTimeout(
            () => setFriendTyping(false),
            2200,
          );
      })
      .on("broadcast", { event: "screen-capture-attempt" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        setSecurityNotice(`${friend?.username ?? "Your friend"}'s device reported a screenshot attempt.`);
        window.setTimeout(() => setSecurityNotice(""), 6000);
      })
      .on("broadcast", { event: "messages-read" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const readAt = payload.at || new Date().toISOString();
        setMessages((current) => current.map((message) =>
          message.sender_id === user.id && !message.read_at
            ? { ...message, read_at: readAt }
            : message,
        ));
      })
      .on("broadcast", { event: "call-request" }, ({ payload }) => {
        if (payload.userId !== user.id) {
          const kind = payload.kind === "video" ? "video" : "audio";
          callKindRef.current = kind;
          setCallKind(kind);
          setCallState("incoming");
        }
      })
      .on("broadcast", { event: "call-response" }, async ({ payload }) => {
        if (payload.userId === user.id) return;
        if (!payload.accepted) {
          setCallError("Call declined");
          setCallState("idle");
          return;
        }
        try {
          setCallState("connecting");
          const peer = await ensurePeer(callKindRef.current);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await channel.send({
            type: "broadcast",
            event: "rtc-offer",
            payload: { userId: user.id, description: offer },
          });
        } catch {
          setCallError(
            callKindRef.current === "video"
              ? "Camera and microphone permission are required."
              : "Microphone permission is required.",
          );
          stopCall(false);
        }
      })
      .on("broadcast", { event: "rtc-offer" }, async ({ payload }) => {
        if (payload.userId === user.id) return;
        try {
          const peer = await ensurePeer(callKindRef.current);
          await peer.setRemoteDescription(payload.description);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await channel.send({
            type: "broadcast",
            event: "rtc-answer",
            payload: { userId: user.id, description: answer },
          });
        } catch {
          setCallError(
            `${callKindRef.current === "video" ? "Video" : "Audio"} connection failed.`,
          );
          stopCall(false);
        }
      })
      .on("broadcast", { event: "rtc-answer" }, async ({ payload }) => {
        if (payload.userId === user.id) return;
        try {
          await peerRef.current?.setRemoteDescription(payload.description);
        } catch {
          setCallError(
            `${callKindRef.current === "video" ? "Video" : "Audio"} connection failed.`,
          );
          stopCall(false);
        }
      })
      .on("broadcast", { event: "rtc-ice" }, async ({ payload }) => {
        if (payload.userId === user.id) return;
        try {
          await peerRef.current?.addIceCandidate(payload.candidate);
        } catch {}
      })
      .on("broadcast", { event: "call-end" }, ({ payload }) => {
        if (payload.userId !== user.id) stopCall(false);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          void channel.track({
            userId: user.id,
            onlineAt: new Date().toISOString(),
          });
      });
    liveRef.current = channel;
    return () => {
      if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
      if (remoteTypingRef.current) window.clearTimeout(remoteTypingRef.current);
      stopCall(false);
      void client.removeChannel(channel);
      liveRef.current = null;
      mediaUrls.forEach((url) => URL.revokeObjectURL(url));
      mediaUrls.clear();
    };
  }, [ensurePeer, friendId, friendship.id, load, stopCall, user.id]);
  useEffect(() => {
    if (user.id === ZION_CEO_ID) return;
    const visibility = () => setChatShielded(document.hidden);
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "PrintScreen") return;
      setChatShielded(true);
      setSecurityNotice("Screenshot attempt detected. Your friend was notified.");
      void liveRef.current?.send({
        type: "broadcast",
        event: "screen-capture-attempt",
        payload: { userId: user.id, at: new Date().toISOString() },
      });
      if (supabase) void supabase.rpc("notify_chat_screenshot_attempt", {
        p_friendship_id: friendship.id,
      });
      window.setTimeout(() => setChatShielded(false), 1400);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keydown);
    };
  }, [friendship.id, user.id]);
  const announceTyping = (typing: boolean) => {
    void liveRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, typing },
    });
  };
  const changeText = (value: string) => {
    setText(value);
    announceTyping(Boolean(value.trim()));
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(
      () => announceTyping(false),
      1400,
    );
  };
  const send = async () => {
    if (!supabase || !text.trim() || !friendId) return;
    const value = text.trim();
    try {
      const encrypted = await encryptText(
        value,
        user.id,
        friendId,
        `friend:${friendship.id}`,
      );
      const { error } = await supabase.from("friend_messages").insert({
        friendship_id: friendship.id,
        sender_id: user.id,
        message: encrypted,
        reply_to_id: replyTo?.id ?? null,
      });
      if (error) throw error;
      setText("");
      announceTyping(false);
      setReplyTo(null);
      await load();
    } catch (problem) {
      alert(
        problem instanceof Error
          ? problem.message
          : "Encrypted message failed.",
      );
    }
  };
  const upload = async (file?: File, forceViewOnce = false) => {
    if (!supabase || !file || !friendId) return;
    if (file.size > 250 * 1024 * 1024) {
      alert("Maximum encrypted media size is 250 MB.");
      return;
    }
    const mediaType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : null;
    if (!mediaType) {
      alert("Choose an image, video or audio file.");
      return;
    }
    setUploading(true);
    setFriendUploadProgress(0);
    try {
      const context = `friend:${friendship.id}`;
      const [encryptedFile, encryptedMetadata] = await Promise.all([
        encryptFile(file, user.id, friendId, context),
        encryptText(
          JSON.stringify({ kind: "media", mime: file.type, name: file.name }),
          user.id,
          friendId,
          context,
        ),
      ]);
      const path = `friend/${friendship.id}/${user.id}/${crypto.randomUUID()}.e2ee`;
      await uploadResumable({
        bucket: "chat-media",
        path,
        body: encryptedFile,
        contentType: "application/octet-stream",
        onProgress: setFriendUploadProgress,
      });
      const { error: messageError } = await supabase
        .from("friend_messages")
        .insert({
          friendship_id: friendship.id,
          sender_id: user.id,
          message: encryptedMetadata,
          media_path: path,
          media_type: mediaType,
          view_once: mediaType === "image" && forceViewOnce,
          reply_to_id: replyTo?.id ?? null,
        });
      if (messageError) throw messageError;
    } catch (problem) {
      alert(
        problem instanceof Error ? problem.message : "Encrypted upload failed.",
      );
    }
    setUploading(false);
    setFriendUploadProgress(0);
    setReplyTo(null);
    setMediaChoice(null);
    await load();
  };
  const toggleVoiceRecording = async () => {
    if (recording) return recorderRef.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderChunksRef.current = [];
      recorder.ondataavailable = (event) =>
        event.data.size && recorderChunksRef.current.push(event.data);
      recorder.onstop = () => {
        const file = new File(
          recorderChunksRef.current,
          `voice-${Date.now()}.${recorder.mimeType.includes("mp4") ? "m4a" : "webm"}`,
          { type: recorder.mimeType || mimeType || "audio/webm" },
        );
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        void upload(file, false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      alert("Allow microphone access to record a voice note.");
    }
  };
  const openViewOnce = async (item: FriendMessage) => {
    if (!supabase || item.sender_id === user.id || item.viewed_at) return;
    if (!item.media_path) return alert("This photo is no longer available.");
    const { data: signed } = await supabase.storage
      .from("chat-media")
      .createSignedUrl(item.media_path, 30);
    if (!signed?.signedUrl)
      return alert("This photo is no longer available.");
    const { data: consumed, error } = await supabase.rpc("consume_view_once_message", {
      p_message_id: item.id,
    });
    if (error || !consumed)
      return alert(error?.message ?? "This photo was already opened.");
    try {
      const decryptedMetadata = await decryptText(
        item.message,
        user.id,
        friendId,
        `friend:${friendship.id}`,
      );
      const metadata = JSON.parse(decryptedMetadata ?? "{}") as { mime?: string };
      const response = await fetch(signed.signedUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Photo download failed");
      const blob = item.encrypted
        ? await decryptFile(
            await response.arrayBuffer(),
            metadata.mime ?? "image/jpeg",
            user.id,
            friendId,
            `friend:${friendship.id}`,
          )
        : await response.blob();
      const mediaUrl = URL.createObjectURL(blob);
      mediaUrlsRef.current.set(item.media_path, mediaUrl);
      item = { ...item, media_url: mediaUrl, viewed_at: new Date().toISOString() };
    } catch {
      void load();
      return alert("This view-once photo could not be opened.");
    }
    setOpenedOnceIds((current) => [...new Set([...current, item.id])]);
    setMediaPreview(item);
    if (viewOnceTimerRef.current) window.clearTimeout(viewOnceTimerRef.current);
    viewOnceTimerRef.current = window.setTimeout(() => {
      setMediaPreview(null);
      setOpenedOnceIds((current) => current.filter((id) => id !== item.id));
      void load();
    }, 10_000);
  };
  const closeMediaPreview = () => {
    if (viewOnceTimerRef.current) window.clearTimeout(viewOnceTimerRef.current);
    const viewedId = mediaPreview?.view_once ? mediaPreview.id : null;
    setMediaPreview(null);
    if (viewedId) {
      setOpenedOnceIds((current) => current.filter((id) => id !== viewedId));
      void load();
    }
  };
  const editMessage = async (item: FriendMessage) => {
    if (
      !supabase ||
      !friendId ||
      !item.message ||
      item.deleted_at ||
      item.media_path
    )
      return;
    const current = item.display_message ?? "";
    const next = window.prompt("Edit message", current)?.trim();
    if (!next || next === current) return;
    const encrypted = await encryptText(
      next,
      user.id,
      friendId,
      `friend:${friendship.id}`,
    );
    const { error } = await supabase.rpc("edit_friend_message", {
      p_message_id: item.id,
      p_message: encrypted,
    });
    if (error) alert(error.message);
    await load();
  };
  const deleteMessage = async (item: FriendMessage) => {
    if (!supabase || item.deleted_at || !window.confirm("Delete this message?"))
      return;
    const { error } = await supabase.rpc("delete_friend_message", {
      p_message_id: item.id,
    });
    if (error) alert(error.message);
    if (replyTo?.id === item.id) setReplyTo(null);
    await load();
  };
  const deleteMessageForMe = async (item: FriendMessage) => {
    if (!supabase) return;
    const { error } = await supabase.rpc("hide_friend_message_for_me", {
      p_message_id: item.id,
    });
    if (error) alert(error.message);
    setMessageMenu(null);
    await load();
  };
  const startMessageHold = (item: FriendMessage) => {
    if (messageHoldRef.current) window.clearTimeout(messageHoldRef.current);
    messageHoldRef.current = window.setTimeout(() => setMessageMenu(item), 520);
  };
  const cancelMessageHold = () => {
    if (messageHoldRef.current) window.clearTimeout(messageHoldRef.current);
    messageHoldRef.current = null;
  };
  const requestCall = (kind: "audio" | "video") => {
    setCallError("");
    if (!friendOnline) {
      setCallError("Friend is not in this chat now.");
      return;
    }
    if (friend?.allow_audio_calls === false) {
      setCallError("This friend has disabled private call requests.");
      return;
    }
    callKindRef.current = kind;
    setCallKind(kind);
    setCallState("requesting");
    void liveRef.current?.send({
      type: "broadcast",
      event: "call-request",
      payload: { userId: user.id, kind },
    });
    if (callTimeoutRef.current) window.clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = window.setTimeout(() => {
      setCallState((current) => {
        if (current === "requesting") {
          setCallError("No answer. You can call again.");
          return "idle";
        }
        return current;
      });
    }, 30000);
  };
  const answerCall = async (accepted: boolean) => {
    void liveRef.current?.send({
      type: "broadcast",
      event: "call-response",
      payload: { userId: user.id, accepted },
    });
    if (!accepted) {
      setCallState("idle");
      return;
    }
    try {
      setCallState("connecting");
      await ensurePeer(callKindRef.current);
    } catch {
      setCallError(
        callKindRef.current === "video"
          ? "Allow camera and microphone access to answer."
          : "Allow microphone access to answer.",
      );
      stopCall(false);
    }
  };
  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };
  const toggleSpeaker = () => {
    const next = !speakerOn;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !next;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !next;
    setSpeakerOn(next);
  };
  const toggleCamera = () => {
    const next = !cameraOn;
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraOn(next);
  };
  const back = () => {
    stopCall();
    onBack();
  };
  if (showFriendProfile && friend)
    return (
      <div className="social-overlay">
        <section className="friends-panel profile-view-panel">
          <header>
            <button onClick={() => setShowFriendProfile(false)}>
              <ArrowLeft />
            </button>
            <b>Friend Profile</b>
          </header>
          <ProfileDetails profile={friend} label="Friend Profile" />
          <ProfileDetails
            profile={friend}
            label="Friend Profile"
            onFollowersClick={() => onOpenConnections("followers")}
            onFollowingClick={() => onOpenConnections("following")}
          />
          <ProfileReels user={user} profile={friend} />
          <div className="profile-status-row">
            <i className={friendOnline ? "online" : "offline"} />
            <b>
              {lastSeenLabel(
                friend ? { ...friend, last_seen_at: friendLastSeen } : friend,
                friendOnline,
              )}
            </b>
          </div>
        </section>
      </div>
    );
  return (
    <div className="social-overlay">
      <section className="friend-chat">
        <audio ref={remoteAudioRef} autoPlay />
        <header>
          <button onClick={back}>
            <ArrowLeft />
          </button>
          <button
            className="chat-avatar profile-open"
            onClick={() => setShowFriendProfile(true)}
            aria-label="View friend profile"
          >
            <ProfileAvatar profile={friend} />
            <i className={friendOnline ? "online" : "offline"} />
          </button>
          <button
            className="chat-person"
            onClick={() => setShowFriendProfile(true)}
          >
            <b>{friend?.username ?? "ZION friend"}</b>
            <small>
              {callState === "active"
                ? `${callKind === "video" ? "Video" : "Audio"} call connected`
                : friendTyping
                  ? "Typing…"
                  : friendOnline
                    ? "Online now · Permanent chat"
                    : `${lastSeenLabel(friend ? { ...friend, last_seen_at: friendLastSeen } : friend)} · Permanent chat`}
            </small>
          </button>
          {callState !== "idle" ? (
            <button
              className="call-button end"
              onClick={() => stopCall()}
              aria-label="End call"
            >
              <PhoneOff />
            </button>
          ) : (
            <div className="friend-call-buttons">
              <button
                className="call-button"
                disabled={!friendOnline}
                onClick={() => requestCall("audio")}
                aria-label="Request audio call"
              >
                <Phone />
              </button>
              <button
                className="call-button video"
                disabled={!friendOnline}
                onClick={() => requestCall("video")}
                aria-label="Request video call"
              >
                <Video />
              </button>
            </div>
          )}
        </header>
        {callKind === "video" && callState !== "idle" ? (
          <div className="private-video-stage">
            <video ref={remoteVideoRef} autoPlay playsInline />
            {callState !== "active" ? (
              <div className="video-waiting">
                <ProfileAvatar profile={friend} />
                <span>Waiting for video permission…</span>
              </div>
            ) : null}
            <video
              className="local-video"
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
            />
          </div>
        ) : null}
        {callState === "incoming" ? (
          <div className="call-request">
            <ProfileAvatar profile={friend} />
            <div>
              <b>
                {friend?.username ?? "Friend"} wants a {callKind} call
              </b>
              <small>
                Your{" "}
                {callKind === "video"
                  ? "camera and microphone start"
                  : "microphone starts"}{" "}
                only after Allow.
              </small>
            </div>
            <button className="decline" onClick={() => void answerCall(false)}>
              Decline
            </button>
            <button className="allow" onClick={() => void answerCall(true)}>
              Allow
            </button>
          </div>
        ) : null}
        {callState === "requesting" || callState === "connecting" ? (
          <div className="call-status">
            <span className="live-dot" />
            {callState === "requesting"
              ? "Waiting for permission…"
              : `Connecting private ${callKind}…`}
            <button onClick={() => stopCall()}>Cancel</button>
          </div>
        ) : null}
        {callState === "active" ? (
          <div className="active-call-controls">
            <button className={muted ? "active" : ""} onClick={toggleMute}>
              {muted ? <MicOff /> : <Mic />}
              <span>{muted ? "Unmute" : "Mute"}</span>
            </button>
            <button
              className={!speakerOn ? "active" : ""}
              onClick={toggleSpeaker}
            >
              {speakerOn ? <Volume2 /> : <VolumeX />}
              <span>{speakerOn ? "Speaker" : "Sound off"}</span>
            </button>
            {callKind === "video" ? (
              <button
                className={!cameraOn ? "active" : ""}
                onClick={toggleCamera}
              >
                {cameraOn ? <Camera /> : <VideoOff />}
                <span>{cameraOn ? "Camera" : "Camera off"}</span>
              </button>
            ) : null}
            <button className="end-control" onClick={() => stopCall()}>
              <PhoneOff />
              <span>End</span>
            </button>
          </div>
        ) : null}
        {callError ? <p className="call-error">{callError}</p> : null}
        {callState !== "idle" ? (
          <p className="call-security-note">Calls use encrypted WebRTC transport. Independent end-to-end encryption verification is pending.</p>
        ) : null}
        <div className="streak-strip">
          <span>{streakBadge(friendship.streak_count)}</span>
          <b>{friendship.streak_count} day streak</b>
          <small>Restarts after 3 inactive days.</small>
        </div>
        <div className="moderation-banner compact">
          <ShieldAlert size={15} /> End-to-end encrypted · Only you and this
          friend can read messages or open media.
        </div>
        {securityNotice ? <div className="chat-security-notice">{securityNotice}</div> : null}
        {chatShielded ? <div className="chat-privacy-shield">Private chat hidden</div> : null}
        <div className="friend-message-list" ref={listRef}>
          {!messages.length ? (
            <div className="empty-private-chat">
              <ProfileAvatar profile={friend} />
              <b>Start your conversation</b>
              <span>
                Messages, photos and videos stay in this private friend chat.
              </span>
            </div>
          ) : null}
          {messages.map((item) => {
            const quoted = messages.find(
              (message) => message.id === item.reply_to_id,
            );
            return (
              <div
                key={item.id}
                onPointerDown={() => startMessageHold(item)}
                onPointerUp={cancelMessageHold}
                onPointerCancel={cancelMessageHold}
                onPointerLeave={cancelMessageHold}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMessageMenu(item);
                }}
                className={
                  item.sender_id === user.id
                    ? `friend-bubble mine ${item.media_url ? "has-media" : ""}`
                    : `friend-bubble theirs ${item.media_url ? "has-media" : ""}`
                }
              >
                {quoted ? (
                  <div className="quoted-message">
                    <Reply />{" "}
                    <span>
                      {quoted.deleted_at
                        ? "Message deleted"
                        : (quoted.display_message ??
                          (quoted.media_type === "image" ? "Photo" : "Video"))}
                    </span>
                  </div>
                ) : null}
                {!item.deleted_at &&
                item.view_once &&
                item.sender_id === user.id ? (
                  <div className="view-once-sent">
                    <ImagePlus />
                    <span>View-once photo sent</span>
                  </div>
                ) : null}
                {!item.deleted_at &&
                item.view_once &&
                item.sender_id !== user.id &&
                !openedOnceIds.includes(item.id) ? (
                  <button
                    className="view-once-button"
                    disabled={Boolean(item.viewed_at)}
                    onClick={() => void openViewOnce(item)}
                  >
                    {item.viewed_at
                      ? "Photo already opened"
                      : "View photo once"}
                  </button>
                ) : null}
                {!item.deleted_at &&
                item.media_url &&
                item.media_type === "image" &&
                !item.view_once ? (
                  <img
                    src={item.media_url}
                    alt="Shared attachment"
                    loading="lazy"
                    onClick={() => setMediaPreview(item)}
                  />
                ) : null}
                {!item.deleted_at &&
                item.media_url &&
                item.media_type === "audio" ? (
                  <VoiceNotePlayer src={item.media_url} onPlaybackError={() => setSecurityNotice("This voice note cannot play on this browser. New recordings use a compatible format.")} />
                ) : null}
                {!item.deleted_at &&
                item.media_url &&
                item.media_type === "video" ? (
                  <video
                    src={item.media_url}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : null}
                {item.deleted_at ? (
                  <span className="deleted-message">Message deleted</span>
                ) : item.display_message ? (
                  <span>{item.display_message}</span>
                ) : null}
                <div className="message-footer">
                {!item.deleted_at ? (
                  <div className="message-actions">
                    <button
                      onClick={() => setReplyTo(item)}
                      title="Reply or mention"
                    >
                      <Reply />
                    </button>
                    {item.sender_id === user.id && !item.media_path ? (
                      <button
                        onClick={() => void editMessage(item)}
                        title="Edit"
                      >
                        <Pencil />
                      </button>
                    ) : null}
                    {item.sender_id === user.id ? (
                      <button
                        onClick={() => void deleteMessage(item)}
                        title="Delete"
                      >
                        <Trash2 />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="message-meta">
                <MessageTime sentAt={item.created_at} />
                {item.edited_at && !item.deleted_at ? (
                  <em className="edited-label">edited</em>
                ) : null}
                {item.sender_id === user.id ? (
                  <small className={item.read_at ? "read" : ""} aria-label={item.read_at ? "Seen" : "Sent"}>
                    {item.read_at ? "✓✓" : "✓"}
                  </small>
                ) : null}
                </div>
                </div>
              </div>
            );
          })}
          {friendOnline ? (
            <div
              className={
                friendTyping ? "presence-peek typing" : "presence-peek"
              }
            >
              <ProfileAvatar profile={friend} />
              {friendTyping ? (
                <div className="typing-dots">
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <small>Here</small>
              )}
            </div>
          ) : null}
        </div>
        {replyTo ? (
          <div className="reply-preview">
            <Reply />
            <div>
              <b>
                Replying to{" "}
                {replyTo.sender_id === user.id
                  ? "yourself"
                  : (friend?.username ?? "friend")}
              </b>
              <span>
                {replyTo.display_message ??
                  (replyTo.media_type === "image" ? "Photo" : "Video")}
              </span>
            </div>
            <button onClick={() => setReplyTo(null)}>
              <X />
            </button>
          </div>
        ) : null}
        <div className="friend-compose">
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.type.startsWith("image/")) setMediaChoice(file);
              else void upload(file, false);
            }}
          />
          <button
            className="media-button"
            aria-label="Share photo or video"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <span>{friendUploadProgress}%</span> : <Plus />}
          </button>
          <input
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void send()}
            placeholder={
              friendTyping
                ? `${friend?.username ?? "Friend"} is typing…`
                : "Message your friend…"
            }
            maxLength={1000}
          />
          {text.trim() ? (
            <button className="send-button" aria-label="Send message" onClick={() => void send()}>
              <Send />
            </button>
          ) : (
            <button
              className={`voice-note-button ${recording ? "recording" : ""}`}
              type="button"
              aria-label={recording ? "Stop and send voice note" : "Record voice note"}
              disabled={uploading}
              onClick={() => void toggleVoiceRecording()}
            >
              {recording ? <MicOff /> : <Mic />}
            </button>
          )}
        </div>
        {mediaChoice ? (
          <div className="media-choice-overlay" onClick={() => setMediaChoice(null)}>
            <div className="media-choice-sheet" onClick={(event) => event.stopPropagation()}>
              <b>Send photo</b>
              <button onClick={() => void upload(mediaChoice, false)}>
                Send normally
              </button>
              <button className="view-once" onClick={() => void upload(mediaChoice, true)}>
                View once · receiver only
              </button>
              <button onClick={() => setMediaChoice(null)}>Cancel</button>
            </div>
          </div>
        ) : null}
        {messageMenu ? (
          <div
            className="message-menu-overlay"
            onClick={() => setMessageMenu(null)}
          >
            <div
              className="message-action-sheet"
              onClick={(event) => event.stopPropagation()}
            >
              <b>Message options</b>
              <button onClick={() => void deleteMessageForMe(messageMenu)}>
                <Trash2 /> Delete for me
              </button>
              {messageMenu.sender_id === user.id ? (
                <button
                  className="danger"
                  onClick={() => {
                    setMessageMenu(null);
                    void deleteMessage(messageMenu);
                  }}
                >
                  <Trash2 /> Delete for everyone
                </button>
              ) : null}
              <button onClick={() => setMessageMenu(null)}>Cancel</button>
            </div>
          </div>
        ) : null}
        {mediaPreview?.media_url ? (
          <div
            className="chat-media-lightbox"
            onClick={closeMediaPreview}
          >
            <button aria-label="Close preview" onClick={closeMediaPreview}>
              <X />
            </button>
            {mediaPreview.media_type === "video" ? (
              <video
                src={mediaPreview.media_url}
                controls
                autoPlay
                playsInline
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <img
                src={mediaPreview.media_url}
                alt="Full-screen shared media"
                onClick={(event) => event.stopPropagation()}
              />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
