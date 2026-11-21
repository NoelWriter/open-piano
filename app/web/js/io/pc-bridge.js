/**
 * Fallback input: a piano plugged into the PC, relayed by server.py over Server-Sent Events.
 * Events: 'noteon' {pitch, velocity} · 'noteoff' {pitch} · 'ports' {inputs}
 */
import { Emitter } from '../core/emitter.js';

export class PcBridge extends Emitter {
  inputs = [];

  start(url = '/events') {
    const es = new EventSource(url);
    es.onmessage = e => {
      const [kind, a, b] = e.data.split(' ');
      if (kind === 'on') this.emit('noteon', { pitch: +a, velocity: +b || 80 });
      else if (kind === 'off') this.emit('noteoff', { pitch: +a });
      else if (kind === 'ports') {
        const inputs = JSON.parse(e.data.slice(6));
        if (inputs.join() !== this.inputs.join()) {
          this.inputs = inputs;
          this.emit('ports', { inputs });
        }
      }
    };
    return this;
  }
}
