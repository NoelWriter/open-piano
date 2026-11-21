import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transport } from '../web/js/core/transport.js';
import { Accompaniment } from '../web/js/core/accompaniment.js';
import { keyboardLayout, rangeFor, keyAt, isBlack } from '../web/js/ui/layout.js';
import { song, TIMING } from './helpers.js';

test('transport: speed, limit, end', () => {
  const tr = new Transport(10, TIMING);
  assert.equal(tr.time, -2);
  assert.equal(tr.tick(1), null);                  // paused
  tr.play(); tr.speed = 0.5;
  assert.deepEqual(tr.tick(1), { from: -2, to: -1.5 });
  assert.equal(tr.tick(10, () => 0).to, 0);        // held by the wait gate
  tr.seek(10.4);
  assert.ok(tr.tick(1).ended);
  assert.equal(tr.playing, false);
  tr.play();
  assert.equal(tr.time, -2);                       // play after the end restarts
});

test('transport: loop wraps to before its start', () => {
  const tr = new Transport(30, TIMING);
  tr.loop = { start: 4, end: 8 };
  tr.seek(7.9); tr.play();
  assert.deepEqual(tr.tick(0.5), { from: 7.9, to: 8, wrapTo: 3 });
});

test('accompaniment: note on and off crossing the interval, stop on seek back', () => {
  const s = song([[0, 1, 48, 1], [0.5, 0.2, 50, 1], [0, 1, 72, 0]]);
  const a = new Accompaniment(s);
  const left = new Set([1]);
  assert.deepEqual(a.advance(-0.1, 0.6, left).map(e => [e.type, e.note.pitch]), [['on', 48], ['on', 50]]);
  assert.deepEqual(a.advance(0.6, 1.2, left).map(e => [e.type, e.note.pitch]), [['off', 50], ['off', 48]]);
  a.advance(-0.1, 0.1, left);
  assert.deepEqual(a.advance(0.1, -1, left).map(e => [e.type, e.note.pitch]), [['off', 48]]);
});

test('layout: range ends on white keys, black keys sit between whites', () => {
  const { lo, hi } = rangeFor(61, 63, 25);
  assert.ok(!isBlack(lo) && !isBlack(hi) && hi - lo + 1 >= 25);
  const l = keyboardLayout(60, 72, 800);
  assert.equal(l.whiteW, 100);
  assert.equal(l.keys[61].x + l.keys[61].w / 2, 100);   // C# centred on the C|D border
  assert.equal(keyAt(l, 99, 0.3), 61);
  assert.equal(keyAt(l, 99, 0.9), 60);
});
