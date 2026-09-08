'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { initialSave, missions, parseSave, shop, type Save } from './game-data';
import styles from './city.module.css';
import { useCityOnline, type Position } from './use-city-online';

const SAVE_KEY = 'zion-harbour-v63';
type Hud = { x: number; z: number; yaw: number; speed: number; vehicle: string; distance: number; nearShop: boolean; fps: number };
export default function CityGame() {
  const host = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const keys = useRef(new Set<string>());
  const action = useRef<(name: string) => void>(() => {});
  const pausedRef = useRef(false);
  const saveRef = useRef<Save>({ ...initialSave });
  const qualityRef = useRef('balanced');
  const [save, setSave] = useState<Save>({ ...initialSave });
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quality, setQuality] = useState('balanced');
  const [hud, setHud] = useState<Hud>({ x: 3, z: 3, yaw: 0, speed: 0, vehicle: '', distance: 0, nearShop: false, fps: 0 });
  const [mapOpen, setMapOpen] = useState(false);
  const networkPosition = useRef<Position>({x:3,z:3,yaw:0,vehicle:''});
  const online = useCityOnline(networkPosition);
  const peerStates = online.peers;
  const [roomCode,setRoomCode] = useState('');
  const [lobbyOpen,setLobbyOpen] = useState(false);
  function persist(next: Save) {
    saveRef.current = next; setSave(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { setNotice('Storage unavailable: progress lasts for this session only.'); }
  }
  function pause(value: boolean) { pausedRef.current = value; setPaused(value); keys.current.clear(); }
  async function fullscreen() {
    try {
      if (!document.fullscreenElement) await root.current?.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
      await orientation.lock?.('landscape');
    } catch { setNotice('Rotate your phone sideways. Fullscreen/rotation lock depends on your browser.'); }
  }
  useEffect(() => {
    try { saveRef.current = parseSave(localStorage.getItem(SAVE_KEY)); setSave(saveRef.current); } catch { setNotice('Browser storage is unavailable.'); }
  }, []);
  useEffect(() => {
    if (!started) return;
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const T = await import('three');
      if (disposed || !host.current) return;
      const container = host.current;
      const scene = new T.Scene(); scene.background = new T.Color('#a6b9c1'); scene.fog = new T.Fog('#a6b9c1', 90, 240);
      const renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      container.appendChild(renderer.domElement);
      const camera = new T.PerspectiveCamera(58, 1, .1, 280);
      scene.add(new T.HemisphereLight('#c2d8ef', '#5b544b', 2.5));
      const sun = new T.DirectionalLight('#ffe0af', 3); sun.position.set(-50, 90, 45); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 190 });
      sun.shadow.bias = -.001; scene.add(sun, sun.target);
      const geometries = new Set<InstanceType<typeof T.BufferGeometry>>();
      const materials = new Set<InstanceType<typeof T.Material>>();
      const textures: InstanceType<typeof T.Texture>[] = [];
      const boxGeo = new T.BoxGeometry(1, 1, 1); geometries.add(boxGeo);
      const sphereGeo = new T.SphereGeometry(1, 12, 8); geometries.add(sphereGeo);
      const wheelGeo = new T.CylinderGeometry(.36, .36, .22, 14); geometries.add(wheelGeo);
      const mat = (color: string, metalness = 0, roughness = .8) => { const m = new T.MeshStandardMaterial({ color, metalness, roughness }); materials.add(m); return m; };
      const asphalt = mat('#484b4c'), concrete = mat('#a3a29a'), white = mat('#dedacb'), dark = mat('#182128'), rubber = mat('#151719'), chrome = mat('#a5acb0', .8, .2);
      const glass = mat('#385160', .65, .15), skin = mat('#b99073'), green = mat('#4c6147');
      const box = (parent: InstanceType<typeof T.Object3D>, m: InstanceType<typeof T.Material>, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const o = new T.Mesh(boxGeo, m); o.position.set(x,y,z); o.scale.set(w,h,d); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
      };
      let seed = 635;
      const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
      // Generated facade texture: no downloads, copyrighted game assets or runtime asset requests.
      function facade(base: string) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const ctx = c.getContext('2d')!; ctx.fillStyle = base; ctx.fillRect(0,0,256,256);
        for (let y=0;y<256;y+=32) for (let x=0;x<256;x+=32) {
          ctx.fillStyle = rand() > .75 ? '#a29b77' : '#31434b'; ctx.fillRect(x+7,y+5,18,22);
          ctx.fillStyle = '#697779'; ctx.fillRect(x+8,y+6,1,20); ctx.fillRect(x+7,y+26,20,2);
        }
        const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; textures.push(t);
        const m = new T.MeshStandardMaterial({ map: t, roughness: .8 }); materials.add(m); return m;
      }
      const facades = ['#827b6f','#b0a58f','#737f83','#8a857b'].map(facade);
      box(scene, asphalt, 0,-.25,0,245,.5,245);
      const obstacles: { x: number; z: number; w: number; d: number }[] = [];
      const walls:InstanceType<typeof T.Mesh>[]=[];
      const sand=mat('#bd9e70');box(scene,sand,0,.03,-98,245,.06,49);
      // A fictional Kuwait-inspired desert boundary, not surveyed real geography.
      for(let i=0;i<22;i++){const dune=new T.Mesh(sphereGeo,sand);dune.position.set(-116+rand()*232,-.8,-96-rand()*22);dune.scale.set(7+rand()*8,1.4+rand(),4+rand()*5);dune.receiveShadow=true;scene.add(dune);}
      for (const x of [-84,-42,0,42,84]) {
        for(let z=-112;z<116;z+=8) { box(scene,white,x,.016,z,.12,.02,3); box(scene,white,z,.016,x,3,.02,.12); }
      }
      for (const x of [-105,-63,-21,21,63,105]) for (const z of [-105,-63,-21,21,63,105]) {
        if(z===-105)continue;
        box(scene,concrete,x,.13,z,28,.26,28);
        const height = 7+rand()*26, w = 15+rand()*5, d = 15+rand()*5;
        walls.push(box(scene,facades[Math.floor(rand()*4)],x,height/2+.25,z,w,height,d));
        box(scene,dark,x,height+.4,z,w+.5,.5,d+.5);
        box(scene,concrete,x+2,height+1,z,3,1.5,3);
        obstacles.push({x,z,w:w/2+.5,d:d/2+.5});
        box(scene,glass,x,.25+1.3,z+d/2+.03,3,2.6,.12);
        for (const offset of [-12,12]) {
          box(scene,dark,x+offset,2.5,z+12,.12,5,.12);
          box(scene,white,x+offset,5,z+12,1.4,.15,.6);
          box(scene,green,x+offset,.65,z-11,1.8,1.2,2.4);
        }
      }
      const water = mat('#356575', .4, .25); box(scene,water,0,-.35,150,330,.1,50);
      box(scene,concrete,0,.1,124,245,.3,4);
      for(let x=-120;x<=120;x+=5) { box(scene,chrome,x,1,125,.08,2,.08); }
      box(scene,chrome,0,1.7,125,245,.08,.08);
      const vehicleMaterials = ['#8c2829','#d2d1c5','#213d50','#434b45','#b28b45'].map(c=>mat(c,.55,.3));
      function car(index: number, bike = false) {
        const g = new T.Group(); const paint = vehicleMaterials[index%vehicleMaterials.length];
        if (bike) {
          box(g,chrome,0,.65,0,.18,.3,1.6); box(g,paint,0,.9,.25,.5,.4,.65);
          box(g,dark,0,1,-.4,.48,.15,.65); box(g,chrome,0,1.25,.75,.9,.07,.07);
        } else {
          box(g,paint,0,.65,0,1.85,.55,4); box(g,paint,0,.95,-.2,1.75,.35,3.1);
          box(g,glass,0,1.3,-.25,1.5,.6,1.8); box(g,paint,0,1.64,-.25,1.55,.1,1.9);
          box(g,chrome,0,.47,2.02,1.8,.12,.12); box(g,chrome,0,.47,-2.02,1.8,.12,.12);
          // Door seams, handles, mirrors and grille give the generated vehicles more definition.
          for(const side of [-1,1]){box(g,dark,side*.929,.85,0,.012,.42,.025);box(g,chrome,side*.94,1.01,-.45,.02,.05,.22);box(g,paint,side*1.01,1.25,.65,.28,.14,.25);}
          for(let grille=-.4;grille<=.4;grille+=.13)box(g,dark,grille,.68,2.015,.055,.2,.025);
          for (const x of [-.6,.6]) { box(g,white,x,.85,2.025,.45,.2,.03); box(g,vehicleMaterials[0],x,.85,-2.025,.45,.2,.03); }
        }
        const wheels: InstanceType<typeof T.Mesh>[] = [];
        for (const x of bike?[0]:[-.94,.94]) for (const z of bike?[-.85,.85]:[-1.25,1.25]) {
          const wheel = new T.Mesh(wheelGeo,rubber); wheel.rotation.z=Math.PI/2; wheel.position.set(x,.38,z); g.add(wheel); wheels.push(wheel);
        }
        scene.add(g); return { group:g,wheels,bike };
      }
      const parked = Array.from({length:18},(_,i)=>{
        const v=car(i,i===1||i===6||i===12); v.group.position.set(i<3?6:(i%2?48:-48),0,i<3?8+i*7:-65+(i%9)*18); return v;
      });
      function person(color: string) {
        const g=new T.Group(), clothes=mat(color); const limbs: InstanceType<typeof T.Mesh>[]=[];
        box(g,clothes,0,1.15,0,.5,.65,.28);
        const head=new T.Mesh(sphereGeo,skin);head.scale.set(.19,.23,.19);head.position.y=1.7;g.add(head);
        for(const x of [-.16,.16]) limbs.push(box(g,dark,x,.45,0,.18,.8,.2));
        for(const x of [-.34,.34]) limbs.push(box(g,clothes,x,1.03,0,.15,.65,.17));
        scene.add(g);return {group:g,limbs};
      }
      const player=person('#d0b894');
      const gun=new T.Group();player.group.add(gun);gun.position.set(.3,1.32,.3);
      box(gun,dark,0,0,.18,.12,.13,.48);box(gun,chrome,0,.025,.24,.11,.09,.36);box(gun,dark,0,-.14,0,.1,.22,.13);
      const npcs=Array.from({length:32},(_,i)=>({ ...person(['#52606b','#857564','#5b4543','#d6d0bd'][i%4]), baseX: [-75,-33,9,51,93][i%5], phase:i*7, health:100,downUntil:0 }));
      function animal(kind:'camel'|'dog'|'cat',px:number,pz:number){
        const g=new T.Group(),camel=kind==='camel',cat=kind==='cat';const fur=mat(camel?'#a88457':cat?'#b6aba0':'#766453');
        const length=camel?2.3:cat?.65:1.05,height=camel?1.8:cat?.35:.6;
        const part=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const m=new T.Mesh(sphereGeo,fur);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;};
        part(0,height,0,length*.24,height*.3,length*.5);
        if(camel){part(0,height+.5,-.1,.4,.7,.6);const neck=part(0,height+.65,.9,.22,.95,.25);neck.rotation.x=.3;}
        part(0,height+(camel?1.5:.1),length*.58,length*.18,height*.2,length*.22);
        const legs=[];for(const side of [-1,1])for(const end of [-1,1])legs.push(part(side*length*.18,height*.45,end*length*.32,length*.055,height*.5,length*.06));
        for(const side of [-1,1])part(side*length*.1,height+(camel?1.85:height*.4),length*.6,.06,cat?.12:.09,.06);
        const tail=part(0,height,-length*.6,.045,cat?.3:.2,.045);tail.rotation.x=-.8;
        g.position.set(px,0,pz);scene.add(g);return {group:g,legs,px,pz,camel};
      }
      const animals=[...Array.from({length:5},(_,i)=>animal('camel',64+i*7,-100)),...Array.from({length:8},(_,i)=>animal(i%2?'dog':'cat',9+(i%3)*42,-45+i*17))];
      const traffic=Array.from({length:8},(_,i)=>({ ...car(i), lane:[-80,-38,4,46][i%4], offset:i*27 }));
      const remotePlayers = new Map<string,{ human:ReturnType<typeof person>; car:ReturnType<typeof car>; bike:ReturnType<typeof car>; label:InstanceType<typeof T.Sprite>; username:string }>();
      const remoteLabel = (username:string) => {
        const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d')!;
        ctx.fillStyle='#142129dd';ctx.fillRect(0,0,512,96);ctx.font='bold 32px Arial';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(username.slice(0,24),256,61,480);
        const texture=new T.CanvasTexture(c);textures.push(texture);const material=new T.SpriteMaterial({map:texture,depthTest:false});materials.add(material);
        const label=new T.Sprite(material);label.scale.set(3.6,.675,1);scene.add(label);return label;
      };
      const markerGeo=new T.TorusGeometry(2,.09,8,32);geometries.add(markerGeo);
      const marker=new T.Mesh(markerGeo,mat('#ecc484',.1,.3));scene.add(marker);
      box(scene,mat('#47766f'),shop.x,1.8,shop.z,2.5,3.6,2.5);
      const targetMat=mat('#bf6553');
      const targets=[-5,0,5].map(dx=>box(scene,targetMat,shop.x+dx,1.5,shop.z+12,1.4,2,.3));
      let x=3,z=3,yaw=0,speed=0,elapsed=0,last=0,frame=0,report=0,frames=0,reportTime=0,active=-1,shotUntil=0,lastShot=-1,reloadUntil=0;
      const traceGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);geometries.add(traceGeo);
      const traceMat=new T.LineBasicMaterial({color:'#ffe4a0'});materials.add(traceMat);
      const trace=new T.Line(traceGeo,traceMat);trace.visible=false;scene.add(trace);
      function blocked(nx:number,nz:number,r=0.5) {return Math.abs(nx)>119||Math.abs(nz)>120||obstacles.some(o=>Math.abs(nx-o.x)<o.w+r&&Math.abs(nz-o.z)<o.d+r);}
      const clear=()=>keys.current.clear();
      action.current=(name)=>{
        if(pausedRef.current)return;
        if(name==='vehicle') {
          if(active>=0) {
            const ex=x+Math.cos(yaw)*2.7,ez=z-Math.sin(yaw)*2.7;
            if(blocked(ex,ez)) {setNotice('Move into open space to get out.');return;}
            active=-1;x=ex;z=ez;speed=0;player.group.visible=true;
          } else {
            active=parked.findIndex(v=>v.group.position.distanceTo(new T.Vector3(x,0,z))<5);
            if(active<0){setNotice('Walk closer to a parked car or motorcycle.');return;}
            x=parked[active].group.position.x;z=parked[active].group.position.z;yaw=parked[active].group.rotation.y;speed=0;
          }
        }
        if(name==='shop') {
          if(Math.hypot(x-shop.x,z-shop.z)>9){setNotice('Visit the gun shop, marked S on the map.');return;}
          if(saveRef.current.owns){persist({...saveRef.current,ammo:12,reserve:60});setNotice('Ammo resupplied. Face your target and press Fire.');return;}
          if(saveRef.current.cash<300){setNotice('Gun costs $300 game money. Complete deliveries first.');return;}
          persist({...saveRef.current,cash:saveRef.current.cash-300,owns:true,ammo:12,reserve:60});setNotice('Gun purchased. Fire: F · Reload: R. Local NPC combat only.');
        }
        if(name==='reload'){
          if(!saveRef.current.owns||reloadUntil>elapsed)return;
          if(saveRef.current.ammo===12)return;
          if(!saveRef.current.reserve){setNotice('Visit S for free ammo resupply.');return;}
          reloadUntil=elapsed+1.2;setNotice('Reloading…');
        }
        if(name==='fire') {
          if(!saveRef.current.owns){setNotice('Buy a gun from S first ($300 game money).');return;}
          if(active>=0){setNotice('Exit the vehicle to use your gun.');return;}
          if(reloadUntil>elapsed||elapsed-lastShot<.3)return;
          if(!saveRef.current.ammo){setNotice('Empty magazine. Press R / Reload.');return;}
          lastShot=elapsed;persist({...saveRef.current,ammo:saveRef.current.ammo-1});
          const origin=new T.Vector3(x,1.5,z),dir=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
          scene.updateMatrixWorld(true);
          const ray=new T.Raycaster(origin,dir,0,45);const hit=ray.intersectObjects([...walls,...targets,...npcs.filter(p=>p.health>0).map(p=>p.group)],true)[0];
          const end=hit?hit.point:origin.clone().addScaledVector(dir,45);
          const attr=traceGeo.getAttribute('position');attr.setXYZ(0,origin.x,origin.y,origin.z);attr.setXYZ(1,end.x,end.y,end.z);attr.needsUpdate=true;traceGeo.computeBoundingSphere();
          trace.visible=true;shotUntil=elapsed+.12;
          if(hit&&targets.some(target=>target===hit.object)){persist({...saveRef.current,hits:saveRef.current.hits+1});setNotice('Range target hit!');}
          else if(hit){const npc=npcs.find(p=>p.group.children.includes(hit.object));if(npc){npc.health-=50;if(npc.health<=0)npc.downUntil=elapsed+12;setNotice(npc.health>0?'NPC hit.':'NPC down — respawns shortly.');}else setNotice('Shot blocked by a building.');}
          else setNotice('Miss. Turn to line up a target.');
        }
      };
      const down=(e:KeyboardEvent)=>{
        if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
        const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
        keys.current.add(key);if(!e.repeat){if(key==='e')action.current('vehicle');if(key==='b')action.current('shop');if(key==='f')action.current('fire');if(key==='r')action.current('reload');if(key==='escape')pause(!pausedRef.current);}
      };
      const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
      const hidden=()=>{clear();if(document.hidden)pause(true);};
      window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',hidden);document.addEventListener('visibilitychange',hidden);
      const lost=(e:Event)=>{e.preventDefault();pause(true);setError('Graphics context lost. Reload this page to resume; saved progress is retained.');};
      renderer.domElement.addEventListener('webglcontextlost',lost);
      const resize=()=>{renderer.setSize(container.clientWidth,container.clientHeight);camera.aspect=container.clientWidth/Math.max(1,container.clientHeight);camera.updateProjectionMatrix();};
      const observer=new ResizeObserver(resize);observer.observe(container);resize();
      let currentQuality='balanced',pixelRatio=Math.min(devicePixelRatio,1.25);
      const desired=new T.Vector3();
      const tick=(now:number)=>{
        frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.04);last=now;
        if(document.hidden||pausedRef.current)return;
        elapsed+=dt;frames++;
        gun.visible=saveRef.current.owns&&active<0;
        if(reloadUntil&&elapsed>=reloadUntil){const amount=Math.min(12-saveRef.current.ammo,saveRef.current.reserve);persist({...saveRef.current,ammo:saveRef.current.ammo+amount,reserve:saveRef.current.reserve-amount});reloadUntil=0;setNotice('Reloaded.');}
        if(currentQuality!==qualityRef.current){currentQuality=qualityRef.current;pixelRatio=Math.min(devicePixelRatio,currentQuality==='low'?.8:1.25);renderer.setPixelRatio(pixelRatio);renderer.shadowMap.enabled=currentQuality!=='low';resize();}
        const k=keys.current,forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'));
        const steering=Number(k.has('a')||k.has('arrowleft'))-Number(k.has('d')||k.has('arrowright'));
        const driving=active>=0, max=driving?(parked[active].bike?20:24):(k.has('shift')?6:3.4);
        speed+=(forward*max-speed)*Math.min(1,dt*(driving?1.4:10));if(k.has(' '))speed*=Math.exp(-dt*8);
        yaw+=steering*dt*(driving?1.4*Math.min(1,Math.abs(speed)/3)*Math.sign(speed):2.1);
        const nx=x+Math.sin(yaw)*speed*dt,nz=z+Math.cos(yaw)*speed*dt;
        if(!blocked(nx,nz,driving?1.6:.5)){x=nx;z=nz;}else speed=0;
        player.group.position.set(x,driving?.3:0,z);player.group.rotation.y=yaw;player.group.visible=!driving||parked[active].bike;
        player.limbs.forEach((l,i)=>l.rotation.x=driving?0:Math.sin(elapsed*10+i%2*Math.PI)*Math.min(.45,Math.abs(speed)*.12));
        if(driving){const v=parked[active];v.group.position.set(x,0,z);v.group.rotation.y=yaw;v.wheels.forEach(w=>w.rotation.x+=speed*dt*2);}
        npcs.forEach((p,i)=>{if(p.health<=0&&elapsed>=p.downUntil)p.health=100;p.group.visible=p.health>0;const t=(elapsed*1.2+p.phase)%165-70;p.group.position.set(p.baseX,0,t);p.limbs.forEach((l,j)=>l.rotation.x=Math.sin(elapsed*6+j%2*Math.PI+i)*.4);});
        animals.forEach((a,i)=>{a.group.position.z=a.pz+Math.sin(elapsed*.1+i)*2;a.group.rotation.y=Math.cos(elapsed*.1+i)>0?0:Math.PI;a.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(elapsed*3+j*Math.PI/2)*.16);});
        traffic.forEach((v,i)=>{const tz=(elapsed*(6+i%3)+v.offset)%230-115;v.group.position.set(v.lane,0,tz);v.wheels.forEach(w=>w.rotation.x+=dt*12);});
        networkPosition.current={x,z,yaw,vehicle:driving?(parked[active].bike?'Motorcycle':'Sedan'):''};
        for(const [id,remote] of remotePlayers){
          remote.human.group.visible=remote.car.group.visible=remote.bike.group.visible=remote.label.visible=false;
          if(!peerStates.current.some(p=>p.id===id)){scene.remove(remote.human.group,remote.car.group,remote.bike.group,remote.label);remote.label.material.map?.dispose();remote.label.material.dispose();remotePlayers.delete(id);}
        }
        for(const p of peerStates.current){
          let remote=remotePlayers.get(p.id);
          if(!remote&&remotePlayers.size<12){remote={human:person('#699aab'),car:car(2),bike:car(2,true),label:remoteLabel(p.username),username:p.username};remotePlayers.set(p.id,remote);remote.human.group.position.set(p.x,0,p.z);remote.car.group.position.set(p.x,0,p.z);remote.bike.group.position.set(p.x,0,p.z);}
          if(!remote)continue;
          const object=p.vehicle==='Sedan'?remote.car.group:p.vehicle==='Motorcycle'?remote.bike.group:remote.human.group;
          object.visible=true;desired.set(p.x,0,p.z);object.position.lerp(desired,1-Math.exp(-dt*9));object.rotation.y=p.yaw;
          remote.label.visible=true;remote.label.position.copy(object.position);remote.label.position.y=3;
          remote.human.limbs.forEach((l,i)=>l.rotation.x=Math.sin(elapsed*8+i%2*Math.PI)*.25);
        }
        const m=missions[saveRef.current.mission];marker.visible=!!m;
        let distance=0;if(m){marker.position.set(m.x,2+Math.sin(elapsed)*.3,m.z);marker.rotation.y=elapsed;distance=Math.hypot(x-m.x,z-m.z);
          if(distance<4&&saveRef.current.hits>=(m.requiresHits??0)){persist({...saveRef.current,cash:saveRef.current.cash+m.reward,mission:saveRef.current.mission+1});setNotice(`Mission complete · +$${m.reward}`);}}
        trace.visible=elapsed<shotUntil;
        desired.set(x-Math.sin(yaw)*(driving?10:7),driving?5.5:4,z-Math.cos(yaw)*(driving?10:7));
        camera.position.lerp(desired,1-Math.exp(-dt*5));camera.lookAt(x,1.3,z);
        sun.position.set(x-50,90,z+45);sun.target.position.set(x,0,z);
        if(now-report>200){setHud({x,z,yaw,speed:Math.round(Math.abs(speed)*3.6),vehicle:driving?(parked[active].bike?'Motorcycle':'Sedan'):'',distance:Math.round(distance),nearShop:Math.hypot(x-shop.x,z-shop.z)<9,fps:Math.round(frames*1000/Math.max(1,now-reportTime))});report=now;}
        if(now-reportTime>2000){const fps=frames*1000/(now-reportTime);if(fps<27&&pixelRatio>.7){pixelRatio=Math.max(.65,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);resize();}reportTime=now;frames=0;}
        renderer.render(scene,camera);
      };
      camera.position.set(3,5,-5);frame=requestAnimationFrame(tick);setReady(true);
      cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();clear();action.current=()=>{};window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',hidden);document.removeEventListener('visibilitychange',hidden);renderer.domElement.removeEventListener('webglcontextlost',lost);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};
    })().catch(()=>setError('3D could not start. Enable graphics acceleration or try a WebGL-compatible browser.'));
    return()=>{disposed=true;cleanup();};
  },[started,peerStates]);
  const hold=(key:string,label:string)=><button aria-label={label} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key);}} onPointerUp={()=>keys.current.delete(key)} onPointerCancel={()=>keys.current.delete(key)} onLostPointerCapture={()=>keys.current.delete(key)}>{label}</button>;
  const mission=missions[save.mission];
  return <main ref={root} className={styles.shell}>
    <div ref={host} className={styles.world}/>
    <header className={styles.header}><Link href="/">← ZION</Link><span>ZION STORY <small>GULF DISTRICT</small></span><div><button onClick={()=>{setLobbyOpen(!lobbyOpen);pause(!lobbyOpen);}}>Friends {online.count||''}</button><button onClick={fullscreen}>Fullscreen</button>{started&&<button onClick={()=>pause(!paused)}>{paused?'Resume':'Pause'}</button>}</div></header>
    {!started?<section className={styles.intro}><small>AN ORIGINAL CITY ADVENTURE</small><h1>Your next<br/><em>shift starts here.</em></h1><p>Explore a Kuwait-inspired city and desert. Drive, deliver and discover.<br/>Earn game money, buy a gun and complete nine missions.</p><button onClick={()=>{setStarted(true);pause(false);}}>Enter Gulf District →</button><p className={styles.disclaimer}>Fictional Kuwait-inspired map • Procedural models, not photorealistic assets.<br/>Progress saves on this browser. No real-money purchases.</p></section>:<>
      <section className={styles.quest}><small>CONTRACT {Math.min(save.mission+1,missions.length)} / {missions.length}</small><h1>{mission?.name||'Shift complete'}</h1><p>{mission?.brief||'All deliveries completed. Explore or practise at the range.'}</p>{mission&&<strong>{hud.distance} m <span>· ${mission.reward} reward</span></strong>}</section>
      <aside className={styles.wallet}><b>${save.cash.toLocaleString()}</b><small>GAME MONEY</small>{save.owns&&<span>Ammo {save.ammo} / {save.reserve}</span>}<span>{hud.vehicle||'On foot'} · {hud.speed} km/h</span></aside>
      <button className={styles.mapButton} onClick={()=>setMapOpen(!mapOpen)} aria-label="Toggle city map">{mapOpen?'Close map':'City map'}</button>
      <div className={`${styles.map} ${mapOpen?styles.expanded:''}`}>
        <svg viewBox="-125 -125 250 250" role="img" aria-label="City map: player arrow, gold mission, S range shop">
          <rect x="-125" y="-125" width="250" height="250" fill="#232f33"/>
          {[-84,-42,0,42,84].map(v=><g key={v} stroke="#657475" strokeWidth="9"><path d={`M ${v} -125 V 125`}/><path d={`M -125 ${v} H 125`}/></g>)}
          <rect x="-125" y="-125" width="250" height="45" fill="#ac936a"/><text x="0" y="-108" fontSize="10" textAnchor="middle" fill="#302e28">DESERT TRAIL</text><text x="-35" y="60" fontSize="9" fill="#d7d1bc">GULF DISTRICT</text><path d="M -125 121 H 125" stroke="#427a8c" strokeWidth="8"/>
          <circle cx={shop.x} cy={shop.z} r="8" fill="#91c9b3"/><text x={shop.x} y={shop.z+4} fontSize="11" textAnchor="middle" fill="#122322">S</text>
          {mission&&<circle cx={mission.x} cy={mission.z} r="5" fill="#efc489"/>}
          <path d="M 0 7 L -4 -4 L 0 -2 L 4 -4 Z" fill="white" transform={`translate(${hud.x} ${hud.z}) rotate(${-hud.yaw*180/Math.PI})`}/>
        </svg><small>YOU △ · MISSION ● · SHOP S</small>
      </div>
      <p className={styles.notice} role="status">{notice||'E: enter vehicle · WASD: move · Space: brake · B: shop · F: fire · R: reload'}</p>
      <div className={styles.controls}><div className={styles.pad}>{hold('w','↑')}{hold('a','←')}{hold('s','↓')}{hold('d','→')}</div><div className={styles.actions}><button onClick={()=>action.current('vehicle')}>{hud.vehicle?'Exit':'Enter vehicle'}</button>{hold(hud.vehicle?' ':'shift',hud.vehicle?'Brake':'Run')}<button onClick={()=>action.current('shop')}>{save.owns?'Ammo at S':'Gun $300'}</button>{save.owns&&<><button onClick={()=>action.current('fire')}>Fire</button><button onClick={()=>action.current('reload')}>Reload</button></>}</div></div>
      <footer className={styles.footer}><span>{online.status} · {save.hits} target hits</span><label>Graphics <select value={quality} onChange={e=>{qualityRef.current=e.target.value;setQuality(e.target.value);}}><option value="balanced">Balanced</option><option value="low">Performance</option></select></label></footer>
      {!ready&&!error&&<div className={styles.overlay}>Building Gulf District…</div>}
      {paused&&!error&&<div className={styles.overlay}><h2>Take a breather.</h2><p>Your progress is saved on this browser.</p><button onClick={()=>pause(false)}>Continue</button><Link href="/">Back to ZION</Link></div>}
      <div className={styles.rotate}>↻ Rotate your phone for a wider view</div>
    </>}
    {lobbyOpen&&<section className={styles.overlay}><h2>Explore with friends</h2><p>Up to 4 players · accepted friends of the host only.</p>{online.room?<><p>Room code: <strong>{online.room.code}</strong></p><button onClick={async()=>{try{await navigator.clipboard.writeText(online.room!.code);setNotice('Room code copied. Send it to your ZION friends.');}catch{setNotice('Select and copy the room code manually.');}}}>Copy room code</button><button onClick={online.leave}>Leave room</button></>:<><button disabled={online.busy} onClick={()=>online.join()}>Create private room</button><label>Friend’s room code <input value={roomCode} maxLength={16} onChange={e=>setRoomCode(e.target.value)} placeholder="16-character room code"/></label><button disabled={online.busy||roomCode.length!==16} onClick={()=>online.join(roomCode)}>Join room</button></>}<p role="status">{online.status}{online.count?` · ${online.count}/4 players`:''}</p><button onClick={()=>{setLobbyOpen(false);pause(false);}}>Back to game</button><small>First-time setup: run SUPABASE_V63_CITY.sql. Sign in through ZION first.</small></section>}
    {error&&<div className={styles.overlay}><p>{error}</p><button onClick={()=>location.reload()}>Reload</button><Link href="/">Back to ZION</Link></div>}
  </main>;
}
