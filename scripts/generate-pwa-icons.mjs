import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");
const iconsDir = path.join(rootDir, "public", "icons");

const sourceAnySvg = path.join(iconsDir, "app-icon.svg");
const sourceMaskableSvg = path.join(iconsDir, "app-icon-maskable.svg");

const targets = [
  { src: sourceAnySvg, size: 192, out: "icon-192.png" },
  { src: sourceAnySvg, size: 512, out: "icon-512.png" },
  { src: sourceMaskableSvg, size: 192, out: "icon-192-maskable.png" },
  { src: sourceMaskableSvg, size: 512, out: "icon-512-maskable.png" },
  { src: sourceAnySvg, size: 180, out: "apple-touch-icon.png" }
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function renderSvgToPng({ svg, size }) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size }
  });
  for (const href of resvg.imagesToResolve()) {
    if (href.startsWith("data:")) continue;
    const filePath = path.join(iconsDir, href);
    const buffer = await fs.readFile(filePath);
    resvg.resolveImage(href, buffer);
  }
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

async function readLogoDataUri() {
  const candidates = ["logo.png", "logo.jpg", "logo.jpeg"];
  for (const filename of candidates) {
    const filePath = path.join(iconsDir, filename);
    if (!(await fileExists(filePath))) continue;
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : null;
    if (!mime) continue;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
  return null;
}

function inlineLogo(svg, dataUri) {
  if (!dataUri) return svg;
  return svg
    .replaceAll('href="logo.jpeg"', `href="${dataUri}"`)
    .replaceAll("href='logo.jpeg'", `href='${dataUri}'`)
    .replaceAll('xlink:href="logo.jpeg"', `xlink:href="${dataUri}"`)
    .replaceAll("xlink:href='logo.jpeg'", `xlink:href='${dataUri}'`)
    .replaceAll('href="logo.jpg"', `href="${dataUri}"`)
    .replaceAll("href='logo.jpg'", `href='${dataUri}'`)
    .replaceAll('xlink:href="logo.jpg"', `xlink:href="${dataUri}"`)
    .replaceAll("xlink:href='logo.jpg'", `xlink:href='${dataUri}'`)
    .replaceAll('href="logo.png"', `href="${dataUri}"`)
    .replaceAll("href='logo.png'", `href='${dataUri}'`)
    .replaceAll('xlink:href="logo.png"', `xlink:href="${dataUri}"`)
    .replaceAll("xlink:href='logo.png'", `xlink:href='${dataUri}'`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(iconsDir, { recursive: true });

  if (hasFlag("--if-missing")) {
    const needed = targets.map((t) => path.join(iconsDir, t.out));
    const allPresent = (await Promise.all(needed.map(fileExists))).every(Boolean);
    if (allPresent) return;
  }

  const [anySvg, maskableSvg] = await Promise.all([
    fs.readFile(sourceAnySvg, "utf8"),
    fs.readFile(sourceMaskableSvg, "utf8")
  ]);
  const logoDataUri = await readLogoDataUri();
  const inlinedAnySvg = inlineLogo(anySvg, logoDataUri);
  const inlinedMaskableSvg = inlineLogo(maskableSvg, logoDataUri);

  for (const target of targets) {
    const svg = target.src === sourceMaskableSvg ? inlinedMaskableSvg : inlinedAnySvg;
    const png = await renderSvgToPng({ svg, size: target.size });
    await fs.writeFile(path.join(iconsDir, target.out), png);
  }
}

main().catch((err) => {
  console.error("[gen:icons] Failed to generate PWA icons:", err);
  process.exitCode = 1;
});
