/**
 * Trim wordmark from logo.png, regenerate PWA icons from the orange mark.
 * Bounding boxes are computed from pixel data — no hardcoded crop coordinates.
 * Usage: node scripts/process-logo.mjs
 */
import sharp from "sharp";
import toIco from "to-ico";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const source = join(publicDir, "logo.png");

const ORANGE = { r: 255, g: 120, b: 26 };

function isOrange(r, g, b, alpha) {
  if (alpha < 10) return false;
  return r > 200 && g > 60 && g < 180 && b < 80;
}

function isWhite(r, g, b) {
  return r >= 250 && g >= 250 && b >= 250;
}

async function loadRgba(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: Buffer.from(data), width: info.width, height: info.height, channels: info.channels };
}

function whiteToTransparent(pixels, channels) {
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (isWhite(r, g, b)) {
      pixels[i + 3] = 0;
    }
  }
}

function columnCounts(pixels, width, height, channels) {
  const counts = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (pixels[i + 3] > 10) counts[x]++;
    }
  }
  return counts;
}

function findMarkRightEdge(counts, width) {
  const searchEnd = Math.min(width, Math.ceil(width * 0.55));
  let bestGapStart = Math.min(120, width);
  let bestGapLen = 0;
  let gapStart = 0;
  let gapLen = 0;

  for (let x = 1; x < searchEnd; x++) {
    if (counts[x] === 0) {
      if (gapLen === 0) gapStart = x;
      gapLen++;
    } else {
      if (gapLen > bestGapLen) {
        bestGapLen = gapLen;
        bestGapStart = gapStart;
      }
      gapLen = 0;
    }
  }
  if (gapLen > bestGapLen) {
    bestGapLen = gapLen;
    bestGapStart = gapStart;
  }

  return bestGapLen >= 2 ? bestGapStart : Math.min(120, width);
}

function boundsInRegion(pixels, width, height, channels, maxX) {
  let minX = width;
  let minY = height;
  let maxXFound = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < maxX; x++) {
      const i = (y * width + x) * channels;
      if (pixels[i + 3] > 10) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxXFound) maxXFound = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return null;
  return {
    left: minX,
    top: minY,
    width: maxXFound - minX + 1,
    height: maxY - minY + 1,
  };
}

function boundsAll(pixels, width, height, channels) {
  return boundsInRegion(pixels, width, height, channels, width);
}

async function makeWordmark() {
  const { pixels, width, height, channels } = await loadRgba(source);
  whiteToTransparent(pixels, channels);

  const wordmarkBounds = boundsAll(pixels, width, height, channels);
  if (!wordmarkBounds) throw new Error("No visible pixels in logo.png");

  const out = join(publicDir, "logo-wordmark.png");
  await sharp(pixels, { raw: { width, height, channels } })
    .extract(wordmarkBounds)
    .png()
    .toFile(out);

  const meta = await sharp(out).metadata();
  console.log(
    `logo-wordmark.png: ${meta.width}×${meta.height} (source crop ${wordmarkBounds.width}×${wordmarkBounds.height})`,
  );
  return { wordmarkBounds, wordmarkPath: out, meta };
}

async function extractMark(wordmarkPath, wordmarkBounds) {
  const { pixels, width, height, channels } = await loadRgba(wordmarkPath);
  const counts = columnCounts(pixels, width, height, channels);
  const markRight = findMarkRightEdge(counts, width);
  const markBounds = boundsInRegion(pixels, width, height, channels, markRight);

  if (!markBounds) throw new Error("Could not detect mark bounding box");

  console.log(
    `mark bounds: ${markBounds.width}×${markBounds.height} at (${markBounds.left},${markBounds.top}), right edge col ${markRight}`,
  );
  console.log(`wordmark bounds: ${width}×${height}`);

  const markBuffer = await sharp(pixels, { raw: { width, height, channels } })
    .extract(markBounds)
    .trim({ threshold: 1 })
    .png()
    .toBuffer();

  const markMeta = await sharp(markBuffer).metadata();
  console.log(`trimmed mark: ${markMeta.width}×${markMeta.height}`);
  return markBuffer;
}

async function paddedIcon(markBuffer, size, paddingPct) {
  const meta = await sharp(markBuffer).metadata();
  const padX = Math.round(meta.width * paddingPct);
  const padY = Math.round(meta.height * paddingPct);

  const padded = await sharp(markBuffer)
    .extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(padded)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function writeIcons(markBuffer) {
  const pngSizes = [
    { file: "icon-192.png", size: 192, padding: 0.12 },
    { file: "icon-512.png", size: 512, padding: 0.12 },
    { file: "icon-512-maskable.png", size: 512, padding: 0.2 },
    { file: "apple-touch-icon.png", size: 180, padding: 0.12 },
  ];

  for (const { file, size, padding } of pngSizes) {
    const out = join(publicDir, file);
    const buf = await paddedIcon(markBuffer, size, padding);
    await writeFile(out, buf);
    console.log(`wrote ${file} (${size}×${size}, ${Math.round(padding * 100)}% pad)`);
  }

  const faviconSizes = [16, 32, 48];
  const faviconFrames = await Promise.all(
    faviconSizes.map((size) => paddedIcon(markBuffer, size, 0.12)),
  );
  await writeFile(join(publicDir, "favicon.ico"), await toIco(faviconFrames));
  console.log(`wrote favicon.ico (${faviconSizes.join(", ")}px)`);
}

const { wordmarkBounds, wordmarkPath } = await makeWordmark();
const mark = await extractMark(wordmarkPath, wordmarkBounds);
await writeIcons(mark);
console.log("done");
