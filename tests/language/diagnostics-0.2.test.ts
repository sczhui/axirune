import { describe, expect, it } from "vitest";
import { compileSource, runSource } from "../../src/language/index.js";

describe("Nexilume 0.2 stable call diagnostics", () => {
  it("checks required and unknown builtin named arguments", () => {
    const result = compileSource(`edition 2
task main
  yield [call Number.add :left 1 :extra 2]
/task
`);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_BUILTIN_MISSING_ARGUMENT" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_BUILTIN_UNKNOWN_ARGUMENT" }),
    );
  });

  it("checks task contracts and basic literal types", () => {
    const result = compileSource(`edition 2
task greet
  take name Text
  give Text
  yield name
/task

task main
  give Number
  let count Number = «not a number»
  yield [call greet :wrong 7]
/task
`);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_TASK_MISSING_ARGUMENT" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_TASK_UNKNOWN_ARGUMENT" }),
    );
    expect(result.diagnostics.filter((item) => item.code === "E_TYPE_MISMATCH").length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    {
      source: "yield [call Number.divide :left 1 :right 0]",
      code: "E_DIVIDE_BY_ZERO",
    },
    {
      source: "yield [call List.at :list [list] :index 0]",
      code: "E_INDEX_OUT_OF_BOUNDS",
    },
    {
      source: "yield [call Json.decode :text «{»]",
      code: "E_JSON_DECODE",
    },
  ])("surfaces runtime fault $code", async ({ source, code }) => {
    const result = await runSource(`edition 2
task main
  ${source}
/task
launch main
`);

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code, phase: "runtime" }),
    );
  });

  it("does not mock unknown tools unless explicitly requested", async () => {
    const source = `edition 2
task main
  yield [call external.lookup :query «nexilume»]
/task
launch main
`;
    const denied = await runSource(source);
    const mocked = await runSource(source, { mockTools: true });

    expect(denied.status).toBe("failed");
    expect(denied.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_TOOL_NOT_BOUND" }),
    );
    expect(mocked.status).toBe("completed");
    expect(mocked.value).toEqual(
      expect.objectContaining({ mock: true, tool: "external.lookup" }),
    );
  });

  it("reports runtime builtin type errors for dynamically supplied values", async () => {
    const result = await runSource(
      `edition 2
task main
  take value Any
  give Number
  yield [call Number.add :left value :right 1]
/task
launch main
`,
      { input: { value: "not-a-number" } },
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_BUILTIN_TYPE", phase: "runtime" }),
    );
  });

  it("rejects unsupported editions without breaking edition 1", async () => {
    const compatible = await runSource(`edition 1
task main
  yield «compatible»
/task
launch main
`);
    const future = compileSource("edition 99\ntask main\n/task\n");

    expect(compatible.status).toBe("completed");
    expect(compatible.value).toBe("compatible");
    expect(future.ok).toBe(false);
    expect(future.diagnostics).toContainEqual(
      expect.objectContaining({ code: "N2045" }),
    );
  });
});
