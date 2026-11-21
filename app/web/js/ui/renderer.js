/**
 * Draws the stage: bar lines, falling notes (which slide behind the keyboard, never vanish),
 * the hit line, the keyboard and the bursts. Reads state; changes nothing.
 */
import { HAND_COLORS, NOTE_NAMES, PALETTE, VIEW } from '../config.js';
import { HIT, MISSED, PENDING } from '../core/practice.js';
import { keyboardLayout, rangeFor } from './layout.js';

const FONT = '-apple-system,BlinkMacSystemFont,system-ui,sans-serif';
export const partColor = i => HAND_COLORS[i % HAND_COLORS.length];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.range = { lo: 48, hi: 84 };
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.resize();
  }

  setSong(song) {
    this.range = song ? rangeFor(song.lowest, song.highest, VIEW.minKeys) : { lo: 48, hi: 84 };
    this.resize();
  }

  resize() {
    const dpr = devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = keyboardLayout(this.range.lo, this.range.hi, this.W);
    this.kbH = Math.min(190, Math.max(100, this.layout.whiteW * 5.2));
    this.hitY = this.H - this.kbH;
  }

  /** Seconds of song visible above the line. */
  get secondsVisible() { return this.hitY / VIEW.pixelsPerSecond; }

  /** A gentle 0..1 pulse while the song waits for you; steady with reduced motion. */
  breath(now, waiting) {
    if (!waiting) return 0.35;
    return this.reduceMotion.matches ? 1 : 0.6 + 0.4 * Math.sin(now / 420);
  }

  /**
   * @param {object} s
   * @param {import('../core/song.js').Song|null} s.song
   * @param {import('../core/practice.js').Practice|null} s.practice
   * @param {number} s.time
   * @param {number} s.now           performance.now()
   * @param {Map<number,{kind:string,color:string|null}>} s.pressed
   * @param {{pitch:number,color:string,t0:number}[]} s.bursts
   */
  draw(s) {
    const { ctx, W, H, hitY } = this;
    const waiting = !!(s.practice && s.playing && s.practice.isWaiting(s.time));
    const k = this.breath(s.now, waiting);

    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, W, H);
    this.#lanes();

    if (s.song) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, hitY); ctx.clip();    // notes slide behind the keyboard
      this.#bars(s.song, s.time);
      this.#notes(s, k);
      ctx.restore();
    }
    this.#hitLine(k);
    this.#keyboard(s, k);
    this.#bursts(s.bursts, s.now);
  }

  #y(t, time) { return this.hitY - (t - time) * VIEW.pixelsPerSecond; }

  #lanes() {
    const { ctx, layout, hitY } = this;
    for (let p = layout.lo; p <= layout.hi; p++) {
      const key = layout.keys[p];
      if (key.black) { ctx.fillStyle = PALETTE.laneBlack; ctx.fillRect(key.x, 0, key.w, hitY); }
      if (p % 12 === 0) { ctx.fillStyle = PALETTE.line; ctx.fillRect(Math.round(key.x), 0, 1, hitY); }
    }
  }

  #bars(song, time) {
    const { ctx, W } = this;
    const top = time + this.secondsVisible;
    ctx.font = `600 10px ${FONT}`; ctx.textAlign = 'left';
    for (let i = 0; i < song.bars.length; i++) {
      const b = song.bars[i];
      if (b < time - 0.05) continue;
      if (b > top) break;
      const y = Math.round(this.#y(b, time)) + 0.5;
      ctx.fillStyle = PALETTE.bar; ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = PALETTE.barText; ctx.fillText(String(i + 1), 6, y - 4);
    }
  }

  #notes(s, k) {
    const { ctx, layout } = this;
    const { song, practice, time } = s;
    const chord = practice?.mode === 'wait' ? practice.pendingChord() : null;
    const top = time + this.secondsVisible;
    const pps = VIEW.pixelsPerSecond;

    for (const n of song.notesBetween(time - 0.5, top)) {
      const key = layout.keys[n.pitch];
      if (!key) continue;
      const yb = this.#y(n.start, time), h = Math.max(n.dur * pps, 8), yt = yb - h;
      const inset = key.black ? 1 : 2.5, x = key.x + inset, w = key.w - inset * 2;
      const base = partColor(n.part);
      const practiced = practice ? practice.isPracticed(n) : true;
      const status = practice ? practice.status[n.id] : PENDING;
      const sounding = time >= n.start && time < n.end;
      const next = chord?.notes.includes(n) && status === PENDING;

      let top_, bottom, alpha = 1, glow = 0;
      if (status === MISSED) { top_ = bottom = PALETTE.missed; }
      else if (status === HIT) {
        top_ = mix(base, '#ffffff', 0.5); bottom = mix(base, '#ffffff', 0.3);
        glow = sounding ? 8 : 0;
      } else {
        top_ = key.black ? mix(base, '#000000', 0.1) : mix(base, '#ffffff', 0.2);
        bottom = key.black ? mix(base, '#000000', 0.3) : base;
        if (!practiced) alpha = sounding ? 0.75 : 0.42;
      }
      if (next) glow = 6 + 8 * k;

      const g = ctx.createLinearGradient(0, yt, 0, yb);
      g.addColorStop(0, top_); g.addColorStop(1, bottom);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      if (glow) { ctx.shadowColor = base; ctx.shadowBlur = glow; }
      roundRect(ctx, x, yt, w, h, 4); ctx.fill();
      ctx.shadowBlur = 0;

      if (h > 14 && status !== MISSED) {              // a thin top highlight
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        roundRect(ctx, x + 2, yt + 1.5, w - 4, 2, 1); ctx.fill();
      }
      if (w >= 14 && h >= 22 && status !== MISSED) {  // note name at the bottom
        ctx.fillStyle = key.black ? 'rgba(255,255,255,.9)' : 'rgba(20,18,16,.7)';
        ctx.font = `700 ${w >= 22 ? 13 : 11}px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(NOTE_NAMES[n.pitch % 12], x + w / 2, yb - 7);
      }
      if (next) {
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;
        roundRect(ctx, x + 0.75, yt + 0.75, w - 1.5, h - 1.5, 3.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** The felt strip behind the keys, where notes land. It warms slightly while it waits for you. */
  #hitLine(k) {
    const { ctx, W, hitY } = this;
    const h = 6, lit = Math.max(0, (k - 0.35) / 0.65);
    const g = ctx.createLinearGradient(0, hitY - h, 0, hitY);
    g.addColorStop(0, mix(PALETTE.felt, PALETTE.feltLit, lit));
    g.addColorStop(1, mix(PALETTE.felt, '#000000', 0.35));
    ctx.fillStyle = g; ctx.fillRect(0, hitY - h, W, h);
    ctx.fillStyle = 'rgba(255,240,220,.10)';
    ctx.fillRect(0, hitY - h, W, 1);
  }

  #keyboard(s, k) {
    const { ctx, layout, hitY, kbH, W } = this;
    const { song, practice, time, pressed } = s;

    // what each key should show, by priority: your key > the other hand sounding > the chord to play
    const sounding = new Map(), expected = new Map();
    if (song) {
      for (const n of song.notesBetween(time, time)) {
        if (practice && !practice.isPracticed(n) && time >= n.start && time < n.end) sounding.set(n.pitch, partColor(n.part));
      }
      const chord = practice?.mode === 'wait' ? practice.pendingChord() : null;
      if (chord && chord.start - time < 1.2) {
        for (const n of chord.notes) if (practice.status[n.id] === PENDING) expected.set(n.pitch, partColor(n.part));
      }
    }
    const radius = Math.min(6, layout.whiteW * 0.18);

    ctx.fillStyle = '#080706'; ctx.fillRect(0, hitY, W, kbH);
    for (const black of [false, true]) {
      for (let p = layout.lo; p <= layout.hi; p++) {
        const key = layout.keys[p];
        if (key.black !== black) continue;
        const h = black ? kbH * 0.62 : kbH - 2;
        const x = black ? key.x : key.x + 1, w = black ? key.w : key.w - 2;
        const press = pressed.get(p);
        const fill = press ? (press.kind === 'wrong' ? PALETTE.error : press.color || PALETTE.free) : sounding.get(p);
        const exp = !fill && expected.get(p);

        const g = ctx.createLinearGradient(0, hitY, 0, hitY + h);
        if (fill) {
          g.addColorStop(0, mix(fill, '#000000', black ? 0.25 : 0.1));
          g.addColorStop(1, black ? mix(fill, '#000000', 0.45) : fill);
        } else if (black) {
          g.addColorStop(0, '#24211f'); g.addColorStop(0.85, '#100f0e'); g.addColorStop(1, '#2c2926');
        } else {
          g.addColorStop(0, PALETTE.ivoryShade); g.addColorStop(0.12, PALETTE.ivory); g.addColorStop(1, '#fbf8f1');
        }
        ctx.fillStyle = g;
        roundRect(ctx, x, hitY, w, h, [0, 0, radius, radius]); ctx.fill();

        if (exp) {                                       // the keys to play now breathe in the hand's colour
          ctx.fillStyle = exp; ctx.globalAlpha = (black ? 0.95 : 0.85) * (0.7 + 0.3 * k);
          ctx.fill(); ctx.globalAlpha = 1;
        }
        if (black && !fill && !exp) {
          ctx.fillStyle = 'rgba(255,255,255,.08)';
          ctx.fillRect(x + w * 0.2, hitY + 2, w * 0.6, h - 8);
        }
        ctx.textAlign = 'center';
        if (exp && w > 10) {
          ctx.fillStyle = black ? '#fff' : 'rgba(20,18,16,.8)';
          ctx.font = `700 ${black ? 11 : 13}px ${FONT}`;
          ctx.fillText(NOTE_NAMES[p % 12], x + w / 2, hitY + h - (black ? 8 : 26));
        }
        if (!black && p % 12 === 0 && w > 18) {
          ctx.fillStyle = fill || exp ? 'rgba(20,18,16,.7)' : '#8f887c';
          ctx.font = `600 11px ${FONT}`;
          ctx.fillText('C' + (p / 12 - 1), x + w / 2, hitY + h - 8);
        }
      }
    }
    const shade = ctx.createLinearGradient(0, hitY, 0, hitY + 8);
    shade.addColorStop(0, 'rgba(0,0,0,.45)'); shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, hitY, W, 8);
  }

  #bursts(bursts, now) {
    const { ctx, layout, hitY } = this;
    for (const b of bursts) {
      const t = (now - b.t0) / VIEW.burstMs;
      const key = layout.keys[b.pitch];
      if (t >= 1 || !key) continue;
      const e = 1 - Math.pow(1 - t, 3);
      const cx = key.x + key.w / 2;
      const rad = layout.whiteW * (this.reduceMotion.matches ? 1.1 : 0.6 + 1.2 * e);
      const g = ctx.createRadialGradient(cx, hitY, 0, cx, hitY, rad);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - t)})`);
      g.addColorStop(0.35, b.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, hitY, rad, rad * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** The key under a point on the canvas, or null above the keyboard. */
  keyAtPoint(x, y) {
    if (y < this.hitY) return null;
    const frac = (y - this.hitY) / this.kbH;
    for (const black of frac < 0.62 ? [true, false] : [false]) {
      for (let p = this.layout.lo; p <= this.layout.hi; p++) {
        const key = this.layout.keys[p];
        if (key.black === black && x >= key.x && x < key.x + key.w) return p;
      }
    }
    return null;
  }
}

export function mix(hex, to, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (!ctx.roundRect) { ctx.rect(x, y, w, h); return; }
  ctx.roundRect(x, y, w, h, Array.isArray(r) ? r : Math.max(0, Math.min(r, w / 2, h / 2)));
}
