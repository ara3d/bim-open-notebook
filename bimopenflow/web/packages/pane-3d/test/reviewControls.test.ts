import { describe, expect, it } from "vitest";
import type { EntityProperties } from "@bimopenflow/contracts";
import type { PaneContext, PlannedNode } from "@bimopenflow/panes";
import { fakeCtx, settle } from "@bimopenflow/panes/testing";
import { createViewPane3D } from "../src/viewPane3D";
import type { PickInfo, RigCamera, View3DDeps, ViewerRig } from "../src/viewerDeps";
import { reviewedPath, utcStamp } from "../src/reviewPlans";

const camera: RigCamera = { position: [1, 2, 3], target: [4, 5, 6], up: [0, 0, 1], fov: 50, aspect: 1.5 };

const rigDeps = (cam: RigCamera | undefined) => {
  let pick: (id: number | null, info: PickInfo) => void = () => {};
  const deps: View3DDeps = {
    createRig: (_canvas, onPick) => {
      pick = onPick;
      const rig: ViewerRig = {
        load: () => Promise.resolve([]),
        setBoxes: () => {}, clearBoxes: () => {}, requestRender: () => {}, dispose: () => {},
        select: () => {}, camera: () => cam,
      };
      return rig;
    },
  };
  return { deps, pick: (id: number | null, extend = false) => pick(id, { extend, onModel: id !== null }) };
};

const props = (localId: number): EntityProperties => ({
  localId, globalId: `G${localId}`, name: "Door", category: "IFCDOOR", parameters: [],
});

interface Setup {
  host: HTMLElement;
  added: PlannedNode[][];
  setCalls: Array<[string, Record<string, string>]>;
  pick: (id: number | null, extend?: boolean) => void;
  button: (label: string) => HTMLButtonElement;
  status: () => string | null | undefined;
  pane: ReturnType<typeof createViewPane3D>;
}

