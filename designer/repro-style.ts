import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { BunPlugin } from "bun";
const NM = path.resolve(import.meta.dir, "node_modules");
const npmPlugin: BunPlugin = {
  name: "npm",
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom|scheduler)(\/.+)?$/ }, async (a) => {
      for (const c of [`${NM}/${a.path}.js`, `${NM}/${a.path}/index.js`]) {
        if (await Bun.file(c).exists()) return { path: c };
      }
      return undefined;
    });
  },
};
const appPath = path.resolve(import.meta.dir, ".test-root/stylecase/App.jsx");
const dir = await mkdtemp(path.join(tmpdir(), "pe-"));
const entry = path.join(dir, "entry.jsx");
await writeFile(entry, `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "__preview_app__";\nconst c=document.getElementById("preview-container");\nif(c) createRoot(c).render(React.createElement(App));\n`);
try {
  const built = await Bun.build({
    entrypoints: [entry], target: "browser", format: "esm",
    plugins: [
      { name: "app", setup(b) { b.onResolve({ filter: /^__preview_app__$/ }, () => ({ path: appPath })); } },
      npmPlugin,
    ],
  });
  console.log("outputs:", built.outputs.map((o, i) => `[${i}] kind=${o.kind} path=${path.basename(o.path)}`));
  for (const o of built.outputs) {
    if (o.path.endsWith(".css")) console.log("CSS CONTENT:\n" + (await o.text()));
  }
} catch (e: any) {
  console.log("THREW:", e.message, e.errors?.map((x: any) => x.message));
}
await rm(dir, { recursive: true, force: true });
