import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
export function pwaShell() {
  let outDir;
  return { name: "momentum-pwa-shell", apply: "build",
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    async writeBundle(_, bundle) {
      const files = Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file));
      const version = createHash("sha256").update(files.join("|") + await readFile("public/sw.js", "utf8")).digest("hex").slice(0,16);
      const shell = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", ...files.map((file) => "./" + file)];
      const template = await readFile("public/sw.js", "utf8");
      await writeFile(path.join(outDir, "sw.js"), template.replace('"__CACHE_VERSION__"', JSON.stringify("momentum-" + version)).replace('"__PRECACHE__"', JSON.stringify(shell)));
    },
  };
}
