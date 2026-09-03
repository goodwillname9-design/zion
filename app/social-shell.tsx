"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  ImagePlus,
  Heart,
  LogOut,
  Mic,
  MicOff,
  Moon,
  Pencil,
  Phone,
  PhoneOff,
  Pin,
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
type FriendMessage = {
  id: number;
  friendship_id: string;
  sender_id: string;
  message: string | null;
  media_path: string | null;
  media_type: "image" | "video" | null;
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
const streakBadge = (count: number) =>
  count >= 360 ? "🖤💛❤️" : count >= 30 ? "❤️" : count >= 10 ? "💛" : "🖤";
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
  followerCount = 0,
  followingCount = 0,
}: {
  profile: ZionProfile;
  label?: string;
  followerCount?: number;
  followingCount?: number;
}) {
  const joined = profile.created_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
        new Date(profile.created_at),
      )
    : "Not available";
  return (
    <div className="profile-details">
      <ProfileAvatar profile={profile} />
      <span className="mini-label">{label}</span>
      <h2>{profile.username}</h2>
      {profile.is_admin ? (
        <span className="admin-profile-badge">ADMIN · ZION OWNER</span>
      ) : null}
      <p className="profile-handle">@{profile.username}</p>
      <div className="profile-social-counts">
        <span><b>{followerCount}</b><small>Followers</small></span>
        <span><b>{followingCount}</b><small>Following</small></span>
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

export function SocialShell() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ZionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friendsInitialTab, setFriendsInitialTab] = useState<"friends" | "notifications">("friends");
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [error, setError] = useState("");
  const [notificationPrompt, setNotificationPrompt] = useState(false);
  const [notificationToast, setNotificationToast] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
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
            "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,allow_audio_calls,show_country,show_online_status,profile_edit_used,is_admin",
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
    const refreshNotificationCount = async () => {
      const { count } = await client
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", user.id)
        .eq("status", "pending");
      setNotificationCount(count ?? 0);
    };
    void refreshNotificationCount();
    const channel = client
      .channel(`friend-request-alerts-${user.id}`)
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
          const row = payload.new as { requester_id?: string; status?: string };
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
        onOpenFriends={() => {
          setFriendsInitialTab("friends");
          setFriendsOpen(true);
        }}
        onOpenNotifications={() => {
          setFriendsInitialTab("notifications");
          setFriendsOpen(true);
        }}
        notificationCount={notificationCount}
        onOpenAccountManager={() => setAccountManagerOpen(true)}
      />
      {friendsOpen ? (
        <FriendsPanel
          user={user}
          profile={profile}
          initialTab={friendsInitialTab}
          onProfileUpdated={setProfile}
          onClose={() => setFriendsOpen(false)}
        />
      ) : null}
      {accountManagerOpen ? (
        <AccountManager
          currentUsername={profile.username}
          onClose={() => setAccountManagerOpen(false)}
        />
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
          setError(problem instanceof Error ? problem.message : "Encryption setup failed.");
        }
      }
    } else {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
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
          setError(problem instanceof Error ? problem.message : "Encryption setup failed.");
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
        <Button disabled={busy || password.length < 6} onClick={() => void unlock()}>
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
  user,
  profile,
  initialTab,
  onProfileUpdated,
  onClose,
}: {
  user: User;
  profile: ZionProfile;
  initialTab: "friends" | "notifications";
  onProfileUpdated: (profile: ZionProfile) => void;
  onClose: () => void;
}) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ZionProfile>>({});
  const [pins, setPins] = useState<string[]>([]);
  const [selected, setSelected] = useState<Friendship | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "friends" | "notifications" | "find" | "profile" | "communities" | "admin"
  >(initialTab);
  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<
    (ZionProfile & { friend_status?: string }) | null
  >(null);
  const [searchMessage, setSearchMessage] = useState("");
  const profileFileRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"dark" | "day">(() =>
    typeof window !== "undefined" &&
    localStorage.getItem("zion-theme") === "day"
      ? "day"
      : "dark",
  );
  const [allowCalls, setAllowCalls] = useState(true);
  const [showCountry, setShowCountry] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editCountry, setEditCountry] = useState(profile.country);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [socialCounts, setSocialCounts] = useState({ followers: 0, following: 0 });
  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: rows }, { data: pinRows }, { data: privacy }, { data: followingRows }, followerCount, followingCount] =
      await Promise.all([
        supabase
          .from("friendships")
          .select(
            "id,requester_id,addressee_id,status,created_at,accepted_at,streak_count,last_streak_date",
          )
          .order("created_at", { ascending: false }),
        supabase.from("friend_pins").select("friend_id").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("allow_audio_calls,show_country,show_online_status")
          .eq("id", user.id)
          .single(),
        supabase.from("profile_follows").select("following_id").eq("follower_id", user.id),
        supabase.from("profile_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("profile_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);
    const list = (rows as Friendship[] | null) ?? [];
    setFriendships(list);
    setPins((pinRows ?? []).map((item) => item.friend_id));
    setFollowingIds((followingRows ?? []).map((item) => item.following_id));
    setSocialCounts({ followers: followerCount.count ?? 0, following: followingCount.count ?? 0 });
    if (privacy) {
      setAllowCalls(privacy.allow_audio_calls);
      setShowCountry(privacy.show_country);
      setShowOnline(privacy.show_online_status);
    }
    const ids = [
      ...new Set(
        list
          .flatMap((item) => [item.requester_id, item.addressee_id])
          .filter((id) => id !== user.id),
      ),
    ];
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,allow_audio_calls,show_country,show_online_status,is_admin",
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
      .subscribe();
    return () => {
      window.clearTimeout(initial);
      if (debounce) window.clearTimeout(debounce);
      void client.removeChannel(channel);
    };
  }, [load, user.id]);
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
        .sort(
          (a, b) => {
            const pinOrder =
              Number(pins.includes(otherId(b))) -
              Number(pins.includes(otherId(a)));
            if (pinOrder) return pinOrder;
            return (
              new Date(b.accepted_at ?? b.created_at).getTime() -
              new Date(a.accepted_at ?? a.created_at).getTime()
            );
          },
        ),
    [friendships, otherId, pins],
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
  const savePrivacy = async () => {
    if (!supabase) return;
    await supabase
      .from("profiles")
      .update({
        allow_audio_calls: allowCalls,
        show_country: showCountry,
        show_online_status: showOnline,
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
      await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("following_id", profileId);
    else
      await supabase.from("profile_follows").insert({ follower_id: user.id, following_id: profileId });
    await load();
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
  if (selected)
    return (
      <FriendChat
        friendship={selected}
        friend={profiles[otherId(selected)]}
        user={user}
        onBack={() => setSelected(null)}
      />
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
            <button onClick={() => setSettingsOpen(false)}>
              <X />
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
          <button onClick={onClose} aria-label="Close">
            <X />
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
            className={activeTab === "profile" ? "active" : ""}
            onClick={() => setActiveTab("profile")}
          >
            <UserRound /> My Profile
          </button>
          <button
            className={activeTab === "communities" ? "active" : ""}
            onClick={() => setActiveTab("communities")}
          >
            <Users /> Communities
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
        ) : activeTab === "communities" ? (
          <CommunityPanel
            user={user}
            friends={accepted.map((item) => profiles[otherId(item)]).filter(Boolean)}
          />
        ) : activeTab === "notifications" ? (
          <div className="notification-center">
            <h2>
              <Bell /> Notification Center
            </h2>
            {pendingRequests.length ? (
              pendingRequests.map((item) => {
                const person = profiles[otherId(item)];
                return (
                  <div className="notification-request" key={item.id}>
                    <ProfileAvatar profile={person} />
                    <div>
                      <b>{person?.username ?? "ZION user"}</b>
                      <small>sent you a friend request</small>
                    </div>
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
              })
            ) : (
              <div className="empty-friends">
                <Bell />
                <p>No new friend requests.</p>
              </div>
            )}
          </div>
        ) : activeTab === "profile" ? (
          <ProfileDetails
            profile={profile}
            label="My ZION Profile"
            followerCount={socialCounts.followers}
            followingCount={socialCounts.following}
          />
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
                  {followingIds.includes(searchResult.id) ? "Following" : "Follow"}
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
                          <small>
                            {person?.country
                              ? countryLabel(person.country)
                              : "Private chat"}
                          </small>
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

function CommunityPanel({ user, friends }: { user: User; friends: ZionProfile[] }) {
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
      .select("id,community_id,sender_id,ciphertext,created_at,media_path,media_type")
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
        const { error: memberError } = await supabase.from("community_members").insert(
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
      setError(problem instanceof Error ? problem.message : "Secure group setup failed.");
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
    const { error: sendError } = await supabase.from("community_messages").insert({
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
      const { error: messageError } = await supabase.from("community_messages").insert({
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
      setError(problem instanceof Error ? problem.message : "Media upload failed.");
    }
    setUploadProgress(null);
    if (communityFileRef.current) communityFileRef.current.value = "";
  };

  if (selected)
    return (
      <div className="community-chat">
        <div className="community-chat-head">
          <button onClick={() => { setSelected(null); setSecret(""); }}><ArrowLeft /></button>
          <div><b>{selected.name}</b><small>🔒 End-to-end encrypted group</small></div>
        </div>
        <div className="community-message-list">
          {messages.map((item) => (
            <div key={item.id} className={item.sender_id === user.id ? "community-bubble mine" : "community-bubble"}>
              <small>{item.sender_id === user.id ? "You" : (friends.find((friend) => friend.id === item.sender_id)?.username ?? "Member")}</small>
              {item.media_url && item.media_type === "image" ? <img src={item.media_url} alt="Encrypted community attachment" loading="lazy" /> : null}
              {item.media_url && item.media_type === "video" ? <video src={item.media_url} controls playsInline preload="metadata" /> : null}
              <span>{item.display_message}</span>
            </div>
          ))}
          {!messages.length ? <p>Start this private community conversation.</p> : null}
        </div>
        <div className="friend-compose">
          <input ref={communityFileRef} hidden type="file" accept="image/*,video/*" onChange={(event) => void uploadCommunityMedia(event.target.files?.[0])} />
          <button className="media-button" onClick={() => communityFileRef.current?.click()} disabled={uploadProgress !== null}><ImagePlus /><span>{uploadProgress === null ? "Gallery" : `${uploadProgress}%`}</span></button>
          <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void sendCommunityMessage()} placeholder="Message community…" maxLength={2000} />
          <button className="send-button" onClick={() => void sendCommunityMessage()} disabled={!text.trim()}><Send /></button>
        </div>
      </div>
    );

  return (
    <div className="community-panel">
      <div className="community-title"><div><span className="mini-label">ZION COMMUNITIES</span><h2>Private group chats</h2></div><button onClick={() => setCreating((value) => !value)}>{creating ? "Cancel" : "+ Create"}</button></div>
      {error ? <p className="error-note">{error}</p> : null}
      {creating ? (
        <div className="community-create">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Community name" maxLength={60} />
          <b>Add trusted friends</b>
          <div className="community-member-picker">
            {friends.map((friend) => (
              <label key={friend.id}><input type="checkbox" checked={memberIds.includes(friend.id)} onChange={(event) => setMemberIds((current) => event.target.checked ? [...current, friend.id] : current.filter((id) => id !== friend.id))} /><ProfileAvatar profile={friend} /><span>{friend.username}</span></label>
            ))}
          </div>
          <Button className="primary-action" disabled={name.trim().length < 3} onClick={() => void createCommunity()}>Create encrypted community</Button>
        </div>
      ) : null}
      <div className="community-list">
        {communities.map((community) => <button key={community.id} onClick={() => void openCommunity(community)}><span>👥</span><div><b>{community.name}</b><small>Encrypted community</small></div><ArrowRight /></button>)}
        {!communities.length && !creating ? <div className="empty-friends"><Users /><p>Create a community and add trusted friends.</p></div> : null}
      </div>
    </div>
  );
}

function AdminPanel({ user }: { user: User }) {
  const [rows, setRows] = useState<ZionProfile[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,is_admin",
      )
      .order("created_at", { ascending: false });
    setRows((data as ZionProfile[] | null) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
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
    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: next, ban_reason: next ? reason : null })
      .eq("id", profile.id);
    if (error) alert(error.message);
    else await load();
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
      </div>
    </div>
  );
}

function FriendChat({
  friendship,
  friend,
  user,
  onBack,
}: {
  friendship: Friendship;
  friend?: ZionProfile;
  user: User;
  onBack: () => void;
}) {
  const friendId = friend?.id ?? "";
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [friendUploadProgress, setFriendUploadProgress] = useState(0);
  const [friendOnline, setFriendOnline] = useState(false);
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
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const load = useCallback(async () => {
    if (!supabase || !friendId) return;
    await supabase.rpc("mark_friend_messages_read", {
      p_friendship_id: friendship.id,
    });
    const { data } = await supabase
      .from("friend_messages")
      .select(
        "id,friendship_id,sender_id,message,media_path,media_type,created_at,read_at,edited_at,deleted_at,reply_to_id",
      )
      .eq("friendship_id", friendship.id)
      .order("created_at");
    const rows = (data as FriendMessage[] | null) ?? [];
    const withUrls = await Promise.all(
      rows.map(async (item) => {
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
        const { data: signed } = await supabase!.storage
          .from("chat-media")
          .createSignedUrl(item.media_path, 3600);
        if (!signed?.signedUrl) return { ...item, display_message: null, encrypted };
        if (!encrypted)
          return { ...item, display_message: null, media_url: signed.signedUrl };
        try {
          const metadata = JSON.parse(decrypted ?? "{}") as { mime?: string };
          const response = await fetch(signed.signedUrl);
          const blob = await decryptFile(
            await response.arrayBuffer(),
            metadata.mime ?? "application/octet-stream",
            user.id,
            friendId,
            `friend:${friendship.id}`,
          );
          const url = URL.createObjectURL(blob);
          mediaUrlsRef.current.set(item.media_path, url);
          return { ...item, display_message: null, media_url: url, encrypted };
        } catch {
          return {
            ...item,
            display_message: "🔒 Unable to decrypt this attachment",
            encrypted,
          };
        }
      }),
    );
    setMessages(withUrls);
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
      alert(problem instanceof Error ? problem.message : "Encrypted message failed.");
    }
  };
  const upload = async (file?: File) => {
    if (!supabase || !file || !friendId) return;
    if (file.size > 250 * 1024 * 1024) {
      alert("Maximum encrypted media size is 250 MB.");
      return;
    }
    const mediaType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : null;
    if (!mediaType) {
      alert("Choose an image or video.");
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
      const { error: messageError } = await supabase.from("friend_messages").insert({
        friendship_id: friendship.id,
        sender_id: user.id,
        message: encryptedMetadata,
        media_path: path,
        media_type: mediaType,
        reply_to_id: replyTo?.id ?? null,
      });
      if (messageError) throw messageError;
    } catch (problem) {
      alert(problem instanceof Error ? problem.message : "Encrypted upload failed.");
    }
    setUploading(false);
    setFriendUploadProgress(0);
    setReplyTo(null);
    await load();
  };
  const editMessage = async (item: FriendMessage) => {
    if (!supabase || !friendId || !item.message || item.deleted_at || item.media_path)
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
          <div className="profile-status-row">
            <i className={friendOnline ? "online" : "offline"} />
            <b>{friendOnline ? "Online now" : "Offline"}</b>
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
                    : "Offline · Permanent chat"}
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
        <div className="streak-strip">
          <span>{streakBadge(friendship.streak_count)}</span>
          <b>{friendship.streak_count} day streak</b>
          <small>Restarts after 3 inactive days.</small>
        </div>
          <div className="moderation-banner compact">
          <ShieldAlert size={15} /> End-to-end encrypted · Only you and this
          friend can read messages or open media.
        </div>
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
                className={
                  item.sender_id === user.id
                    ? "friend-bubble mine"
                    : "friend-bubble theirs"
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
                item.media_url &&
                item.media_type === "image" ? (
                  <img src={item.media_url} alt="Shared attachment" loading="lazy" />
                ) : null}
                {!item.deleted_at &&
                item.media_url &&
                item.media_type === "video" ? (
                  <video src={item.media_url} controls playsInline preload="metadata" />
                ) : null}
                {item.deleted_at ? (
                  <span className="deleted-message">Message deleted</span>
                ) : item.display_message ? (
                  <span>{item.display_message}</span>
                ) : null}
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
                {item.edited_at && !item.deleted_at ? (
                  <em className="edited-label">edited</em>
                ) : null}
                {item.sender_id === user.id ? (
                  <small className={item.read_at ? "read" : ""}>
                    {item.read_at ? "✓✓" : "✓"}
                  </small>
                ) : null}
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
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button
            className="media-button"
            aria-label="Share photo or video"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
            <span>{uploading ? `${friendUploadProgress}%` : "Gallery"}</span>
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
          <button
            className="send-button"
            aria-label="Send message"
            disabled={!text.trim()}
            onClick={() => void send()}
          >
            <Send />
          </button>
        </div>
      </section>
    </div>
  );
}
