/**
 * Monotonic ULIDs (https://github.com/ulid/spec): 10 characters of
 * millisecond timestamp, then 16 random characters, in Crockford base32.
 *
 * This used to wrap the `ulid` package. That package runs its random-source
 * detection the moment it's imported, and the detection only looks at
 * `window.crypto`. A Manifest V3 service worker has `crypto` but no `window`,
 * so the import threw and Chrome refused to start the background script at
 * all ("Service worker registration failed. Status code: 15"). Generating the
 * IDs here with `globalThis.crypto` works in pages and workers alike.
 */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = -1;
let lastRandom: number[] = [];

function randomDigits(): number[] {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(RANDOM_LEN));
  // 256 is a multiple of 32, so masking to 5 bits keeps every digit uniform.
  return Array.from(bytes, (b) => b & 31);
}

/** Adds one to the random part, carrying left. Same-millisecond IDs sort in order. */
function increment(digits: number[]): number[] {
  const next = digits.slice();
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]! < 31) {
      next[i]!++;
      return next;
    }
    next[i] = 0;
  }
  throw new Error('ulid: random component overflowed within one millisecond');
}

function encodeTime(ms: number): string {
  let out = '';
  for (let i = 0; i < TIME_LEN; i++) {
    out = ENCODING[ms % 32] + out;
    ms = Math.floor(ms / 32);
  }
  return out;
}

export function newId(): string {
  const now = Date.now();
  if (now <= lastTime) {
    // Same millisecond, or the clock stepped backwards: keep the last
    // timestamp and bump the random part, so IDs still sort by creation.
    lastRandom = increment(lastRandom);
  } else {
    lastTime = now;
    lastRandom = randomDigits();
  }
  return encodeTime(lastTime) + lastRandom.map((d) => ENCODING[d]).join('');
}
