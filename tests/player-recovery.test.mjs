import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './player-fixture.mjs';
test('long outage retains intent and keeps a low-frequency recovery probe', () => {
  const f = fixture(); f.run('togglePlay()');
  for (let i=0; i<9; i++) {
    f.audio.error = { code: 4 }; f.events.get('error')(); f.advance(16000);
  }
  assert.equal(f.run('userWantsPlayback'), true);
  assert.ok(f.audio.plays > 6);
  f.audio.error = null; f.audio.currentTime = 1; f.events.get('playing')();
  assert.equal(f.run('playerState'), 'playing');
  assert.equal(f.run('reconnectAttempts'), 0);
});

test('manual retry clears a failed media source without reloading the page', () => {
  const f=fixture(); f.audio.error={code:4}; f.run("playerState='error'; togglePlay()");
  assert.equal(f.audio.loads, 1); assert.match(f.audio.src, /\?cb=/);
  assert.equal(f.audio.error, null); assert.equal(f.audio.plays,1);
});

test('a superseded play rejection cannot cancel a newer attempt', () => {
  const f=fixture(); f.run('togglePlay(); retryPlayback()');
  f.audio.rejections[0]();
  assert.equal(f.run('userWantsPlayback'),true);
  assert.notEqual(f.run('connectTimer'),null);
  assert.equal(f.run('reconnectTimer'),null);
});

test('cancel prevents delayed retry and late playing events from restarting audio', () => {
  const f=fixture(); f.run('togglePlay()'); f.audio.error={code:4}; f.events.get('error')();
  f.run('togglePlay()'); f.advance(60000);
  assert.equal(f.audio.plays,1); assert.equal(f.run('userWantsPlayback'),false);
  f.events.get('playing')(); assert.equal(f.audio.paused,true);
});

test('error-driven iOS pause retains recovery intent and error status', () => {
  const f=fixture(true); f.run("userWantsPlayback=true; playerState='playing'");
  f.audio.error={code:4}; f.audio.paused=true; f.events.get('pause')();
  assert.equal(f.run('userWantsPlayback'),true);
  f.run("userWantsPlayback=false; setPlayerState('error')"); f.events.get('pause')();
  assert.equal(f.run('playerState'),'error');
});

test('offline Play preserves intent and online starts a fresh stream', () => {
  const f=fixture(); f.context.navigator.onLine=false; f.run('togglePlay()');
  assert.equal(f.run('userWantsPlayback'),true); assert.equal(f.audio.plays,0);
  f.context.navigator.onLine=true; f.windowEvents.get('online')();
  assert.equal(f.audio.loads,1); assert.equal(f.audio.plays,1);
});

test('progress events without advancing media time cannot hide a stall', () => {
  const f=fixture(); f.run('togglePlay()'); const before=f.run('lastHealthyAt');
  f.advance(1000); f.events.get('progress')(); assert.equal(f.run('lastHealthyAt'),before);
  f.audio.currentTime=1; f.events.get('timeupdate')(); assert.ok(f.run('lastHealthyAt')>before);
});

test('autoplay permission rejection waits for a new user gesture', () => {
  const f=fixture();f.run('togglePlay()');
  f.audio.rejections[0]({name:'NotAllowedError'});f.advance(60000);
  assert.equal(f.audio.plays,1);assert.equal(f.run('userWantsPlayback'),false);
  assert.equal(f.run('playerState'),'error');
});
