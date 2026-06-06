// Packs PNG files into a single multi-size Windows .ico (PNG-compressed entries, Vista+).
// Usage: node pack-ico.mjs <out.ico> <size:path> [<size:path> ...]
import { readFileSync, writeFileSync } from "node:fs";

const outPath = process.argv[2];
const entries = process.argv.slice(3).map((arg) => {
  const i = arg.indexOf(":");
  const size = Number(arg.slice(0, i));
  const png = readFileSync(arg.slice(i + 1));
  return { size, png };
});

const N = entries.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type 1 = icon
header.writeUInt16LE(N, 4);      // image count

const dir = Buffer.alloc(16 * N);
let offset = 6 + 16 * N;         // image data starts after header + directory
entries.forEach((e, idx) => {
  const o = idx * 16;
  dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 0); // width  (0 means 256)
  dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1); // height (0 means 256)
  dir.writeUInt8(0, o + 2);      // color count (0 = truecolor)
  dir.writeUInt8(0, o + 3);      // reserved
  dir.writeUInt16LE(1, o + 4);   // color planes
  dir.writeUInt16LE(32, o + 6);  // bits per pixel
  dir.writeUInt32LE(e.png.length, o + 8);  // size of image data
  dir.writeUInt32LE(offset, o + 12);        // offset of image data
  offset += e.png.length;
});

const ico = Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
writeFileSync(outPath, ico);
console.log(`wrote ${outPath} (${N} sizes, ${ico.length} bytes)`);
