import { describe, expect, it } from "vitest";
import { capabilityManifestFromIR } from "../../src/cli/manifest.js";
import { compileSource } from "../../src/language/index.js";

describe("capability manifest", () => {
  it("links declared authority to its consumers and sandbox policy", () => {
    const compiled = compileSource(`space manifest
capability weather.read
  effect network.read
  resource «https://weather.example/v1»
/capability
tool weather.current
  need capability weather.read
/tool
sandbox preview
  network allow «weather.example»
/sandbox
`);
    expect(compiled.ok).toBe(true);
    const manifest = capabilityManifestFromIR(compiled.ir);
    expect(manifest.capabilities).toMatchObject([
      {
        name: "weather.read",
        requiredBy: ["weather.current"],
      },
    ]);
    expect(manifest.tools).toEqual([
      {
        name: "weather.current",
        kind: "tool",
        capabilities: ["weather.read"],
      },
    ]);
    expect(manifest.sandboxes[0]).toMatchObject({
      name: "preview",
      policies: [{ name: "network" }],
    });
  });
});
