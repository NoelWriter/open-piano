/**
 * Song time: play/pause, speed, seeking, the loop region and the end. Pure: the caller passes elapsed
 * real time and a `limit` function (the practice engine's wait gate).
 */
import { TIMING } from '../config.js';

export class Transport {
  constructor(duration, timing = TIMING) {
    this.duration = duration;
    this.timing = timing;
    this.time = -timing.leadIn;
    this.playing = false;
    this.speed = 1;
    /** @type {{start:number, end:number} | null} */
    this.loop = null;
  }

  get start() { return -this.timing.leadIn; }
  get finished() { return this.time >= this.duration + 0.5; }

  seek(t) {
    this.time = Math.min(Math.max(t, this.start), this.duration + 0.5);
    return this.time;
  }

  play() {
    if (this.finished) this.seek(this.loop ? this.loop.start - this.timing.loopLeadIn : this.start);
    this.playing = true;
  }
  pause() { this.playing = false; }
  toggle() { this.playing ? this.pause() : this.play(); }

  /**
   * Advance by `dt` real seconds.
   * @param {(t0:number, t1:number) => number} limit  how far time may go (wait mode)
   * @returns {{from:number, to:number, wrapTo?:number, ended?:boolean} | null}
   */
  tick(dt, limit = (_, t1) => t1) {
    if (!this.playing) return null;
    const from = this.time;
    let to = limit(from, from + dt * this.speed);
    if (this.loop && to >= this.loop.end) {
      this.time = this.loop.end;
      return { from, to: this.loop.end, wrapTo: this.loop.start - this.timing.loopLeadIn };
    }
    this.time = Math.min(to, this.duration + 0.5);
    if (this.finished) {
      this.playing = false;
      return { from, to: this.time, ended: true };
    }
    return { from, to: this.time };
  }
}
