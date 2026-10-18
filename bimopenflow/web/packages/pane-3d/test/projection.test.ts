import { describe, expect, it } from "vitest";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { applyOrthographic, applyPerspective, rayThroughCamera } from "@bim-open-viewer/viewer";
import { cameraPose, orthographic, perspective, viewState } from "@bim-open-viewer/model";
import { projectToCanvas } from "../src/projection";

// Cameras are passed `as never` below: the viewer and this workspace resolve different @types/three versions of the same classes.
type Triple = [number, number, number];
const W = 800, H = 500, ASPECT = W / H;
/** A BOS (z-up) model: the camera stands south-west of a door and looks at it. */
const view = viewState(cameraPose([-6, -9, 4], [2, 3, 1], [0, 0, 1]), perspective(50, 0.1, 500));
const doorTopCentre: Triple = [2.4, 3.1, 2.1];

const pixelsFromThree = (camera: PerspectiveCamera | OrthographicCamera, p: Triple) => {
  const ndc = new Vector3(p[0], p[1], p[2]).project(camera);
  return { x: ((ndc.x + 1) * W) / 2, y: ((1 - ndc.y) * H) / 2 };
};

describe("projectToCanvas", () => {
  it("matches the viewer's perspective camera for points across the frame", () => {
    const camera = new PerspectiveCamera();
    applyPerspective(camera as never, view, ASPECT);
    const points: Triple[] = [doorTopCentre, [2, 3, 1], [0, 1, 0], [5, 6, 3], [1, 4, 2]];
    for (const p of points) {
      const mine = projectToCanvas(view, ASPECT, W, H, p);
      const theirs = pixelsFromThree(camera, p);
      expect(mine?.x).toBeCloseTo(theirs.x, 6);
      expect(mine?.y).toBeCloseTo(theirs.y, 6);
    }
  });

  it("matches the viewer's orthographic camera", () => {
    const ortho = viewState(cameraPose([0, -20, 15], [0, 0, 0], [0, 0, 1]), orthographic(18, 0.1, 500));
    const camera = new OrthographicCamera(-1, 1, 1, -1);
    applyOrthographic(camera as never, ortho, ASPECT);
    const points: Triple[] = [[0, 0, 0], [3, 2, 1], [-4, 1, 2]];
    for (const p of points) {
      const mine = projectToCanvas(ortho, ASPECT, W, H, p);
      const theirs = pixelsFromThree(camera, p);
      expect(mine?.x).toBeCloseTo(theirs.x, 6);
      expect(mine?.y).toBeCloseTo(theirs.y, 6);
    }
  });

  it("puts a door's top centre where a pick ray through that pixel passes through it", () => {
    const camera = new PerspectiveCamera();
    applyPerspective(camera as never, view, ASPECT);
    const at = projectToCanvas(view, ASPECT, W, H, doorTopCentre)!;
    const ray = rayThroughCamera(camera as never, (at.x / W) * 2 - 1, 1 - (at.y / H) * 2)!;
    const toPoint = doorTopCentre.map((v, i) => v - ray.origin[i]!);
    const along = toPoint.reduce((sum, v, i) => sum + v * ray.direction[i]!, 0);
    const miss = Math.hypot(...toPoint.map((v, i) => v - along * ray.direction[i]!));
    expect(along).toBeGreaterThan(0);
    expect(miss).toBeLessThan(1e-3);
  });

  it("hides points behind the camera, outside the canvas, and outside the depth planes", () => {
    expect(projectToCanvas(view, ASPECT, W, H, [-12, -18, 8])).toBeUndefined();
    expect(projectToCanvas(view, ASPECT, W, H, [60, 3, 1])).toBeUndefined();
    expect(projectToCanvas(view, ASPECT, W, H, [2, 3, 600])).toBeUndefined();
    const near = viewState(view.camera, perspective(50, 30, 500));
    expect(projectToCanvas(near, ASPECT, W, H, [2, 3, 1])).toBeUndefined();
  });

  it("returns nothing before the canvas has a size", () => {
    expect(projectToCanvas(view, ASPECT, 0, 0, [2, 3, 1])).toBeUndefined();
  });
});
