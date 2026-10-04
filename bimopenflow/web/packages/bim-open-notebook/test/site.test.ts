import { describe, expect, it } from "vitest";
import { hostlessNote } from "../src/page/site";

describe("hostlessNote", () => {
  it("says there is no host and links the copied NOTICE.md", () => {
    const span = document.createElement("span");
    span.append(hostlessNote(document));
    expect(span.textContent).toMatch(/^This is a static copy with no host behind it/);
    const link = span.querySelector("a");
    expect(link?.getAttribute("href")).toBe("NOTICE.md");
    expect(link?.textContent).toBe("NOTICE.md");
  });
});
