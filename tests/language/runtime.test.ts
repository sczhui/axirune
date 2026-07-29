import { describe, expect, it } from "vitest";
import { runSource } from "../../src/language/index.js";

const hero = `space hello
edition 1

grant text.compose to greet

task greet
  give Text
  need text.compose
  let message [call Text.join
    :parts [list «Hello, » «Nexilume» «!»]
  ]
  emit message
  yield message
/task

launch greet
`;

describe("browser-safe Nexilume interpreter", () => {
  it("runs the canonical hero deterministically", async () => {
    const result = await runSource(hero);

    expect(result.status).toBe("completed");
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toBe("Hello, Nexilume!");
    expect(result.output).toEqual(["Hello, Nexilume!"]);
    expect(result.emissions).toEqual(["Hello, Nexilume!"]);
    expect(result.trace.map((event) => event.kind)).toContain("permission.check");
    expect(result.trace.map((event) => event.kind)).toContain("call");
    expect(result.trace.map((event) => event.sequence)).toEqual(
      result.trace.map((_, index) => index),
    );
  });

  it("denies undelegated authority before executing a frame", async () => {
    const result = await runSource(`task main
  need vault.read
  yield «secret»
/task

launch main
`);

    expect(result.status).toBe("denied");
    expect(result.output).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_PERMISSION_DENIED", phase: "runtime" }),
    );
  });

  it("uses deterministic tool mocks and records their trace", async () => {
    const result = await runSource(`space tools
grant catalog.read to main

tool lookup
  take query Text
  give Text
  need catalog.read
/tool

task main
  invoke lookup with «nexilume» as found
  yield found
/task

launch main
`, { mockTools: true });

    expect(result.status).toBe("completed");
    expect(result.value).toEqual(
      expect.objectContaining({ mock: true, tool: "lookup" }),
    );
    expect(result.trace).toContainEqual(
      expect.objectContaining({ kind: "tool.mock" }),
    );
  });

  it("stops at a hard step budget", async () => {
    const result = await runSource(hero, { sandbox: { maxSteps: 2 } });

    expect(result.status).toBe("budget-exhausted");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_STEP_BUDGET" }),
    );
  });
});
