import { Song } from '../core/song.js';

/** @returns {Promise<string[]>} file names in songs/ on the PC */
export async function listSongs() {
  const r = await fetch('/songs');
  if (!r.ok) throw new Error('Can’t reach the PC');
  return r.json();
}

/** @returns {Promise<Song>} */
export async function loadSong(file) {
  const r = await fetch('/songs/' + encodeURIComponent(file));
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || 'Can’t open this song');
  return Song.fromJSON(data, displayName(file).title);
}

/** "Artist - Title.mid" -> {title, artist} */
export function displayName(file) {
  const base = file.replace(/\.midi?$/i, '');
  const i = base.indexOf(' - ');
  return i > 0 ? { artist: base.slice(0, i), title: base.slice(i + 3) } : { artist: '', title: base };
}
