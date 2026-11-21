/** The song list overlay and the end-of-song card. */
import { displayName } from '../io/api.js';

const $ = id => document.getElementById(id);

export class Picker {
  /** @param {{open:(file:string)=>void, list:()=>Promise<string[]>}} app */
  constructor(app) {
    this.app = app;
    $('pickerClose').onclick = () => this.close();
    $('picker').addEventListener('pointerdown', e => { if (e.target.id === 'picker' && this.canClose) this.close(); });
  }

  async open(canClose) {
    this.canClose = canClose;
    $('pickerClose').hidden = !canClose;
    $('picker').hidden = false;
    const list = $('pickerList');
    try {
      const files = await this.app.list();
      list.replaceChildren(...files.map(f => this.#row(f)));
      $('pickerEmpty').hidden = files.length > 0;
    } catch (e) {
      list.replaceChildren();
      $('pickerEmpty').hidden = false;
      $('pickerEmpty').textContent = e.message;
    }
  }

  close() { $('picker').hidden = true; }

  #row(file) {
    const { title, artist } = displayName(file);
    const b = document.createElement('button');
    b.className = 'song';
    const t = document.createElement('span'); t.className = 'title'; t.textContent = title;
    const a = document.createElement('span'); a.className = 'artist'; a.textContent = artist;
    b.append(t, a);
    b.onclick = () => { this.close(); this.app.open(file); };
    return b;
  }
}

export class FinishedCard {
  constructor(app) {
    $('again').onclick = () => { this.hide(); app.restart(); app.play(); };
    $('finishedPick').onclick = () => { this.hide(); app.openPicker(); };
  }

  /** @param {{mode:string, accuracy:number|null, wrong:number, hits:number}} r */
  show(r) {
    $('finishedScore').textContent = r.mode === 'play' && r.accuracy != null
      ? `${Math.round(r.accuracy * 100)}%` : `${r.hits} notes`;
    $('finishedDetail').textContent = r.wrong === 1 ? '1 wrong key' : `${r.wrong} wrong keys`;
    $('finished').hidden = false;
  }

  hide() { $('finished').hidden = true; }
}
