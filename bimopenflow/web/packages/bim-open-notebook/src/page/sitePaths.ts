// Where the static site (vite.pages.config.ts) keeps the sample notebooks,
// relative to notebook.html. Read by the page (files.ts) and by the build,
// so this module stays free of browser and Vite-only globals.

/** The sample folder. */
export const STATIC_SAMPLES = "notebooks/";
/** File names, the same list the dev server's /__notebooks/ answers. */
export const STATIC_INDEX = "index.json";
/** One NotebookEntry (catalog.ts) per sample, in reading order, for a landing page. */
export const STATIC_CATALOG = "catalog.json";
/** The host's node catalog (GET /api/catalog/nodes), written beside the samples by scripts/write-node-catalog.ts;
 *  the static page places ports and draws wires from it (staticApi.ts). */
export const STATIC_NODE_CATALOG = "node-catalog.json";
/** The sample buildings' licences, copied from the repository's NOTICE.md beside notebook.html. */
export const NOTICE_FILE = "NOTICE.md";
