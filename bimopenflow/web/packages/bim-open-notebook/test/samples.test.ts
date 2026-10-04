// @vitest-environment node
/// <reference types="node" />
// This repository's public sample notebooks (samples/notebooks, written by
// scripts/write-sample-notebooks.ts over flow's generic host and
// bim-open-data's samples/public): they parse, they name no machine-local
// path, their graph cards sit where their graph files put them, and their
// headline numbers equal the counts in samples/public/samples.json, which is
// read here rather than copied.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Embed, Notebook, TableSnapshot } from "../src/document/format";
import { parseNotebook } from "../src/document/io";
import { sampleGraphFiles, staleLayouts } from "../scripts/embedLayouts";
import { outlineErrors } from "../scripts/outline";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const SAMPLES = join(ROOT, "samples", "notebooks");
const OUTLINES = join(SAMPLES, "outlines");
const PUBLIC = join(ROOT, "deps", "bim-open-data", "samples", "public");

const sampleFiles = readdirSync(SAMPLES).filter((f) => f.endsWith(".notebook.json"));
const outlineFiles = readdirSync(OUTLINES).filter((f) => f.endsWith(".outline.json"));
const nameOf = (file: string) => file.replace(/\.(notebook|outline)\.json$/, "");

interface SampleEntry {
  readonly name: string;
  readonly counts: Readonly<Record<string, number>>;
}

/** bim-open-data's own counts per converted sample, by sample name. */
function publicCounts(): ReadonlyMap<string, Readonly<Record<string, number>>> {
  const file = join(PUBLIC, "samples.json");
  if (!existsSync(file)) throw new Error(`${file} is missing; run node deps.mjs at the repository root`);
  const { samples } = JSON.parse(readFileSync(file, "utf8")) as { samples: SampleEntry[] };
  return new Map(samples.map((s) => [s.name, s.counts]));
}

/** The count of one IFC class in one sample; a class samples.json does not list has none. */
function countOf(sample: string, ifcClass: string): number {
  const counts = publicCounts().get(sample);
  if (!counts) throw new Error(`samples.json has no sample "${sample}"`);
  return counts[ifcClass] ?? 0;
}

function load(name: string): Notebook {
  const parsed = parseNotebook(readFileSync(join(SAMPLES, `${name}.notebook.json`), "utf8"));
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.notebook;
}

/** The snapshot of the embed in turn `turn` that reads `node`. */
function snapshot(notebook: Notebook, turn: number, node: string): TableSnapshot {
  const embed = notebook.turns[turn].reply.embeds.find((e) => "snapshot" in e && e.source.nodeId === node);
  if (!embed || !("snapshot" in embed)) throw new Error(`turn ${turn} has no snapshot of ${node}`);
  return embed.snapshot;
}

/** Every value of `column` in a snapshot that holds all of its rows. */
function column(table: TableSnapshot, name: string): unknown[] {
  expect(table.rows.length, "the snapshot holds every row").toBe(table.totalRows);
  const index = table.columns.findIndex((c) => c.name === name);
  if (index < 0) throw new Error(`no column ${name} in ${table.columns.map((c) => c.name).join(", ")}`);
  return table.rows.map((row) => row[index]);
}

const sum = (values: readonly unknown[]) => values.reduce<number>((total, v) => total + Number(v), 0);
const firstValue = (table: TableSnapshot, name: string) => column(table, name)[0];
const reply = (notebook: Notebook, turn: number) => notebook.turns[turn].reply.text;
/** A count as a reply writes it: 1,418, not 1418. */
const written = (n: number) => n.toLocaleString("en-US");

const embedsOf = (notebook: Notebook): Embed[] => notebook.turns.flatMap((t) => t.reply.embeds);

