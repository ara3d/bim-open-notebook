import type { TableSlice } from "@bimopenflow/contracts";
import {
  definePane,
  emptyInstanceLegend,
  entriesLegendView,
  groupColorPlan,
  groupTransformPlan,
  legendFromSlice,
  parseBoxTable,
  parseScaleLegend,
  planFromSlice,
  renderEntityMessage,
  renderEntityProperties,
  renderLegendView,
  scaleLegendView,
  type GroupEntityMap,
  type InstanceLegend,
  type ModelFormat,
  type Pane,
} from "@bimopenflow/panes";
import { defaultView3DDeps, type PickInfo, type View3DDeps } from "./viewerDeps";
import { parseViewRecipe } from "./viewRecipe";
import { openForm } from "./reviewForms";
import { ensureReviewStyles } from "./reviewStyles";
import { createLabelLayer, parseLabels } from "./sceneLabels";
import { commentPlan, editPropertyPlan, selectionPlan } from "./reviewPlans";

export interface ViewPane3DOptions {
  /** The graph owns presentation; do not offer temporary overrides of it. */
  followGraph?: boolean;
  /** Viewer wiring override, mainly for headless tests. */
  deps?: View3DDeps;
}

/** ".bos" (any case, query/hash ignored) loads as BOS; everything else as GLB. */
export const inferFormat = (url: string): ModelFormat =>
  /\.bfast$/i.test(url.split(/[?#]/, 1)[0]) ? "bfast" :
  /\.bos$/i.test(url.split(/[?#]/, 1)[0]) ? "bos" : "glb";

/**
 * 3D view pane: a Viewer with orbit and pick controls on a canvas.
 *
 * Inputs: "model" loads a model via ctx.resolveAsset (format from the URL
 * unless given); "instances" applies an instance table — rows define the
 * visible (isolated) set, r/g/b/a columns recolor, an `a` column alone fades
 * (0 hides), offsetX/Y/Z columns translate instances on top of the loaded
 * transforms, and absent instances get alpha 0. "boxes" renders a boxes
 * table as instanced unit cubes, replacing any previous boxes group. An
 * instances input arriving before the model finishes loading is applied
 * afterwards. The legend strip prefers, in order: the rig's own recipe
 * legend; a "legend" input (a scale table from view.colormap or
 * view3d.color); the table's distinct `verdict` or `category` values with
 * their colours. Emits
 * "selection" (ids = [entityId]) on pick where the
 * loader provided a group→entity mapping, and "action" modelLoaded/loadError.
 */
export const createViewPane3D = (options?: ViewPane3DOptions): Pane =>
  definePane((root, ctx, emit) => {
    const deps = options?.deps ?? defaultView3DDeps;
    const canvas = root.ownerDocument.createElement("canvas");
    canvas.className = "bof-panes-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "3D model. Drag to orbit, scroll to zoom.");
    root.classList.add("bof-panes-view3d");
    const toolbar = root.ownerDocument.createElement("div");
    toolbar.className = "bof-panes-toolbar";
    const status = root.ownerDocument.createElement("div");
    status.className = "bof-panes-viewstatus";
    status.setAttribute("role", "status");
    status.textContent = "Choose a model or view recipe.";
    const commentHost = root.ownerDocument.createElement("div");
    // One header holds the toolbar, the comment form and the status, stacked, so a long
    // toolbar never runs under the status (see reviewStyles.ts).
    const header = root.ownerDocument.createElement("div");
    header.className = "bof-panes-hud";
    header.append(toolbar, commentHost, status);
    root.append(header);
    ensureReviewStyles(root.ownerDocument);
    const properties = root.ownerDocument.createElement("div");
    properties.className = "bof-panes-props";
    properties.setAttribute("aria-label", "Selected element properties");
    properties.hidden = true;
    root.append(properties);
    root.appendChild(canvas);
    const legend = root.ownerDocument.createElement("div");
    legend.className = "bof-panes-legend";
    legend.setAttribute("aria-label", "Source category legend");
    root.append(legend);
    // Precedence: the recipe rig's legend, then a "legend" input (a scale
    // table), then a coloured instance table's distinct values.
    let tableLegend: InstanceLegend = emptyInstanceLegend;
    let legendInput: TableSlice | null = null;
    const updateLegend = () => {
      const fromRig = rig.legend?.() ?? [];
      if (fromRig.length > 0) {
        renderLegendView(legend, entriesLegendView(fromRig, 0));
        return;
      }
      const scale = legendInput && parseScaleLegend(legendInput);
      renderLegendView(
        legend,
        scale ? scaleLegendView(scale) : entriesLegendView(tableLegend.entries, tableLegend.omitted),
      );
    };

    // Text labels from an instances input's label columns, placed on every drawn frame.
    const labels = createLabelLayer(root, canvas, point => rig.project?.(point));
    let labelNote = "";
    const reportError = (error: unknown) => {
      status.textContent = String(error);
      status.setAttribute("role", "alert");
      emit({ kind: "action", action: "loadError", payload: { message: String(error) } });
    };
    let rig: ReturnType<View3DDeps["createRig"]>;
    try { rig = deps.createRig(canvas, (entityId, info) => onPick(entityId, info)); } catch (error) {
      reportError(error);
      return { update() {}, destroy() {} };
    }

    const stopFrames = rig.onFrame?.(() => labels.layout());
    let maps: readonly GroupEntityMap[] = [];
    let baseColors: Float32Array[] = [];
    let baseTransforms: (Float32Array | null)[] = [];
    let offsetsApplied = false;
    let pending: TableSlice | null = null;
    let loadToken = 0;
    let loading = false;
    let pendingView: TableSlice | null = null;
    let pendingBoxes: TableSlice | null = null;
    let lastModel: { url: string; format: ModelFormat } | null = null;
    let disposed = false;
    let propsToken = 0;
    /** Picked entity ids in pick order, each with its GlobalId once the property fetch has returned. */
    const selected = new Map<number, string | undefined>();
    /** GlobalIds learned for the loaded model, kept so a re-pick carries its GlobalId at once. */
    const globalIds = new Map<number, string>();
    let lastPicked: number | null = null;
    /** The graph's own path for the loaded model, when the editor gave one. */
    let modelPath: string | undefined;
    /** The bim.selection node this pane added, so Use selection updates it. */
    let selectionNodeId: string | undefined;
    const knownGlobalIds = (): string[] => [...selected.values()].filter((id): id is string => !!id);
    /** The selection event: entity ids as text, then the GlobalIds known so far. */
    const emitSelection = () => emit({
      kind: "selection",
      event: {
        source: "view3d",
        ids: [
          ...[...selected.keys()].map(String),
          ...[...selected.values()].filter((id): id is string => !!id),
        ],
      },
    });
    const hideProperties = () => {
      propsToken++;
      properties.hidden = true;
      properties.replaceChildren();
    };
    const selectionChanged = () => {
      rig.select?.([...selected.keys()]);
      updateControls();
      status.textContent = selected.size === 0 ? "Nothing selected." : `${selected.size} selected`;
      emitSelection();
    };
    /** Replace on a plain pick, toggle on an extended one, clear on a click in empty space. */
    const onPick = (entityId: number | null, info: PickInfo): void => {
      if (entityId === null) {
        if (info.onModel) { status.textContent = "That object has no entity id, so it cannot be selected."; return; }
        if (selected.size === 0) return;
        selected.clear();
        lastPicked = null;
        hideProperties();
        selectionChanged();
        return;
      }
      if (info.extend && selected.has(entityId)) {
        selected.delete(entityId);
        if (lastPicked === entityId) { lastPicked = null; hideProperties(); }
      } else {
        if (!info.extend) selected.clear();
        selected.set(entityId, globalIds.get(entityId));
        lastPicked = entityId;
        showProperties(entityId);
      }
      selectionChanged();
    };
    /** Fetches the picked entity's properties; a later pick supersedes an
     * in-flight one in the panel, and a failure is reported in the panel only.
     * Every answer still records its GlobalId for the selection event. */
    const showProperties = (entityId: number): void => {
      const model = lastModel;
      if (!ctx.requestEntityProperties || !model) return;
      const token = ++propsToken;
      const current = () => !disposed && token === propsToken;
      ctx.requestEntityProperties(model.url, entityId).then(
        props => {
          if (disposed || model !== lastModel) return;
          if (props.globalId) {
            globalIds.set(entityId, props.globalId);
            if (selected.has(entityId) && selected.get(entityId) !== props.globalId) {
              selected.set(entityId, props.globalId);
              emitSelection();
            }
          }
          if (!current()) return;
          renderEntityProperties(properties, props);
          properties.append(editControls(entityId));
        },
        error => {
          if (!current()) return;
          renderEntityMessage(properties, `No properties for entity ${entityId} (${error})`);
          properties.append(editControls(entityId));
        },
      );
    };
    let recipeFrame: number | null = null;
    const scheduleRecipe = () => {
      const win = root.ownerDocument.defaultView;
      if (!options?.followGraph || !win?.requestAnimationFrame) {
        if (pendingView) rig.applyRecipe?.(pendingView);
        updateLegend();
        return;
      }
      if (recipeFrame !== null) return;
      recipeFrame = win.requestAnimationFrame(() => {
        recipeFrame = null;
        if (disposed || loading || !pendingView) return;
        try { rig.applyRecipe?.(pendingView); updateLegend(); } catch (error) { reportError(error); }
      });
    };
    const button = (label: string, action: () => void | Promise<void>): HTMLButtonElement => {
      const control = root.ownerDocument.createElement("button");
      control.type = "button";
      control.textContent = label;
      control.addEventListener("click", () => {
        Promise.resolve().then(action).catch(error => { if (!disposed) reportError(error); });
      });
      toolbar.append(control);
      return control;
    };
    if (rig.fit) button("Fit", () => rig.fit?.());
    if (rig.reset && !options?.followGraph) button("Reset view", () => {
      rig.reset?.();
      updateLegend();
      status.textContent = "Original view restored. Reapply to restore the graph presentation.";
    });
    if (rig.applyRecipe && !options?.followGraph) button("Reapply graph", () => {
      if (pending) applyInstances(pending);
      if (pendingBoxes) applyBoxes(pendingBoxes);
      if (pendingView) rig.applyRecipe?.(pendingView);
      updateLegend();
    });
    if (rig.capture) button("Save PNG", async () => {
      const blob = await rig.capture!();
      if (disposed) return;
      const url = URL.createObjectURL(blob);
      const link = root.ownerDocument.createElement("a");
      link.href = url;
      link.download = "bim-flow-view.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    // Shown only once a load has failed: a retry offered before any failure
    // reads as a warning.
    const retry = button("Retry model", () => {
      if (lastModel) load(lastModel.url, lastModel.format);
    });
    retry.hidden = true;

    // Review controls: each adds nodes through the editor (one edit path) and
    // writes nothing itself; the nodes' Run does.
    const note = (text: string) => { status.setAttribute("role", "status"); status.textContent = text; };
    const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);
    const reviewButton = (label: string, act: () => void | Promise<void>): HTMLButtonElement => {
      const control = root.ownerDocument.createElement("button");
      control.type = "button";
      control.textContent = label;
      control.addEventListener("click", () => {
        Promise.resolve().then(act).catch(error => { if (!disposed) note(errorText(error)); });
      });
      return control;
    };
    const missingGlobalIds = (): string => {
      const missing = selected.size - knownGlobalIds().length;
      return missing > 0 ? ` ${missing} of ${selected.size} selected elements have no GlobalId yet.` : "";
    };
    const addNodes = async (plan: Parameters<NonNullable<typeof ctx.addNodes>>[0]): Promise<string[]> => {
      if (!ctx.addNodes) throw new Error("This editor cannot add nodes from the 3D pane.");
      return ctx.addNodes(plan);
    };
    const useSelection = async () => {
      const globalIds = knownGlobalIds();
      if (globalIds.length === 0) { note("No GlobalId is known for the selected elements yet."); return; }
      const plan = selectionPlan(globalIds);
      if (selectionNodeId && ctx.setParams) {
        try {
          await ctx.setParams(selectionNodeId, plan.params!);
          note(`Updated ${selectionNodeId}.${missingGlobalIds()}`);
          return;
        } catch { selectionNodeId = undefined; }
      }
      const [id] = await addNodes([plan]);
      selectionNodeId = id;
      note(`Added ${id}.${missingGlobalIds()}`);
    };
    const useSelectionButton = reviewButton("Use selection", useSelection);
    const commentButton = reviewButton("Comment", () => {
      openForm(commentHost, {
        fields: [
          { name: "title", label: "Title", required: true },
          { name: "comment", label: "Comment", required: true },
          { name: "author", label: "Author" },
        ],
        onSubmit: async form => {
          const camera = rig.camera?.();
          try {
            const ids = await addNodes(commentPlan(form, camera, knownGlobalIds(), new Date()));
            note(`Added ${ids.join(" and ")}.${missingGlobalIds()}${camera?.orthographic
              ? " The view is orthographic; the camera was saved with a 60 degree field of view." : ""}`);
          } catch (error) { note(errorText(error)); throw error; }
        },
      }, "bof-panes-form bof-panes-comment");
    });
    toolbar.append(useSelectionButton, commentButton);
    /** Buttons that cannot act are disabled, not hidden, so the controls stay findable. */
    const updateControls = () => {
      const canEdit = !!ctx.addNodes && lastModel !== null && !loading;
      useSelectionButton.disabled = !canEdit || selected.size === 0;
      commentButton.disabled = !canEdit;
    };
    updateControls();
    /** The property panel's Edit property control for one picked element. */
    const editControls = (entityId: number): HTMLElement => {
      const bar = root.ownerDocument.createElement("div");
      const host = root.ownerDocument.createElement("div");
      const open = reviewButton("Edit property", () => {
        openForm(host, {
          fields: [
            { name: "psetName", label: "Property set", required: true },
            { name: "paramName", label: "Property", required: true },
            { name: "paramValue", label: "Value", required: true },
          ],
          onSubmit: async form => {
            try {
              const ids = await addNodes(editPropertyPlan(form, entityId, modelPath));
              note(`Added ${ids.join(" and ")}.`);
            } catch (error) { note(errorText(error)); throw error; }
          },
        }, "bof-panes-form bof-panes-edit");
      });
      open.className = "bof-panes-edit-open";
      open.disabled = !ctx.addNodes;
      bar.append(open, host);
      return bar;
    };

    const applyInstances = (slice: TableSlice): void => {
      const plan = planFromSlice(slice);
      const applyOffsets = plan.offsets !== null || offsetsApplied;
      maps.forEach((m, i) => {
        const colors = groupColorPlan(m.entities, baseColors[i], plan);
        if (colors) m.group.setColors(0, colors);
        const base = baseTransforms[i];
        if (!applyOffsets || !base || !m.group.setTransform) return;
        const transforms = groupTransformPlan(m.entities, base, plan) ?? base;
        for (let j = 0; j < m.entities.length; j++)
          m.group.setTransform(j, transforms.subarray(j * 16, (j + 1) * 16));
      });
      offsetsApplied = plan.offsets !== null;
      tableLegend = legendFromSlice(slice);
      labelNote = labels.set(rig.project ? parseLabels(slice) : null);
      if (labelNote) note(labelNote);
      updateLegend();
      rig.requestRender();
    };

    const applyBoxes = (slice: TableSlice) => {
      const boxes = parseBoxTable(slice);
      if (boxes.count === 0) rig.clearBoxes();
      else rig.setBoxes(boxes.transforms, boxes.colors);
      rig.requestRender();
    };
    const load = (url: string, format: ModelFormat) => {
      lastModel = { url, format };
      labels.set(null);
      labelNote = "";
      hideProperties();
      globalIds.clear();
      lastPicked = null;
      selectionNodeId = undefined;
      if (selected.size > 0) { selected.clear(); emitSelection(); }
      const token = ++loadToken;
      maps = [];
      loading = true;
      status.setAttribute("role", "status");
      status.textContent = "Loading model…";
      retry.hidden = true;
      updateControls();
      rig.load(ctx.resolveAsset(url), format, () => {
        if (!disposed && token === loadToken) status.textContent = "Coarse preview · loading full detail…";
      }).then(loaded => {
        if (disposed || token !== loadToken) return;
        maps = loaded;
        loading = false;
        updateControls();
        baseColors = loaded.map(m => m.group.colors.slice());
        baseTransforms = loaded.map(m => m.group.transforms?.slice() ?? null);
        offsetsApplied = false;
        if (pending) applyInstances(pending);
        if (pendingBoxes) applyBoxes(pendingBoxes);
        if (pendingView) rig.applyRecipe?.(pendingView);
        updateLegend();
        status.textContent = `${loaded.reduce((n, m) => n + m.entities.length, 0).toLocaleString()} rendered instances · orbit / pan / zoom${labelNote ? ` · ${labelNote}` : ""}`;
        emit({ kind: "action", action: "modelLoaded", payload: { url } });
      }).catch(error => {
        if (disposed || token !== loadToken) return;
        loading = false;
        updateControls();
        retry.hidden = false;
        status.textContent = String(error);
        status.setAttribute("role", "alert");
        emit({ kind: "action", action: "loadError", payload: { url, message: String(error) } });
      });
    };

    return {
      update(input) {
        if (input.kind === "model") {
          if (lastModel) {
            pending = null;
            pendingBoxes = null;
            pendingView = null;
          }
          modelPath = input.path;
          load(input.url, input.format ?? inferFormat(input.url));
        } else if (input.kind === "instances") {
          pending = input.data;
          if (!loading && maps.length > 0) applyInstances(input.data);
        } else if (input.kind === "boxes") {
          pendingBoxes = input.data;
          if (!loading) applyBoxes(input.data);
        } else if (input.kind === "view") {
          try {
            parseViewRecipe(input.data);
            pendingView = input.data;
            if (!loading && maps.length > 0) scheduleRecipe();
          } catch (error) { reportError(error); }
        } else if (input.kind === "legend") {
          legendInput = input.data;
          updateLegend();
        }
      },
      destroy: () => {
        disposed = true; loadToken++;
        if (recipeFrame !== null) root.ownerDocument.defaultView?.cancelAnimationFrame(recipeFrame);
        stopFrames?.();
        labels.destroy();
        rig.dispose();
      },
    };
  });
