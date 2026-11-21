/** Per-viewer conveniences in localStorage. Never required: every read and write may fail. */
const PREFIX = 'piano-trainer:';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : { ...fallback, ...JSON.parse(v) };
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode, full, … */ }
}
