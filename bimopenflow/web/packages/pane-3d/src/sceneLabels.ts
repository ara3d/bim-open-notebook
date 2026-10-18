// Text labels over the 3D canvas (TKT-336). An instance table may carry `label` (Text, null
// for no label) and `labelX`, `labelY`, `labelZ` (Number, model coordinates in the frame of the
// table's minX..maxZ bounds). The pane reads only those four columns; the view3d.label node
// decides the text and the anchors.

import type { TableSlice } from "@bimopenflow/contracts";
import { columnIndex } from "@bimopenflow/panes";
import type { CanvasPoint } from "./projection";

type Triple = [number, number, number];

/** The most labels drawn at once; more would hide the model and slow every frame. */
export const LABEL_CAP = 300;

export interface SceneLabel { text: string; at: Triple }
export interface ParsedLabels { labels: SceneLabel[]; total: number }

const finite = (value: unknown): number | undefined =>
  value === null || value === undefined || value === "" ? undefined :
  Number.isFinite(Number(value)) ? Number(value) : undefined;

/**
 * The labelled rows of an instance table, or null when it has no label columns (all four are
 * needed). A row with no text, or with an anchor coordinate that is missing or not a number, is
 * not labelled: nothing is invented for it.
 */
export const parseLabels = (slice: TableSlice): ParsedLabels | null => {
  const at = ["label", "labelX", "labelY", "labelZ"].map(name => columnIndex(slice.columns, name));
  if (at.some(i => i < 0)) return null;
  const [text, x, y, z] = at;
  const labels: SceneLabel[] = [];
  for (const row of slice.rows) {
    const label = row[text];
    const anchor = [row[x], row[y], row[z]].map(finite);
    if (typeof label !== "string" || label === "" || anchor.some(v => v === undefined)) continue;
    labels.push({ text: label, at: anchor as Triple });
  }
  return { labels, total: labels.length };
};

/** "300 of 512 labels shown" when the cap applies, else empty. */
export const capNote = (shown: number, total: number): string =>
  total > shown ? `${shown} of ${total} labels shown` : "";

export interface LabelLayer {
  /** Replaces the drawn labels (null removes them); returns the cap note, empty when all are drawn. */
  set(parsed: ParsedLabels | null): string;
  /** Places every label for the frame just drawn. */
  layout(): void;
  destroy(): void;
}

/**
 * An overlay beside the canvas holding one text element per label. It takes no pointer events,
 * so a click on a label picks what is under it. `project` places a model point on the canvas, or
 * returns undefined for a point that should not show (behind the camera, off the canvas).
 */
export const createLabelLayer = (
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  project: (point: Triple) => CanvasPoint | undefined,
): LabelLayer => {
  const doc = root.ownerDocument;
  const overlay = doc.createElement("div");
  overlay.className = "bof-panes-labels";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.pointerEvents = "none";
  root.append(overlay);
  let shown: Array<{ label: SceneLabel; element: HTMLElement }> = [];
  return {
    set(parsed) {
      overlay.replaceChildren();
      shown = (parsed?.labels ?? []).slice(0, LABEL_CAP).map(label => {
        const element = doc.createElement("div");
        element.className = "bof-panes-label";
        element.textContent = label.text;
        element.hidden = true;
        overlay.append(element);
        return { label, element };
      });
      this.layout();
      return parsed ? capNote(shown.length, parsed.total) : "";
    },
    layout() {
      if (shown.length === 0) return;
      overlay.style.left = `${canvas.offsetLeft}px`;
      overlay.style.top = `${canvas.offsetTop}px`;
      overlay.style.width = `${canvas.clientWidth}px`;
      overlay.style.height = `${canvas.clientHeight}px`;
      for (const { label, element } of shown) {
        const place = project(label.at);
        element.hidden = !place;
        if (place) element.style.transform = `translate(${place.x}px, ${place.y}px) translate(-50%, -100%)`;
      }
    },
    destroy() { overlay.remove(); shown = []; },
  };
};
