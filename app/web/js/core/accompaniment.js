/**
 * The parts you are not practising, played for you: which notes start and stop between two times.
 * Pure; the caller sends the events to a MIDI output (or ignores them).
 */
export class Accompaniment {
  /** @param {import('./song.js').Song} song */
  constructor(song) {
    this.song = song;
    this.sounding = new Map();   // note id -> note
  }

  /**
   * Notes of `parts` crossing into (t0, t1]: note-ons for starts, note-offs for ends.
   * Going backwards (t1 < t0) stops everything.
   * @returns {{type:'on'|'off', note: import('./song.js').Note}[]}
   */
  advance(t0, t1, parts) {
    if (t1 < t0) return this.stopAll();
    const events = [];
    for (const n of this.song.notesBetween(t0, t1)) {
      if (!parts.has(n.part)) continue;
      if (n.start > t0 && n.start <= t1 && !this.sounding.has(n.id)) {
        this.sounding.set(n.id, n);
        events.push({ type: 'on', note: n, at: n.start });
      }
    }
    for (const n of this.sounding.values()) {
      if (n.end <= t1) {
        this.sounding.delete(n.id);
        events.push({ type: 'off', note: n, at: n.end });
      }
    }
    return events.sort((a, b) => a.at - b.at);
  }

  stopAll() {
    const events = [...this.sounding.values()].map(note => ({ type: 'off', note, at: 0 }));
    this.sounding.clear();
    return events;
  }
}
