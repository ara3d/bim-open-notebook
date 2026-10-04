import { describe, expect, it } from "vitest";
import type { Notebook, View3dEmbed } from "../src/document/format";
import { modelFileName, modelFiles, resolveEmbedPath, view3dEmbeds } from "../src/document/paths";

const view = (id: string, model?: string): View3dEmbed => ({
  id,
  kind: "view3d",
  source: { analysisId: "a", nodeId: "n", port: "table" },
  ...(model === undefined ? {} : { model }),
});

const notebook: Notebook = {
  format: "bimopen-notebook/0.1",
  title: "t",
  createdUtc: "2026-10-04T00:00:00Z",
  turns: [
    {
      id: "t1",
      request: { text: "a" },
      reply: { text: "b", tools: [], embeds: [view("e1", "models/duplex.bos"), view("e2")] },
      earlier: [{ request: { text: "a0" }, reply: { text: "b0", tools: [], embeds: [view("e1", "models/old.bos")] } }],
    },
    { id: "t2", request: { text: "c" }, reply: { text: "d", tools: [], embeds: [view("e1", "models/duplex.bos")] } },
  ],
};

describe("resolveEmbedPath", () => {
  const doc = "https://example.org/site/app/notebook.html";

  it("resolves a relative path against the notebook's URL, itself relative to the document", () => {
    expect(resolveEmbedPath("models/duplex.bos", "notebooks/p03.notebook.json", doc)).toBe(
      "https://example.org/site/app/notebooks/models/duplex.bos",
    );
    expect(resolveEmbedPath("models/duplex.bos", "/__notebooks/p03.notebook.json", doc)).toBe(
      "https://example.org/__notebooks/models/duplex.bos",
    );
  });

  it("leaves a data:, absolute, or http URL alone, and a path with no base", () => {
    expect(resolveEmbedPath("data:image/png;base64,AA", "notebooks/x.notebook.json", doc)).toBe("data:image/png;base64,AA");
    expect(resolveEmbedPath("/models/x.bos", "notebooks/x.notebook.json", doc)).toBe("/models/x.bos");
    expect(resolveEmbedPath("https://a.b/c.bos", "notebooks/x.notebook.json", doc)).toBe("https://a.b/c.bos");
    expect(resolveEmbedPath("models/x.bos", undefined, doc)).toBe("models/x.bos");
  });
});

describe("the model files a notebook names", () => {
  it("lists every 3D view, earlier replies included", () => {
    expect(view3dEmbeds(notebook).map((e) => e.model)).toEqual(["models/duplex.bos", undefined, "models/old.bos", "models/duplex.bos"]);
  });

  it("lists each model once, in order of first use", () => {
    expect(modelFiles(notebook)).toEqual(["models/duplex.bos", "models/old.bos"]);
  });

  it("takes the file name from models/<file> and refuses any other shape", () => {
    expect(modelFileName("models/duplex.bos")).toEqual({ file: "duplex.bos" });
    for (const bad of ["duplex.bos", "models/", "models/a/b.bos", "models/..", "other/duplex.bos"]) {
      expect(modelFileName(bad), bad).toHaveProperty("problem");
    }
  });
});
