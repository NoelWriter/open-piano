/** Keyboard geometry. Pure. */
export const isBlack = p => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);

/** The pitch range to show for a song: its notes plus a margin, at least `minKeys`, ending on white keys. */
export function rangeFor(lowest, highest, minKeys = 25) {
  let lo = lowest - 2, hi = highest + 2;
  while (hi - lo + 1 < minKeys) { lo--; hi++; }
  lo = Math.max(21, lo); hi = Math.min(108, hi);
  if (isBlack(lo)) lo--;
  if (isBlack(hi)) hi++;
  return { lo, hi };
}

/**
 * @returns {{lo:number, hi:number, whiteW:number, keys: Record<number, {x:number, w:number, black:boolean}>}}
 */
export function keyboardLayout(lo, hi, width) {
  let whites = 0;
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites++;
  const whiteW = width / whites;
  const keys = {};
  let i = 0;
  for (let p = lo; p <= hi; p++) {
    if (isBlack(p)) {
      const w = whiteW * 0.58;
      keys[p] = { x: i * whiteW - w / 2, w, black: true };
    } else {
      keys[p] = { x: i++ * whiteW, w: whiteW, black: false };
    }
  }
  return { lo, hi, whiteW, keys };
}

/** The key under x (black keys win in their upper part). */
export function keyAt(layout, x, yFraction) {
  if (yFraction < 0.62) {
    for (let p = layout.lo; p <= layout.hi; p++) {
      const k = layout.keys[p];
      if (k.black && x >= k.x && x < k.x + k.w) return p;
    }
  }
  for (let p = layout.lo; p <= layout.hi; p++) {
    const k = layout.keys[p];
    if (!k.black && x >= k.x && x < k.x + k.w) return p;
  }
  return null;
}
