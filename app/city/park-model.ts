// ZION Park — pure track + schedule maths (no rendering), so it can be tested in Node.
import type * as THREE from 'three';
type ThreeNS = typeof THREE;

export const PARK = {
  cx: 63, cz: 63,                 // amusement park centre (free grass cell between the 42/84 roads)
  half: 17,                       // park footprint half-size (used to keep trees/rocks out)
  ferris: { x: -80, z: 22, radius: 11, hub: 13.5 },
};
export const DWELL_S = 18;        // time the train waits at the station for riders
export const LAPS = 3;            // laps per ride
export const CAR_COUNT = 3;
export const CAR_GAP_M = 3.7;
const N = 900;                    // samples per lap

// Control points relative to the park centre: [x, height, z]. u=0 is the head of the station platform.
const CONTROL: [number, number, number][] = [
  [4, 1.2, -11], [11, 2.0, -10], [14.5, 6, -4], [14, 12.5, 3], [11, 17.5, 9], [5, 15, 12.5],
  [-2, 7, 12.5], [-8, 2.6, 9], [-12.5, 5.5, 3], [-12.5, 8.5, -3], [-14, 4.2, -8.2], [-12.5, 1.2, -11], [-8, 1.2, -11],
];

export type TrackModel = ReturnType<typeof makeTrack>;

export function makeTrack(T: ThreeNS) {
  const pts = CONTROL.map(([x, y, z]) => new T.Vector3(PARK.cx + x, y, PARK.cz + z));
  const curve = new T.CatmullRomCurve3(pts, true, 'centripetal');
  curve.arcLengthDivisions = 2400;
  const length = curve.getLength();
  const heights: number[] = [];
  for (let i = 0; i <= N; i++) heights.push(Math.max(1.1, curve.getPointAt((i % N) / N).y));
  let top = 0;
  for (let i = 0; i < N; i++) if (heights[i] > heights[top]) top = i;
  const hMax = heights[top];

  // Speed in m/s at sample i of lap `lap`: chain lift up to the highest point, then gravity-style speed from height.
  const speedAt = (i: number, lap: number) => {
    let v = i <= top ? 5 : Math.min(13.5, Math.max(4.2, 3.1 * Math.sqrt(Math.max(0, hMax - heights[i]) + 1.2)));
    if (lap === LAPS - 1) { const f = Math.min(1, (N - i) / (0.1 * N)); v = 2.4 + (v - 2.4) * f; }   // brake into the station
    return v;
  };
  const cum: number[] = [0];
  for (let k = 0; k < LAPS * N; k++) {
    const lap = Math.floor(k / N), i = k % N;
    cum.push(cum[k] + (length / N) / speedAt(i, lap));
  }
  const rideSeconds = cum[LAPS * N];
  const cycleSeconds = DWELL_S + rideSeconds;

  // Ride time (s) -> position along one lap, 0..1.
  const progress = (tRide: number) => {
    const t = Math.min(Math.max(tRide, 0), rideSeconds);
    let lo = 0, hi = LAPS * N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= t) lo = mid; else hi = mid; }
    const frac = (t - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo]);
    return (((lo + frac) / N) % 1 + 1) % 1;
  };

  // Everyone computes the same train position from the wall clock, so all players see the same ride.
  const status = (nowMs: number) => {
    const tt = ((nowMs / 1000) % cycleSeconds + cycleSeconds) % cycleSeconds;
    if (tt < DWELL_S) return { phase: 'dwell' as const, u: 0, secondsLeft: DWELL_S - tt };
    const tr = tt - DWELL_S;
    return { phase: 'ride' as const, u: progress(tr), secondsLeft: rideSeconds - tr };
  };

  const carU = (u: number, car: number) => (((u - car * CAR_GAP_M / length) % 1) + 1) % 1;
  const pose = (u: number, car = 0) => {
    const uu = carU(u, car), p = curve.getPointAt(uu), t = curve.getTangentAt(uu);
    return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(t.x, t.z), pitch: Math.asin(Math.max(-1, Math.min(1, t.y))) };
  };
  return { curve, length, hMax, rideSeconds, cycleSeconds, status, pose, carU, progress, speedAt, samples: N };
}

export const STATION = { x: PARK.cx - 2, z: PARK.cz - 7.2 };   // boarding spot beside the platform
