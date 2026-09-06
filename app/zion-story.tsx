"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Coins, Crosshair, Heart, Map, Shield, Trees } from "lucide-react";

type Save = { name: string; horse: string; country: string; coins: number; x: number; y: number };
const SAVE_KEY = "zion-story-chapter-one";
const horses = ["Storm", "Sahara", "Shadow", "Atlas"];

export function ZionStory({ country, onBack }: { country?: string; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const player = useRef({ x: 1200, y: 1050, hp: 100, mounted: true, angle: 0 });
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("Rider");
  const [horse, setHorse] = useState(horses[0]);
  const [region, setRegion] = useState(country || "Kuwait");
  const [coins, setCoins] = useState(120);
  const [hp, setHp] = useState(100);
  const [mounted, setMounted] = useState(true);
  const [notice, setNotice] = useState("Ride to the golden workshop marker");
  const touch = (code: string, down: boolean) => {
    if (down) keys.current.add(code); else keys.current.delete(code);
  };

  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const save = JSON.parse(raw) as Save;
      setName(save.name); setHorse(save.horse); setRegion(save.country);
      setCoins(save.coins); player.current.x = save.x; player.current.y = save.y;
    } catch { /* start a clean journey */ }
  }, []);

  useEffect(() => {
    if (!started) return;
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    const save = window.setInterval(() => localStorage.setItem(SAVE_KEY, JSON.stringify({
      name, horse, country: region, coins, x: player.current.x, y: player.current.y,
    } satisfies Save)), 2500);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.clearInterval(save); };
  }, [started, name, horse, region, coins]);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const world = { w: 3000, h: 2600 };
    const animals = Array.from({ length: 20 }, (_, i) => ({
      x: 230 + ((i * 431) % 2500), y: 180 + ((i * 617) % 2100), phase: i * 0.7,
    }));
    const trees = Array.from({ length: 180 }, (_, i) => ({
      x: (i * 977) % world.w, y: (i * 593) % world.h, size: 8 + ((i * 17) % 18),
    }));
    let frame = 0, raf = 0, last = performance.now();
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
      canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 2); last = now; frame += dt;
      const p = player.current;
      let dx = 0, dy = 0;
      if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) dy--;
      if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) dy++;
      if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) dx--;
      if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) dx++;
      if (dx || dy) { const len = Math.hypot(dx, dy); const speed = (p.mounted ? 7 : 4) * dt; p.x += dx / len * speed; p.y += dy / len * speed; p.angle = Math.atan2(dy, dx); }
      p.x = Math.max(30, Math.min(world.w - 30, p.x)); p.y = Math.max(30, Math.min(world.h - 30, p.y));
      const vw = innerWidth, vh = innerHeight, camX = p.x - vw / 2, camY = p.y - vh / 2;
      const sky = ctx.createLinearGradient(0, 0, 0, vh); sky.addColorStop(0, "#8ac7df"); sky.addColorStop(.38, "#d8d5aa"); sky.addColorStop(1, "#2d5738"); ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, vh);
      ctx.save(); ctx.translate(-camX, -camY);
      const ground = ctx.createRadialGradient(1450, 1250, 100, 1450, 1250, 1700); ground.addColorStop(0, "#7a8b48"); ground.addColorStop(.55, "#365d39"); ground.addColorStop(1, "#263d32"); ctx.fillStyle = ground; ctx.fillRect(0, 0, world.w, world.h);
      ctx.lineWidth = 75; ctx.lineCap = "round"; ctx.strokeStyle = "#9a7848"; ctx.beginPath(); ctx.moveTo(50, 2050); ctx.bezierCurveTo(650, 1600, 1150, 1950, 1600, 1300); ctx.bezierCurveTo(2100, 600, 2450, 750, 2950, 280); ctx.stroke();
      ctx.lineWidth = 49; ctx.strokeStyle = "#b89961"; ctx.stroke();
      ctx.fillStyle = "#1e6682"; ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(700, 520, 940, 50, 1600, 230); ctx.bezierCurveTo(2100, 390, 2300, 40, 3000, 170); ctx.lineTo(3000, 0); ctx.lineTo(0, 0); ctx.fill();
      trees.forEach(t => { if (Math.abs(t.x-p.x)>vw || Math.abs(t.y-p.y)>vh) return; ctx.fillStyle="#172b20"; ctx.fillRect(t.x-2,t.y,4,t.size); ctx.fillStyle=t.y%3?"#244e34":"#7f8a3d"; ctx.beginPath(); ctx.arc(t.x,t.y-t.size*.25,t.size*.55,0,7); ctx.fill(); });
      // Village, workshop and discoverable stable.
      [[780,720,"#884b35"],[850,760,"#6b4030"],[940,690,"#9a613e"]].forEach(([x,y,c])=>{ctx.fillStyle=c as string;ctx.fillRect(x as number,y as number,75,55);ctx.fillStyle="#33271f";ctx.beginPath();ctx.moveTo((x as number)-8,y as number);ctx.lineTo((x as number)+38,(y as number)-38);ctx.lineTo((x as number)+83,y as number);ctx.fill();});
      ctx.fillStyle="#ffd45e"; ctx.beginPath(); ctx.arc(820,820,18+Math.sin(frame/15)*4,0,7);ctx.fill(); ctx.fillStyle="#171221";ctx.font="800 14px Montserrat";ctx.fillText("WORK",790,855);
      ctx.fillStyle="#73e8d0";ctx.beginPath();ctx.arc(2460,670,18+Math.sin(frame/18)*4,0,7);ctx.fill();ctx.fillStyle="#fff";ctx.fillText("WILD HORSE",2395,710);
      animals.forEach((a,i)=>{a.x+=Math.sin(frame/75+a.phase)*.22;a.y+=Math.cos(frame/90+a.phase)*.18;ctx.fillStyle=i%4===0?"#b87949":"#ddd0a7";ctx.beginPath();ctx.ellipse(a.x,a.y,12,7,0,0,7);ctx.fill();ctx.fillRect(a.x+7,a.y-5,8,4);});
      // Rider and horse, with a soft dynamic shadow.
      ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(p.x,p.y+13,p.mounted?25:13,7,0,0,7);ctx.fill();
      if(p.mounted){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle="#242126";ctx.beginPath();ctx.ellipse(0,0,24,11,0,0,7);ctx.fill();ctx.fillRect(13,-7,15,7);ctx.fillStyle="#15131a";ctx.fillRect(-15,7,4,17);ctx.fillRect(13,7,4,17);ctx.restore();}
      ctx.fillStyle="#8d203c";ctx.beginPath();ctx.arc(p.x,p.y-(p.mounted?17:8),8,0,7);ctx.fill();ctx.fillStyle="#f1c5a5";ctx.beginPath();ctx.arc(p.x,p.y-(p.mounted?29:20),5,0,7);ctx.fill();
      ctx.restore();
      // Filmic vignette.
      const vignette=ctx.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.25,vw/2,vh/2,Math.max(vw,vh)*.75);vignette.addColorStop(0,"transparent");vignette.addColorStop(1,"rgba(4,8,13,.62)");ctx.fillStyle=vignette;ctx.fillRect(0,0,vw,vh);
      if (Math.hypot(p.x-820,p.y-820)<85) setNotice("Workshop: press JOB to earn 40 coins");
      else if(Math.hypot(p.x-2460,p.y-670)<90) setNotice("A rare horse is nearby — future stable update");
      raf=requestAnimationFrame(draw);
    };
    resize(); addEventListener("resize",resize); raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);};
  }, [started]);

  const job = () => {
    if (Math.hypot(player.current.x-820,player.current.y-820)>100) return setNotice("Reach the golden workshop marker first");
    setCoins(v=>v+40); setNotice("Vehicle repaired · +40 coins");
  };
  const attack = () => setNotice("Combat training complete · PvP arrives with multiplayer servers");

  return <div className="zion-story">
    {!started ? <div className="story-setup">
      <div className="story-logo"><span>Z</span><small>CHAPTER ONE</small></div>
      <h1>ZION STORY</h1><p>THE WILD HORIZON</p>
      <div className="story-form"><label>Character name<input value={name} maxLength={18} onChange={e=>setName(e.target.value)}/></label><label>Starting region<input value={region} onChange={e=>setRegion(e.target.value)}/></label><label>Your horse<select value={horse} onChange={e=>setHorse(e.target.value)}>{horses.map(h=><option key={h}>{h}</option>)}</select></label></div>
      <button className="story-start" onClick={()=>setStarted(true)}>START JOURNEY</button><button className="story-exit" onClick={onBack}><ArrowLeft/> Back to Games</button>
    </div> : <>
      <canvas ref={canvasRef}/>
      <header className="story-hud"><button onClick={onBack}><ArrowLeft/></button><div><b>ZION STORY</b><small>{region} · {name} & {horse}</small></div><span><Heart/> {hp}</span><span><Coins/> {coins}</span></header>
      <div className="story-objective"><Trees/><span>{notice}</span></div>
      <div className="story-map"><Map/><i/></div>
      <div className="story-controls story-move"><button onPointerDown={()=>touch("KeyW",true)} onPointerUp={()=>touch("KeyW",false)}>▲</button><button onPointerDown={()=>touch("KeyA",true)} onPointerUp={()=>touch("KeyA",false)}>◀</button><button onPointerDown={()=>touch("KeyS",true)} onPointerUp={()=>touch("KeyS",false)}>▼</button><button onPointerDown={()=>touch("KeyD",true)} onPointerUp={()=>touch("KeyD",false)}>▶</button></div>
      <div className="story-controls story-actions"><button onClick={()=>{player.current.mounted=!player.current.mounted;setMounted(player.current.mounted)}}>🐎<small>{mounted?"Dismount":"Ride"}</small></button><button onClick={attack}><Crosshair/><small>Attack</small></button><button onClick={job}><Shield/><small>Job</small></button></div>
    </>}
  </div>;
}
