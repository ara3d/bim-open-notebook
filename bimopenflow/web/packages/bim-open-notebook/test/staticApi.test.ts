import { describe, expect, it, vi } from "vitest";
import { hostlessApi, NO_HOST, staticNodeCatalogUrl } from "../src/page/staticApi";

const catalog = { nodes: [{ kind: "table.filter", version: 1, capability: "Pure", inputs: [], outputs: [], params: [] }] };

function fakeFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === staticNodeCatalogUrl()) return new Response(JSON.stringify(catalog), { headers: { "content-type": "application/json" } });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("hostlessApi", () => {
  it("answers the node catalog from the shipped file", async () => {
    const fetchFn = fakeFetch();
    const api = hostlessApi(fetchFn);
    expect(await api.getNodeCatalog()).toEqual(catalog);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("notebooks/node-catalog.json");
  });

  it("fails every other request at once without fetching", async () => {
    const fetchFn = fakeFetch();
    const api = hostlessApi(fetchFn);
    await expect(api.listModels()).rejects.toThrow(NO_HOST);
    await expect(api.getAnalysisState("x")).rejects.toThrow(NO_HOST);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
