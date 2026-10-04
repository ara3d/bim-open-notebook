// The static site: notebook.html with the sample notebooks bundled as files,
// for GitHub Pages (https://ara3d.github.io/bim-open-notebook/). No host stands
// behind it; src/page/site.ts turns the page's host features off in this mode.
//
//   npm run build:pages -w @bimopenflow/bim-open-notebook --prefix bimopenflow/web
//
// writes the repository's site/app (git-ignored; .github/workflows/pages.yml
// builds it and publishes site/): notebook.html, assets/, NOTICE.md (the
// building licences), and notebooks/ (every sample, index.json with their file
// names, catalog.json with one landing-page entry each). The base is relative,
// so the folder works under any path. --outDir writes elsewhere.

import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import base, { samples } from "./vite.config";
import { bundleSamples } from "./vite/samples";
import { NOTICE_FILE } from "./src/page/sitePaths";

const repository = resolve(__dirname, "../../../..");

/** The public notebooks, in the order the landing page lists them. */
const LEAD = ["p01-schependomlaan", "p02-digitalhub-heating", "p03-duplex-doors"];

/** Copies the repository's NOTICE.md (the sample buildings' licences) into the site. */
function notice(): Plugin {
  return {
    name: "notice",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: NOTICE_FILE, source: readFileSync(resolve(repository, "NOTICE.md"), "utf8") });
    },
  };
}

export default defineConfig({
  ...base,
  mode: "pages",
  base: "./",
  plugins: [bundleSamples(samples, LEAD), notice()],
  build: {
    outDir: resolve(repository, "site/app"),
    emptyOutDir: true,
    rollupOptions: { input: { notebook: resolve(__dirname, "notebook.html") } },
  },
});
