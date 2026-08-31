"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, LogIn, Pin, Send, ShieldAlert, UserRoundPlus, Users, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Experience, type ZionProfile } from "./experience";

type Friendship = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" | "declined"; created_at: string };
type FriendMessage = { id: number; friendship_id: string; sender_id: string; message: string | null; media_path: string | null; media_type: "image" | "video" | null; created_at: string; read_at: string | null; media_url?: string };
const avatars = ["👨🏽", "👨🏻‍🦱", "👨🏿‍🦲", "🧔🏼", "👩🏽", "👩🏻‍🦱", "👩🏿", "👱🏼‍♀️", "🧑🏾", "🧑🏻‍🦰"];

export function SocialShell() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ZionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser || !supabase) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("id,username,gender,country,avatar,is_banned,ban_reason").eq("id", nextUser.id).maybeSingle();
    setProfile((data as ZionProfile | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    void supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void loadProfile(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  if (loading) return <AuthScreen title="Opening ZION…" />;
  if (!supabase) return <AuthScreen title="ZION needs Supabase configuration." />;
  if (!user) return <LoginScreen setError={setError} error={error} />;
  if (!profile) return <ProfileSetup user={user} onSaved={setProfile} />;
  if (profile.is_banned) return <BanScreen reason={profile.ban_reason} />;

  return <><Experience profile={profile} onOpenFriends={() => setFriendsOpen(true)} />{friendsOpen ? <FriendsPanel user={user} profile={profile} onClose={() => setFriendsOpen(false)} /> : null}</>;
}

function AuthScreen({ title }: { title: string }) {
  return <main className="auth-shell"><div className="auth-card"><div className="auth-logo">♥</div><h1>{title}</h1></div></main>;
}

function LoginScreen({ error, setError }: { error: string; setError: (value: string) => void }) {
  const googleLogin = async () => {
    if (!supabase) return;
    const { error: loginError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (loginError) setError(loginError.message);
  };
  const guestLogin = async () => {
    if (!supabase) return;
    const { error: loginError } = await supabase.auth.signInAnonymously();
    if (loginError) setError(loginError.message);
  };
  return <main className="auth-shell"><section className="auth-card login-card"><div className="auth-logo">♥</div><span className="mini-label">Welcome to ZION</span><h1>Meet kindly. Stay safely.</h1><p>Google accounts keep friends and chats across devices. Guest access lasts until app/browser data is cleared.</p><div className="moderation-banner"><ShieldAlert size={18} /><span>Sexual harassment, hate, threats, scams and unwanted explicit content can result in an immediate ban.</span></div>{error ? <p className="error-note">{error}</p> : null}<Button className="primary-action" onClick={() => void googleLogin()}><LogIn size={18} /> Continue with Google</Button><Button variant="outline" className="guest-action" onClick={() => void guestLogin()}>Continue as guest</Button><small>18+ only · Gender is self-declared, not identity-verified.</small></section></main>;
}

function ProfileSetup({ user, onSaved }: { user: User; onSaved: (profile: ZionProfile) => void }) {
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("male");
  const [country, setCountry] = useState("");
  const [avatar, setAvatar] = useState(avatars[0]);
  const [error, setError] = useState("");
  const save = async () => {
    if (!supabase || username.trim().length < 3 || country.trim().length < 2) return;
    const row = { id: user.id, username: username.trim(), gender, country: country.trim(), avatar };
    const { data, error: saveError } = await supabase.from("profiles").upsert(row).select("id,username,gender,country,avatar,is_banned,ban_reason").single();
    if (saveError) setError(saveError.message); else onSaved(data as ZionProfile);
  };
  return <main className="auth-shell"><section className="auth-card profile-card"><span className="mini-label">Create your profile</span><h1>Who are you on ZION?</h1><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={24} placeholder="3–24 characters" /></label><div className="form-grid"><label>Gender<select value={gender} onChange={(event) => setGender(event.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label><label>Country<input value={country} onChange={(event) => setCountry(event.target.value)} maxLength={60} placeholder="Your country" /></label></div><span className="field-label">Choose an avatar</span><div className="avatar-picker">{avatars.map((item) => <button type="button" className={avatar === item ? "selected" : ""} onClick={() => setAvatar(item)} key={item}>{item}</button>)}</div><p className="profile-note">Gender is self-declared. ZION does not claim identity verification.</p>{error ? <p className="error-note">{error}</p> : null}<Button className="primary-action" disabled={username.trim().length < 3 || country.trim().length < 2} onClick={() => void save()}>Enter ZION</Button></section></main>;
}

function BanScreen({ reason }: { reason: string | null }) {
  return <main className="auth-shell"><section className="auth-card ban-card"><ShieldAlert size={42} /><h1>Account suspended</h1><p>{reason ?? "This account violated ZION community safety rules."}</p><div className="moderation-banner">Threats, hate, scams, harassment and unwanted explicit content are not allowed.</div></section></main>;
}

function FriendsPanel({ user, profile, onClose }: { user: User; profile: ZionProfile; onClose: () => void }) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ZionProfile>>({});
  const [pins, setPins] = useState<string[]>([]);
  const [selected, setSelected] = useState<Friendship | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: rows }, { data: pinRows }] = await Promise.all([supabase.from("friendships").select("id,requester_id,addressee_id,status,created_at").order("created_at", { ascending: false }), supabase.from("friend_pins").select("friend_id").eq("user_id", user.id)]);
    const list = (rows as Friendship[] | null) ?? [];
    setFriendships(list); setPins((pinRows ?? []).map((item) => item.friend_id));
    const ids = [...new Set(list.flatMap((item) => [item.requester_id, item.addressee_id]).filter((id) => id !== user.id))];
    if (ids.length) { const { data } = await supabase.from("profiles").select("id,username,gender,country,avatar,is_banned,ban_reason").in("id", ids); setProfiles(Object.fromEntries(((data as ZionProfile[] | null) ?? []).map((item) => [item.id, item]))); }
  }, [user.id]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 2500); return () => window.clearInterval(timer); }, [load]);
  const otherId = (item: Friendship) => item.requester_id === user.id ? item.addressee_id : item.requester_id;
  const accept = async (item: Friendship) => { if (!supabase) return; await supabase.from("friendships").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", item.id); await load(); };
  const togglePin = async (friendId: string) => { if (!supabase) return; if (pins.includes(friendId)) await supabase.from("friend_pins").delete().eq("user_id", user.id).eq("friend_id", friendId); else await supabase.from("friend_pins").insert({ user_id: user.id, friend_id: friendId }); await load(); };
  const accepted = useMemo(() => friendships.filter((item) => item.status === "accepted").sort((a,b) => Number(pins.includes(otherId(b))) - Number(pins.includes(otherId(a)))), [friendships, pins]);
  if (selected) return <FriendChat friendship={selected} friend={profiles[otherId(selected)]} user={user} onBack={() => setSelected(null)} />;
  return <div className="social-overlay"><section className="friends-panel"><header><div><span>{profile.avatar}</span><div><b>{profile.username}</b><small>{profile.country} · {profile.gender}</small></div></div><button onClick={onClose} aria-label="Close"><X /></button></header><div className="moderation-banner compact"><ShieldAlert size={16} />Unsafe or unwanted content: block and report. Serious violations can lead to bans.</div><h2><Users size={20} /> Friends</h2>{friendships.filter((item) => item.status === "pending" && item.addressee_id === user.id).map((item) => { const person = profiles[otherId(item)]; return <div className="friend-row request" key={item.id}><span>{person?.avatar ?? "🙂"}</span><div><b>{person?.username ?? "ZION user"}</b><small>sent a friend request</small></div><Button onClick={() => void accept(item)}>Accept</Button></div>; })}<div className="friends-list">{accepted.length ? accepted.map((item) => { const id = otherId(item); const person = profiles[id]; return <div className="friend-row" key={item.id}><button className="friend-main" onClick={() => setSelected(item)}><span>{person?.avatar ?? "🙂"}</span><div><b>{person?.username ?? "ZION friend"}</b><small>{person?.country ?? "Private chat"}</small></div></button><button className={pins.includes(id) ? "pin active" : "pin"} onClick={() => void togglePin(id)} aria-label="Pin friend"><Pin size={17} /></button></div>; }) : <div className="empty-friends"><UserRoundPlus /><p>Add someone after a random chat. Accepted friends stay here for permanent messaging.</p></div>}</div></section></div>;
}

