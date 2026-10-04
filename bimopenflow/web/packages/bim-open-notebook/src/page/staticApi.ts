// The API of the static site (site.ts, HOSTLESS): no host stands behind the
// page, so every request fails at once with a plain reason, except the node
// catalog, which the build ships as a file beside the sample notebooks
// (vite/samples.ts) and this module serves from there. A graph cell needs
// the catalog to place ports, and without ports it cannot draw the wires its
// document carries (embeds/graph.ts), so a static page without this file
// shows every graph as unconnected boxes (TKT-159).

import { ApiClient } from "@bimopenflow/api-client";
import { STATIC_SAMPLES } from "./sitePaths";

/** The node catalog file in the sample folder: the host's GET /api/catalog/nodes, written by scripts/write-node-catalog.ts. */
export const STATIC_NODE_CATALOG = "node-catalog.json";

/** The one API route the static site answers, from the file above. */
export const NODE_CATALOG_ROUTE = "/api/catalog/nodes";

/** What every other request says. */
export const NO_HOST = "This copy has no host.";

/** The static file's URL, relative to notebook.html like the samples. */
export const staticNodeCatalogUrl = (): string => `${STATIC_SAMPLES}${STATIC_NODE_CATALOG}`;

/** An ApiClient for a page with no host: the node catalog comes from the shipped file; everything else fails with NO_HOST. */
export function hostlessApi(fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): ApiClient {
  const route: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    if (method === "GET" && url === NODE_CATALOG_ROUTE) return fetchFn(staticNodeCatalogUrl());
    throw new Error(NO_HOST);
  };
  return new ApiClient({ baseUrl: "", fetch: route });
}
