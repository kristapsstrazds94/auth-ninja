import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

function isBackgroundPixel(r, g, b) {
  // Drop flat black JPEG matte while keeping navy (#080D1D) and brand purples.
  const sum = r + g + b;
  if (sum <= 24) return true;
  if (sum <= 40 && Math.max(r, g, b) - Math.min(r, g, b) <= 8) return true;
  return false;
}

function convertJpegMatteToPng(inputPath, outputPath) {
  const input = fs.readFileSync(inputPath);
  const decoded = jpeg.decode(input, { useTArray: true });
  const png = new PNG({ width: decoded.width, height: decoded.height });

  for (let i = 0; i < decoded.data.length; i += 4) {
    const r = decoded.data[i];
    const g = decoded.data[i + 1];
    const b = decoded.data[i + 2];
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = isBackgroundPixel(r, g, b) ? 0 : 255;
  }

  fs.writeFileSync(outputPath, PNG.sync.write(png));
  console.log(`Wrote ${outputPath} (${decoded.width}x${decoded.height}, RGBA)`);
}

for (const name of ["logo.png", "logo-full.png"]) {
  convertJpegMatteToPng(path.join(publicDir, name), path.join(publicDir, name));
}
