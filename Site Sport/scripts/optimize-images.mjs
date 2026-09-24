import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
const sources = path.resolve("assets", "exercise-sources");
const destination = path.resolve("public", "exercises");
const files = (await readdir(sources)).filter((file) => file.endsWith(".png"));
let changed = 0;
for (const file of files) {
  const source = path.join(sources, file), target = path.join(destination, file.replace(/\.png$/, ".webp"));
  const existing = await stat(target).catch(() => null);
  if (existing && existing.mtimeMs >= (await stat(source)).mtimeMs) continue;
  await sharp(source).resize(960, 720, { fit: "contain", background: "#101311" }).webp({ quality: 82, effort: 5 }).toFile(target);
  changed++;
}
console.log("Illustrations optimisées : " + changed + " / " + files.length + " (960 × 720, WebP).");
