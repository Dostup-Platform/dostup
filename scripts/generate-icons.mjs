/**
 * Derive PWA / favicon assets from logo-wordmark.png (wordmark only).
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile, access } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const wordmarkPath = join(publicDir, "logo-wordmark.png");

async function describeBuffer(label, buffer) {
  const meta = await sharp(buffer).metadata();
  const hasAlpha = meta.hasAlpha === true || meta.channels === 4;
  console.log(`${label}: ${meta.width}×${meta.height}, alpha=${hasAlpha}`);
}

async function describeOutput(filePath) {
  const meta = await sharp(filePath).metadata();
  const hasAlpha = meta.hasAlpha === true || meta.channels === 4;
  console.log(
    `${basename(filePath)}: ${meta.width}×${meta.height}, alpha=${hasAlpha}`,
  );
}

async function resizeWordmark(wordmark, size, paddingPct, { opaque = false } = {}) {
  const meta = await sharp(wordmark).metadata();
  const innerWidth = Math.round(size * (1 - paddingPct * 2));
  const scaledHeight = Math.round(meta.height * (innerWidth / meta.width));
  const leftPad = Math.floor((size - innerWidth) / 2);
  const topPad = Math.floor((size - scaledHeight) / 2);

  const resized = await sharp(wordmark)
    .resize(innerWidth, scaledHeight, { fit: "fill" })
    .png()
    .toBuffer();

  const background = opaque
    ? { r: 255, g: 255, b: 255, alpha: 1 }
    : { r: 0, g: 0, b: 0, alpha: 0 };

  let pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  }).composite([{ input: resized, top: topPad, left: leftPad }]);

  if (opaque) {
    pipeline = pipeline
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha();
  }

  return pipeline.png().toBuffer();
}

async function main() {
  await access(wordmarkPath).catch(() => {
    throw new Error("logo-wordmark.png is missing from public/");
  });

  const meta = await sharp(wordmarkPath).metadata();
  console.log(`source logo-wordmark.png: ${meta.width}×${meta.height}`);

  const favicon32 = await resizeWordmark(wordmarkPath, 32, 0);
  const favicon32Path = join(publicDir, "favicon-32.png");
  await writeFile(favicon32Path, favicon32);
  await describeOutput(favicon32Path);

  const faviconSizes = [16, 32, 48];
  const faviconFrames = await Promise.all(
    faviconSizes.map((size) => resizeWordmark(wordmarkPath, size, 0)),
  );
  for (let i = 0; i < faviconSizes.length; i++) {
    await describeBuffer(`favicon.ico frame ${faviconSizes[i]}px`, faviconFrames[i]);
  }
  const icoPath = join(publicDir, "favicon.ico");
  await writeFile(icoPath, await pngToIco(faviconFrames));
  console.log("favicon.ico: multi-frame ICO (16, 32, 48px via png-to-ico)");

  const transparentTiles = [
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
  ];
  for (const { file, size } of transparentTiles) {
    const out = join(publicDir, file);
    await writeFile(out, await resizeWordmark(wordmarkPath, size, 0));
    await describeOutput(out);
  }

  const appleTouchPath = join(publicDir, "apple-touch-icon.png");
  await writeFile(
    appleTouchPath,
    await resizeWordmark(wordmarkPath, 180, 0.1, { opaque: true }),
  );
  await describeOutput(appleTouchPath);

  const maskablePath = join(publicDir, "icon-maskable-512.png");
  await writeFile(
    maskablePath,
    await resizeWordmark(wordmarkPath, 512, 0.2, { opaque: true }),
  );
  await describeOutput(maskablePath);

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
