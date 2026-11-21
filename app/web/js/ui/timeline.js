/**
 * The scrub bar under the toolbar: progress, bar ticks, the loop region with draggable ends.
 * Tap or drag anywhere to seek; drag a loop end to move it (snaps to bars).
 */
import { PALETTE } from '../config.js';

const HANDLE_HIT = 22;   // px either side of a loop end that grabs it

export class Timeline {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{seek:(t:number)=>void, scrubStart:()=>void, scrubEnd:()=>void, setLoop:(l:{start:number,end:number})=>void}} on
   */
  constructor(canvas, on) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.on = on;
    this.song = null;
    this.drag = null;
    canvas.addEventListener('pointerdown', e => this.#down(e));
    canvas.addEventListener('pointermove', e => this.#move(e));
    canvas.addEventListener('pointerup', e => this.#up(e));
    canvas.addEventListener('pointercancel', e => this.#up(e));
    this.resize();
  }

  resize() {
    const dpr = devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get pad() { return 14; }
  #x(t) { return this.pad + (this.W - 2 * this.pad) * Math.max(0, Math.min(1, t / (this.song?.duration || 1))); }
  #t(x) { return ((x - this.pad) / (this.W - 2 * this.pad)) * (this.song?.duration || 0); }

  #snap(t) {
    const bars = this.song.bars;
    let best = bars[0] ?? 0;
    for (const b of bars) if (Math.abs(b - t) < Math.abs(best - t)) best = b;
    return best;
  }

  #down(e) {
    if (!this.song) return;
    this.canvas.setPointerCapture(e.pointerId);
    const x = e.offsetX, loop = this.loop;
    if (loop && Math.abs(x - this.#x(loop.end)) < HANDLE_HIT) this.drag = { handle: 'end' };
    else if (loop && Math.abs(x - this.#x(loop.start)) < HANDLE_HIT) this.drag = { handle: 'start' };
    else {
      this.drag = { seek: true };
      this.on.scrubStart();
      this.on.seek(this.#t(x));
    }
  }

  #move(e) {
    if (!this.drag) return;
    const t = this.#t(e.offsetX);
    if (this.drag.seek) return this.on.seek(t);
    const loop = { ...this.loop };
    const snapped = this.#snap(t);
    if (this.drag.handle === 'start') loop.start = Math.min(snapped, loop.end - 0.5);
    else loop.end = Math.max(snapped, loop.start + 0.5);
    this.on.setLoop(loop);
  }

  #up() {
    if (this.drag?.seek) this.on.scrubEnd();
    this.drag = null;
  }

  /** @param {{song, time:number, loop:{start:number,end:number}|null}} s */
  draw(s) {
    this.song = s.song;
    this.loop = s.loop;
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    ctx.fillStyle = '#2b2825';
    roundRect(ctx, this.pad, mid - 2, W - 2 * this.pad, 4, 2); ctx.fill();
    if (!s.song) return;

    // bar ticks: small every bar, taller every 4
    s.song.bars.forEach((b, i) => {
      const x = Math.round(this.#x(b)) + 0.5, tall = i % 4 === 0;
      ctx.fillStyle = tall ? '#4a453f' : '#34302c';
      ctx.fillRect(x, mid - (tall ? 7 : 4), 1, tall ? 14 : 8);
    });

    if (s.loop) {
      const x0 = this.#x(s.loop.start), x1 = this.#x(s.loop.end);
      ctx.fillStyle = 'rgba(201,164,92,.16)';
      ctx.fillRect(x0, mid - 11, x1 - x0, 22);
      for (const x of [x0, x1]) {
        ctx.fillStyle = PALETTE.accent;
        roundRect(ctx, x - 2.5, mid - 12, 5, 24, 2.5); ctx.fill();
      }
    }

    const px = this.#x(Math.max(0, s.time));
    ctx.fillStyle = PALETTE.ivory;
    roundRect(ctx, this.pad, mid - 2, px - this.pad, 4, 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px, mid, 7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ivory; ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (w <= 0) return;
  ctx.roundRect ? ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)) : ctx.rect(x, y, w, h);
}
