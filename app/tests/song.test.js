import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Song } from '../web/js/core/song.js';
import { song } from './helpers.js';

test('one track is split into hands at middle C', () => {
  const s = Song.fromJSON({ tracks: ['Piano'], notes: [[0, 1, 72, 0], [0, 1, 48, 0], [1, 1, 60, 0]] });
  assert.deepEqual(s.parts.map(p => p.name), ['Right hand', 'Left hand']);
  assert.deepEqual(s.notes.map(n => [n.pitch, n.part]), [[48, 1], [72, 0], [60, 0]]);
});

test('two generic tracks are named by pitch', () => {
  const s = Song.fromJSON({ tracks: ['Track 1', 'Track 2'], notes: [[0, 1, 40, 0], [0, 1, 76, 1]] });
  assert.deepEqual(s.parts.map(p => p.name), ['Left hand', 'Right hand']);
  assert.deepEqual(s.hands, { right: 1, left: 0 });
});

test('one hand-labelled track gives the other its hand', () => {
  const s = Song.fromJSON({ tracks: ['Piano RH', 'Track 2'], notes: [[0, 1, 76, 0], [0, 1, 40, 1]] });
  assert.deepEqual(s.parts.map(p => p.name), ['Right hand', 'Left hand']);
});

test('named tracks keep their names', () => {
  const s = Song.fromJSON({ tracks: ['Violin', 'Cello'], notes: [[0, 1, 76, 0], [0, 1, 40, 1]] });
  assert.deepEqual(s.parts.map(p => p.name), ['Violin', 'Cello']);
  assert.equal(s.hands, null);
});

test('notesBetween finds long notes that started earlier', () => {
  const s = song([[0, 10, 60], [5, 1, 62], [20, 1, 64]]);
  assert.deepEqual([...s.notesBetween(7, 8)].map(n => n.pitch), [60]);
  assert.deepEqual([...s.notesBetween(4, 6)].map(n => n.pitch), [60, 62]);
  assert.deepEqual([...s.notesBetween(19, 30)].map(n => n.pitch), [64]);
});

test('chords group notes starting within the window, per part set', () => {
  const s = song([[0, 1, 60, 0], [0.05, 1, 64, 0], [0.02, 1, 48, 1], [1, 1, 62, 0]]);
  assert.deepEqual(s.chords(new Set([0]), 0.08).map(c => c.notes.map(n => n.pitch)), [[60, 64], [62]]);
  assert.deepEqual(s.chords(new Set([0, 1]), 0.08).map(c => c.notes.length), [3, 1]);
});

test('barAt', () => {
  const s = song([[0, 1, 60]], undefined, [0, 2, 4, 6]);
  assert.equal(s.barAt(-1), 0);
  assert.equal(s.barAt(3.9), 1);
  assert.equal(s.barAt(4), 2);
});
