# Sample notebooks

Notebook files (`bimopen-notebook/0.1`, the format in
`bimopenflow/web/packages/bim-open-notebook/src/document/format.ts`) over three
openly licensed buildings. The buildings come from BIM Open Data's
`samples/public` folder, which `node deps.mjs` puts at
`deps/bim-open-data/samples/public`; `NOTICE.md` at the repository root
carries their licences. Every graph uses only nodes of BIM Open Flow's generic
host.

| Notebook | Building and files | Turns | Headline numbers |
|---|---|---|---|
| `p01-schependomlaan.notebook.json` | Schependomlaan, `schependomlaan.duckdb` and `.bos` | storeys; spaces per storey with a chart; doors and windows per storey; the building in 3D coloured by IFC class | 6 storeys, 100 spaces (32, 29, 20, 19), 205 doors, 259 windows |
| `p02-digitalhub-heating.notebook.json` | DigitalHub, `digitalhub-hzg.duckdb` and `.bos`, `digitalhub-federated.duckdb` | heating systems; heaters and pipes per storey; pipe diameters; the heating model in 3D; systems per discipline model | 42 systems (21 supply, 21 return), 63 space heaters, 914 pipe segments; 65 systems across the four models |
| `p03-duplex-doors.notebook.json` | Duplex Apartment, `duplex.duckdb` and `.bos`, `duplex-mep.duckdb` | doors with widths; a minimum width of 850 mm with the doors in 3D; which heating system serves a room, which the data cannot say | 14 doors, 8 pass and 6 fail; 0 systems among 908 flow elements in the MEP model |

The sessions are reconstructed: an agent wrote the requests and replies after
reading the results, and every embed, snapshot, and tool call was computed by
the host from the graphs named. Each notebook's host note says so. The
headline counts equal BIM Open Data's `samples/public/samples.json`, and
`test/samples.test.ts` in the notebook package checks them against that file.
`test/notice.test.ts` checks that `NOTICE.md` lists every building file a
sample reads and that its building sections equal BIM Open Data's.

## Files

- `outlines/<name>.outline.json` gives `<name>.notebook.json` in this folder:
  the title, the host profile and note, the graphs to save to the host, and
  each turn's request, reply, and embeds.
- `graphs/<name>/nb-<name>-*.json` are the graph documents an outline saves.
  They name the data folder as `{PUBLIC}`, so no document holds a
  machine-local path; the script fills it in before saving and turns it back
  into `{PUBLIC}` in the written notebook.

The outline format, its embed kinds, and the fields for reconstructed sessions
are documented in BIM Open Toolkit's `samples/notebooks/README.md`, which
describes the same script; `scripts/outline.ts` in the notebook package
validates an outline.

## Regenerating

The notebooks are generated; do not edit them by hand. Change an outline or a
graph, then regenerate against BIM Open Flow's generic host with a fresh store,
started over the public samples (`deps/bim-open-flow` is filled by
`node deps.mjs`):

```
dotnet run --project deps/bim-open-flow/src/flow/BimOpenFlow.Host -c Release -- --profile tables --models deps/bim-open-data/samples/public --port 5431 --store artifacts/samples/store --cache artifacts/samples/cache

cd bimopenflow/web/packages/bim-open-notebook
npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5431 --outline ../../../../samples/notebooks/outlines/p01-schependomlaan.outline.json --placeholder PUBLIC=../../../../deps/bim-open-data/samples/public
```

Repeat the last command for `p02-digitalhub-heating` and `p03-duplex-doors`.
A graph change shows up as a diff in the regenerated file; reread the
snapshots and update the outline's reply texts to match. A changed card
position needs no host: `npx vite-node scripts/sync-embed-layouts.ts -- --samples ../../../../samples/notebooks`
copies the graph files' positions into the notebooks' graph embeds.

The 3D embeds need the host at view time. A `view3d` embed names a node whose
table has `entityId` (the IFC STEP id) and `r g b a` columns, computed by a
`duck.query` over `x.duckdb`; the pane loads `x.bos` from the host's model
catalog. To look at them, serve the notebook page against the same host:
`BOF_HOST=http://127.0.0.1:5431 npm run dev -w @bimopenflow/bim-open-notebook --prefix bimopenflow/web`,
then open `http://127.0.0.1:5354/notebook.html` and choose a notebook.
