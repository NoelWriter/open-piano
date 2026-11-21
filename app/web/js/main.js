/**
 * Composition root: creates the modules, owns the app state, routes input, runs the frame loop.
 * All decisions live in core/; this file only connects things.
 */
import { SPEEDS, TIMING } from './config.js';
import { Practice } from './core/practice.js';
import { Transport } from './core/transport.js';
import { Accompaniment } from './core/accompaniment.js';
import { Midi } from './io/midi.js';
import { PcBridge } from './io/pc-bridge.js';
import { listSongs, loadSong } from './io/api.js';
import { Renderer, partColor } from './ui/renderer.js';
import { Timeline } from './ui/timeline.js';
import { Gestures } from './ui/gestures.js';
import { Toolbar } from './ui/toolbar.js';
import { Picker, FinishedCard } from './ui/picker.js';
import * as storage from './util/storage.js';

const $ = id => document.getElementById(id);

// ---------- state ----------
const st = {
  file: null,
  song: null,
  practice: null,
  transport: null,
  accomp: null,
  pressed: new Map(),          // pitch -> {kind, color}: keys you are holding
  bursts: [],
  scrub: { active: false, resume: false },
  accompaniment: storage.load('global', { accompaniment: true }).accompaniment,
};

// ---------- devices ----------
const midi = new Midi().start();
const pc = new PcBridge().start();
for (const source of [midi, pc]) {
  source.on('noteon', e => noteOn(e.pitch));
  source.on('noteoff', e => noteOff(e.pitch));
}

// ---------- actions ----------
const app = {
  async open(file) {
    let song;
    try {
      song = await loadSong(file);
    } catch (e) {
      alert(e.message);
      return app.openPicker();
    }
    stopAccompaniment();
    const saved = storage.load('song:' + file, { speed: 1, mode: 'wait', parts: null, loop: null });
    const valid = (saved.parts ?? []).filter(i => i < song.parts.length);
    st.file = file;
    st.song = song;
    st.practice = new Practice(song, {
      mode: saved.mode === 'play' ? 'play' : 'wait',
      parts: new Set(valid.length ? valid : song.parts.map((_, i) => i)),
    });
    st.transport = new Transport(song.duration);
    st.transport.speed = SPEEDS.includes(saved.speed) ? saved.speed : 1;
    st.transport.loop = saved.loop;
    st.accomp = new Accompaniment(song);
    renderer.setSong(song);
    finished.hide();
    seekTo(st.transport.start);
  },
  list: listSongs,
  openPicker: () => picker.open(!!st.song),

  play() {
    if (!st.song) return;
    finished.hide();
    const wasFinished = st.transport.finished;
    st.transport.play();
    if (wasFinished) seekTo(st.transport.time);
  },
  pause() {
    st.transport?.pause();
    stopAccompaniment();
  },
  togglePlay: () => (st.transport?.playing ? app.pause() : app.play()),
  restart() {
    if (!st.song) return;
    finished.hide();
    seekTo(st.transport.start);
  },

  // scrolling: pause while the notes are under your finger, resume afterwards
  scrubStart() {
    if (!st.song || st.scrub.active) return;
    st.scrub = { active: true, resume: st.transport.playing };
    app.pause();
  },
  scrub: t => seekTo(t),
  scrubEnd() {
    if (!st.scrub.active) return;
    const resume = st.scrub.resume;
    st.scrub = { active: false, resume: false };
    if (resume) app.play();
  },

  toggleLoop() {
    if (!st.song) return;
    const tr = st.transport, bars = st.song.bars;
    if (tr.loop) tr.loop = null;
    else {
      const i = st.song.barAt(Math.max(0, tr.time));
      tr.loop = { start: bars[i] ?? 0, end: bars[i + 4] ?? st.song.duration };
    }
    persist();
  },
  setLoop(loop) { st.transport.loop = loop; persist(); },
  setSpeed(speed) { if (st.transport) { st.transport.speed = speed; persist(); } },
  setMode(mode) {
    if (!st.practice) return;
    st.practice.setMode(mode, st.transport.time);
    persist();
  },
  setParts(ids) {
    stopAccompaniment();
    st.practice.setParts(ids, st.transport.time);
    persist();
  },
  toggleAccompaniment() {
    st.accompaniment = !st.accompaniment;
    if (!st.accompaniment) stopAccompaniment();
    storage.save('global', { accompaniment: st.accompaniment });
  },

  command(cmd) {
    if (!st.song) return;
    const { bars } = st.song, t = st.transport.time, i = st.song.barAt(Math.max(0, t));
    if (cmd === 'bar-back') seekTo(t - bars[i] > 0.3 ? bars[i] : bars[Math.max(0, i - 1)]);
    if (cmd === 'bar-forward') seekTo(bars[i + 1] ?? st.song.duration);
    if (cmd === 'restart') app.restart();
    if (cmd === 'loop') app.toggleLoop();
    if (cmd === 'faster' || cmd === 'slower') {
      const j = SPEEDS.indexOf(st.transport.speed) + (cmd === 'faster' ? 1 : -1);
      app.setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, j))]);
    }
  },

  keyDown: p => noteOn(p),
  keyUp: p => noteOff(p),
  keyAt: (x, y) => renderer.keyAtPoint(x, y),
  time: () => st.transport?.time ?? 0,
};

