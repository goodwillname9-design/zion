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
  X,
} from "lucide-react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Experience, type ZionProfile } from "./experience";
import { countryLabel, countryOptions } from "./countries";

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
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
};
const avatars = ["👨🏽", "👨🏻‍🦱", "👨🏿‍🦲", "🧔🏼", "👩🏽", "👩🏻‍🦱", "👩🏿", "👱🏼‍♀️", "🧑🏾", "🧑🏻‍🦰"];
const streakBadge = (count: number) =>
  count >= 360 ? "🖤💛❤️" : count >= 30 ? "❤️" : count >= 10 ? "💛" : "🖤";
const DEVICE_ACCOUNTS_KEY = "zion-device-usernames";
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
  return `u-${hex}@accounts.zion.local`;
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
}: {
  profile: ZionProfile;
  label?: string;
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
      <p className="profile-handle">@{profile.username}</p>
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
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [error, setError] = useState("");
  const [notificationPrompt, setNotificationPrompt] = useState(false);
  const [notificationToast, setNotificationToast] = useState("");
  const [openingIntro, setOpeningIntro] = useState(true);
  useEffect(() => {
    document.documentElement.dataset.theme =
      localStorage.getItem("zion-theme") === "day" ? "day" : "dark";
  }, []);
  const loadProfile = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser || !supabase) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,allow_audio_calls,show_country,show_online_status,profile_edit_used",
      )
      .eq("id", nextUser.id)
      .maybeSingle();
    setProfile((data as ZionProfile | null) ?? null);
    if (data?.username) rememberDeviceAccount(data.username);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
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
  if (loading) return <AuthScreen title="Opening ZION…" />;
  if (!supabase)
    return <AuthScreen title="ZION needs Supabase configuration." />;
  if (!user) return <LoginScreen setError={setError} error={error} />;
  if (!profile) return <ProfileSetup user={user} onSaved={setProfile} />;
  if (profile.is_banned) return <BanScreen reason={profile.ban_reason} />;

  return (
    <>
      <Experience
        profile={profile}
        onOpenFriends={() => setFriendsOpen(true)}
        onOpenAccountManager={() => setAccountManagerOpen(true)}
      />
      {friendsOpen ? (
        <FriendsPanel
          user={user}
          profile={profile}
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
      else rememberDeviceAccount(username.trim());
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });
      if (loginError) setError("Incorrect username or password.");
      else rememberDeviceAccount(username.trim());
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
  onProfileUpdated,
  onClose,
}: {
  user: User;
  profile: ZionProfile;
  onProfileUpdated: (profile: ZionProfile) => void;
  onClose: () => void;
}) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ZionProfile>>({});
  const [pins, setPins] = useState<string[]>([]);
  const [selected, setSelected] = useState<Friendship | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "friends" | "notifications" | "find" | "profile"
  >("friends");
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
  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: rows }, { data: pinRows }, { data: privacy }] =
      await Promise.all([
        supabase
          .from("friendships")
          .select(
            "id,requester_id,addressee_id,status,created_at,streak_count,last_streak_date",
          )
          .order("created_at", { ascending: false }),
        supabase.from("friend_pins").select("friend_id").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("allow_audio_calls,show_country,show_online_status")
          .eq("id", user.id)
          .single(),
      ]);
    const list = (rows as Friendship[] | null) ?? [];
    setFriendships(list);
    setPins((pinRows ?? []).map((item) => item.friend_id));
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
          "id,username,gender,country,avatar,avatar_url,created_at,is_banned,ban_reason,allow_audio_calls,show_country,show_online_status",
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
    void load();
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load]);
  const otherId = (item: Friendship) =>
    item.requester_id === user.id ? item.addressee_id : item.requester_id;
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
          (a, b) =>
            Number(pins.includes(otherId(b))) -
            Number(pins.includes(otherId(a))),
        ),
    [friendships, pins],
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
    if (
      !supabase ||
      profile.profile_edit_used ||
      editUsername.trim().length < 3 ||
      !editCountry
    )
      return;
    const { data, error } = await supabase.rpc("update_profile_once", {
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
          <button
            className={activeTab === "friends" ? "active" : ""}
            onClick={() => setActiveTab("friends")}
          >
            <Users /> Friends
          </button>
          <button
            className={activeTab === "notifications" ? "active" : ""}
            onClick={() => setActiveTab("notifications")}
          >
            <Bell /> Alerts
            {pendingRequests.length ? (
              <em className="notification-count">{pendingRequests.length}</em>
            ) : null}
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
            className="meeting-tab"
            onClick={() => {
              window.location.href = "/meeting";
            }}
          >
            <Video /> Meetings
          </button>
        </div>
        {activeTab === "notifications" ? (
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
          <ProfileDetails profile={profile} label="My ZION Profile" />
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
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [friendOnline, setFriendOnline] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<FriendMessage | null>(null);
  const [showFriendProfile, setShowFriendProfile] = useState(false);
  const [callState, setCallState] = useState<
    "idle" | "requesting" | "incoming" | "connecting" | "active"
  >("idle");
  const [callError, setCallError] = useState("");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const liveRef = useRef<RealtimeChannel | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const remoteTypingRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
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
        if (!item.media_path) return item;
        const { data: signed } = await supabase!.storage
          .from("chat-media")
          .createSignedUrl(item.media_path, 3600);
        return { ...item, media_url: signed?.signedUrl };
      }),
    );
    setMessages(withUrls);
  }, [friendship.id]);
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
      if (callTimeoutRef.current) window.clearTimeout(callTimeoutRef.current);
      setMuted(false);
      setSpeakerOn(true);
      setCallState("idle");
    },
    [user.id],
  );
  const ensurePeer = useCallback(async () => {
    if (peerRef.current) return peerRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    streamRef.current = stream;
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
      if (remoteAudioRef.current) {
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
  }, [stopCall, user.id]);
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
    void load();
    const timer = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  useEffect(() => {
    if (!supabase || !friend?.id) return;
    const client = supabase;
    const channel = client
      .channel(`friend-live-${friendship.id}`, {
        config: { presence: { key: user.id } },
      })
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        setFriendOnline(Boolean(presence[friend.id]));
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
        if (payload.userId !== user.id) setCallState("incoming");
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
          const peer = await ensurePeer();
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await channel.send({
            type: "broadcast",
            event: "rtc-offer",
            payload: { userId: user.id, description: offer },
          });
        } catch {
          setCallError("Microphone permission is required.");
          stopCall(false);
        }
      })
      .on("broadcast", { event: "rtc-offer" }, async ({ payload }) => {
        if (payload.userId === user.id) return;
        try {
          const peer = await ensurePeer();
          await peer.setRemoteDescription(payload.description);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await channel.send({
            type: "broadcast",
            event: "rtc-answer",
            payload: { userId: user.id, description: answer },
          });
        } catch {
          setCallError("Audio connection failed.");
          stopCall(false);
        }
      })
      .on("broadcast", { event: "rtc-answer" }, async ({ payload }) => {
        if (payload.userId === user.id) return;
        try {
          await peerRef.current?.setRemoteDescription(payload.description);
        } catch {
          setCallError("Audio connection failed.");
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
    };
  }, [ensurePeer, friend?.id, friendship.id, stopCall, user.id]);
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
    if (!supabase || !text.trim()) return;
    const value = text.trim();
    setText("");
    announceTyping(false);
    await supabase.from("friend_messages").insert({
      friendship_id: friendship.id,
      sender_id: user.id,
      message: value,
      reply_to_id: replyTo?.id ?? null,
    });
    setReplyTo(null);
    await load();
  };
  const upload = async (file?: File) => {
    if (!supabase || !file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Maximum file size is 15 MB.");
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
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `friend/${friendship.id}/${user.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { contentType: file.type });
    if (!error)
      await supabase.from("friend_messages").insert({
        friendship_id: friendship.id,
        sender_id: user.id,
        media_path: path,
        media_type: mediaType,
        reply_to_id: replyTo?.id ?? null,
      });
    else alert(error.message);
    setUploading(false);
    setReplyTo(null);
    await load();
  };
  const editMessage = async (item: FriendMessage) => {
    if (!supabase || !item.message || item.deleted_at || item.media_path)
      return;
    const next = window.prompt("Edit message", item.message)?.trim();
    if (!next || next === item.message) return;
    const { error } = await supabase.rpc("edit_friend_message", {
      p_message_id: item.id,
      p_message: next,
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
  const requestCall = () => {
    setCallError("");
    if (!friendOnline) {
      setCallError("Friend is not in this chat now.");
      return;
    }
    if (friend?.allow_audio_calls === false) {
      setCallError("This friend has disabled audio call requests.");
      return;
    }
    setCallState("requesting");
    void liveRef.current?.send({
      type: "broadcast",
      event: "call-request",
      payload: { userId: user.id },
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
      await ensurePeer();
    } catch {
      setCallError("Allow microphone access to answer.");
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
    setSpeakerOn(next);
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
                ? "Audio call connected"
                : friendTyping
                  ? "Typing…"
                  : friendOnline
                    ? "Online now · Permanent chat"
                    : "Offline · Permanent chat"}
            </small>
          </button>
          {callState === "active" ? (
            <button
              className="call-button end"
              onClick={() => stopCall()}
              aria-label="End audio call"
            >
              <PhoneOff />
            </button>
          ) : (
            <button
              className="call-button"
              disabled={!friendOnline || callState !== "idle"}
              onClick={requestCall}
              aria-label="Request audio call"
            >
              <Phone />
            </button>
          )}
        </header>
        {callState === "incoming" ? (
          <div className="call-request">
            <ProfileAvatar profile={friend} />
            <div>
              <b>{friend?.username ?? "Friend"} wants an audio call</b>
              <small>Your microphone starts only after Allow.</small>
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
              : "Connecting private audio…"}
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
          <ShieldAlert size={15} />
          Never send money, passwords, exact location or unwanted explicit
          media.
        </div>
        <div className="friend-message-list" ref={listRef}>
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
                        : (quoted.message ??
                          (quoted.media_type === "image" ? "Photo" : "Video"))}
                    </span>
                  </div>
                ) : null}
                {!item.deleted_at &&
                item.media_url &&
                item.media_type === "image" ? (
                  <img src={item.media_url} alt="Shared attachment" />
                ) : null}
                {!item.deleted_at &&
                item.media_url &&
                item.media_type === "video" ? (
                  <video src={item.media_url} controls playsInline />
                ) : null}
                {item.deleted_at ? (
                  <span className="deleted-message">Message deleted</span>
                ) : item.message ? (
                  <span>{item.message}</span>
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
                {replyTo.message ??
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
            onClick={() => void send()}
          >
            <Send />
          </button>
        </div>
      </section>
    </div>
  );
}
