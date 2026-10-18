// The nodes each review control asks the editor to add. Pure: the pane
// supplies the camera, the clock, and the model path, so every plan is a value
// a test can compare. Kinds and param names come from graphNodes.ts.
import type { PlannedNode } from "@bimopenflow/panes";
import type { RigCamera } from "./viewerDeps";
import { BCF_ISSUE, BIM_SELECTION, SINK_WRITE_PSETS, TABLE_INLINE, VIEW3D_CAMERA } from "./graphNodes";

export interface CommentForm { title: string; comment: string; author: string }
export interface PropertyForm { psetName: string; paramName: string; paramValue: string }

/** Numbers as canonical text without float noise (0.1 + 0.2 stays 0.3). */
const num = (value: number): string => String(Number(value.toFixed(6)));

/** The current UTC time to the second: yyyy-MM-ddTHH:mm:ssZ. */
export const utcStamp = (now: Date): string => now.toISOString().replace(/\.\d+Z$/, "Z");

export const isIfcPath = (path: string | undefined): path is string => !!path && /\.ifc$/i.test(path);

/** "a/b/duplex.ifc" becomes "a/b/duplex-reviewed.ifc"; blank for a path that is not an IFC file. */
export const reviewedPath = (path: string | undefined): string =>
  isIfcPath(path) ? path.replace(/\.ifc$/i, "-reviewed$&") : "";

export const selectionPlan = (globalIds: readonly string[]): PlannedNode => ({
  kind: BIM_SELECTION.kind,
  params: { [BIM_SELECTION.ids]: globalIds.join(",") },
});

/** A camera node wired into an issue node; just the issue when the rig has no camera. */
export const commentPlan = (
  form: CommentForm,
  camera: RigCamera | undefined,
  globalIds: readonly string[],
  now: Date,
): PlannedNode[] => {
  const issue: PlannedNode = {
    kind: BCF_ISSUE.kind,
    params: {
      [BCF_ISSUE.title]: form.title,
      [BCF_ISSUE.comment]: form.comment,
      [BCF_ISSUE.author]: form.author,
      [BCF_ISSUE.created]: utcStamp(now),
      [BCF_ISSUE.status]: "Open",
      [BCF_ISSUE.ids]: globalIds.join(","),
    },
  };
  if (!camera) return [issue];
  const [px, py, pz] = camera.position;
  const [tx, ty, tz] = camera.target;
  return [
    {
      kind: VIEW3D_CAMERA.kind,
      params: {
        [VIEW3D_CAMERA.name]: form.title,
        [VIEW3D_CAMERA.posX]: num(px), [VIEW3D_CAMERA.posY]: num(py), [VIEW3D_CAMERA.posZ]: num(pz),
        [VIEW3D_CAMERA.targetX]: num(tx), [VIEW3D_CAMERA.targetY]: num(ty), [VIEW3D_CAMERA.targetZ]: num(tz),
        [VIEW3D_CAMERA.fov]: num(camera.fov),
      },
    },
    { ...issue, inputs: { [BCF_ISSUE.cameraInput]: { node: 0, port: VIEW3D_CAMERA.output } } },
  ];
};

/** One inline row wired into a pset write-back whose paths come from the model path. */
export const editPropertyPlan = (
  form: PropertyForm,
  entityId: number,
  modelPath: string | undefined,
): PlannedNode[] => [
  {
    kind: TABLE_INLINE.kind,
    params: {
      [TABLE_INLINE.rows]: JSON.stringify([
        { entityId, psetName: form.psetName, paramName: form.paramName, paramValue: form.paramValue },
      ]),
    },
  },
  {
    kind: SINK_WRITE_PSETS.kind,
    params: {
      [SINK_WRITE_PSETS.sourcePath]: isIfcPath(modelPath) ? modelPath : "",
      [SINK_WRITE_PSETS.targetPath]: reviewedPath(modelPath),
    },
    inputs: { [SINK_WRITE_PSETS.input]: { node: 0, port: TABLE_INLINE.output } },
  },
];
