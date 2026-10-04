/// <reference types="node" />
// Writes the host's node catalog beside the sample notebooks, so the static
// site (vite.pages.config.ts) can ship it and a hostless page can draw ports
// and wires in its graph cells (TKT-159). Run it against the same host the
// samples were written with, from bimopenflow/web/packages/bim-open-notebook:
//
//   npx vite-node scripts/write-node-catalog.ts -- --host http://127.0.0.1:5431 \
//     --out ../../../../samples/notebooks
//
// The file is <out>/node-catalog.json (sitePaths.ts, STATIC_NODE_CATALOG): the
// NodeCatalog the host answers at GET /api/catalog/nodes, pretty-printed with
// its kinds sorted so a regeneration diffs cleanly. The script fails when the
// catalog lacks a kind that a notebook in <out> uses, because that notebook's
// cells would then draw that node portless.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ApiClient } from "@bimopenflow/api-client";
import type { NodeCatalog } from "@bimopenflow/contracts";
import { parseDocument } from "@bimopenflow/state";
import { NOTEBOOK_EXTENSION } from "../src/document/format";
import { parseNotebook } from "../src/document/io";
import { STATIC_NODE_CATALOG } from "../src/page/staticApi";

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/** The catalog with its kinds in order, the shape the file keeps. */
export function sortedCatalog(catalog: NodeCatalog): NodeCatalog {
  return { nodes: [...catalog.nodes].sort((a, b) => a.kind.localeCompare(b.kind)) };
}

/** Every node kind the graph embeds of the notebooks in `dir` use. */
export function kindsUsedBy(dir: string): Set<string> {
  const kinds = new Set<string>();
  for (const name of readdirSync(dir).filter((f) => f.endsWith(NOTEBOOK_EXTENSION))) {
    const parsed = parseNotebook(readFileSync(join(dir, name), "utf8"));
    if (!parsed.ok) throw new Error(`${name} is not a valid notebook: ${parsed.errors.join("; ")}`);
    for (const turn of parsed.notebook.turns)
      for (const embed of turn.reply.embeds)
        if (embed.kind === "graph" && embed.document !== undefined)
          for (const node of parseDocument(embed.document).structure.nodes) kinds.add(node.kind);
  }
  return kinds;
}

/** The kinds in `used` that `catalog` does not declare. */
export function missingKinds(catalog: NodeCatalog, used: ReadonlySet<string>): string[] {
  const have = new Set(catalog.nodes.map((n) => n.kind));
  return [...used].filter((k) => !have.has(k)).sort();
}

async function main(): Promise<void> {
  const api = new ApiClient({ baseUrl: requiredOption("--host") });
  const out = resolve(requiredOption("--out"));
  const catalog = sortedCatalog(await api.getNodeCatalog());
  const missing = missingKinds(catalog, kindsUsedBy(out));
  if (missing.length) throw new Error(`The host's catalog lacks kinds the notebooks use: ${missing.join(", ")}`);
  const file = join(out, STATIC_NODE_CATALOG);
  writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`${file}: ${catalog.nodes.length} node kinds`);
}

if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
