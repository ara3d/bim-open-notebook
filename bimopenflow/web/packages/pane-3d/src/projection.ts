// A model point placed on the canvas, from the view state a frame was drawn with.
// Plain vector math (no three.js) so the pane's labels need nothing from the viewer's
// renderer; test/projection.test.ts checks it against three's own cameras and the
// viewer's ray function, so the two cannot drift apart unnoticed.

import type { ViewState } from "@bim-open-viewer/model";

type Triple = [number, number, number];
/** A position in CSS pixels from the canvas's top-left corner. */
export interface CanvasPoint { x: number; y: number }

const sub = (a: ArrayLike<number>, b: ArrayLike<number>): Triple => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Triple, b: Triple): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Triple, b: Triple): Triple => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Triple): Triple | undefined => {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length > 0 && Number.isFinite(length) ? [a[0] / length, a[1] / length, a[2] / length] : undefined;
};

/**
 * Where `point` (in the frame the view looks at, which is the loaded model's own frame: the rig
 * applies no transform to it) lands on a canvas of `width` x `height` CSS pixels. `aspect` is the
 * aspect the frame was drawn with. Undefined when the point is behind the camera, nearer than the
 * near plane or past the far plane, or outside the canvas.
 */
export const projectToCanvas = (
  view: Pick<ViewState, "camera" | "projection">,
  aspect: number,
  width: number,
  height: number,
  point: Triple,
): CanvasPoint | undefined => {
  if (!(width > 0 && height > 0 && aspect > 0)) return undefined;
  const { position, target, up } = view.camera;
  const forward = unit(sub(target, position));
  const right = forward && unit(cross(forward, [up[0], up[1], up[2]]));
  if (!forward || !right) return undefined;
  const upward = cross(right, forward);
  const offset = sub(point, position);
  const depth = dot(offset, forward);
  const { projection } = view;
  if (!(depth >= projection.near && depth <= projection.far)) return undefined;
  const halfHeight = projection.kind === "perspective"
    ? depth * Math.tan((projection.fieldOfViewDegrees * Math.PI) / 360)
    : projection.height / 2;
  if (!(halfHeight > 0)) return undefined;
  const ndcX = dot(offset, right) / (halfHeight * aspect);
  const ndcY = dot(offset, upward) / halfHeight;
  if (!(Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1)) return undefined;
  return { x: ((ndcX + 1) * width) / 2, y: ((1 - ndcY) * height) / 2 };
};
