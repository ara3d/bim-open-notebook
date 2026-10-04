// Where the page runs: under the dev server, which serves the sample routes
// and proxies /api to a host (vite.config.ts), or as the static site built by
// vite.pages.config.ts, which holds the samples as files (sitePaths.ts) and
// has no host.

import { NOTICE_FILE } from "./sitePaths";

/** True in the static build (`vite build --mode pages`); Vite replaces MODE at build time. */
export const HOSTLESS = import.meta.env.MODE === "pages";

/** What the static site says in place of the host banner and the request box. */
const HOSTLESS_NOTE =
  "This is a static copy with no host behind it, so it shows every answer as it was recorded. " +
  "Asking, Re-evaluate, and the live 3D view need a running host; the BIM Open Notebook README says how to start one.";

/** HOSTLESS_NOTE followed by a link to the sample buildings' licences, which the static build copies beside the page. */
export function hostlessNote(doc: Document): Node {
  const note = doc.createDocumentFragment();
  const link = doc.createElement("a");
  link.href = NOTICE_FILE;
  link.textContent = "NOTICE.md";
  note.append(`${HOSTLESS_NOTE} The sample buildings' licences are in `, link, ".");
  return note;
}
