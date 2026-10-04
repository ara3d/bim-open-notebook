// @vitest-environment node
/// <reference types="node" />
// NOTICE.md at the repository root carries the licence of every building the
// public sample notebooks read. Its building sections are copies of the
// sections of the same name in bim-open-data's samples/public/NOTICE.md (one
// source, copied: the plan's planned debt), so this test fails when a copy
// drifts from the pinned bim-open-data, and when a sample graph names a
// building file that no section lists.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseNotebook } from "../src/document/io";
import { sampleGraphFiles } from "../scripts/embedLayouts";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const SAMPLES = join(ROOT, "samples", "notebooks");
const NOTICE = join(ROOT, "NOTICE.md");
const DATA_NOTICE = join(ROOT, "deps", "bim-open-data", "samples", "public", "NOTICE.md");

const read = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

/** Each `## ` section of a Markdown file, heading line included, keyed by its heading text. */
function sections(markdown: string): Map<string, string> {
  const parts = markdown.split(/^(?=## )/m).filter((part) => part.startsWith("## "));
  return new Map(parts.map((part) => [part.slice(3, part.indexOf("\n")).trim(), part.trimEnd()]));
}

/** The `{PUBLIC}/<file>` names in a graph document's text. */
const publicFiles = (text: string): string[] => [...text.matchAll(/\{PUBLIC\}\/([^"\\]+)/g)].map((m) => m[1]);

const notebookNames = readdirSync(SAMPLES)
  .filter((f) => f.endsWith(".notebook.json"))
  .map((f) => f.replace(/\.notebook\.json$/, ""));

/**
 * Every building file a sample reads: each `{PUBLIC}/x` its graphs name, and
 * for a graph a view3d embed shows, the `.bos` beside a named `.duckdb` (the
 * 3D view loads the model from the catalog under that name).
 */
function filesRead(name: string): string[] {
  const graphs = sampleGraphFiles(name, SAMPLES, []);
  const parsed = parseNotebook(read(join(SAMPLES, `${name}.notebook.json`)));
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const shown3d = new Set(
    parsed.notebook.turns.flatMap((t) => t.reply.embeds).flatMap((e) => (e.kind === "view3d" ? [e.source.analysisId] : [])),
  );
  return [...graphs].flatMap(([id, file]) => {
    const named = publicFiles(read(file));
    const models = shown3d.has(id) ? named.filter((f) => f.endsWith(".duckdb")).map((f) => f.replace(/\.duckdb$/, ".bos")) : [];
    return [...named, ...models];
  });
}

describe("NOTICE.md", () => {
  const notice = sections(read(NOTICE));
  const data = sections(read(DATA_NOTICE));

  it("has a building section for each of bim-open-data's", () => {
    expect([...notice.keys()].sort()).toEqual([...data.keys()].sort());
  });

  it.each([...data.keys()])("its %s section equals bim-open-data's", (heading) => {
    expect(notice.get(heading)).toBe(data.get(heading));
  });

  it.each(notebookNames)("lists every building file %s reads", (name) => {
    const files = filesRead(name);
    expect(files.length).toBeGreaterThan(0);
    const listed = [...notice.values()].join("\n");
    expect(files.filter((file) => !listed.includes(`\`${file}\``))).toEqual([]);
  });

  it("finds the files a graph names, and a section's files by their backquoted names", () => {
    expect(publicFiles('{"path": "{PUBLIC}/duplex.duckdb", "sql": "x"}')).toEqual(["duplex.duckdb"]);
    const parsed = sections("# T\n\nintro\n\n## A\n\nFiles: `a.bos`.\n\n## B\n\nb\n");
    expect([...parsed.keys()]).toEqual(["A", "B"]);
    expect(parsed.get("A")).toBe("## A\n\nFiles: `a.bos`.");
  });
});
