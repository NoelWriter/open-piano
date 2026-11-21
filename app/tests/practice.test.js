import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Practice, HIT, MISSED, PENDING, PAST } from '../web/js/core/practice.js';
import { song, TIMING } from './helpers.js';

// right hand: C (0s), E+G chord (1s), D (2s). left hand: C3 (1s)
const S = () => song([[0, 0.5, 60, 0], [1, 0.5, 64, 0], [1.03, 0.5, 67, 0], [2, 0.5, 62, 0], [1, 1, 48, 1]]);

test('wait: time stops at the first unplayed chord', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  assert.equal(p.limit(-1, 0.5), 0);
  assert.ok(p.isWaiting(0));
});

test('wait: right key releases the chord, time runs to the next', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  assert.equal(p.press(60, 0).kind, 'hit');
  assert.equal(p.limit(0, 0.9), 0.9);
  assert.equal(p.limit(0.9, 1.5), 1);
});

test('wait: a chord needs all its notes, in any order within the chord', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  p.press(60, 0);
  assert.equal(p.press(67, 1).kind, 'hit');
  assert.ok(p.isWaiting(1));
  assert.equal(p.press(64, 1).kind, 'hit');
  assert.ok(!p.isWaiting(1));
});

test('wait: keys count up to waitEarly before the chord, not earlier', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  assert.equal(p.press(60, -0.5).kind, 'hit');
  const q = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  assert.equal(q.press(60, -0.7).kind, 'wrong');
});

test('wait: out of order is wrong and does not count', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  assert.equal(p.press(64, 0).kind, 'wrong');      // E belongs to the next chord
  assert.equal(p.status[S().notes.find(n => n.pitch === 64).id], PENDING);
  assert.equal(p.stats.wrong, 1);
});

test('wait: the other hand is never wrong', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  p.press(60, 0);
  assert.equal(p.press(48, 1).kind, 'free');
});

test('wait: a repeated pitch needs a new press', () => {
  const p = new Practice(song([[0, 0.5, 60], [1, 0.5, 60]]), { timing: TIMING });
  assert.equal(p.press(60, 0).kind, 'hit');
  assert.ok(p.isWaiting(1));
  assert.equal(p.press(60, 1).kind, 'hit');
});

test('seek back makes later notes unplayed again; earlier notes are past', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  p.press(60, 0); p.press(64, 1); p.press(67, 1);
  p.reset(0.5);
  const s = S();
  assert.equal(p.status[s.notes.find(n => n.pitch === 60).id], PAST);
  assert.equal(p.status[s.notes.find(n => n.pitch === 64).id], PENDING);
  assert.equal(p.limit(0.5, 2), 1);
});

test('play: time never stops; hits within the window, nearest first', () => {
  const p = new Practice(S(), { parts: new Set([0]), mode: 'play', timing: TIMING });
  assert.equal(p.limit(0, 5), 5);
  assert.equal(p.press(60, 0.25).kind, 'hit');
  assert.equal(p.press(62, 1.6).kind, 'wrong');     // 0.4 s early: outside the window
  assert.equal(p.press(62, 1.75).kind, 'hit');
});

test('play: notes let pass are missed; accuracy', () => {
  const p = new Practice(S(), { parts: new Set([0]), mode: 'play', timing: TIMING });
  p.press(60, 0);
  p.update(3);
  const s = S();
  assert.equal(p.status[s.notes.find(n => n.pitch === 64).id], MISSED);
  assert.equal(p.status[s.notes.find(n => n.pitch === 60).id], HIT);
  assert.equal(p.stats.missed, 3);
  assert.equal(p.accuracy, 0.25);
});

test('changing parts re-plans the chords', () => {
  const p = new Practice(S(), { parts: new Set([0]), timing: TIMING });
  p.setParts([1], -1);
  assert.equal(p.limit(-1, 5), 1);
  assert.equal(p.press(48, 1).kind, 'hit');
  assert.equal(p.limit(1, 5), 5);
});
