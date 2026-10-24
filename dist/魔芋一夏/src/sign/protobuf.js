'use strict';

/* 極簡 protobuf 編碼器 — 移植自 fanqie-assistant/src/crypto/protobuf.ts */

const WIRE_VARINT = 0;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

class ProtobufWriter {
  constructor() { this.buf = []; }

  _varint(v) {
    let x = v >>> 0;
    while (x >= 0x80) {
      this.buf.push((x & 0x7f) | 0x80);
      x >>>= 7;
    }
    this.buf.push(x & 0x7f);
    return this;
  }

  _key(field, wire) { return this._varint((field << 3) | wire); }

  varint(field, value) { return this._key(field, WIRE_VARINT)._varint(value); }

  fixed32(field, value) {
    this._key(field, WIRE_FIXED32);
    const v = value >>> 0;
    this.buf.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    return this;
  }

  bytes(field, data) {
    this._key(field, WIRE_BYTES)._varint(data.length);
    for (let i = 0; i < data.length; i++) this.buf.push(data[i] & 0xff);
    return this;
  }

  string(field, value) {
    return this.bytes(field, Buffer.from(String(value), 'utf8'));
  }

  message(field, build) {
    const sub = new ProtobufWriter();
    build(sub);
    return this.bytes(field, sub.toBytes());
  }

  toBytes() { return Uint8Array.from(this.buf); }
}

module.exports = { ProtobufWriter };
