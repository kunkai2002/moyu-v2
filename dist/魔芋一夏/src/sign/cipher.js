'use strict';

/* Simon / Speck 區塊加密 — 移植自 fanqie-assistant/src/crypto/{simon,speck}.ts */

const crypto = require('crypto');
const MASK64 = (1n << 64n) - 1n;

/* ───────────── Simon（argus 用）───────────── */
const ROUNDS_SIMON = 72;
const Z4 = 0x3dc94c3a046d678bn;

const rl64 = (v, n) => ((v << n) | (v >> (64n - n))) & MASK64;
const rr64 = (v, n) => ((v << (64n - n)) | (v >> n)) & MASK64;
const bit = (v, i) => (v >> BigInt(i)) & 1n;

function simonKeyExpansion(key) {
  const k = key.map((x) => x & MASK64);
  for (let i = 4; i < ROUNDS_SIMON; i++) {
    let tmp = rr64(k[i - 1], 3n);
    tmp ^= k[i - 3];
    tmp ^= rr64(tmp, 1n);
    k.push((~k[i - 4] ^ tmp ^ bit(Z4, (i - 4) % 62) ^ 3n) & MASK64);
  }
  return k;
}

function simonEncrypt(plain, key) {
  const k = simonKeyExpansion(key);
  let x = plain[0] & MASK64;
  let y = plain[1] & MASK64;
  for (let i = 0; i < ROUNDS_SIMON; i++) {
    const tmp = y;
    const f = rl64(y, 1n) & rl64(y, 8n);
    y = (x ^ f ^ rl64(y, 2n) ^ k[i]) & MASK64;
    x = tmp;
  }
  return [x, y];
}

/* ───────────── Speck（ladon 用）───────────── */
const ROUNDS_SPECK = 34;
const WORD = 64n, ALPHA = 8n, BETA = 3n;

function speckKeySchedule(key) {
  const dv = new DataView(key.buffer, key.byteOffset, key.byteLength);
  const ks = [dv.getBigUint64(0, true) & MASK64];
  const n = (key.length * 8) / Number(WORD);
  const ls = [];
  for (let i = 1; i < n; i++) ls.push(dv.getBigUint64(i * 8, true) & MASK64);

  for (let x = 0; x < ROUNDS_SPECK - 1; x++) {
    const rsX = ((ls[x] << (WORD - ALPHA)) + (ls[x] >> ALPHA)) & MASK64;
    const addSxy = (rsX + ks[x]) & MASK64;
    const nx = BigInt(x) ^ addSxy;
    const lsY = ((ks[x] >> (WORD - BETA)) + (ks[x] << BETA)) & MASK64;
    ls.push(nx);
    ks.push(nx ^ lsY);
  }
  return ks;
}

function speckEncrypt(key, plaintext) {
  if (key.length !== 32) throw new Error('Speck key must be 32 bytes');
  const ks = speckKeySchedule(key);
  const padded = pkcs7Pad(plaintext, 16);
  const out = new Uint8Array(padded.length);
  const inView = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);

  for (let off = 0; off < padded.length; off += 16) {
    let y = inView.getBigUint64(off, true);
    let x = inView.getBigUint64(off + 8, true);
    for (const k of ks) {
      const rsX = ((x << (WORD - ALPHA)) + (x >> ALPHA)) & MASK64;
      x = k ^ ((rsX + y) & MASK64);
      const lsY = ((y >> (WORD - BETA)) + (y << BETA)) & MASK64;
      y = (x ^ lsY) & MASK64;
    }
    out.set(Buffer.from(bigToLE(y, 8)), off);
    out.set(Buffer.from(bigToLE(x, 8)), off + 8);
  }
  return out;
}

function generateLadonKey(randomBytes, aid) {
  const aidBytes = Buffer.from(aid, 'utf8');
  const input = Buffer.concat([Buffer.from(randomBytes), aidBytes]);
  const hex = crypto.createHash('md5').update(input).digest('hex');
  return Buffer.from(hex, 'utf8');   // 32 bytes（hex 字串本身）
}

/* 小工具 */
function bigToLE(v, len) {
  const b = Buffer.alloc(len);
  let t = v;
  for (let i = 0; i < len; i++) { b[i] = Number(t & 0xffn); t >>= 8n; }
  return b;
}

function pkcs7Pad(data, block = 16) {
  const pad = block - (data.length % block);
  const out = new Uint8Array(data.length + pad);
  out.set(data);
  out.fill(pad, data.length);
  return out;
}

module.exports = { simonEncrypt, speckEncrypt, generateLadonKey, pkcs7Pad, bigToLE };