describe("public sample notebooks", () => {
  it("has one notebook per outline, three at least", () => {
    expect(sampleFiles.map(nameOf).sort()).toEqual(outlineFiles.map(nameOf).sort());
    expect(sampleFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(outlineFiles)("%s passes the outline check", (file) => {
    expect(outlineErrors(JSON.parse(readFileSync(join(OUTLINES, file), "utf8")), nameOf(file))).toEqual([]);
  });

  it.each(sampleFiles)("%s parses and is labelled as reconstructed", (file) => {
    expect(load(nameOf(file)).host?.note).toMatch(/^Reconstructed session/);
  });

  it.each(sampleFiles)("%s names only analyses from its outline's graphs", (file) => {
    const known = new Set(sampleGraphFiles(nameOf(file), SAMPLES, []).keys());
    const named = embedsOf(load(nameOf(file))).flatMap((e) =>
      e.kind === "graph" ? [e.analysisId] : "source" in e ? [e.source.analysisId] : [],
    );
    expect(named.filter((id) => !known.has(id))).toEqual([]);
  });

  it.each(sampleFiles)("%s places every graph card where its graph file does", (file) => {
    const text = readFileSync(join(SAMPLES, file), "utf8");
    expect(staleLayouts(text, sampleGraphFiles(nameOf(file), SAMPLES, []))).toEqual([]);
  });

  // A drive letter with \Users\ (escaped or not) or /Users/, or a Unix home directory.
  const LOCAL_PATH = /[A-Za-z]:(\\\\|\/)Users(\\\\|\/)|\/home\/|\/Users\//;

  it.each(sampleFiles)("%s names no path on the machine that wrote it", (file) => {
    expect(readFileSync(join(SAMPLES, file), "utf8")).not.toMatch(LOCAL_PATH);
  });
});

describe("p01-schependomlaan matches samples.json", () => {
  const notebook = load("p01-schependomlaan");

  it("lists every storey", () => {
    const storeys = countOf("schependomlaan", "IFCBUILDINGSTOREY");
    expect(snapshot(notebook, 0, "storeys").totalRows).toBe(storeys);
  });

  it("counts every space, and the per-storey chart adds up to it", () => {
    const spaces = countOf("schependomlaan", "IFCSPACE");
    expect(firstValue(snapshot(notebook, 1, "total"), "Spaces")).toBe(spaces);
    expect(sum(column(snapshot(notebook, 1, "chart"), "Spaces"))).toBe(spaces);
    expect(reply(notebook, 1)).toContain(written(spaces));
  });

  it("counts every door and window", () => {
    const total = snapshot(notebook, 2, "total");
    for (const [name, ifcClass] of [["Doors", "IFCDOOR"], ["Windows", "IFCWINDOW"]] as const) {
      const expected = countOf("schependomlaan", ifcClass);
      expect(firstValue(total, name), name).toBe(expected);
      expect(reply(notebook, 2)).toContain(written(expected));
    }
  });

  it("colours the doors and windows it counted in 3D", () => {
    expect(notebook.turns[3].reply.embeds.map((e) => e.kind)).toContain("view3d");
    const legend = snapshot(notebook, 3, "sorted");
    const elements = (category: string) => column(legend, "Elements")[column(legend, "category").indexOf(category)];
    expect(elements("IFCDOOR")).toBe(countOf("schependomlaan", "IFCDOOR"));
    expect(elements("IFCWINDOW")).toBe(countOf("schependomlaan", "IFCWINDOW"));
  });
});

describe("p02-digitalhub-heating matches samples.json", () => {
  const notebook = load("p02-digitalhub-heating");

  it("lists every heating system", () => {
    const systems = countOf("digitalhub-hzg", "IFCSYSTEM");
    expect(snapshot(notebook, 0, "systems").totalRows).toBe(systems);
    expect(sum(column(snapshot(notebook, 0, "sides"), "Systems"))).toBe(systems);
    expect(reply(notebook, 0)).toContain(written(systems));
  });

  it("counts every space heater and pipe segment", () => {
    const total = snapshot(notebook, 1, "total");
    for (const [name, ifcClass] of [["SpaceHeaters", "IFCSPACEHEATER"], ["PipeSegments", "IFCPIPESEGMENT"]] as const) {
      const expected = countOf("digitalhub-hzg", ifcClass);
      expect(firstValue(total, name), name).toBe(expected);
      expect(reply(notebook, 1)).toContain(written(expected));
    }
  });

  it("gives every pipe segment a diameter", () => {
    expect(sum(column(snapshot(notebook, 2, "sorted"), "Segments"))).toBe(countOf("digitalhub-hzg", "IFCPIPESEGMENT"));
  });

  it("shows the heating model in 3D", () => {
    expect(notebook.turns[3].reply.embeds.map((e) => e.kind)).toContain("view3d");
  });

  it("adds the four discipline models up to the federated model's counts", () => {
    const models = snapshot(notebook, 4, "models");
    const classes = {
      Systems: "IFCSYSTEM",
      SpaceHeaters: "IFCSPACEHEATER",
      PipeSegments: "IFCPIPESEGMENT",
      DuctSegments: "IFCDUCTSEGMENT",
      AirTerminals: "IFCAIRTERMINAL",
      SanitaryTerminals: "IFCSANITARYTERMINAL",
    } as const;
    for (const [name, ifcClass] of Object.entries(classes))
      expect(sum(column(models, name)), name).toBe(countOf("digitalhub-federated", ifcClass));
    expect(reply(notebook, 4)).toContain(written(countOf("digitalhub-federated", "IFCSYSTEM")));
  });
});

describe("p03-duplex-doors matches samples.json", () => {
  const notebook = load("p03-duplex-doors");
  const doors = snapshot(notebook, 0, "doors");

  it("lists every door with a width", () => {
    const expected = countOf("duplex", "IFCDOOR");
    expect(doors.totalRows).toBe(expected);
    expect(column(doors, "WidthMm").every((w) => typeof w === "number" && w > 0)).toBe(true);
    expect(reply(notebook, 0)).toContain(written(expected));
  });

  it("passes exactly the doors at least 850 mm wide", () => {
    const tally = snapshot(notebook, 1, "tally");
    const count = (verdict: string) => column(tally, "Doors")[column(tally, "verdict").indexOf(verdict)];
    const wide = column(doors, "WidthMm").filter((w) => Number(w) >= 850).length;
    expect([count("Pass"), count("Fail")]).toEqual([wide, doors.totalRows - wide]);
    expect(snapshot(notebook, 1, "failing").totalRows).toBe(doors.totalRows - wide);
    expect(notebook.turns[1].reply.embeds.map((e) => e.kind)).toContain("view3d");
  });

  it("finds no system in the MEP model, as samples.json lists none, and every flow element", () => {
    const classes = snapshot(notebook, 2, "classes");
    expect(firstValue(classes, "Systems")).toBe(countOf("duplex-mep", "IFCSYSTEM"));
    expect(firstValue(classes, "Systems")).toBe(0);
    const flow = Object.entries(publicCounts().get("duplex-mep")!)
      .filter(([ifcClass]) => ifcClass.startsWith("IFCFLOW"))
      .reduce((total, [, n]) => total + n, 0);
    expect(firstValue(classes, "FlowElements")).toBe(flow);
    expect(reply(notebook, 2)).toContain(written(flow));
  });
});
