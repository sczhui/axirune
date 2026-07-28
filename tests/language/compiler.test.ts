import { describe, expect, it } from "vitest";
import {
  compileSource,
  formatSource,
  parseSource,
} from "../../src/language/index.js";

describe("Nexilume compiler and formatter", () => {
  it("lowers contracts, authority, budgets, and launch into stable IR", () => {
    const source = `space demo
edition 1

grant net.read to main

sandbox safe
  network deny
  limit time 2s
/sandbox

task main
  take query Text
  give Text
  need net.read
  within sandbox safe
  budget steps 20
  let result «ok»
  emit result
  yield result
/task

launch main
`;
    const result = compileSource(source);
    const frame = result.ir.frames.find((candidate) => candidate.name === "main");

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.version).toBe("nexilume-ir/0.1");
    expect(result.ir.permissions).toEqual(["net.read"]);
    expect(result.ir.entry.map((instruction) => instruction.op)).toEqual([
      "grant",
      "launch",
    ]);
    expect(frame?.contract.inputs[0]?.name).toBe("query");
    expect(frame?.requirements[0]?.target).toBe("net.read");
    expect(frame?.sandbox).toBe("safe");
  });

  it("rejects self-grant while keeping linking and need non-authorizing", () => {
    const result = compileSource(`agent unsafe
  use tool.search
  need net.read
  grant net.read
/agent
`);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_SELF_GRANT", severity: "error" }),
    );
    expect(result.ir.permissions).toEqual([]);
  });

  it("formats to an idempotent explicit-frame form", () => {
    const source =
      "space x\nedition 1\ntask main\nlet greeting = «Hello»\nemit greeting\nyield greeting\n/task\nlaunch main";
    const first = formatSource(source);
    const second = formatSource(first.code);

    expect(first.diagnostics).toEqual([]);
    expect(second.diagnostics).toEqual([]);
    expect(second.code).toBe(first.code);
    expect(parseSource(first.code).diagnostics).toEqual([]);
    expect(first.code).toContain("/task");
  });
});