function seekTo(t) {
  if (!st.song) return;
  const time = st.transport.seek(t);
  st.practice.reset(time);
  stopAccompaniment();
}

function stopAccompaniment() {
  if (!st.accomp) return;
  for (const e of st.accomp.stopAll()) midi.noteOff(e.note.pitch);
}

function persist() {
  if (!st.file) return;
  storage.save('song:' + st.file, {
    speed: st.transport.speed, mode: st.practice.mode, parts: [...st.practice.parts], loop: st.transport.loop,
  });
}

const autoParts = () => new Set(st.song.parts.map((_, i) => i).filter(i => !st.practice.parts.has(i)));

// ---------- input ----------
function noteOn(pitch) {
  if (!st.song) { st.pressed.set(pitch, { kind: 'free', color: null }); return; }
  const { practice, transport } = st;
  const t = transport.time;
  // paused at a chord? playing the right key carries on
  if (!transport.playing && !st.scrub.active && practice.isWaiting(t)
      && practice.pendingChord()?.notes.some(n => n.pitch === pitch)) app.play();

  const res = transport.playing ? practice.press(pitch, t) : { kind: 'free' };
  let color = res.note ? partColor(res.note.part) : null;
  if (res.kind === 'free') {
    for (const n of st.song.notesBetween(t - 0.3, t + 0.3)) if (n.pitch === pitch) color = partColor(n.part);
  }
  st.pressed.set(pitch, { kind: res.kind, color });
  if (res.kind === 'hit') st.bursts.push({ pitch, color, t0: performance.now() });
}

function noteOff(pitch) { st.pressed.delete(pitch); }

// ---------- views ----------
const renderer = new Renderer($('notes'));
const timeline = new Timeline($('timeline'), {
  seek: t => seekTo(t), scrubStart: app.scrubStart, scrubEnd: app.scrubEnd, setLoop: app.setLoop,
});
const toolbar = new Toolbar(app);
const gestures = new Gestures($('notes'), app);
const picker = new Picker(app);
const finished = new FinishedCard(app);

addEventListener('resize', () => { renderer.resize(); timeline.resize(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) app.pause(); });

function status() {
  const names = [...midi.inputs, ...pc.inputs.map(n => n + ' (PC)')];
  if (names.length) return { text: names.join(', '), ok: true };
  return { text: midi.error || (midi.available ? 'Connect your piano' : 'Open in Web MIDI Browser'), ok: false };
}

const clock = s => {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

// ---------- frame loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  gestures.step(dt);

  if (st.song) {
    const r = st.transport.tick(dt, (a, b) => st.practice.limit(a, b));
    if (r) {
      const events = st.accomp.advance(r.from, r.to, autoParts());
      if (st.accompaniment) {
        for (const e of events) e.type === 'on' ? midi.noteOn(e.note.pitch, e.note.vel) : midi.noteOff(e.note.pitch);
      }
      st.practice.update(r.to);
      if (r.wrapTo != null) seekTo(r.wrapTo);
      if (r.ended) {
        stopAccompaniment();
        finished.show({ mode: st.practice.mode, accuracy: st.practice.accuracy, ...st.practice.stats });
      }
    }
  }
  st.bursts = st.bursts.filter(b => now - b.t0 < 600);

  const time = st.transport?.time ?? 0;
  renderer.draw({ song: st.song, practice: st.practice, time, now, playing: !!st.transport?.playing, pressed: st.pressed, bursts: st.bursts });
  timeline.draw({ song: st.song, time, loop: st.transport?.loop ?? null });
  toolbar.render({
    song: st.song, playing: !!st.transport?.playing, loop: st.transport?.loop, speed: st.transport?.speed ?? 1,
    mode: st.practice?.mode ?? 'wait', parts: st.practice?.parts ?? new Set(),
    accompaniment: st.accompaniment, hasOutput: midi.hasOutput, status: status(),
  });
  const clockText = st.song ? `${clock(time)} / ${clock(st.song.duration)}` : '';
  if ($('clock').textContent !== clockText) $('clock').textContent = clockText;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

picker.open(false);

// for debugging in the browser console
window.pianoTrainer = { st, app, midi, TIMING };
