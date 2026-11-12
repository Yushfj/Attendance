/**
 * Re-download face-api.js model weights into public/models.
 * Usage: node scripts/download-models.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "models");
const base =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const files = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model-shard1",
  "ssd_mobilenetv1_model-shard2",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
];

await mkdir(outDir, { recursive: true });

for (const file of files) {
  const url = `${base}/${file}`;
  process.stdout.write(`Downloading ${file}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(outDir, file), buf);
  console.log(`${buf.length} bytes`);
}

console.log("Done.");
