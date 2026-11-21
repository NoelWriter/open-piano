/**
 * The song model: notes split into parts (usually the two hands), sorted, indexed for fast lookup.
 *
 * @typedef {{id:number, start:number, dur:number, end:number, pitch:number, part:number, vel:number}} Note
 * @typedef {{name:string, hand:'right'|'left'|null}} Part
 */
const GENERIC = /^(track|piano|staff|instrument|acoustic grand piano)?\s*\d*$/i;
const MIDDLE_C = 60;

export class Song {
  /** @param {{tracks:string[], notes:number[][], bars?:number[], duration?:number}} data  server JSON */
  static fromJSON(data, title = '') {
    let notes = data.notes.map(([start, dur, pitch, track, vel = 80]) => ({ start, dur, pitch, part: track, vel }));
    let parts = data.tracks.map(name => ({ name, hand: handFromName(name) }));

    if (parts.length === 1) {
      // one track holds both hands: split at middle C, as most piano tutors do
      notes = notes.map(n => ({ ...n, part: n.pitch >= MIDDLE_C ? 0 : 1 }));
      parts = [{ name: 'Right hand', hand: 'right' }, { name: 'Left hand', hand: 'left' }];
    } else if (parts.length === 2 && !(parts[0].hand && parts[1].hand)) {
      const named = parts.findIndex(p => p.hand);
      if (named >= 0) {
        // one track says which hand it is: the other one is the other hand
        const other = 1 - named;
        parts[other] = parts[named].hand === 'right'
          ? { name: 'Left hand', hand: 'left' } : { name: 'Right hand', hand: 'right' };
        parts[named] = parts[named].hand === 'right'
          ? { name: 'Right hand', hand: 'right' } : { name: 'Left hand', hand: 'left' };
      } else if (parts.every(p => GENERIC.test(p.name.trim()))) {
        // two unnamed tracks are the two hands: the higher one is the right hand
        const right = averagePitch(notes, 0) >= averagePitch(notes, 1) ? 0 : 1;
        parts[right] = { name: 'Right hand', hand: 'right' };
        parts[1 - right] = { name: 'Left hand', hand: 'left' };
      }
    }
    return new Song(title, parts, notes, data.bars ?? [], data.duration);
  }

  constructor(title, parts, notes, bars, duration) {
    this.title = title;
    this.parts = parts;
    /** @type {Note[]} sorted by start, then pitch */
    this.notes = notes
      .map(n => ({ ...n, end: n.start + n.dur }))
      .sort((a, b) => a.start - b.start || a.pitch - b.pitch)
      .map((n, id) => ({ ...n, id }));
    this.duration = duration ?? Math.max(0, ...this.notes.map(n => n.end));
    this.bars = bars.length ? bars : evenBars(this.duration);
    this.maxDur = Math.max(0, ...this.notes.map(n => n.dur));
    const pitches = this.notes.map(n => n.pitch);
    this.lowest = pitches.length ? Math.min(...pitches) : 60;
    this.highest = pitches.length ? Math.max(...pitches) : 72;
  }

  /** Index of the first note starting at or after t. */
  firstAtOrAfter(t) {
    let lo = 0, hi = this.notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.notes[mid].start < t) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  /** Notes that overlap [t0, t1]. */
  *notesBetween(t0, t1) {
    const end = this.firstAtOrAfter(t1 + 1e-9);
    for (let i = this.firstAtOrAfter(t0 - this.maxDur); i < end; i++) {
      if (this.notes[i].end >= t0) yield this.notes[i];
    }
  }

  /** Start of the bar containing t (or the first bar). */
  barAt(t) {
    let i = 0;
    while (i + 1 < this.bars.length && this.bars[i + 1] <= t + 1e-6) i++;
    return i;
  }

  /** Group the notes of the given parts into chords (notes starting within `window` of the first). */
  chords(partIds, window) {
    const chords = [];
    for (const n of this.notes) {
      if (!partIds.has(n.part)) continue;
      const last = chords[chords.length - 1];
      if (last && n.start - last.start < window) last.notes.push(n);
      else chords.push({ start: n.start, notes: [n] });
    }
    return chords;
  }

  /** Two parts that are the two hands. */
  get hands() {
    const right = this.parts.findIndex(p => p.hand === 'right');
    const left = this.parts.findIndex(p => p.hand === 'left');
    return right >= 0 && left >= 0 && this.parts.length === 2 ? { right, left } : null;
  }
}

function handFromName(name) {
  if (/\b(right|rh|r\.h\.|treble|upper)\b/i.test(name)) return 'right';
  if (/\b(left|lh|l\.h\.|bass|lower)\b/i.test(name)) return 'left';
  return null;
}

function averagePitch(notes, part) {
  const ps = notes.filter(n => n.part === part).map(n => n.pitch);
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
}

function evenBars(duration) {
  const bars = [];
  for (let t = 0; t <= duration; t += 2) bars.push(t);  // 4/4 at 120 bpm
  return bars;
}
