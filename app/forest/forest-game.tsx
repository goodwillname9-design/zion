'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './forest.module.css';

export default function ForestGame() {
  const host = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const mode = useRef({ riding: true, running: false, paused: false });
  const [riding, setRiding] = useState(true);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(0);
  const [distance, setDistance] = useState(0);
  const [quality, setQuality] = useState('balanced');
  const places = ['The old crossing', 'Pine ridge', 'The quiet grove'];
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const T = await import('three');
      if (disposed || !host.current) return;
      const container = host.current;
      const scene = new T.Scene();
      scene.background = new T.Color('#a5b3aa');
      scene.fog = new T.FogExp2('#a5b3aa', .014);
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : 1.5));
      renderer.shadowMap.enabled = quality !== 'low';
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      container.appendChild(renderer.domElement);
      const camera = new T.PerspectiveCamera(55, 1, .1, 400);
      scene.add(new T.HemisphereLight('#e2e8dc', '#343126', 2));
      const sun = new T.DirectionalLight('#ffe2b1', 3);
      sun.position.set(35, 60, -30); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 180 });
      scene.add(sun);
      const mat = (color: string) => new T.MeshStandardMaterial({ color, roughness: .94 });
      const soil = mat('#505b39'), bark = mat('#47372b'), leaf = mat('#263f30');
      const horseMat = mat('#56382a'), maneMat = mat('#241e19'), cloth = mat('#383f40');
      const terrain = (x: number, z: number) => .9 * Math.sin(x * .04) * Math.cos(z * .05);
      const groundGeo = new T.PlaneGeometry(260, 260, 90, 90);
      groundGeo.rotateX(-Math.PI / 2);
      const vertices = groundGeo.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setY(i, terrain(vertices.getX(i), vertices.getZ(i)));
      groundGeo.computeVertexNormals();
      const ground = new T.Mesh(groundGeo, soil); ground.receiveShadow = true; scene.add(ground);
      let seed = 81;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const obstacles: { x: number; z: number; r: number }[] = [];
      const trunkGeo = new T.CylinderGeometry(.22, .42, 8, 7);
      const crownGeo = new T.ConeGeometry(3, 9, 10);
      const trunks = new T.InstancedMesh(trunkGeo, bark, 360);
      const crowns = new T.InstancedMesh(crownGeo, leaf, 720);
      const dummy = new T.Object3D();
      for (let i = 0; i < 360; i++) {
        let x = (random() - .5) * 235, z = (random() - .5) * 235;
        if (Math.abs(x) < 8 || (z > 23 && z < 37)) x += x < 0 ? -12 : 12;
        const scale = .7 + random() * .7, y = terrain(x, z);
        dummy.position.set(x, y + 4 * scale, z); dummy.scale.set(scale, scale, scale); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
        for (let j = 0; j < 2; j++) {
          dummy.position.y = y + (8 + j * 3) * scale;
          dummy.scale.setScalar(scale * (1 - j * .2)); dummy.updateMatrix(); crowns.setMatrixAt(i * 2 + j, dummy.matrix);
        }
        obstacles.push({ x, z, r: .8 });
      }
      trunks.castShadow = crowns.castShadow = true; scene.add(trunks, crowns);
      const river = new T.Mesh(new T.PlaneGeometry(260, 10), new T.MeshStandardMaterial({ color: '#527e80', roughness: .22, metalness: .35, transparent: true, opacity: .88 }));
      river.rotation.x = -Math.PI / 2; river.position.set(0, .35, 30); scene.add(river);
      const bridge = new T.Mesh(new T.BoxGeometry(7, .4, 15), bark); bridge.position.set(0, .85, 30); bridge.receiveShadow = true; scene.add(bridge);
      for (let i = 0; i < 45; i++) {
        const rock = new T.Mesh(new T.DodecahedronGeometry(1 + random() * 2, 1), mat('#6a6c60'));
        const x = (random() - .5) * 230, z = (random() - .5) * 230;
        if (Math.abs(x) < 10) continue;
        rock.position.set(x, terrain(x,z), z); rock.scale.y = .5; scene.add(rock); obstacles.push({ x, z, r: 2.5 });
      }
      const horse = new T.Group(), rider = new T.Group(); scene.add(horse, rider);
      const ellipsoid = (parent: InstanceType<typeof T.Group>, material: InstanceType<typeof T.MeshStandardMaterial>, p: number[], s: number[]) => {
        const mesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), material);
        mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(s[0], s[1], s[2]); mesh.castShadow = true; parent.add(mesh); return mesh;
      };
      ellipsoid(horse, horseMat, [0,1.6,0], [.55,.65,1.05]);
      const neck = ellipsoid(horse, horseMat, [0,2.1,.85], [.32,.8,.4]); neck.rotation.x = .4;
      ellipsoid(horse, horseMat, [0,2.65,1.17], [.28,.32,.57]);
      ellipsoid(horse, maneMat, [0,2.35,.64], [.13,.64,.2]);
      ellipsoid(horse, maneMat, [0,1.5,-1.15], [.12,.6,.12]);
      ellipsoid(horse, maneMat, [0,2.15,-.12], [.52,.12,.48]);
      for (const x of [-.18,.18]) ellipsoid(horse, horseMat, [x,3,1.05], [.09,.24,.1]);
      const legs: InstanceType<typeof T.Group>[] = [];
      for (const x of [-.35,.35]) for (const z of [-.65,.65]) {
        const leg = new T.Group(); leg.position.set(x,1.45,z); horse.add(leg);
        ellipsoid(leg,horseMat,[0,-.55,0],[.12,.64,.13]); ellipsoid(leg,maneMat,[0,-1.17,.05],[.16,.12,.2]); legs.push(leg);
      }
      ellipsoid(rider, cloth, [0,1.2,0], [.3,.48,.22]);
      ellipsoid(rider, mat('#b89a79'), [0,1.85,0], [.21,.25,.21]);
      ellipsoid(rider, maneMat, [0,2.03,0], [.32,.07,.29]);
      const humanLegs = [-.17,.17].map(x => ellipsoid(rider,cloth,[x,.5,0],[.12,.52,.13]));
      const checkpoints = [new T.Vector3(0,1.5,42), new T.Vector3(-48,1.5,70), new T.Vector3(44,1.5,-55)];
      const marker = new T.Mesh(new T.TorusGeometry(2,.1,8,40), new T.MeshBasicMaterial({ color: '#d9edaa' })); scene.add(marker);
      let checkpoint = 0, yaw = 0, x = 0, z = -10, elapsed = 0, last = 0, frame = 0, report = 0;
      const resize = () => { const w=container.clientWidth,h=container.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
      const observer = new ResizeObserver(resize); observer.observe(container); resize();
      const down = (e: KeyboardEvent) => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); keys.current.add(e.key.toLowerCase()); };
      const clear = () => keys.current.clear();
      const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
      window.addEventListener('keydown',down); window.addEventListener('keyup',up); window.addEventListener('blur',clear);
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min((now-last)/1000,.04); last=now;
        if (document.hidden || mode.current.paused) return;
        elapsed += dt;
        const pressed = keys.current;
        const forward = Number(pressed.has('w')||pressed.has('arrowup'))-Number(pressed.has('s')||pressed.has('arrowdown'));
        yaw += (Number(pressed.has('a')||pressed.has('arrowleft'))-Number(pressed.has('d')||pressed.has('arrowright'))) * dt * 1.8;
        const speed = (mode.current.riding ? 7 : 3) * (mode.current.running || pressed.has('shift') ? 1.6 : 1);
        const nx=x+Math.sin(yaw)*forward*speed*dt,nz=z+Math.cos(yaw)*forward*speed*dt;
        if (Math.abs(nx)<118 && Math.abs(nz)<118 && !(nz>24&&nz<36&&Math.abs(nx)>2.7) && !obstacles.some(o=>Math.hypot(nx-o.x,nz-o.z)<o.r+.6)) { x=nx;z=nz; }
        const y=z>23&&z<37 ? 1.1 : terrain(x,z)+.1;
        rider.position.set(x,y+(mode.current.riding?1.55:0),z); rider.rotation.y=yaw;
        if (mode.current.riding) { horse.position.set(x,y,z);horse.rotation.y=yaw; }
        legs.forEach((leg,i)=>leg.rotation.x=mode.current.riding ? Math.sin(elapsed*speed*1.8+i*Math.PI/2)*.48*Math.abs(forward):0);
        humanLegs.forEach((leg,i)=>leg.rotation.x=mode.current.riding ? -.75 : Math.sin(elapsed*9+i*Math.PI)*.5*Math.abs(forward));
        rider.position.y+=Math.sin(elapsed*speed*2)*.04*Math.abs(forward);
        const desired=new T.Vector3(x-Math.sin(yaw)*9,y+5,z-Math.cos(yaw)*9);
        camera.position.lerp(desired,1-Math.exp(-dt*5)); camera.lookAt(x,y+2,z);
        if (checkpoint<checkpoints.length) {
          marker.position.copy(checkpoints[checkpoint]); marker.position.y=terrain(marker.position.x,marker.position.z)+3+Math.sin(elapsed)*.3; marker.rotation.y=elapsed*.4;
          const d=Math.hypot(x-marker.position.x,z-marker.position.z);
          if (now-report>250) { setDistance(Math.round(d));report=now; }
          if (d<4) { checkpoint++;setTarget(checkpoint);if(checkpoint===3) marker.visible=false; }
        }
        renderer.render(scene,camera);
      };
      camera.position.set(0,5,-20);frame=requestAnimationFrame(tick);setReady(true);
      cleanup=()=>{
        cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);clear();
        scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
        renderer.dispose();renderer.domElement.remove();
      };
    })().catch(()=>setError('3D could not start. Try another browser or enable hardware acceleration.'));
    return ()=>{disposed=true;cleanup();};
  },[quality]);
  const control = (key: string, label: string) => <button aria-label={label} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key);}} onPointerUp={()=>keys.current.delete(key)} onPointerCancel={()=>keys.current.delete(key)}>{label}</button>;
  return <main className={styles.shell}>
    <div ref={host} className={styles.world}/>
    <header className={styles.header}><Link href="/">← Back to ZION</Link><span>ZION STORY <small>WHISPERING PINES</small></span><button onClick={()=>{mode.current.paused=!paused;setPaused(!paused);}}>{paused?'Resume':'Pause'}</button></header>
    <aside className={styles.quest}><small>FOREST JOURNAL · {Math.min(target+1,3)}/3</small><h1>{target<3?places[target]:'The trail is yours.'}</h1><p>{target<3?`Follow the glowing ring · ${distance} m`:'All landmarks discovered. Keep exploring.'}</p><span>Single-player • Prototype • Placeholder models</span></aside>
    {!ready&&!error&&<div className={styles.loading}>Preparing the forest…</div>}
    {error&&<div className={styles.loading}>{error}<Link href="/">Return to ZION</Link></div>}
    {paused&&<div className={styles.loading}>Paused</div>}
    <footer className={styles.footer}><p>WASD / arrows · Shift to gallop<br/>Cross the river using the wooden bridge.</p><label>Graphics <select value={quality} onChange={e=>{setReady(false);setTarget(0);setQuality(e.target.value);}}><option value="balanced">Balanced</option><option value="low">Low</option></select></label></footer>
    <div className={styles.controls}><div className={styles.pad}>{control('w','↑')}{control('a','←')}{control('s','↓')}{control('d','→')}</div><div className={styles.actions}><button onClick={()=>{mode.current.riding=!riding;setRiding(!riding);}}>{riding?'Walk':'Ride'}</button><button onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);mode.current.running=true;}} onPointerUp={()=>mode.current.running=false} onPointerCancel={()=>mode.current.running=false}>Gallop</button></div></div>
  </main>;
}
