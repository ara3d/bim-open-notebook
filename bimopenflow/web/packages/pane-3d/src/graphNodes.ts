// The node kinds and parameter names the 3D pane's review controls plan.
// The toolkit owns the nodes; this pane may not import the toolkit
// (test/seam.ts), so the names are repeated here, in this one module. A rename
// in the toolkit's node catalog (docs/nodes.catalog.json) lands here.

/** Owner: BimOpenFlow.Nodes.BimAnalysis. Output `ids`: one GlobalId column. */
export const BIM_SELECTION = { kind: "bim.selection", ids: "ids" } as const;

/** Owner: BimOpenFlow.Nodes.Geometry. Output `camera`: a one-row table. */
export const VIEW3D_CAMERA = {
  kind: "view3d.camera",
  name: "name",
  posX: "posX", posY: "posY", posZ: "posZ",
  targetX: "targetX", targetY: "targetY", targetZ: "targetZ",
  fov: "fov",
  output: "camera",
} as const;

/** Owner: BimOpenFlow.Nodes.Bcf. Input `camera` takes view3d.camera's table. */
export const BCF_ISSUE = {
  kind: "bcf.issue",
  title: "title",
  description: "description",
  comment: "comment",
  author: "author",
  created: "created",
  status: "status",
  priority: "priority",
  type: "type",
  ids: "ids",
  cameraInput: "camera",
} as const;

/** Owner: BimOpenFlow.Nodes.Tables (bim-open-flow). `rows` is a JSON array of objects. */
export const TABLE_INLINE = { kind: "table.inline", rows: "rows", output: "table" } as const;

/** Owner: BimOpenFlow.Nodes.Effects (bim-open-flow). Input rows: entityId, psetName, paramName, paramValue. Writes a copy of `sourcePath` at `targetPath` on Run only. */
export const SINK_WRITE_PSETS = {
  kind: "sink.writePsets",
  sourcePath: "sourcePath",
  targetPath: "targetPath",
  input: "in",
} as const;
