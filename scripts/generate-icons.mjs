/**
 * Derive PWA / favicon assets.
 * Favicons: full wordmark (transparent). Tiles: square "D" from icon-source.png.
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile, access, unlink } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const logoPath = join(publicDir, "logo.png");
const wordmarkPath = join(publicDir, "logo-wordmark.png");
const iconSourcePath = join(publicDir, "icon-source.png");

function isWhite(r, g, b) {
  return r >= 250 && g >= 250 && b >= 250;
}

async function loadRgba(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    pixels: Buffer.from(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

function whiteToTransparent(pixels, channels) {
  for (let i = 0; i < pixels.length; i += channels) {
    if (isWhite(pixels[i], pixels[i + 1], pixels[i + 2])) {
      pixels[i + 3] = 0;
    }
  }
}

function contentBounds(pixels, width, height, channels) {
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (pixels[i + 3] > 10) {
        found = true;
        if (x < left) left = x;
        if (y < top) top = y;
        if (x > right) right = x;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (!found) {
    throw new Error("No visible content found when building wordmark");
  }

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function resolveWordmarkPath() {
  try {
    await access(wordmarkPath);
    return wordmarkPath;
  } catch {
    console.log("logo-wordmark.png missing — rebuilding from logo.png (in memory)");

    const { pixels, width, height, channels } = await loadRgba(logoPath);
    whiteToTransparent(pixels, channels);
    const bbox = contentBounds(pixels, width, height, channels);

    const tempPath = join(publicDir, ".wordmark-temp.png");
    await sharp(pixels, { raw: { width, height, channels } })
      .extract(bbox)
      .png()
      .toFile(tempPath);

    const meta = await sharp(tempPath).metadata();
    console.log(`temporary wordmark: ${meta.width}×${meta.height}`);
    return tempPath;
  }
}

async function describeOutput(filePath) {
  const meta = await sharp(filePath).metadata();
  const hasAlpha = meta.hasAlpha === true || meta.channels === 4;
  console.log(
    `${basename(filePath)}: ${meta.width}×${meta.height}, alpha=${hasAlpha}`,
  );
}

async function resizeWordmarkFavicon(wordmark, size) {
  const meta = await sharp(wordmark).metadata();
  const scaledHeight = Math.round(meta.height * (size / meta.width));
  const topPad = Math.floor((size - scaledHeight) / 2);
  const bottomPad = size - scaledHeight - topPad;

  return sharp(wordmark)
    .resize(size, scaledHeight, { fit: "fill" })
    .extend({
      top: topPad,
      bottom: bottomPad,
      left: 0,
      right: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function resizeSquareTransparent(sourcePath, size) {
  return sharp(sourcePath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function resizeWithPaddingOnWhite(sourcePath, size, paddingPct) {
  const inner = Math.round(size * (1 - paddingPct * 2));
  const pad = Math.floor((size - inner) / 2);

  const mark = await sharp(sourcePath)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toBuffer();
}

async function exportFavicons(wordmark) {
  const favicon32Path = join(publicDir, "favicon-32.png");
  const favicon32 = await resizeWordmarkFavicon(wordmark, 32);
  await writeFile(favicon32Path, favicon32);
  await describeOutput(favicon32Path);

  const faviconFrames = await Promise.all(
    [16, 32, 48].map((size) => resizeWordmarkFavicon(wordmark, size)),
  );
  const icoPath = join(publicDir, "favicon.ico");
  await writeFile(icoPath, await pngToIco(faviconFrames));
  console.log("favicon.ico: 16×16, 32×32, 48×48 frames (via png-to-ico), alpha=true");
}

async function exportTiles() {
  await access(iconSourcePath).catch(() => {
    throw new Error("icon-source.png is missing — run mark crop step first");
  });

  const tileExports = [
    { file: "icon-192.png", size: 192, fn: () => resizeSquareTransparent(iconSourcePath, 192) },
    { file: "icon-512.png", size: 512, fn: () => resizeSquareTransparent(iconSourcePath, 512) },
    {
      file: "apple-touch-icon.png",
      size: 180,
      fn: () => resizeWithPaddingOnWhite(iconSourcePath, 180, 0.1),
    },
  ];

  for (const { file, fn } of tileExports) {
    const out = join(publicDir, file);
    await writeFile(out, await fn());
    await describeOutput(out);
  }

  const maskablePath = join(publicDir, "icon-maskable-512.png");
  await writeFile(
    maskablePath,
    await resizeWithPaddingOnWhite(iconSourcePath, 512, 0.2),
  );
  await describeOutput(maskablePath);
}

const wordmark = await resolveWordmarkPath();
await exportFavicons(wordmark);
await exportTiles();

if (wordmark.endsWith(".wordmark-temp.png")) {
  await unlink(wordmark).catch(() => {});
}

console.log("done");
