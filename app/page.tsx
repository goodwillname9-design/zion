import { SocialShell } from "./social-shell";

export const metadata = { title: "ZION — Stranger Chat & Friends", description: "Meet new people through conversation prompts, chat with friends, share photos and videos, and play together on ZION.", alternates: { canonical: "/" } };

export default function Home() {
  return <><SocialShell /><footer className="public-info-links"><a href="/about">About ZION</a><a href="/privacy">Privacy</a><a href="/safety">Safety & reporting</a></footer></>;
}
