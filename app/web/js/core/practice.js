/**
 * The practice engine: which notes you have played, whether the song must wait for you, and the score.
 * Pure logic: no DOM, no clock. Times are song seconds.
 *
 * Modes
 *  - 'wait': the song stops when the next chord of your parts reaches the line. A key counts if it is in
 *            that chord and pressed at most `waitEarly` before it. Chords must be played in order.
 *  - 'play': time never stops. A key counts within [start - playEarly, start + playLate] of a note of
 *            that pitch, nearest first; notes left unplayed after the window are missed.
 */
import { TIMING } from '../config.js';

export const PENDING = 0, HIT = 1, MISSED = 2, PAST = 3;
const EPS = 1e-6;

export class Practice {
  /**
   * @param {import('./song.js').Song} song
   * @param {{parts?: Set<number>, mode?: 'wait'|'play', timing?: typeof TIMING}} [opts]
   */
  constructor(song, { parts, mode = 'wait', timing = TIMING } = {}) {
    this.song = song;
    this.timing = timing;
    this.mode = mode;
    this.parts = parts ?? new Set(song.parts.map((_, i) => i));
    this.status = new Uint8Array(song.notes.length);
    this.reset(-Infinity);
  }

  setParts(parts, t) { this.parts = new Set(parts); this.reset(t); }
  setMode(mode, t) { this.mode = mode; this.reset(t); }

  isPracticed(note) { return this.parts.has(note.part); }

  /** Forget everything from time t on: those notes become unplayed again. Earlier notes become "past". */
  reset(t) {
    this.chords = this.song.chords(this.parts, this.timing.chord);
    for (const n of this.song.notes) this.status[n.id] = n.start >= t - EPS ? PENDING : PAST;
    this.ci = lowerBound(this.chords, t - EPS);
    this.missIndex = this.song.firstAtOrAfter(t - EPS);
    this.stats = { hits: 0, missed: 0, wrong: 0 };
  }

  /** The chord the song is waiting for (wait mode), skipping chords already completed. */
  pendingChord() {
    while (this.ci < this.chords.length && this.chords[this.ci].notes.every(n => this.status[n.id] !== PENDING)) this.ci++;
    return this.chords[this.ci] ?? null;
  }

  /** How far time may move from t0 towards t1. In wait mode it stops at an unplayed chord. */
  limit(t0, t1) {
    if (this.mode !== 'wait') return t1;
    const c = this.pendingChord();
    return c && t1 >= c.start ? Math.max(t0, c.start) : t1;
  }

  /** True while the song is held at a chord. */
  isWaiting(t) {
    if (this.mode !== 'wait') return false;
    const c = this.pendingChord();
    return !!c && t >= c.start - EPS;
  }

  /** Advance bookkeeping to time t (play mode: mark notes you let pass as missed). */
  update(t) {
    if (this.mode !== 'play') return;
    const notes = this.song.notes;
    while (this.missIndex < notes.length && notes[this.missIndex].start + this.timing.playLate < t) {
      const n = notes[this.missIndex++];
      if (this.isPracticed(n) && this.status[n.id] === PENDING) {
        this.status[n.id] = MISSED;
        this.stats.missed++;
      }
    }
  }

  /**
   * A key went down at time t.
   * @returns {{kind: 'hit'|'wrong'|'free', note?: import('./song.js').Note}}
   *   hit: it was the right key; free: a key that is fine to play (the other hand's note, or nothing due);
   *   wrong: a mistake.
   */
  press(pitch, t) {
    const note = this.mode === 'wait' ? this.#matchWait(pitch, t) : this.#matchPlay(pitch, t);
    if (note) {
      this.status[note.id] = HIT;
      this.stats.hits++;
      return { kind: 'hit', note };
    }
    if (this.#otherPartSounds(pitch, t)) return { kind: 'free' };
    if (this.mode === 'wait' && !this.pendingChord()) return { kind: 'free' };   // song over
    this.stats.wrong++;
    return { kind: 'wrong' };
  }

  #matchWait(pitch, t) {
    const c = this.pendingChord();
    if (!c || c.start - t > this.timing.waitEarly) return null;
    return c.notes.find(n => n.pitch === pitch && this.status[n.id] === PENDING) ?? null;
  }

  #matchPlay(pitch, t) {
    let best = null;
    for (const n of this.song.notesBetween(t - this.timing.playLate, t + this.timing.playEarly)) {
      if (n.pitch !== pitch || !this.isPracticed(n) || this.status[n.id] !== PENDING) continue;
      if (n.start < t - this.timing.playLate || n.start > t + this.timing.playEarly) continue;
      if (!best || Math.abs(n.start - t) < Math.abs(best.start - t)) best = n;
    }
    return best;
  }

  #otherPartSounds(pitch, t) {
    for (const n of this.song.notesBetween(t - this.timing.playLate, t + this.timing.waitEarly)) {
      if (n.pitch === pitch && !this.isPracticed(n)) return true;
    }
    return false;
  }

  /** Score over the notes of your parts that have been decided (hit or missed). */
  get accuracy() {
    const decided = this.stats.hits + this.stats.missed;
    return decided ? this.stats.hits / decided : null;
  }
}

function lowerBound(chords, t) {
  let lo = 0, hi = chords.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (chords[mid].start < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}
