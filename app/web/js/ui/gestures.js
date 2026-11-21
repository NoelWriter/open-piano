/**
 * Touch and keys on the stage.
 *  - Notes follow your finger: drag to scroll through the song, fling to keep scrolling.
 *    Scrolling pauses; playback resumes when the fling settles if it was playing.
 *  - Tap the notes: play / pause.  Tap the on-screen keys: play them (handy without a piano).
 *  - Wheel / trackpad scrolls. PC keys: Space, ←/→ bar, ↑/↓ speed, Home, L loop.
 */
import { VIEW } from '../config.js';

const TAP_SLOP = 8;   // px of movement before a touch becomes a drag

export class Gestures {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} app
   * @param {(x:number,y:number)=>number|null} app.keyAt
   * @param {()=>number} app.time
   * @param {(t:number)=>void} app.scrub          seek without stopping the gesture
   * @param {()=>void} app.scrubStart             pause, remember whether it was playing
   * @param {()=>void} app.scrubEnd               resume if it was playing
   * @param {()=>void} app.togglePlay
   * @param {(p:number)=>void} app.keyDown
   * @param {(p:number)=>void} app.keyUp
   * @param {(cmd:string)=>void} app.command      'bar-back'|'bar-forward'|'faster'|'slower'|'restart'|'loop'
   */
  constructor(canvas, app) {
    this.app = app;
    this.drag = null;
    this.velocity = 0;          // song seconds per second, while flinging
    this.keys = new Map();      // pointerId -> pitch
    canvas.addEventListener('pointerdown', e => this.#down(e));
    canvas.addEventListener('pointermove', e => this.#move(e));
    canvas.addEventListener('pointerup', e => this.#up(e));
    canvas.addEventListener('pointercancel', e => this.#up(e));
    canvas.addEventListener('wheel', e => this.#wheel(e), { passive: false });
    addEventListener('keydown', e => this.#key(e));
  }

  get flinging() { return this.velocity !== 0; }

  /** Called every frame: carries a fling and ends it smoothly. */
  step(dt) {
    if (!this.velocity) return;
    this.app.scrub(this.app.time() + this.velocity * dt);
    this.velocity *= Math.exp(-VIEW.flingFriction * dt);
    if (Math.abs(this.velocity) < 0.08) {
      this.velocity = 0;
      this.app.scrubEnd();
    }
  }

  #down(e) {
    const pitch = this.app.keyAt(e.offsetX, e.offsetY);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pitch != null) {
      this.keys.set(e.pointerId, pitch);
      this.app.keyDown(pitch);
      return;
    }
    if (this.velocity) {                      // catching a fling stops it where it is
      this.velocity = 0;
      this.drag = { id: e.pointerId, y0: e.offsetY, t0: this.app.time(), moved: true, caught: true, samples: [] };
      return;
    }
    this.drag = { id: e.pointerId, y0: e.offsetY, t0: this.app.time(), moved: false, samples: [] };
  }

  #move(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.offsetY - d.y0;
    if (!d.moved && Math.abs(dy) > TAP_SLOP) { d.moved = true; this.app.scrubStart(); }
    if (!d.moved) return;
    // notes follow the finger: dragging down brings later notes down, i.e. moves forward in time
    this.app.scrub(d.t0 + dy / VIEW.pixelsPerSecond);
    d.samples.push({ y: e.offsetY, at: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  }

  #up(e) {
    const pitch = this.keys.get(e.pointerId);
    if (pitch != null) {
      this.keys.delete(e.pointerId);
      this.app.keyUp(pitch);
      return;
    }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    if (!d.moved) return this.app.togglePlay();
    const s = d.samples, first = s[0], last = s[s.length - 1];
    const ms = last && first ? last.at - first.at : 0;
    const v = ms > 0 && e.timeStamp - last.at < 80 ? (last.y - first.y) / ms * 1000 / VIEW.pixelsPerSecond : 0;
    if (Math.abs(v) > 0.4) this.velocity = Math.sign(v) * Math.min(Math.abs(v), VIEW.maxFling);   // step() settles it
    else this.app.scrubEnd();
  }

  #wheel(e) {
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    this.app.scrub(this.app.time() + px / VIEW.pixelsPerSecond);
  }

  #key(e) {
    if (e.target.closest?.('input, select, textarea')) return;
    const map = { ' ': 'toggle', ArrowLeft: 'bar-back', ArrowRight: 'bar-forward', ArrowUp: 'faster', ArrowDown: 'slower', Home: 'restart', l: 'loop', L: 'loop' };
    const cmd = map[e.key];
    if (!cmd) return;
    e.preventDefault();
    cmd === 'toggle' ? this.app.togglePlay() : this.app.command(cmd);
  }
}
