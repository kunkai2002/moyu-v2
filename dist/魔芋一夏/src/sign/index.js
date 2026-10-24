'use strict';

/* 簽名堆疊：x-argus / x-ladon / x-khronos
   移植自 fanqie-assistant/src/crypto/{argus,ladon,sign}.ts
   ─────────────────────────────────────────────────────────────
   只做匿名請求（不帶任何帳號 cookie）。 */

const crypto = require('crypto');
const { sm3 } = require('./sm3');
const { simonEncrypt, speckEncrypt, generateLadonKey, pkcs7Pad, bigToLE } = require('./cipher');
const { ProtobufWriter } = require('./protobuf');

const LOW_RAND = Buffer.from([0xf2, 0x81]);
const HIGH_RAND = Buffer.from([0x61, 0x6f]);
const XOR_PREFIX = Buffer.from([0xf2, 0xf7, 0xfc, 0xff, 0xf2, 0xf7, 0xfc, 0xff]);
const HEADER = Buffer.from([0xa6, 0x6e, 0xad, 0x9f, 0x77, 0x01, 0xd0, 0x0c, 0x18]);

const DEFAULT_CONFIG = {
  signKey: Buffer.from('ac1adaae95a7af94a5114ab3b3a97dd80050aa0a39314c40528caec95256c28c', 'hex'),
  aid: '1967',
  licenseId: '1611921764',
  sdkVersion: 'v04.04.05-ov-android',
  sdkVersionInt: 134744640,
  callType: 738,
};

const md5 = (b) => crypto.createHash('md5').update(b).digest();
const sm3Prefix6 = (b) => Buffer.from(sm3(b).slice(0, 6));

function decodeStub(xssStub) {
  const out = Buffer.alloc(16);
  if (xssStub.length >= 32) {
    for (let i = 0; i < 16; i++) out[i] = parseInt(xssStub.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  return out;
}

function buildProtobuf(query, xssStub, timestamp, cfg) {
  const params = new URLSearchParams(query);
  const deviceId = params.get('device_id') || '';
  const versionName = params.get('version_name') || '';

  // 空 stub / 空 query 都對 16 位元組全零求 SM3
  const bodyHash = sm3Prefix6(xssStub === '' ? Buffer.alloc(16) : decodeStub(xssStub));
  const queryHash = sm3Prefix6(query === '' ? Buffer.alloc(16) : Buffer.from(query, 'utf8'));

  const rand = crypto.randomBytes(4).readUInt32LE(0) % 0x7fffffff;

  return new ProtobufWriter()
    .varint(1, 0x20200929 * 2)
    .varint(2, 2)
    .varint(3, rand)
    .string(4, cfg.aid)
    .string(5, deviceId)
    .string(6, cfg.licenseId)
    .string(7, versionName)
    .string(8, cfg.sdkVersion)
    .varint(9, cfg.sdkVersionInt)
    .bytes(10, Buffer.alloc(8))
    .varint(11, 0)
    .varint(12, timestamp * 2)
    .bytes(13, bodyHash)
    .bytes(14, queryHash)
    .message(15, (s) => { s.varint(1, 1).varint(2, 1).varint(3, 1).varint(7, 3348294860); })
    .string(16, '')
    .string(20, 'none')
    .varint(21, cfg.callType)
    .message(23, (s) => { s.string(1, 'NX551J').varint(2, 8196).varint(4, 2162219008); })
    .varint(25, 2)
    .toBytes();
}

function aesCbcEncrypt(key, iv, data) {
  const c = crypto.createCipheriv(key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc', key, iv);
  return Buffer.concat([c.update(data), c.final()]);
}

function aesCbcDecrypt(key, iv, data) {
  const d = crypto.createDecipheriv(key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc', key, iv);
  return Buffer.concat([d.update(data), d.final()]);
}

/* ── x-argus ── */
function getArgus(query, xssStub, timestamp, cfg = DEFAULT_CONFIG) {
  const signKey = cfg.signKey;
  if (signKey.length !== 32) throw new Error('signKey 必須 32 bytes');

  const pb = Buffer.from(pkcs7Pad(buildProtobuf(query, xssStub, timestamp, cfg), 16));

  // sm3(signKey + LOW + HIGH + signKey) → 4 個 uint64 當 Simon 金鑰
  const sm3In = Buffer.concat([signKey, LOW_RAND, HIGH_RAND, signKey]);
  const digest = Buffer.from(sm3(sm3In));
  const simonKey = [
    digest.readBigUInt64LE(0),
    digest.readBigUInt64LE(8),
    digest.readBigUInt64LE(16),
    digest.readBigUInt64LE(24),
  ];

  const enc = Buffer.alloc(pb.length);
  for (let off = 0; off < pb.length; off += 16) {
    const [lo, hi] = simonEncrypt([pb.readBigUInt64LE(off), pb.readBigUInt64LE(off + 8)], simonKey);
    enc.set(bigToLE(lo, 8), off);
    enc.set(bigToLE(hi, 8), off + 8);
  }

  let data = Buffer.concat([XOR_PREFIX, enc]);
  for (let i = XOR_PREFIX.length; i < data.length; i++) data[i] ^= data[i % 8];
  data = Buffer.from(data).reverse();

  const plaintext = Buffer.concat([HEADER, data, HIGH_RAND]);

  const aesKey = md5(signKey.subarray(0, 16));
  const iv = md5(signKey.subarray(16));
  const ct = aesCbcEncrypt(aesKey, iv, plaintext);

  return Buffer.concat([LOW_RAND, ct]).toString('base64');
}

/* ── x-ladon ── */
function getLadon(timestamp, cfg = DEFAULT_CONFIG) {
  const rand = crypto.randomBytes(4);
  const plain = Buffer.from(`${timestamp}-${cfg.licenseId}-${cfg.aid}`, 'utf8');
  const key = generateLadonKey(rand, cfg.aid);
  const enc = speckEncrypt(key, plain);
  return Buffer.concat([rand, enc]).toString('base64');
}

/* ── 組標頭 ── */
function signRequest(url, body, cfg = DEFAULT_CONFIG) {
  const rawQuery = new URL(url).search.replace(/^\?/, '');
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);

  let xssStub = '';
  let hasBody = false;
  if (body) {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    hasBody = buf.length > 0;
    if (hasBody) xssStub = md5(buf).toString('hex');
  }

  const headers = {
    'x-argus': getArgus(rawQuery, xssStub, timestamp, cfg),
    'x-ladon': getLadon(timestamp, cfg),
    'x-khronos': String(timestamp),
    'x-ss-req-ticket': String(now),
  };
  if (hasBody) headers['X-SS-STUB'] = xssStub;
  return headers;
}

module.exports = { signRequest, getArgus, getLadon, DEFAULT_CONFIG, aesCbcEncrypt, aesCbcDecrypt, md5 };
