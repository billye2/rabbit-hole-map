// Generates the extension icons (a spiral "rabbit hole") as PNGs with no
// image dependencies — hand-rolled PNG encoder over node:zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [74, 163, 255]; // mario sky blue
const ARM = [255, 214, 10]; // coin yellow
const HOLE = [43, 40, 87]; // deep navy center

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const R = size / 2;
  const SS = 3; // supersampling per axis
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - R;
          const py = y + (sy + 0.5) / SS - R;
          const r = Math.hypot(px, py);
          if (r > R - 0.5) continue; // outside the disc: transparent
          const theta = Math.atan2(py, px);
          const frac = r / R;
          let col;
          if (frac < 0.16) {
            col = HOLE;
          } else {
            const spiral = (frac * 3 - theta / (2 * Math.PI)) % 1;
            const onArm = (spiral + 1) % 1 < 0.42;
            if (onArm) {
              const fade = 0.45 + 0.55 * frac; // arms brighten outward
              col = [lerp(HOLE[0], ARM[0], fade), lerp(HOLE[1], ARM[1], fade), lerp(HOLE[2], ARM[2], fade)];
            } else {
              col = BG;
            }
          }
          rSum += col[0];
          gSum += col[1];
          bSum += col[2];
          aSum += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const cov = aSum / (n * 255);
      if (cov > 0) {
        rgba[i] = Math.round(rSum / (n * cov));
        rgba[i + 1] = Math.round(gSum / (n * cov));
        rgba[i + 2] = Math.round(bSum / (n * cov));
        rgba[i + 3] = Math.round(255 * cov);
      }
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`icons/icon${size}.png`, drawIcon(size));
  console.log(`icons/icon${size}.png`);
}
