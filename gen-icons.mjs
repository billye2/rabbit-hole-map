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

// A white rabbit peeking out of its hole, on the sky-blue badge.
const SKY = [74, 163, 255]; // mario sky blue
const NAVY = [43, 40, 87]; // the hole, eyes
const WHITE = [255, 255, 255]; // the rabbit
const PINK = [255, 158, 181]; // inner ears, nose

// Shape tests in unit coordinates (0..1 across the icon).
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inVCapsule = (x, y, cx, y0, y1, halfW) => {
  const yy = Math.max(y0, Math.min(y1, y));
  return (x - cx) ** 2 + (y - yy) ** 2 <= halfW * halfW;
};

function rabbitColor(ux, uy) {
  // Topmost shape wins.
  if (inCircle(ux, uy, 0.435, 0.555, 0.024) || inCircle(ux, uy, 0.565, 0.555, 0.024)) return NAVY; // eyes
  if (inCircle(ux, uy, 0.5, 0.615, 0.021)) return PINK; // nose
  if (inCircle(ux, uy, 0.5, 0.58, 0.215)) return WHITE; // head
  if (inVCapsule(ux, uy, 0.395, 0.2, 0.38, 0.027) || inVCapsule(ux, uy, 0.605, 0.2, 0.38, 0.027)) return PINK; // inner ears
  if (inVCapsule(ux, uy, 0.395, 0.16, 0.42, 0.063) || inVCapsule(ux, uy, 0.605, 0.16, 0.42, 0.063)) return WHITE; // ears
  if (inEllipse(ux, uy, 0.5, 0.8, 0.36, 0.11)) return NAVY; // the rabbit hole
  return SKY;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const R = size / 2;
  const SS = 3; // supersampling per axis
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (Math.hypot(px - R, py - R) > R - 0.5) continue; // outside the disc: transparent
          const col = rabbitColor(px / size, py / size);
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
