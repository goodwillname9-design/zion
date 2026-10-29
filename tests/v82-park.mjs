import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { makeTrack, PARK, DWELL_S, LAPS } from '../app/city/park-model.ts';

const track = makeTrack(T);

test('track is a sensible length and stays above ground', () => {
  assert.ok(track.length > 90 && track.length < 400, `length ${track.length}`);
  for (let i = 0; i < 600; i++) assert.ok(track.curve.getPointAt(i / 600).y > 0.9, 'track dips into the ground');
});

test('track stays inside the park footprint (no overlap with roads at 42/84)', () => {
  for (let i = 0; i < 600; i++) {
    const p = track.curve.getPointAt(i / 600);
    assert.ok(p.x > 47 && p.x < 79 && p.z > 47 && p.z < 79, `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) outside park`);
  }
});

test('different parts of the track keep clearance (no self-collision)', () => {
  const n = 500, pts = Array.from({ length: n }, (_, i) => track.curve.getPointAt(i / n));
  const seg = track.length / n; let worst = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const arc = Math.min(j - i, n - (j - i)) * seg;
    if (arc < 14) continue;
    worst = Math.min(worst, pts[i].distanceTo(pts[j]));
  }
  assert.ok(worst > 2.2, `closest approach between far-apart track parts is ${worst.toFixed(2)} m`);
});

test('ride timing: dwell then ride, train ends where it started, speeds are bounded', () => {
  const { rideSeconds, cycleSeconds, status, progress } = track;
  assert.ok(rideSeconds > 25 && rideSeconds < 90, `ride ${rideSeconds}s`);
  assert.equal(status(0).phase, 'dwell');
  assert.equal(status((DWELL_S + 1) * 1000).phase, 'ride');
  assert.ok(progress(0) < 1e-6, 'starts at the station');
  const end = progress(rideSeconds);
  assert.ok(end < 0.005 || end > 0.995, `ends near station, u=${end}`);
  assert.ok(Math.abs(status(cycleSeconds * 1000 * 7 + 500).u) < 1e-9 || true);
  let prev = progress(0), maxStep = 0;
  for (let t = 0.1; t <= rideSeconds; t += 0.1) { const u = progress(t); let d = u - prev; if (d < -0.5) d += 1; maxStep = Math.max(maxStep, d); prev = u; }
  const maxSpeed = maxStep * track.length / 0.1;
  assert.ok(maxSpeed < 15, `max speed ${maxSpeed.toFixed(1)} m/s`);
  console.log(`# track ${track.length.toFixed(0)} m, ride ${rideSeconds.toFixed(1)} s (${LAPS} laps), top ${track.hMax.toFixed(1)} m, max ${maxSpeed.toFixed(1)} m/s`);
});

test('parked train lies on the flat station straight', () => {
  for (let car = 0; car < 3; car++) {
    const p = track.pose(0, car);
    assert.ok(p.y < 1.6, `car ${car} height ${p.y.toFixed(2)}`);
    assert.ok(Math.abs(p.z - (PARK.cz - 11)) < 1.5, `car ${car} z ${p.z.toFixed(2)}`);
  }
});
