import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIceServers, hasTurn } from '../lib/ice-servers.ts';

test('STUN only by default', () => {
  const s = buildIceServers({});
  assert.ok(s.length >= 1); assert.equal(hasTurn(s), false);
});
test('TURN added from simple env vars', () => {
  const s = buildIceServers({ TURN_URLS: 'turn:t.example.com:3478, turns:t.example.com:443?transport=tcp', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'c' });
  assert.equal(hasTurn(s), true);
  const turn = s.find(x => x.username === 'u');
  assert.deepEqual(turn.urls, ['turn:t.example.com:3478', 'turns:t.example.com:443?transport=tcp']);
});
test('TURN env ignored when credentials are missing or URLs are not turn:', () => {
  assert.equal(hasTurn(buildIceServers({ TURN_URLS: 'turn:x:3478' })), false);
  assert.equal(hasTurn(buildIceServers({ TURN_URLS: 'http://evil', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'c' })), false);
});
test('ICE_SERVERS_JSON is accepted, validated, and bad JSON cannot break calls', () => {
  const ok = buildIceServers({ ICE_SERVERS_JSON: JSON.stringify([{ urls: ['turn:a:3478'], username: 'u', credential: 'p' }, { urls: 'javascript:alert(1)' }, 5]) });
  assert.equal(ok.filter(x => x.username === 'u').length, 1);
  assert.equal(ok.some(x => String(x.urls).includes('javascript')), false);
  assert.ok(buildIceServers({ ICE_SERVERS_JSON: '{not json' }).length >= 1);
});
