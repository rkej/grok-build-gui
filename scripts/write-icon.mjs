#!/usr/bin/env node
/**
 * Writes resources/icon.png (1024²) with no extra dependencies.
 * Packaged builds call this before electron-builder.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const BG = [26, 27, 30, 255];
const FG = [244, 241, 234, 255];
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "resources");
const OUT = path.join(DIR, "icon.png");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const take = crc & 1;
      crc >>>= 1;
      if (take) crc ^= 0xedb88320;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const payload = Buffer.concat([name, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([len, payload, crc]);
}

function inSpark(x, y) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  const arm = SIZE * 0.28;
  const thick = SIZE * 0.048;
  return dx / arm + dy / thick <= 1 || dx / thick + dy / arm <= 1;
}

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y += 1) {
  const row = y * (1 + SIZE * 4);
  raw[row] = 0;
  for (let x = 0; x < SIZE; x += 1) {
    const px = row + 1 + x * 4;
    const color = inSpark(x, y) ? FG : BG;
    raw[px] = color[0];
    raw[px + 1] = color[1];
    raw[px + 2] = color[2];
    raw[px + 3] = color[3];
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(DIR, { recursive: true });
writeFileSync(OUT, png);
if (createHash("sha256").update(png).digest("hex").length !== 64) {
  throw new Error("icon write failed");
}
process.stdout.write(`${OUT}\n`);
