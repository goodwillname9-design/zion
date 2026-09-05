"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Pause,
  Play,
  Send,
  Share2,
  Upload,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { uploadResumable } from "@/lib/resumable-upload";
import type { ZionProfile } from "./experience";

type Reel = {
  id: string;
  owner_id: string;
  video_path: string;
  caption: string;
  created_at: string;
  profile?: ZionProfile;
  liked: boolean;
  likes: number;
  comments: number;
  url: string;
};
type Comment = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  username?: string;
};
type Story = {
  id: string;
  owner_id: string;
  media_path: string;
  media_type: "image" | "video";
  caption: string;
  profile?: ZionProfile;
  url: string;
  liked: boolean;
  likes: number;
};
const OFFICIAL_REEL_ID = "00000000-0000-4000-8000-000000000001";
const CEO_ID = "fd62030e-f3b8-4c14-bce7-a1f3eedbb74b";

export function ZionReels({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [reels, setReels] = useState<Reel[]>([]),
    [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState(""),
    [commentsFor, setCommentsFor] = useState<Reel | null>(null),
    [comments, setComments] = useState<Comment[]>([]),
    [comment, setComment] = useState("");
  const [stories, setStories] = useState<Story[]>([]),
    [storyOpen, setStoryOpen] = useState<Story | null>(null),
    [profileOpen, setProfileOpen] = useState<ZionProfile | null>(null),
    [following, setFollowing] = useState<string[]>([]),
    [friendMessage, setFriendMessage] = useState("");
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    kind: "reel" | "story";
    preview: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    void supabase.rpc("cleanup_expired_zion_stories");
    const { data } = await supabase
      .from("zion_reels")
      .select("id,owner_id,video_path,caption,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    const rows = (data ?? []) as Array<
      Omit<Reel, "profile" | "liked" | "likes" | "comments" | "url">
    >;
    if (!rows.some((row) => row.id === OFFICIAL_REEL_ID))
      rows.unshift({
        id: OFFICIAL_REEL_ID,
        owner_id: CEO_ID,
        video_path: "__zion_official_demo__",
        caption: "MAKE FRIENDS · ZION WORLDWIDE · SHARE WITH WORLDWIDE",
        created_at: "2026-09-03T00:00:00.000Z",
      });
    const ids = rows.map((r) => r.id),
      owners = [...new Set(rows.map((r) => r.owner_id))];
    const [
      { data: profiles },
      { data: likes },
      { data: commentRows },
      { data: storyRows },
      { data: followRows },
    ] = await Promise.all([
      owners.length
        ? supabase
            .from("profiles")
            .select(
              "id,username,avatar,avatar_url,country,gender,is_banned,ban_reason",
            )
            .in("id", owners)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("zion_reel_likes")
            .select("reel_id,user_id")
            .in("reel_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("zion_reel_comments")
            .select("reel_id")
            .in("reel_id", ids)
        : Promise.resolve({ data: [] }),
      supabase
        .from("zion_stories")
        .select("id,owner_id,media_path,media_type,caption")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("profile_follows")
        .select("following_id")
        .eq("follower_id", user.id),
    ]);
    const storyList = (storyRows ?? []) as Array<
      Omit<Story, "profile" | "url" | "liked" | "likes">
    >;
    const { data: storyLikeRows } = storyList.length
      ? await supabase
          .from("zion_story_likes")
          .select("story_id,user_id")
          .in(
            "story_id",
            storyList.map((story) => story.id),
          )
      : { data: [] };
    const paths = [
      ...rows
        .map((x) => x.video_path)
        .filter((x) => x !== "__zion_official_demo__"),
      ...storyList.map((x) => x.media_path),
    ];
    const { data: signedRows } = paths.length
      ? await supabase.storage.from("chat-media").createSignedUrls(paths, 3600)
      : { data: [] };
    const urls = Object.fromEntries(
      (signedRows ?? []).map((x, index) => [paths[index], x.signedUrl]),
    );
    const profileList = [...(profiles ?? [])];
    const missingOwners = [
      ...new Set(
        storyList
          .map((x) => x.owner_id)
          .filter((id) => !profileList.some((p) => p.id === id)),
      ),
    ];
    if (missingOwners.length) {
      const { data: extra } = await supabase
        .from("profiles")
        .select(
          "id,username,avatar,avatar_url,country,gender,is_banned,ban_reason",
        )
        .in("id", missingOwners);
      profileList.push(...(extra ?? []));
    }
    const p = Object.fromEntries(profileList.map((x) => [x.id, x]));
    setReels(
      rows.map((row) => {
        const reelLikes = (likes ?? []).filter((x) => x.reel_id === row.id);
        const officialProfile: ZionProfile = {
          id: CEO_ID,
          username: "Ceo mubieeyy",
          avatar: "💚",
          gender: "male",
          country: "KW",
          is_banned: false,
          ban_reason: null,
          is_admin: true,
        };
        return {
          ...row,
          profile:
            p[row.owner_id] ??
            (row.id === OFFICIAL_REEL_ID ? officialProfile : undefined),
          liked: reelLikes.some((x) => x.user_id === user.id),
          likes: reelLikes.length,
          comments: (commentRows ?? []).filter((x) => x.reel_id === row.id)
            .length,
          url:
            row.id === OFFICIAL_REEL_ID
              ? "/zion-worldwide-demo.mp4"
              : (urls[row.video_path] ?? ""),
        };
      }),
    );
    setStories(
      storyList.map((s) => {
        const likes = (storyLikeRows ?? []).filter(
          (like) => like.story_id === s.id,
        );
        return {
          ...s,
          profile: p[s.owner_id],
          url: urls[s.media_path] ?? "",
          liked: likes.some((like) => like.user_id === user.id),
          likes: likes.length,
        };
      }),
    );
    setFollowing((followRows ?? []).map((x) => x.following_id));
  }, [user.id]);
  useEffect(() => {
    void load();
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("zion-reels-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zion_reels" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zion_reel_likes" },
        () => void load(),
      )
      .subscribe();
    return () => void client.removeChannel(channel);
  }, [load]);
  const upload = async (file?: File) => {
    if (!supabase || !file || !file.type.startsWith("video/")) return;
    setUploading(true);
    setProgress(0);
    try {
      const ext =
          file.name
            .split(".")
            .pop()
            ?.replace(/[^a-z0-9]/gi, "") || "mp4",
        path = `reels/${user.id}/${crypto.randomUUID()}.${ext}`;
      await uploadResumable({
        bucket: "chat-media",
        path,
        body: file,
        contentType: file.type,
        onProgress: setProgress,
      });
      const { error } = await supabase.from("zion_reels").insert({
        owner_id: user.id,
        video_path: path,
        caption: caption.trim(),
      });
      if (error) throw error;
      setCaption("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const uploadStory = async (file?: File) => {
    if (
      !supabase ||
      !file ||
      (!file.type.startsWith("video/") && !file.type.startsWith("image/"))
    )
      return;
    setUploading(true);
    try {
      const ext =
          file.name
            .split(".")
            .pop()
            ?.replace(/[^a-z0-9]/gi, "") || "mp4",
        path = `stories/${user.id}/${crypto.randomUUID()}.${ext}`;
      await uploadResumable({
        bucket: "chat-media",
        path,
        body: file,
        contentType: file.type,
        onProgress: setProgress,
      });
      const { error } = await supabase.from("zion_stories").insert({
        owner_id: user.id,
        media_path: path,
        media_type: file.type.startsWith("image/") ? "image" : "video",
        caption: caption.trim(),
      });
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Story upload failed");
    } finally {
      setUploading(false);
    }
  };
  const like = async (reel: Reel) => {
    if (!supabase) return;
    if (reel.liked)
      await supabase
        .from("zion_reel_likes")
        .delete()
        .eq("reel_id", reel.id)
        .eq("user_id", user.id);
    else
      await supabase
        .from("zion_reel_likes")
        .insert({ reel_id: reel.id, user_id: user.id });
    setReels((x) =>
      x.map((r) =>
        r.id === reel.id
          ? { ...r, liked: !r.liked, likes: r.likes + (r.liked ? -1 : 1) }
          : r,
      ),
    );
  };
  const openComments = async (reel: Reel) => {
    if (!supabase) return;
    setCommentsFor(reel);
    const { data } = await supabase
      .from("zion_reel_comments")
      .select("id,user_id,body,created_at")
      .eq("reel_id", reel.id)
      .order("created_at");
    const rows = (data ?? []) as Comment[],
      ids = [...new Set(rows.map((x) => x.user_id))];
    const { data: p } = ids.length
      ? await supabase.from("profiles").select("id,username").in("id", ids)
      : { data: [] };
    const names = Object.fromEntries((p ?? []).map((x) => [x.id, x.username]));
    setComments(rows.map((x) => ({ ...x, username: names[x.user_id] })));
  };
  const sendComment = async () => {
    if (!supabase || !commentsFor || !comment.trim()) return;
    const { error } = await supabase.from("zion_reel_comments").insert({
      reel_id: commentsFor.id,
      user_id: user.id,
      body: comment.trim(),
    });
    if (!error) {
      setComment("");
      await openComments(commentsFor);
    }
  };
  const share = async (reel: Reel) => {
    const url = `${location.origin}/?reel=${reel.id}`;
    if (navigator.share)
      await navigator.share({ title: "ZION Reel", text: reel.caption, url });
    else {
      await navigator.clipboard.writeText(url);
      alert("Reel link copied");
    }
  };
  const toggleFollow = async (p: ZionProfile) => {
    if (!supabase || p.id === user.id) return;
    if (following.includes(p.id))
      await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", p.id);
    else {
      const { error } = await supabase.rpc("request_zion_follow", {
        p_target_id: p.id,
      });
      setFriendMessage(error?.message ?? "Follow request sent.");
    }
    await load();
  };
  const addFriend = async (p: ZionProfile) => {
    if (!supabase || p.id === user.id) return;
    const { data, error } = await supabase.rpc("request_zion_friend", {
      p_user_id: p.id,
    });
    setFriendMessage(
      error?.message ??
        (data === "accepted" ? "You are now friends." : "Friend request sent."),
    );
  };
  const canDelete = (ownerId: string) =>
    ownerId === user.id || user.id === CEO_ID;
  const deleteReel = async (reel: Reel) => {
    if (
      !supabase ||
      reel.id === OFFICIAL_REEL_ID ||
      !confirm("Delete this Reel permanently?")
    )
      return;
    await supabase.storage.from("chat-media").remove([reel.video_path]);
    const { error } = await supabase
      .from("zion_reels")
      .delete()
      .eq("id", reel.id);
    if (error) alert(error.message);
    else await load();
  };
  const deleteStory = async (story: Story) => {
    if (!supabase || !confirm("Delete this Story permanently?")) return;
    await supabase.storage.from("chat-media").remove([story.media_path]);
    const { error } = await supabase
      .from("zion_stories")
      .delete()
      .eq("id", story.id);
    if (error) alert(error.message);
    else {
      setStoryOpen(null);
      await load();
    }
  };
  const likeStory = async (story: Story) => {
    if (!supabase) return;
    if (story.liked)
      await supabase
        .from("zion_story_likes")
        .delete()
        .eq("story_id", story.id)
        .eq("user_id", user.id);
    else
      await supabase
        .from("zion_story_likes")
        .insert({ story_id: story.id, user_id: user.id });
    setStoryOpen({
      ...story,
      liked: !story.liked,
      likes: story.likes + (story.liked ? -1 : 1),
    });
    await load();
  };
  const chooseUpload = (file: File | undefined, kind: "reel" | "story") => {
    if (!file) return;
    setCaption("");
    setPendingUpload({ file, kind, preview: URL.createObjectURL(file) });
  };
  const cancelUpload = () => {
    if (pendingUpload) URL.revokeObjectURL(pendingUpload.preview);
    setPendingUpload(null);
    setCaption("");
  };
  const confirmUpload = async () => {
    if (!pendingUpload) return;
    const selected = pendingUpload;
    if (selected.kind === "reel") await upload(selected.file);
    else await uploadStory(selected.file);
    URL.revokeObjectURL(selected.preview);
    setPendingUpload(null);
    setCaption("");
  };
  return (
    <div className="reels-overlay">
      <header>
        <b>ZION REELS</b>
        <button onClick={onClose}>
          <X />
        </button>
      </header>
      <div className="stories-row">
        <label className="story-add">
          <input
            hidden
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              chooseUpload(e.target.files?.[0], "story");
              e.currentTarget.value = "";
            }}
          />
          <span>＋</span>
          <b>Your story</b>
        </label>
        {stories.map((s) => (
          <button key={s.id} onClick={() => setStoryOpen(s)}>
            <span>
              {s.profile?.avatar_url ? (
                <img src={s.profile.avatar_url} alt="" />
              ) : (
                (s.profile?.avatar ?? "🙂")
              )}
            </span>
            <b>{s.profile?.username ?? "ZION"}</b>
          </button>
        ))}
      </div>
      <div className="reel-upload">
        <input
          ref={input}
          hidden
          type="file"
          accept="video/*"
          onChange={(e) => {
            chooseUpload(e.target.files?.[0], "reel");
            e.currentTarget.value = "";
          }}
        />
        <button disabled={uploading} onClick={() => input.current?.click()}>
          <Upload />
          {uploading ? `${progress}%` : "Post video"}
        </button>
      </div>
      <main className="reels-scroll">
        {reels.map((reel) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            onProfile={() => reel.profile && setProfileOpen(reel.profile)}
            onLike={() => void like(reel)}
            onComment={() => void openComments(reel)}
            onShare={() => void share(reel)}
            onDelete={
              canDelete(reel.owner_id) && reel.id !== OFFICIAL_REEL_ID
                ? () => void deleteReel(reel)
                : undefined
            }
          />
        ))}
      </main>
      {commentsFor ? (
        <aside className="reel-comments">
          <header>
            <b>Comments</b>
            <button onClick={() => setCommentsFor(null)}>
              <X />
            </button>
          </header>
          <div>
            {comments.map((c) => (
              <p key={c.id}>
                <b>{c.username ?? "ZION user"}</b>
                {c.body}
              </p>
            ))}
          </div>
          <footer>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendComment()}
              placeholder="Add a comment…"
            />
            <button onClick={() => void sendComment()}>
              <Send />
            </button>
          </footer>
        </aside>
      ) : null}
      {storyOpen ? (
        <div className="story-viewer">
          {storyOpen.media_type === "video" ? (
            <video src={storyOpen.url} autoPlay controls />
          ) : (
            <img src={storyOpen.url} alt="Story" />
          )}
          <button onClick={() => setStoryOpen(null)}>
            <X />
          </button>
          <b>@{storyOpen.profile?.username}</b>
          <div className="story-actions">
            <button
              className={storyOpen.liked ? "liked" : ""}
              onClick={() => void likeStory(storyOpen)}
            >
              <Heart fill={storyOpen.liked ? "currentColor" : "none"} />
              {storyOpen.likes}
            </button>
            {canDelete(storyOpen.owner_id) ? (
              <button onClick={() => void deleteStory(storyOpen)}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {profileOpen ? (
        <div className="reel-profile-modal">
          <button className="close" onClick={() => setProfileOpen(null)}>
            <X />
          </button>
          <span>
            {profileOpen.avatar_url ? (
              <img src={profileOpen.avatar_url} alt="" />
            ) : (
              profileOpen.avatar
            )}
          </span>
          <h2>{profileOpen.username}</h2>
          {profileOpen.id !== user.id ? (
            <>
              <button onClick={() => void toggleFollow(profileOpen)}>
                {following.includes(profileOpen.id) ? "Following" : "Follow"}
              </button>
              <button onClick={() => void addFriend(profileOpen)}>
                Add friend
              </button>
            </>
          ) : null}
          <small>{friendMessage}</small>
        </div>
      ) : null}
      {pendingUpload ? (
        <div className="upload-compose">
          <section>
            <header>
              <button onClick={cancelUpload} aria-label="Cancel upload">
                <X />
              </button>
              <div>
                <b>New {pendingUpload.kind === "reel" ? "Reel" : "Story"}</b>
                <small>Add a caption before sharing</small>
              </div>
            </header>
            <div className="upload-preview">
              {pendingUpload.file.type.startsWith("video/") ? (
                <video src={pendingUpload.preview} controls muted playsInline />
              ) : (
                <img src={pendingUpload.preview} alt="Upload preview" />
              )}
            </div>
            <label>
              Caption
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={500}
                placeholder="Write a caption…"
              />
              <small>{caption.length}/500</small>
            </label>
            <button
              className="publish-upload"
              disabled={uploading}
              onClick={() => void confirmUpload()}
            >
              <Upload />{" "}
              {uploading
                ? `Uploading ${progress}%`
                : pendingUpload.kind === "reel"
                  ? "Share Reel"
                  : "Share Story"}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ReelCard({
  reel,
  onProfile,
  onLike,
  onComment,
  onShare,
  onDelete,
}: {
  reel: Reel;
  onProfile: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onDelete?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    [playing, setPlaying] = useState(true);
  const official = reel.id === OFFICIAL_REEL_ID;
  return (
    <article className="reel-card">
      <video
        ref={video}
        src={reel.url}
        loop
        muted
        playsInline
        autoPlay
        preload="metadata"
        onClick={() => {
          if (!video.current) return;
          if (video.current.paused) {
            void video.current.play();
            setPlaying(true);
          } else {
            video.current.pause();
            setPlaying(false);
          }
        }}
      />
      {official ? (
        <div
          className="official-reel-animation"
          aria-label="ZION Worldwide animated reel"
        >
          <i className="orbit orbit-one" />
          <i className="orbit orbit-two" />
          <div className="world-globe">
            <span>♥</span>
          </div>
          <p>MEET · CONNECT · SHARE</p>
          <h2>MAKE FRIENDS</h2>
          <h3>ZION WORLDWIDE</h3>
          <strong>SHARE WITH WORLDWIDE</strong>
          <small>10 SEC · OFFICIAL ZION REEL</small>
        </div>
      ) : null}
      <button className="reel-play" onClick={() => video.current?.click()}>
        {playing ? <Pause /> : <Play />}
      </button>
      <button className="reel-owner" onClick={onProfile}>
        <span>
          {reel.profile?.avatar_url ? (
            <img src={reel.profile.avatar_url} alt="" />
          ) : (
            (reel.profile?.avatar ?? "🙂")
          )}
        </span>
        <div>
          <b>@{reel.profile?.username ?? "zion"}</b>
          <p>{reel.caption}</p>
        </div>
      </button>
      <nav>
        <button className={reel.liked ? "liked" : ""} onClick={onLike}>
          <Heart fill={reel.liked ? "currentColor" : "none"} />
          <b>{reel.likes}</b>
        </button>
        <button onClick={onComment}>
          <MessageCircle />
          <b>{reel.comments}</b>
        </button>
        <button onClick={onShare}>
          <Share2 />
          <b>Share</b>
        </button>
        {onDelete ? (
          <button className="delete-reel" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </nav>
    </article>
  );
}

export function ProfileReels({
  user,
  profile,
}: {
  user: User;
  profile: ZionProfile;
}) {
  const [items, setItems] = useState<
    Array<{ id: string; video_path: string; caption: string; url: string }>
  >([]);
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("zion_reels")
      .select("id,video_path,caption")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []).filter((row) => row.id !== OFFICIAL_REEL_ID);
    const paths = rows.map((row) => row.video_path);
    const { data: signed } = paths.length
      ? await supabase.storage.from("chat-media").createSignedUrls(paths, 3600)
      : { data: [] };
    setItems(
      rows.map((row, index) => ({
        ...row,
        url: signed?.[index]?.signedUrl ?? "",
      })),
    );
  }, [profile.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = async (item: { id: string; video_path: string }) => {
    if (!supabase || !confirm("Delete this Reel permanently?")) return;
    await supabase.storage.from("chat-media").remove([item.video_path]);
    const { error } = await supabase
      .from("zion_reels")
      .delete()
      .eq("id", item.id);
    if (error) alert(error.message);
    else await load();
  };
  const allowed = user.id === profile.id || user.id === CEO_ID;
  return (
    <section className="profile-reels">
      <h3>Reels</h3>
      <div>
        {items.map((item) => (
          <article key={item.id}>
            <video src={item.url} controls playsInline preload="metadata" />
            <p>{item.caption}</p>
            {allowed ? (
              <button onClick={() => void remove(item)}>Delete</button>
            ) : null}
          </article>
        ))}
      </div>
      {!items.length ? <p>No Reels posted yet.</p> : null}
    </section>
  );
}
