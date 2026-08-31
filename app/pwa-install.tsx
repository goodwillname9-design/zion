"use client";
import { useEffect, useState } from "react";
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null); const [visible, setVisible] = useState(false); const [ios, setIos] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const standalone=window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone;if(standalone)return;
    const recentlyDeclined=Date.now()-Number(localStorage.getItem("zion-install-declined")||0)<3*24*60*60*1000;const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);setIos(isIos);if(isIos&&!recentlyDeclined)setVisible(true);
    const listener=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent);if(!recentlyDeclined)setVisible(true);};window.addEventListener("beforeinstallprompt",listener);const installed=()=>setVisible(false);window.addEventListener("appinstalled",installed);
    return()=>{window.removeEventListener("beforeinstallprompt",listener);window.removeEventListener("appinstalled",installed);};
  },[]);
  const decline=()=>{localStorage.setItem("zion-install-declined",String(Date.now()));setVisible(false);};
  const allow=async()=>{if(prompt){await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==="accepted")setVisible(false);return;}if(!ios)setVisible(false);};
  if(!visible)return null;
  return <div className="install-overlay" role="dialog" aria-modal="true" aria-label="Install ZION"><section className="install-card"><img src="/icons/zion-192.png" alt="ZION app icon"/><span className="mini-label">Install ZION App</span><h2>Add ZION to this device?</h2><p>{ios?"On iPhone/iPad, Apple requires the Safari Home Screen steps below.":"Install ZION for a full-screen app experience and faster access from your Home Screen."}</p>{ios?<div className="ios-install-steps"><b>To install:</b><span>1. Tap Safari Share</span><span>2. Choose “Add to Home Screen”</span><span>3. Turn on “Open as Web App” and tap Add</span></div>:null}<div className="install-actions"><button onClick={decline}>Decline</button><button className="allow" onClick={()=>void allow()}>{ios?"Allow · Show steps":"Allow & Install"}</button></div></section></div>;
}
