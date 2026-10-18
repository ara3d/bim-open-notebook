# @bimopenflow/pane-3d

The editor's 3D pane over the BIM Open viewer (`deps/bim-open-viewer`), kept
out of `@bimopenflow/panes` so the generic editor packages never depend on
the viewer. `view3dPane` is its registration for an editor that takes panes
(`PaneRegistration` in `@bimopenflow/client`): it is offered for `view3d.*`
nodes and nodes with an `instances` or `boxes` table, loads the node's model
once per pane, feeds the live view recipe (`buildLiveViewRecipe`) or the
node's complete table, and keeps its pane across recipe branches of one
model. The toolkit's pages (`packages/studio-web`) register it with
`bootEditor({ panes: [...genericPanes, view3dPane] })`.

## ViewPane3D — `createViewPane3D(options?)`

A `@bim-open-viewer/core` Viewer with `OrbitControls` and `PickControls` on a
canvas. Scene/color/mapping logic is pure and viewer-free
(`src/instanceTable.ts`); `src/viewerDeps.ts` is the thin real wiring, and
`options.deps` swaps it for a fake in headless tests. Without a WebGL context
(e.g. jsdom) the renderer is never attached but the pane still mounts.

- Accepts:
  - `model`: loads via `ctx.resolveAsset(url)`; format inferred from the URL
    (`.bos` → BOS, else GLB) unless `format` is given.
  - `instances`: an instance table per
    `src/BimOpenFlow.Nodes.Geometry/README.md` — keyed by `entityId` (else
    `instanceIndex`); rows present define the visible set (absent instances
    are hidden via alpha 0), and `r`/`g`/`b`/`a` columns (0..1 floats), when
    all four are present, recolor. Arriving before the model finishes
    loading, it is held and applied afterwards. When the rig has no recipe
    legend, the legend strip lists the table's distinct `verdict` (else
    `category`) values with their colours and counts, capped at 12 with an
    "and N more" row (`src/instanceLegend.ts`).
  - `model` may carry `path`, the graph's own path for the model; Edit
    property uses it for the write-back paths.
- Selection: a plain click replaces the selection, shift-click or ctrl-click
  adds the element or removes it if already picked, and a click in empty space
  clears it. The picked elements are highlighted in the viewer
  (`ViewerRig.select`). The status line reads `N selected` (`Nothing
  selected.` after a clear). A click on an object with no entity id (a GLB
  model has no mapping) leaves the selection and says `That object has no
  entity id, so it cannot be selected.` Loading a model clears the selection.
- Emits:
  - `selection` with `source: "view3d"` on every change of the selection.
    `ids` lists the entity ids as text, then the GlobalIds known so far; the
    event is emitted again when a property fetch supplies a GlobalId. A table
    pane that highlights rows whose id cell matches any id in the set lights
    up the picked rows whether it is keyed by entity id or GlobalId.
  - `action` `modelLoaded` / `loadError` with `{ url }` payloads.
- Property panel: the last picked element's properties come from
  `ctx.requestEntityProperties(modelUrl, localId)` — when the context supplies
  it — and show the entity's name, category, GlobalId, and one section per
  property set in a scrollable panel under the status line
  (`src/entityProperties.ts`). A failed fetch shows one line there and leaves
  the view alone; a later pick supersedes an in-flight request in the panel
  (the GlobalId is still recorded), and loading a model clears the panel.

## Review controls

Each control adds nodes through `ctx.addNodes` / `ctx.setParams`, so the
result is a graph a person could have built, undoable, and nothing is written
until Run. A button is disabled when it cannot act: there is no `ctx.addNodes`,
no model is loaded, or (Use selection) nothing is selected. A form with an
empty required field does nothing but focus that field. The status line
reports `Added <ids>.`, `Updated <id>.`, or the error message of a rejected
call. The node kinds and parameter names are in `src/graphNodes.ts`, with the
toolkit pack that owns each; the pane never imports the toolkit.

| Control | Where | Adds |
|---|---|---|
| **Use selection** | toolbar | a `bim.selection` node whose `ids` are the selected GlobalIds. Pressed again, it sets `ids` on the node it added (`ctx.setParams`) and adds a new one if that node is gone. |
| **Comment** | toolbar; form: Title (required), Comment (required), Author; **Add to graph**, **Cancel** | a `view3d.camera` node holding the view's position, target and field of view, wired `camera` to the `camera` input of a `bcf.issue` node holding title, comment, author, `created` (the current UTC time, `yyyy-MM-ddTHH:mm:ssZ`), status `Open` and the selected GlobalIds. An orthographic view is saved with a 60 degree field of view and the status says so. |
| **Edit property** | property panel; form: Property set, Property, Value (all required); **Add to graph**, **Cancel** | a `table.inline` node with one row `{entityId, psetName, paramName, paramValue}` wired `table` to `in` of a `sink.writePsets` node. `sourcePath` is the model path when it ends in `.ifc` (any case), `targetPath` is that path with `-reviewed` before the extension; both stay blank for any other model. |

Only GlobalIds that the property fetch has returned go into the nodes. When
some selected elements have none yet, the status says how many.

## Development

`@bim-open-viewer/*` are aliased to their `src/index.ts` in `tsconfig.json`
(through `../../viewer.tsconfig.json`) and `vitest.config.ts`
(`viewerAlias`). Tests use `@bimopenflow/panes/testing`.

```sh
npx tsc -p . --noEmit   # typecheck
npx vitest run          # tests (jsdom)
```
