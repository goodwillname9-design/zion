// ZION Park — roller coaster + Ferris wheel meshes. Everything is driven by the wall clock,
// so every player sees the same train and wheel position. Draw calls are kept low with instancing.
import type * as THREE from 'three';
import { makeTrack, PARK, STATION, CAR_COUNT } from './park-model';

type ThreeNS = typeof THREE;
export type ParkContext = {
  T: ThreeNS;
  scene: THREE.Scene;
  mat: (color: string, metalness?: number, roughness?: number) => THREE.MeshStandardMaterial;
  geometries: { add(geometry: THREE.BufferGeometry): unknown };
  materials: { add(material: THREE.Material): unknown };
  label: (text: string) => THREE.Sprite;
  obstacles: { x: number; z: number; w: number; d: number }[];
};

export function buildPark(ctx: ParkContext) {
  const { T, scene, mat, geometries, materials, label, obstacles } = ctx;
  const track = makeTrack(T);
  const box = new T.BoxGeometry(1, 1, 1); geometries.add(box);
  const cyl = new T.CylinderGeometry(1, 1, 1, 8); geometries.add(cyl);
  const dummy = new T.Object3D();
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, parent: THREE.Object3D = scene) => {
    const o = new T.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };

  // --- Plaza + entrance -------------------------------------------------------------------------
  mesh(box, mat('#8d8a82', 0, .9), PARK.cx, .03, PARK.cz, PARK.half * 2 - 2, .06, PARK.half * 2 - 2).castShadow = false;
  const frame = mat('#2b3a45', .4, .4);
  const glow = new T.MeshStandardMaterial({ color: '#35e0ff', emissive: '#35e0ff', emissiveIntensity: 1.6, roughness: .3 }); materials.add(glow);
  const warm = new T.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 1.8, roughness: .4 }); materials.add(warm);
  for (const dx of [-5, 5]) mesh(box, frame, PARK.cx + dx, 3, PARK.cz - 16, .6, 6, .6);
  mesh(box, frame, PARK.cx, 6.2, PARK.cz - 16, 11, .7, .7);
  mesh(box, glow, PARK.cx, 5.8, PARK.cz - 16, 10.6, .12, .12);
  const gate = label('ZION PARK • ROLLER COASTER'); gate.position.set(PARK.cx, 7.6, PARK.cz - 16);
  for (const dx of [-5, 5]) obstacles.push({ x: PARK.cx + dx, z: PARK.cz - 16, w: .4, d: .4 });

  // --- Track ------------------------------------------------------------------------------------
  const samples = 520, up = new T.Vector3(0, 1, 0);
  const left: THREE.Vector3[] = [], right: THREE.Vector3[] = [];
  for (let i = 0; i < samples; i++) {
    const u = i / samples, p = track.curve.getPointAt(u), t = track.curve.getTangentAt(u);
    const side = new T.Vector3().crossVectors(t, up).normalize().multiplyScalar(.55);
    left.push(p.clone().add(side)); right.push(p.clone().sub(side));
  }
  const railMat = mat('#e8344d', .6, .3), tieMat = mat('#39434d', .3, .6), supportMat = mat('#aeb7bd', .5, .5);
  for (const pts of [left, right]) {
    const g = new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), samples, .09, 6, true); geometries.add(g);
    const rail = new T.Mesh(g, railMat); rail.castShadow = true; scene.add(rail);
  }
  const ties = Math.floor(track.length / 1.1);
  const tieMesh = new T.InstancedMesh(box, tieMat, ties); tieMesh.castShadow = true;
  const supportSlots: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < ties; i++) {
    const u = i / ties, p = track.curve.getPointAt(u), t = track.curve.getTangentAt(u);
    dummy.position.copy(p); dummy.lookAt(p.x + t.x, p.y + t.y, p.z + t.z); dummy.scale.set(1.4, .1, .18); dummy.updateMatrix();
    tieMesh.setMatrixAt(i, dummy.matrix);
    if (i % 5 === 0 && p.y > 1.8) supportSlots.push({ x: p.x, y: p.y, z: p.z });
  }
  tieMesh.computeBoundingSphere(); scene.add(tieMesh);
  const supports = new T.InstancedMesh(cyl, supportMat, Math.max(1, supportSlots.length)); supports.castShadow = true;
  supportSlots.forEach((s, i) => { dummy.position.set(s.x, (s.y - .15) / 2, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(.14, s.y - .15, .14); dummy.updateMatrix(); supports.setMatrixAt(i, dummy.matrix); });
  supports.computeBoundingSphere(); scene.add(supports);

  // Station platform, canopy and sign
  const platform = mat('#cfc7b4', 0, .8), roof = mat('#c0392b', .1, .6);
  mesh(box, platform, PARK.cx - 5, .35, PARK.cz - 8.2, 16, .5, 3);
  for (const dx of [-12, 2]) mesh(box, frame, PARK.cx + dx, 2.3, PARK.cz - 8.2, .25, 4, .25);
  mesh(box, roof, PARK.cx - 5, 4.4, PARK.cz - 8.2, 16, .25, 3.6);
  const sign = label('BOARD HERE • PRESS E'); sign.position.set(PARK.cx - 5, 5.6, PARK.cz - 8.2);

  // Train
  const carColors = ['#35e0ff', '#ffd27a', '#e8344d'];
  const cars: THREE.Group[] = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    const g = new T.Group(), paint = mat(carColors[i % carColors.length], .5, .3);
    mesh(box, paint, 0, .45, 0, 1.5, .55, 2.8, g); mesh(box, frame, 0, .85, -1.05, 1.5, .45, .3, g);
    for (const s of [-.62, .62]) mesh(box, frame, s, .15, 0, .2, .3, 2.4, g);
    scene.add(g); cars.push(g);
  }

  // --- Ferris wheel -----------------------------------------------------------------------------
  const F = PARK.ferris, wheel = new T.Group(); wheel.position.set(F.x, F.hub, F.z); scene.add(wheel);
  const rimMat = mat('#dfe6ea', .6, .3), rimGeo = new T.TorusGeometry(F.radius, .16, 8, 48); geometries.add(rimGeo);
  for (const dz of [-.8, .8]) { const rim = new T.Mesh(rimGeo, rimMat); rim.position.z = dz; rim.castShadow = true; wheel.add(rim); }
  const spokes = 16;
  for (let i = 0; i < spokes; i++) {
    const a = i / spokes * Math.PI * 2;
    for (const dz of [-.8, .8]) { const s = mesh(box, rimMat, Math.cos(a) * F.radius / 2, Math.sin(a) * F.radius / 2, dz, F.radius, .07, .07, wheel); s.rotation.z = a; }
  }
  const lamps = new T.InstancedMesh(new T.SphereGeometry(.16, 8, 6), warm, 48); geometries.add(lamps.geometry);
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; dummy.position.set(Math.cos(a) * F.radius, Math.sin(a) * F.radius, i % 2 ? .8 : -.8); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); lamps.setMatrixAt(i, dummy.matrix); }
  wheel.add(lamps);
  const gondolas: THREE.Group[] = [];
  const gondolaColors = ['#e8344d', '#35e0ff', '#ffd27a', '#7be08a'];
  for (let i = 0; i < 12; i++) {
    const g = new T.Group(); mesh(box, mat(gondolaColors[i % 4], .3, .5), 0, -.7, 0, 1.5, 1.1, 1.3, g); mesh(box, frame, 0, -.05, 0, 1.7, .12, 1.5, g);
    wheel.add(g); gondolas.push(g);
  }
  for (const dz of [-2.2, 2.2]) {
    const leg = (sx: number) => { const l = mesh(box, frame, F.x + sx, F.hub / 2, F.z + dz, .35, F.hub + .6, .35); l.rotation.z = sx > 0 ? -.2 : .2; };
    leg(-2.6); leg(2.6);
  }
  mesh(cyl, frame, F.x, F.hub, F.z, .5, 2.4, .5).rotation.x = Math.PI / 2;
  obstacles.push({ x: F.x, z: F.z - 2.2, w: 3.2, d: .8 }, { x: F.x, z: F.z + 2.2, w: 3.2, d: .8 });
  const fSign = label('ZION WHEEL'); fSign.position.set(F.x, F.hub + F.radius + 2, F.z);

  // --- Per-frame update -------------------------------------------------------------------------
  const tangent = new T.Vector3();
  function update(nowMs: number) {
    const st = track.status(nowMs);
    for (let i = 0; i < cars.length; i++) {
      const p = track.pose(st.u, i);
      cars[i].position.set(p.x, p.y + .18, p.z);
      cars[i].rotation.set(0, 0, 0); cars[i].rotation.order = 'YXZ';
      cars[i].rotation.y = p.yaw; cars[i].rotation.x = -p.pitch;
    }
    const angle = (nowMs / 1000) * .13;
    wheel.rotation.z = angle;
    gondolas.forEach((g, i) => { const a = i / gondolas.length * Math.PI * 2; g.position.set(Math.cos(a) * F.radius, Math.sin(a) * F.radius, 0); g.rotation.z = -angle; });
    return st;
  }
  void tangent;

  return {
    update,
    status: track.status,
    seat: (nowMs: number) => { const st = track.status(nowMs); const p = track.pose(st.u, 0); return { ...p, phase: st.phase, secondsLeft: st.secondsLeft }; },
    station: STATION,
    exit: { x: STATION.x - 3, z: STATION.z + 2 },
    rideSeconds: track.rideSeconds,
  };
}
export type Park = ReturnType<typeof buildPark>;
