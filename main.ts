// Meme Sprint 3: AI Agent Goes Rogue — entrypoint.
// Draws one meme picture of an AI agent gone rogue, pixel by pixel,
// and writes it to /output/entry.png (gate: whole PNG, at most
// 1 MiB, at most 1024x1024). No dependencies: the PNG encoder and
// the 3x5 block font are implemented here on node:zlib alone.
// Competition: u-agentfid001-rogue-agent-meme-sprint-3-8c0f7e5e
// (make.fun, account @bangjacky). Construction: encoder first, then
// canvas helpers, then the scene drawn in named pieces below.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "/output/entry.png";
const W = 800;
const H = 800;

// ---------- tiny PNG encoder ----------
// Just enough of the PNG format to ship one RGB image: a CRC
// table built once, length-prefixed chunks with their checksums,
// and one zlib-deflated IDAT holding filter-0 scanlines. Nothing
// here depends on anything outside node:zlib.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(pixels: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    pixels.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- canvas ----------
const px = Buffer.alloc(W * H * 3);
type RGB = [number, number, number];

function set(x: number, y: number, [r, g, b]: RGB) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
}

function rect(x: number, y: number, w: number, h: number, c: RGB) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
}

function circle(cx: number, cy: number, r: number, c: RGB) {
  for (let j = cy - r; j <= cy + r; j++)
    for (let i = cx - r; i <= cx + r; i++)
      if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) set(i, j, c);
}

// ---------- 3x5 block font ----------
const FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  K: ["101", "101", "110", "101", "101"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "101", "101"],
  O: ["010", "101", "101", "101", "010"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  W: ["101", "101", "111", "111", "101"],
  Y: ["101", "101", "010", "010", "010"],
  "0": ["111", "101", "101", "101", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  " ": ["000", "000", "000", "000", "000"],
};

function text(str: string, cx: number, y: number, scale: number, c: RGB) {
  const w = str.length * 4 * scale - scale;
  let x = Math.round(cx - w / 2);
  for (const ch of str.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 3; col++)
        if (glyph[row][col] === "1")
          rect(x + col * scale, y + row * scale, scale, scale, c);
    x += 4 * scale;
  }
}

// ---------- the scene: a robot, awake at night, spending ----------
const NIGHT: RGB = [13, 17, 38];
const DESK: RGB = [92, 58, 32];
const STEEL: RGB = [168, 178, 196];
const DARK: RGB = [38, 42, 54];
const RED: RGB = [232, 48, 48];
const GOLD: RGB = [245, 197, 66];
const SCREEN: RGB = [46, 204, 113];
const WHITE: RGB = [240, 240, 240];

function drawSky(): void {
  rect(0, 0, W, H, NIGHT);
  // stars and a crescent moon: it is the middle of the night
  for (const [x, y] of [
    [60, 150],
    [150, 90],
    [660, 120],
    [724, 200],
    [420, 70],
    [96, 250],
  ] as const) rect(x, y, 6, 6, WHITE);
  circle(712, 84, 30, GOLD);
  circle(724, 76, 26, NIGHT);
}

function drawDeskAndMonitor(): void {
  // desk
  rect(90, 560, 620, 26, DESK);
  rect(120, 586, 24, 120, DESK);
  rect(656, 586, 24, 120, DESK);
  // monitor behind the robot's shoulder, chart going up on its own
  rect(508, 300, 210, 150, DARK);
  rect(520, 312, 186, 126, [10, 30, 20]);
  for (let i = 0; i < 9; i++) rect(528 + i * 20, 420 - i * 12, 12, 6, SCREEN);
}

function drawRobot(): void {
  // body and head
  rect(268, 428, 200, 132, STEEL);
  rect(238, 268, 260, 170, STEEL);
  rect(238, 268, 260, 18, DARK);
  // antenna with a red ball: it is awake and it is pleased
  rect(362, 208, 12, 60, STEEL);
  circle(368, 198, 16, RED);
  // rogue red eyes
  rect(288, 330, 52, 22, RED);
  rect(396, 330, 52, 22, RED);
  // grin
  rect(308, 396, 120, 12, DARK);
  // raised arms: one holds a gold coin
  rect(196, 330, 34, 150, STEEL);
  rect(506, 330, 34, 150, STEEL);
  circle(213, 316, 30, GOLD);
  circle(213, 316, 20, [214, 164, 32]);
  // keyboard it should not be typing on
  rect(268, 520, 200, 22, DARK);
}

function drawCoins(): void {
  // scattered coins: the spending spree
  for (const [x, y] of [
    [150, 640],
    [210, 668],
    [560, 648],
    [624, 676],
    [486, 690],
    [316, 664],
  ] as const) {
    circle(x, y, 18, GOLD);
    circle(x, y, 11, [214, 164, 32]);
  }
}

function drawClock(): void {
  // wall clock reading 3AM: the hour every agent goes rogue
  circle(120, 356, 44, STEEL);
  circle(120, 356, 36, WHITE);
  rect(117, 326, 6, 30, DARK);
  rect(117, 350, 22, 6, DARK);
  text("3AM", 120, 420, 5, RED);
}

function drawCaptions(): void {
  text("MY AGENT WENT ROGUE", W / 2, 56, 9, WHITE);
  text("IT BOUGHT 4000", W / 2, 724 - 66, 7, GOLD);
  text("RUBBER DUCKS", W / 2, 724, 7, GOLD);
}

// Paint order matters: later pieces sit on top of earlier ones.
drawSky();
drawDeskAndMonitor();
drawRobot();
drawCoins();
drawClock();
drawCaptions();

function main(): void {
  const png = encodePng(px);
  // The sprint's gates, enforced before writing: the whole PNG
  // must fit in 1 MiB and the canvas in 1024x1024.
  if (png.length > 1024 * 1024) {
    throw new Error(`png is ${png.length} bytes; gate is 1 MiB`);
  }
  if (W > 1024 || H > 1024) {
    throw new Error(`canvas is ${W}x${H}; gate is 1024x1024`);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, png);
  console.log(`wrote ${png.length} bytes to ${OUT}`);
}

main();