const setup = async (opts: {
  ctx?: Partial<PaneContext>; path?: string; cam?: RigCamera | undefined; noModel?: boolean;
} = {}): Promise<Setup> => {
  const { deps, pick } = rigDeps("cam" in opts ? opts.cam : camera);
  const added: PlannedNode[][] = [];
  const setCalls: Array<[string, Record<string, string>]> = [];
  let counter = 0;
  const ctx: PaneContext = {
    ...fakeCtx(),
    requestEntityProperties: (_url, id) => Promise.resolve(props(id)),
    addNodes: (nodes) => {
      added.push([...nodes]);
      return Promise.resolve(nodes.map((n) => `${n.kind.split(".").at(-1)}${++counter}`));
    },
    setParams: (id, params) => { setCalls.push([id, params]); return Promise.resolve(); },
    ...opts.ctx,
  };
  const host = document.createElement("div");
  const pane = createViewPane3D({ deps });
  pane.mount(host, ctx);
  if (!opts.noModel) pane.update({ kind: "model", url: "model:duplex", path: opts.path });
  await settle();
  return {
    host, added, setCalls, pick, pane,
    button: (label) => [...host.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement,
    status: () => host.querySelector(".bof-panes-viewstatus")?.textContent,
  };
};

const fill = (host: HTMLElement, values: Record<string, string>) => {
  for (const [name, value] of Object.entries(values))
    (host.querySelector(`input[name="${name}"]`) as HTMLInputElement).value = value;
};
const submit = (host: HTMLElement) =>
  host.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

describe("path and time helpers", () => {
  it("derives the reviewed path only for IFC files", () => {
    expect(reviewedPath("C:/m/duplex.IFC")).toBe("C:/m/duplex-reviewed.IFC");
    expect(reviewedPath("a.b/duplex.bos")).toBe("");
    expect(reviewedPath(undefined)).toBe("");
  });
  it("formats UTC to the second", () => {
    expect(utcStamp(new Date("2026-10-18T01:02:03.456Z"))).toBe("2026-10-18T01:02:03Z");
  });
});

describe("pane header", () => {
  it("stacks the toolbar, the comment form area and the status in one header, and adds the stylesheet once", async () => {
    const a = await setup();
    const b = await setup();
    const header = a.host.querySelector(".bof-panes-hud") as HTMLElement;
    expect(header.parentElement?.classList.contains("bof-panes-view3d")).toBe(true);
    expect([...header.children].map((e) => e.className)).toEqual(["bof-panes-toolbar", "", "bof-panes-viewstatus"]);
    expect(document.querySelectorAll("style#bof-pane3d-styles").length).toBe(1);
    a.pane.destroy();
    b.pane.destroy();
  });

  it("opens the comment form inside the header, between the toolbar and the status", async () => {
    const s = await setup();
    s.button("Comment").click(); await settle();
    const header = s.host.querySelector(".bof-panes-hud") as HTMLElement;
    expect(header.children[1].querySelector("form.bof-panes-form")).not.toBeNull();
    s.pane.destroy();
  });
});

describe("review controls", () => {
  it("disables the buttons without addNodes, without a model, and Use selection without a selection", async () => {
    const none = await setup({ ctx: { addNodes: undefined } });
    none.pick(1); await settle();
    expect(none.button("Use selection").disabled).toBe(true);
    expect(none.button("Comment").disabled).toBe(true);
    none.pane.destroy();

    const noModel = await setup({ noModel: true });
    expect(noModel.button("Comment").disabled).toBe(true);
    noModel.pane.destroy();

    const ready = await setup();
    expect(ready.button("Comment").disabled).toBe(false);
    expect(ready.button("Use selection").disabled).toBe(true);
    ready.pick(1); await settle();
    expect(ready.button("Use selection").disabled).toBe(false);
    ready.pane.destroy();
  });

  it("Use selection adds bim.selection, then updates the same node", async () => {
    const s = await setup();
    s.pick(1); s.pick(2, true); await settle();
    s.button("Use selection").click(); await settle();
    expect(s.added).toEqual([[{ kind: "bim.selection", params: { ids: "G1,G2" } }]]);
    expect(s.status()).toBe("Added selection1.");
    s.pick(3, true); await settle();
    s.button("Use selection").click(); await settle();
    expect(s.setCalls).toEqual([["selection1", { ids: "G1,G2,G3" }]]);
    expect(s.status()).toBe("Updated selection1.");
    s.pane.destroy();
  });

  it("Use selection adds a new node when setParams rejects, and shows an addNodes error", async () => {
    const s = await setup({ ctx: { setParams: () => Promise.reject(new Error("gone")) } });
    s.pick(1); await settle();
    s.button("Use selection").click(); await settle();
    s.button("Use selection").click(); await settle();
    expect(s.added.length).toBe(2);
    s.pane.destroy();

    const failing = await setup({ ctx: { addNodes: () => Promise.reject(new Error("No flow is open.")) } });
    failing.pick(1); await settle();
    failing.button("Use selection").click(); await settle();
    expect(failing.status()).toBe("No flow is open.");
    failing.pane.destroy();
  });

  it("Comment plans the camera and the issue, wired camera to camera", async () => {
    const s = await setup();
    s.pick(1); s.pick(2, true); await settle();
    s.button("Comment").click(); await settle();
    fill(s.host, { title: "Door swing", comment: "Opens into the corridor", author: "Ana" });
    submit(s.host); await settle();
    expect(s.added.length).toBe(1);
    const [cam, issue] = s.added[0];
    expect(cam).toEqual({
      kind: "view3d.camera",
      params: { name: "Door swing", posX: "1", posY: "2", posZ: "3", targetX: "4", targetY: "5", targetZ: "6", fov: "50" },
    });
    expect(issue.kind).toBe("bcf.issue");
    expect(issue.inputs).toEqual({ camera: { node: 0, port: "camera" } });
    expect(issue.params).toMatchObject({
      title: "Door swing", comment: "Opens into the corridor", author: "Ana", status: "Open", ids: "G1,G2",
    });
    expect(issue.params!.created).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(s.status()).toBe("Added camera1 and issue2.");
    expect(s.host.querySelector("form")).toBeNull();
    s.pane.destroy();
  });

  it("Comment with an empty required field does nothing, and Cancel closes the form", async () => {
    const s = await setup();
    s.button("Comment").click(); await settle();
    fill(s.host, { title: "", comment: "x" });
    submit(s.host); await settle();
    expect(s.added).toEqual([]);
    expect(s.host.querySelector("form")).not.toBeNull();
    (s.host.querySelector("form button[type=button]") as HTMLButtonElement).click();
    expect(s.host.querySelector("form")).toBeNull();
    s.pane.destroy();
  });

  it("Comment without a camera adds only the issue", async () => {
    const s = await setup({ cam: undefined });
    s.button("Comment").click(); await settle();
    fill(s.host, { title: "t", comment: "c" });
    submit(s.host); await settle();
    expect(s.added[0].map((n) => n.kind)).toEqual(["bcf.issue"]);
    s.pane.destroy();
  });

  it("Edit property plans the inline row and the write-back with derived paths", async () => {
    const s = await setup({ path: "C:/m/duplex.ifc" });
    s.pick(1234); await settle();
    s.button("Edit property").click(); await settle();
    fill(s.host, { psetName: "Pset_Review", paramName: "Status", paramValue: "Checked" });
    submit(s.host); await settle();
    expect(s.added).toEqual([[
      {
        kind: "table.inline",
        params: { rows: JSON.stringify([{ entityId: 1234, psetName: "Pset_Review", paramName: "Status", paramValue: "Checked" }]) },
      },
      {
        kind: "sink.writePsets",
        params: { sourcePath: "C:/m/duplex.ifc", targetPath: "C:/m/duplex-reviewed.ifc" },
        inputs: { in: { node: 0, port: "table" } },
      },
    ]]);
    expect(s.status()).toBe("Added inline1 and writePsets2.");
    s.pane.destroy();
  });

  it("Edit property leaves the paths blank for a model that is not an IFC file", async () => {
    const s = await setup({ path: "m/duplex.bos" });
    s.pick(5); await settle();
    s.button("Edit property").click(); await settle();
    fill(s.host, { psetName: "P", paramName: "N", paramValue: "V" });
    submit(s.host); await settle();
    expect(s.added[0][1].params).toEqual({ sourcePath: "", targetPath: "" });
    s.pane.destroy();
  });

  it("disables Edit property without addNodes", async () => {
    const s = await setup({ ctx: { addNodes: undefined } });
    s.pick(5); await settle();
    expect(s.button("Edit property").disabled).toBe(true);
    s.pane.destroy();
  });
});
