/// <reference types="node" />
// The Vite plugins that hand a page its sample notebooks, exported as
// "@bimopenflow/bim-open-notebook/vite". The caller names the folder of
// *.notebook.json files and, for the static build, which notebooks lead the
// landing-page catalog; nothing here knows which repository it runs in.
//
// A 3D view that recorded its model names it as models/<file> beside the
// notebook (src/document/paths.ts). The caller's `models` option says which
// folder those files are in: the dev server answers /__notebooks/models/<file>
// from it, and the static build copies each named file to notebooks/models/.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Plugin } from "vite";
import { NOTEBOOK_EXTENSION } from "../src/document/format";
import { parseNotebook } from "../src/document/io";
import { MODELS_FOLDER, modelFileName, modelFiles } from "../src/document/paths";
import { notebookEntry, orderNotebooks, type NotebookEntry } from "../src/page/catalog";
import { STATIC_CATALOG, STATIC_INDEX, STATIC_NODE_CATALOG, STATIC_SAMPLES } from "../src/page/sitePaths";

export const NOTEBOOK_SUFFIX = NOTEBOOK_EXTENSION;

export interface SampleOptions {
  /** The folder holding the model files the notebooks' 3D views name as models/<file>; none when absent. */
  readonly models?: string;
}

/** The notebook file names in `dir`, sorted; empty when the folder does not exist. */
function notebookFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(NOTEBOOK_SUFFIX)).sort() : [];
}

/** The model files the notebooks in `dir` name, each with the notebook that first names it, and a problem per path of another shape. */
function namedModels(dir: string): { readonly files: ReadonlyMap<string, string>; readonly problems: readonly string[] } {
  const files = new Map<string, string>();
  const problems: string[] = [];
  for (const name of notebookFiles(dir)) {
    const parsed = parseNotebook(readFileSync(resolve(dir, name), "utf8"));
    if (!parsed.ok) continue; // bundleSamples reports it
    for (const path of modelFiles(parsed.notebook)) {
      const named = modelFileName(path);
      if ("problem" in named) problems.push(`${name}: ${named.problem}`);
      else if (!files.has(named.file)) files.set(named.file, name);
    }
  }
  return { files, problems };
}

/**
 * Serves the notebooks in `dir` in dev: GET /__notebooks/ lists their names,
 * GET /__notebooks/<name> returns one, and GET /__notebooks/models/<file>
 * returns a model file from `options.models`. Read-only; saving goes through
 * the browser's download.
 */
export function sampleNotebooks(dir: string, options: SampleOptions = {}): Plugin {
  return {
    name: "sample-notebooks",
    configureServer(server) {
      server.middlewares.use("/__notebooks", (req, res) => {
        const name = decodeURIComponent((req.url ?? "/").replace(/^\/+/, "").split("?")[0]);
        if (name.startsWith(MODELS_FOLDER)) {
          const named = modelFileName(name);
          const file = options.models && "file" in named ? resolve(options.models, named.file) : undefined;
          if (!file || !existsSync(file)) {
            res.statusCode = 404;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: options.models ? `No model file ${name}` : "This page serves no model files" }));
            return;
          }
          res.setHeader("content-type", "application/octet-stream");
          res.end(readFileSync(file));
          return;
        }
        res.setHeader("content-type", "application/json");
        if (name === "") {
          res.end(JSON.stringify(notebookFiles(dir)));
          return;
        }
        const file = resolve(dir, basename(name));
        if (!file.endsWith(NOTEBOOK_SUFFIX) || !existsSync(file)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `No sample notebook ${name}` }));
          return;
        }
        res.end(readFileSync(file, "utf8"));
      });
    },
  };
}

/**
 * Emits every notebook in `dir` under notebooks/ (sitePaths.ts), with
 * index.json (the file names), catalog.json (one NotebookEntry each, the
 * `lead` names first), and under notebooks/models/ each model file a 3D view
 * names, read from `options.models`, and node-catalog.json (the host's node
 * catalog, scripts/write-node-catalog.ts) when `dir` has one. A notebook that
 * does not parse, a model path of another shape, or a named model file that is
 * missing fails the build; a missing node catalog only warns, and the page's
 * graph cells then draw no wires.
 */
export function bundleSamples(dir: string, lead: readonly string[] = [], options: SampleOptions = {}): Plugin {
  return {
    name: "bundle-sample-notebooks",
    generateBundle() {
      const names = notebookFiles(dir);
      const entries: NotebookEntry[] = [];
      for (const name of names) {
        const text = readFileSync(resolve(dir, name), "utf8");
        const entry = notebookEntry(name, text);
        if ("errors" in entry) this.error(`${name} is not a valid notebook: ${entry.errors.join("; ")}`);
        entries.push(entry);
        this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${name}`, source: text });
      }
      const models = namedModels(dir);
      for (const problem of models.problems) this.error(problem);
      for (const [file, notebook] of models.files) {
        const source = options.models ? resolve(options.models, file) : undefined;
        if (!source || !existsSync(source))
          this.error(`${notebook} names the model ${MODELS_FOLDER}${file}, ${source ? `but ${source} does not exist` : "but no models folder is configured"}`);
        else this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${MODELS_FOLDER}${file}`, source: readFileSync(source) });
      }
      const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
      // The node catalog the graph cells place their ports from: without it a hostless page draws no wires (TKT-159).
      const nodeCatalog = resolve(dir, STATIC_NODE_CATALOG);
      if (existsSync(nodeCatalog)) this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_NODE_CATALOG}`, source: readFileSync(nodeCatalog, "utf8") });
      else this.warn(`${dir} has no ${STATIC_NODE_CATALOG}; the page's graph cells will draw no wires`);
      this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_INDEX}`, source: json(names) });
      this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_CATALOG}`, source: json(orderNotebooks(entries, lead)) });
    },
  };
}
