// Generates PWA PNG icons from public/icon.svg using sharp.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "apps", "web", "public", "icon.svg");
const OUT = join(__dirname, "..", "apps", "web", "public");

const sizes = [192, 512];
for (const s of sizes) {
  await sharp(SRC).resize(s, s).png().toFile(join(OUT, `icon-${s}.png`));
  console.log("wrote", `icon-${s}.png`);
}
// maskable: pad into a safe zone (80% inner) on the accent background
const PAD = 512;
const maskBg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD}" height="${PAD}"><rect width="${PAD}" height="${PAD}" fill="#6366f1"/></svg>`,
);
const inner = await sharp(SRC).resize(Math.round(PAD * 0.8), Math.round(PAD * 0.8)).png().toBuffer();
await sharp(maskBg)
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(join(OUT, "icon-maskable-512.png"));
console.log("wrote icon-maskable-512.png");
// apple touch icon
await sharp(SRC).resize(180, 180).png().toFile(join(OUT, "apple-touch-icon.png"));
console.log("wrote apple-touch-icon.png");
