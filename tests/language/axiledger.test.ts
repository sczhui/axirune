import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  compileSource,
  runSource,
  type RuntimeValue,
} from "../../src/language/index.js";

const appUrl = new URL("../../apps/axiledger/", import.meta.url);

async function fixture<T extends RuntimeValue>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, appUrl), "utf8")) as T;
}

describe("AxiLedger deterministic Axirune application", () => {
  it("compiles as a pure application with an empty authority surface", async () => {
    const source = await readFile(new URL("main.axi", appUrl), "utf8");
    const compiled = compileSource(source);

    expect(compiled.ok).toBe(true);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.ir.space).toBe("axiledger");
    expect(compiled.ir.permissions).toEqual([]);
    expect(compiled.ir.frames.every((frame) => frame.requirements.length === 0)).toBe(
      true,
    );
    expect(
      compiled.ir.frames.some((frame) =>
        ["agent", "mcp", "prompt", "tool"].includes(frame.kind),
      ),
    ).toBe(false);
  });

  it("runs the checked-in sample and emits canonical JSON", async () => {
    const source = await readFile(new URL("main.axi", appUrl), "utf8");
    const input = await fixture<Record<string, RuntimeValue>>("sample-input.json");
    const expected = await fixture<Record<string, RuntimeValue>>(
      "expected-output.json",
    );
    const first = await runSource(source, { input });
    const second = await runSource(source, { input });

    expect(first.status).toBe("completed");
    expect(first.diagnostics).toEqual([]);
    expect(first.value).toEqual(expected);
    expect(first.output).toEqual([expected]);
    expect(first.emissions).toHaveLength(1);
    expect(JSON.parse(String(first.emissions[0]))).toEqual(expected);
    expect(second.value).toEqual(first.value);
    expect(second.emissions).toEqual(first.emissions);
    expect(
      first.trace.some(
        (event) =>
          event.kind.startsWith("tool.") ||
          /\b(?:agent|mcp|model|prompt)\b/iu.test(event.message),
      ),
    ).toBe(false);
  });

  it("rejects missing, malformed, non-positive, fractional, and unknown-kind entries", async () => {
    const source = await readFile(new URL("main.axi", appUrl), "utf8");
    const valid = {
      id: "valid",
      description: "Coffee",
      kind: "expense",
      category: "food",
      amount_cents: 450,
    };
    const missingCategory = {
      id: "missing-category",
      description: "No category field",
      kind: "expense",
      amount_cents: 450,
    };
    const result = await runSource(source, {
      input: {
        budget_cents: 1000,
        transactions: [
          valid,
          { ...valid, id: "income", kind: "income", amount_cents: 2000 },
          missingCategory,
          { ...valid, id: "zero", amount_cents: 0 },
          { ...valid, id: "negative", amount_cents: -1 },
          { ...valid, id: "fractional", amount_cents: 1.5 },
          { ...valid, id: "unknown-kind", kind: "transfer" },
          { ...valid, id: "text-amount", amount_cents: "450" },
          { ...valid, id: 9 },
          { ...valid, description: false },
          "not-a-record",
        ],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.value).toEqual({
      schema: "axirune-ledger-report/1",
      currency: "USD",
      transaction_count: 11,
      valid_count: 2,
      invalid_count: 9,
      income_cents: 2000,
      expense_cents: 450,
      net_cents: 1550,
      budget_cents: 1000,
      remaining_cents: 550,
      over_budget: false,
      categories: { food: 450 },
    });
  });

  it("returns a stable zero report for an empty ledger", async () => {
    const source = await readFile(new URL("main.axi", appUrl), "utf8");
    const result = await runSource(source, {
      input: { transactions: [], budget_cents: 5000 },
    });

    expect(result.status).toBe("completed");
    expect(result.value).toEqual({
      schema: "axirune-ledger-report/1",
      currency: "USD",
      transaction_count: 0,
      valid_count: 0,
      invalid_count: 0,
      income_cents: 0,
      expense_cents: 0,
      net_cents: 0,
      budget_cents: 5000,
      remaining_cents: 5000,
      over_budget: false,
      categories: {},
    });
  });
});