function FriendChat({ friendship, friend, user, onBack }: { friendship: Friendship; friend?: ZionProfile; user: User; onBack: () => void }) {
  const [messages, setMessages] = useState<FriendMessage[]>([]); const [text, setText] = useState(""); const [uploading, setUploading] = useState(false); const listRef = useRef<HTMLDivElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { if (!supabase) return; await supabase.rpc("mark_friend_messages_read", { p_friendship_id: friendship.id }); const { data } = await supabase.from("friend_messages").select("id,friendship_id,sender_id,message,media_path,media_type,created_at,read_at").eq("friendship_id", friendship.id).order("created_at"); const rows=(data as FriendMessage[]|null)??[]; const withUrls=await Promise.all(rows.map(async(item)=>{if(!item.media_path)return item;const {data:signed}=await supabase!.storage.from("chat-media").createSignedUrl(item.media_path,3600);return {...item,media_url:signed?.signedUrl};})); setMessages(withUrls); }, [friendship.id]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),1500);return()=>window.clearInterval(timer);},[load]);
  useEffect(()=>{listRef.current?.scrollTo({top:listRef.current.scrollHeight,behavior:"smooth"});},[messages]);
  const send = async () => { if(!supabase||!text.trim())return;const value=text.trim();setText("");await supabase.from("friend_messages").insert({friendship_id:friendship.id,sender_id:user.id,message:value});await load(); };
  const upload = async (file?:File) => { if(!supabase||!file)return;if(file.size>15*1024*1024){alert("Maximum file size is 15 MB.");return;}const mediaType=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":null;if(!mediaType){alert("Choose an image or video.");return;}setUploading(true);const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`friend/${friendship.id}/${user.id}/${crypto.randomUUID()}-${safe}`;const {error}=await supabase.storage.from("chat-media").upload(path,file,{contentType:file.type});if(!error)await supabase.from("friend_messages").insert({friendship_id:friendship.id,sender_id:user.id,media_path:path,media_type:mediaType});else alert(error.message);setUploading(false);await load(); };
  return <div className="social-overlay"><section className="friend-chat"><header><button onClick={onBack}><ArrowLeft /></button><span>{friend?.avatar ?? "🙂"}</span><div><b>{friend?.username ?? "ZION friend"}</b><small>Permanent private chat</small></div></header><div className="moderation-banner compact"><ShieldAlert size={15} />Never send money, passwords, exact location or unwanted explicit media.</div><div className="friend-message-list" ref={listRef}>{messages.map((item)=><div key={item.id} className={item.sender_id===user.id?"friend-bubble mine":"friend-bubble theirs"}>{item.media_url&&item.media_type==="image"?<img src={item.media_url} alt="Shared attachment" />:null}{item.media_url&&item.media_type==="video"?<video src={item.media_url} controls playsInline />:null}{item.message?<span>{item.message}</span>:null}{item.sender_id===user.id?<small className={item.read_at?"read":""}>{item.read_at?"✓✓":"✓"}</small>:null}</div>)}</div><div className="friend-compose"><input ref={fileRef} hidden type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(event)=>void upload(event.target.files?.[0])}/><button disabled={uploading} onClick={()=>fileRef.current?.click()}><ImagePlus /></button><input value={text} onChange={(event)=>setText(event.target.value)} onKeyDown={(event)=>event.key==="Enter"&&void send()} placeholder="Message your friend…" maxLength={1000}/><button onClick={()=>void send()}><Send /></button></div></section></div>;
}
