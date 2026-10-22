'use strict';

/* SM3（國密雜湊）— 移植自 fanqie-assistant/src/crypto/sm3.ts
   只用到摘要，HMAC 沒用到就不搬。 */

const rotl = (v, n) => {
  const s = n & 31;
  return ((v << s) | (v >>> (32 - s))) >>> 0;
};
const p0 = (x) => (x ^ rotl(x, 9) ^ rotl(x, 17)) >>> 0;
const p1 = (x) => (x ^ rotl(x, 15) ^ rotl(x, 23)) >>> 0;

function sm3(input) {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
  const len = bytes.length;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[len] = 0x80;

  const bits = BigInt(len) * 8n;
  for (let i = 0; i < 8; i++) msg[paddedLen - 1 - i] = Number((bits >> BigInt(i * 8)) & 0xffn);

  const dv = new DataView(msg.buffer);
  const state = new Uint32Array([
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
    0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
  ]);
  const w = new Uint32Array(68);
  const w1 = new Uint32Array(64);

  for (let blk = 0; blk < msg.length / 64; blk++) {
    const off = blk * 64;
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 68; i++) {
      w[i] = (p1((w[i - 16] ^ w[i - 9]) ^ rotl(w[i - 3], 15)) ^ rotl(w[i - 13], 7) ^ w[i - 6]) >>> 0;
    }
    for (let i = 0; i < 64; i++) w1[i] = (w[i] ^ w[i + 4]) >>> 0;

    let a = state[0], b = state[1], c = state[2], d = state[3];
    let e = state[4], f = state[5], g = state[6], h = state[7];

    for (let i = 0; i < 64; i++) {
      const t = i <= 15 ? 0x79cc4519 : 0x7a879d8a;
      const ss1 = rotl((rotl(a, 12) + e + rotl(t, i)) >>> 0, 7);
      const ss2 = (ss1 ^ rotl(a, 12)) >>> 0;
      const ff = i <= 15 ? (a ^ b) ^ c : ((a & b) | (a & c)) | (b & c);
      const gg = i <= 15 ? (e ^ f) ^ g : (e & f) | (~e & g);
      const tt1 = (ff + d + ss2 + w1[i]) >>> 0;
      const tt2 = (gg + h + ss1 + w[i]) >>> 0;

      d = c; c = rotl(b, 9); b = a; a = tt1;
      h = g; g = rotl(f, 19); f = e; e = p0(tt2);
    }

    state[0] ^= a; state[1] ^= b; state[2] ^= c; state[3] ^= d;
    state[4] ^= e; state[5] ^= f; state[6] ^= g; state[7] ^= h;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const v = state[i];
    out[i * 4] = v >>> 24;
    out[i * 4 + 1] = v >>> 16;
    out[i * 4 + 2] = v >>> 8;
    out[i * 4 + 3] = v;
  }
  return out;
}

module.exports = { sm3, rotl };
