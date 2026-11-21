/**
 * Web MIDI: the piano's keys in, and an output to let the piano play the other hand.
 * Robust to Web MIDI Browser's shim, which can appear after load, fill its inputs late without a
 * statechange, and may lack Map#values. So: wait for the API, rescan every 2 s, iterate with forEach.
 *
 * Events: 'noteon' {pitch, velocity} · 'noteoff' {pitch} · 'ports' {inputs, outputs, error}
 */
import { Emitter } from '../core/emitter.js';

export class Midi extends Emitter {
  inputs = [];
  outputs = [];
  error = '';
  #access = null;
  #hooked = new WeakSet();
  #output = null;
  #scanned = false;

  start() {
    this.#waitForApi(0);
    return this;
  }

  get available() { return !!navigator.requestMIDIAccess; }
  get hasOutput() { return !!this.#output; }

  /** Send raw bytes to the piano (no-op without an output). */
  send(bytes) {
    try { this.#output?.send(bytes); } catch { /* output went away */ }
  }

  noteOn(pitch, velocity = 80, channel = 0) { this.send([0x90 | channel, pitch, velocity]); }
  noteOff(pitch, channel = 0) { this.send([0x80 | channel, pitch, 0]); }
  allNotesOff(channel = 0) { this.send([0xb0 | channel, 123, 0]); }

  #waitForApi(tries) {
    if (!navigator.requestMIDIAccess) {
      if (tries < 20) setTimeout(() => this.#waitForApi(tries + 1), 500);
      else this.#publish();
      return;
    }
    navigator.requestMIDIAccess({ sysex: false }).then(access => {
      this.#access = access;
      access.onstatechange = () => this.#scan();
      this.#scan();
      setInterval(() => this.#scan(), 2000);
    }, err => {
      this.error = 'Allow MIDI to connect your piano';
      console.warn('MIDI access refused', err);
      this.#publish();
    });
  }

  #scan() {
    try {
      const inputs = [], outputs = [];
      this.#access.inputs.forEach(input => {
        if (!this.#hooked.has(input)) {
          input.onmidimessage = e => this.#onMessage(e.data);
          this.#hooked.add(input);
        }
        if (input.state !== 'disconnected') inputs.push(input.name || 'MIDI input');
      });
      let output = null;
      this.#access.outputs?.forEach?.(o => {
        if (o.state === 'disconnected') return;
        outputs.push(o.name || 'MIDI output');
        // prefer the output that belongs to the piano we hear from
        if (!output || inputs.some(i => sameDevice(i, o.name))) output = o;
      });
      this.#output = output;
      this.error = '';
      const changed = !this.#scanned || inputs.join() !== this.inputs.join() || outputs.join() !== this.outputs.join();
      this.#scanned = true;
      this.inputs = inputs; this.outputs = outputs;
      if (changed) this.#publish();
    } catch (e) {
      this.error = 'Piano can’t be read';
      console.warn(e);
      this.#publish();
    }
  }

  #onMessage(data) {
    const [status, pitch, velocity] = data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && velocity > 0) this.emit('noteon', { pitch, velocity });
    else if (cmd === 0x80 || cmd === 0x90) this.emit('noteoff', { pitch });
  }

  #publish() {
    this.emit('ports', { inputs: this.inputs, outputs: this.outputs, error: this.error });
  }
}

function sameDevice(a, b) {
  const words = s => new Set((s || '').toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const wa = words(a);
  return [...words(b)].some(w => wa.has(w));
}
