// Every tunable number in one place.
export const TIMING = {
  waitEarly: 0.6,      // Wait mode: a key counts up to this many seconds before its chord reaches the line
  playEarly: 0.3,      // Play-along: window before a note...
  playLate: 0.3,       // ...and after it
  chord: 0.08,         // notes starting this close together form one chord
  leadIn: 2,           // seconds before the first note when starting
  loopLeadIn: 1,       // seconds before the loop start when looping back
};

export const SPEEDS = [0.25, 0.5, 0.75, 0.9, 1, 1.25, 1.5];

export const VIEW = {
  pixelsPerSecond: 190,
  minKeys: 25,         // show at least two octaves
  flingFriction: 4,    // per second; higher stops a fling sooner
  maxFling: 6,         // song seconds per second at most
  burstMs: 380,
};

export const HAND_COLORS = ['#5b9dff', '#ff9a5c', '#b48cff', '#46d39a', '#ff6f91', '#f2c14e'];

// The piano's own materials: lacquer black, ivory, brass lettering, the red felt strip behind the keys.
export const PALETTE = {
  ground: '#0e0d0c', laneBlack: '#0a0908', line: '#1e1c1a', bar: '#2c2926', barText: '#5f5951',
  ink: '#f1ede4', muted: '#9a948a', accent: '#c9a45c', error: '#ff5a4f', missed: '#3b3835', free: '#d8d2c6',
  felt: '#7c2427', feltLit: '#a8383a', ivory: '#f4efe4', ivoryShade: '#ddd6c7',
};

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
