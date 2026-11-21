import { Song } from '../web/js/core/song.js';

/** Build a song from [start, dur, pitch, part] rows; parts default to right (0) and left (1). */
export function song(rows, tracks = ['Right hand', 'Left hand'], bars) {
  return Song.fromJSON({ tracks, notes: rows.map(([s, d, p, part = 0]) => [s, d, p, part, 80]), bars });
}

export const TIMING = { waitEarly: 0.6, playEarly: 0.3, playLate: 0.3, chord: 0.08, leadIn: 2, loopLeadIn: 1 };
