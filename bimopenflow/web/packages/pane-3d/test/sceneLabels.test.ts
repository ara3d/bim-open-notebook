import { describe, expect, it } from "vitest";
import { createViewPane3D } from "../src/viewPane3D";
import { LABEL_CAP, parseLabels } from "../src/sceneLabels";
import type { View3DDeps, ViewerRig } from "../src/viewerDeps";
import type { ColorableGroup, GroupEntityMap } from "@bimopenflow/panes";
import { fakeCtx, makeSlice, settle } from "@bimopenflow/panes/testing";

const COLUMNS: Array<[string, "Text" | "Number" | "Integer"]> = [
  ["entityId", "Integer"], ["label", "Text"], ["labelX", "Number"], ["labelY", "Number"], ["labelZ", "Number"],
];
const slice = (rows: unknown[][]) => makeSlice(COLUMNS, rows);

interface LabelRig extends ViewerRig {
  /** Moves the fake camera: every point shifts right by this many pixels, and listeners are told. */
  pan(dx: number): void;
  stopped: number;
}
const group: ColorableGroup = { instanceCount: 1, colors: Float32Array.of(0, 0, 0, 1), setColors() {} };
const maps: readonly GroupEntityMap[] = [{ entities: [7], group }];

/** A rig whose projection is x = 10 * pointX + offset, y = 100 - 10 * pointZ; a point with Y < 0 is behind the camera. */
const labelDeps = (): { deps: View3DDeps; rig: () => LabelRig } => {
  let rig: LabelRig | undefined;
  return {
    deps: {
      createRig: () => {
        const listeners = new Set<() => void>();
        let offset = 0;
        rig = {
          stopped: 0,
          pan(dx) { offset += dx; for (const l of [...listeners]) l(); },
          load: () => Promise.resolve(maps),
          setBoxes() {}, clearBoxes() {}, requestRender() {},
          project: ([x, y, z]) => (y < 0 ? undefined : { x: 10 * x + offset, y: 100 - 10 * z }),
          onFrame(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); rig!.stopped++; };
          },
          dispose() {},
        };
        return rig;
      },
    },
    rig: () => rig!,
  };
};

const mount = async (withModel = true) => {
  const { deps, rig } = labelDeps();
  const root = document.createElement("div");
  document.body.append(root);
  const pane = createViewPane3D({ deps });
  pane.mount(root, fakeCtx());
  if (withModel) { pane.update({ kind: "model", url: "m.bos" }); await settle(); }
  return { root, pane, rig: rig() };
};
const drawn = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(".bof-panes-label")];
const status = (root: HTMLElement) => root.querySelector(".bof-panes-viewstatus")!.textContent;
const many = (n: number) => Array.from({ length: n }, (_, i) => [i, `L${i}`, i, 1, 1]);

describe("parseLabels", () => {
  it("returns null without all four label columns", () => {
    expect(parseLabels(makeSlice([["entityId", "Integer"], ["label", "Text"]], [[1, "a"]]))).toBeNull();
  });
  it("keeps only rows with text and a numeric anchor", () => {
    const parsed = parseLabels(slice([[1, "A", 1, 2, 3], [2, null, 1, 2, 3], [3, "", 1, 2, 3], [4, "B", null, 2, 3], [5, "C", "4", 5, 6]]))!;
    expect(parsed.labels).toEqual([{ text: "A", at: [1, 2, 3] }, { text: "C", at: [4, 5, 6] }]);
  });
});

describe("scene labels in the pane", () => {
  it("draws one element per non-null label, placed by the rig's projection", async () => {
    const { root, pane } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "12.5 kgCO2e", 1, 1, 2], [8, null, 3, 3, 3], [9, "Door 0.9 m", 5, 2, 1]]) });
    const labels = drawn(root);
    expect(labels.map(l => l.textContent)).toEqual(["12.5 kgCO2e", "Door 0.9 m"]);
    expect(labels[0].style.transform).toContain("translate(10px, 80px)");
    expect(labels[1].style.transform).toContain("translate(50px, 90px)");
    expect(labels.every(l => !l.hidden)).toBe(true);
  });

  it("moves labels when the camera notifies", async () => {
    const { root, pane, rig } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "A", 1, 1, 2]]) });
    rig.pan(25);
    expect(drawn(root)[0].style.transform).toContain("translate(35px, 80px)");
  });

  it("hides a label whose point is behind the camera", async () => {
    const { root, pane } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "front", 1, 1, 2], [8, "behind", 1, -5, 2]]) });
    const [front, behind] = drawn(root);
    expect(front.hidden).toBe(false);
    expect(behind.hidden).toBe(true);
  });

  it("caps the count and says so in the status line", async () => {
    const { root, pane } = await mount();
    pane.update({ kind: "instances", data: slice(many(LABEL_CAP + 12)) });
    expect(drawn(root)).toHaveLength(LABEL_CAP);
    expect(status(root)).toBe(`${LABEL_CAP} of ${LABEL_CAP + 12} labels shown`);
  });

  it("states the cap in the loaded message when instances arrived before the model", async () => {
    const { root, pane } = await mount(false);
    pane.update({ kind: "instances", data: slice(many(LABEL_CAP + 1)) });
    expect(drawn(root)).toHaveLength(0);
    pane.update({ kind: "model", url: "m.bos" });
    await settle();
    expect(drawn(root)).toHaveLength(LABEL_CAP);
    expect(status(root)).toContain(`${LABEL_CAP} of ${LABEL_CAP + 1} labels shown`);
  });

  it("replaces labels on a later instances input, and drops them when it has no label columns", async () => {
    const { root, pane } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "old", 1, 1, 1]]) });
    pane.update({ kind: "instances", data: slice([[7, "new", 2, 1, 1]]) });
    expect(drawn(root).map(l => l.textContent)).toEqual(["new"]);
    pane.update({ kind: "instances", data: makeSlice([["entityId", "Integer"]], [[7]]) });
    expect(drawn(root)).toHaveLength(0);
  });

  it("clears labels when a model loads", async () => {
    const { root, pane } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "A", 1, 1, 1]]) });
    expect(drawn(root)).toHaveLength(1);
    pane.update({ kind: "model", url: "other.bos" });
    expect(drawn(root)).toHaveLength(0);
  });

  it("takes no pointer events, so picking through a label still works", async () => {
    const { root, pane } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "A", 1, 1, 1]]) });
    expect((root.querySelector(".bof-panes-labels") as HTMLElement).style.pointerEvents).toBe("none");
    expect(document.head.querySelector("#bof-pane3d-styles")!.textContent).toMatch(/\.bof-panes-label \{[^}]*pointer-events: none/);
  });

  it("removes the overlay and stops listening on destroy", async () => {
    const { root, pane, rig } = await mount();
    pane.update({ kind: "instances", data: slice([[7, "A", 1, 1, 1]]) });
    pane.destroy();
    expect(root.querySelector(".bof-panes-labels")).toBeNull();
    expect(rig.stopped).toBe(1);
  });
});
