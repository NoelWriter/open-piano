/**
 * The controls in the bar. Binds DOM events to app actions and renders app state into the DOM.
 * Only touches the DOM when a value actually changes.
 */
import { SPEEDS } from '../config.js';
import { partColor } from './renderer.js';

const $ = id => document.getElementById(id);
const PLAY_ICON = 'M8 5.5v13l10.5-6.5z';
const PAUSE_ICON = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z';

export class Toolbar {
  /**
   * @param {object} app  actions: openPicker, togglePlay, restart, toggleLoop, setSpeed, setMode, setParts, toggleAccompaniment
   */
  constructor(app) {
    this.app = app;
    this.last = {};
    $('songButton').onclick = () => app.openPicker();
    $('play').onclick = () => app.togglePlay();
    $('restart').onclick = () => app.restart();
    $('loop').onclick = () => app.toggleLoop();
    $('accomp').onclick = () => app.toggleAccompaniment();
    const speed = $('speed');
    for (const s of SPEEDS) speed.add(new Option(Math.round(s * 100) + '%', String(s)));
    speed.onchange = () => app.setSpeed(+speed.value);
    for (const b of $('mode').querySelectorAll('button')) b.onclick = () => app.setMode(b.dataset.mode);
  }

  /** @param {object} s  current app state */
  render(s) {
    const set = (key, value, apply) => {
      if (this.last[key] === value) return;
      this.last[key] = value;
      apply(value);
    };
    const hasSong = !!s.song;
    set('title', s.song?.title ?? '', v => { $('songTitle').textContent = v || 'Choose a song'; });
    set('hasSong', hasSong, v => {
      for (const id of ['play', 'restart', 'loop']) $(id).disabled = !v;
    });
    set('playing', s.playing, v => {
      $('playIcon').setAttribute('d', v ? PAUSE_ICON : PLAY_ICON);
      $('playText').textContent = v ? 'Pause' : 'Play';
      $('play').setAttribute('aria-label', v ? 'Pause' : 'Play');
    });
    set('loop', !!s.loop, v => { $('loop').classList.toggle('on', v); $('loop').setAttribute('aria-pressed', v); });
    set('speed', s.speed, v => { $('speed').value = String(v); });
    set('mode', s.mode, v => {
      for (const b of $('mode').querySelectorAll('button')) {
        const on = b.dataset.mode === v;
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
      }
    });
    set('accomp', `${s.accompaniment}|${s.hasOutput}`, () => {
      const b = $('accomp');
      b.classList.toggle('on', s.accompaniment && s.hasOutput);
      b.disabled = !s.hasOutput;
      b.setAttribute('aria-pressed', s.accompaniment && s.hasOutput);
      b.title = s.hasOutput ? 'Let the piano play the other hand' : 'No MIDI output to play the other hand';
    });
    set('parts', `${s.song?.title}|${[...(s.parts ?? [])].sort().join()}`, () => this.#renderParts(s));
    set('status', `${s.status.text}|${s.status.ok}`, () => {
      $('statusText').textContent = s.status.text;
      $('status').classList.toggle('ok', s.status.ok);
    });
  }

  #renderParts(s) {
    const box = $('parts');
    box.innerHTML = '';
    if (!s.song) return;
    const hands = s.song.hands;
    if (hands) {
      const seg = el('div', 'seg', { role: 'radiogroup', 'aria-label': 'Hands' });
      for (const [label, ids] of [['Both', [hands.right, hands.left]], ['Right', [hands.right]], ['Left', [hands.left]]]) {
        const on = ids.length === s.parts.size && ids.every(i => s.parts.has(i));
        const b = el('button', on ? 'on' : '', { role: 'radio', 'aria-checked': on });
        if (ids.length === 1) b.append(dot(partColor(ids[0])));
        b.append(label);
        b.onclick = () => this.app.setParts(ids);
        seg.append(b);
      }
      box.append(seg);
      return;
    }
    s.song.parts.forEach((part, i) => {               // other files: one toggle per part
      const on = s.parts.has(i);
      const b = el('button', 'chip' + (on ? ' on' : ''), { 'aria-pressed': on });
      b.append(dot(partColor(i)), part.name);
      b.onclick = () => {
        const next = new Set(s.parts);
        on ? next.delete(i) : next.add(i);
        if (next.size) this.app.setParts([...next]);
      };
      box.append(b);
    });
  }
}

function el(tag, className, attrs = {}) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function dot(color) {
  const d = el('span', 'dot');
  d.style.background = color;
  return d;
}
