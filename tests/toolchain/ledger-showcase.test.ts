import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/axirune.js";
import { capabilityManifestFromIR } from "../../src/cli/manifest.js";
import {
  compileSource,
  runSource,
  type RuntimeValue,
} from "../../src/language/index.js";

const appDirectory = new URL("../../apps/axiledger/", import.meta.url);
const appPath = fileURLToPath(new URL("main.axi", appDirectory));
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readFixture<T extends RuntimeValue>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, appDirectory), "utf8")) as T;
}

async function readShowcase(): Promise<string> {
  return readFile(new URL("main.axi", appDirectory), "utf8");
}

describe("AxiLedger showcase acceptance", () => {
  it("ships real Axirune source that compiles to an empty authority manifest", async () => {
    const source = await readShowcase();
    const compiled = compileSource(source);

    expect(source.length).toBeGreaterThan(1_000);
    expect(compiled.ok).toBe(true);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.ir.space).toBe("axiledger");

    const manifest = capabilityManifestFromIR(compiled.ir);
    expect(manifest).toMatchObject({
      schema: "axirune-capability-manifest/1",
      space: "axiledger",
      capabilities: [],
      tools: [],
      sandboxes: [],
      permissions: [],
    });
    expect(compiled.ir.permissions).toEqual([]);
    expect(
      compiled.ir.frames.filter((frame) =>
        ["agent", "mcp", "prompt", "tool"].includes(frame.kind),
      ),
    ).toEqual([]);
    expect(
      [
        ...compiled.ir.entry,
        ...compiled.ir.frames.flatMap((frame) => frame.instructions),
      ].filter(
        (instruction) =>
          instruction.op === "directive" && instruction.verb === "model",
      ),
    ).toEqual([]);
  });

  it("runs the checked-in sample end to end through the public CLI", async () => {
    const input =
      await readFixture<Record<string, RuntimeValue>>("sample-input.json");
    const expected =
      await readFixture<Record<string, RuntimeValue>>("expected-output.json");
    const output = capture();

    const exitCode = await runCli(
      [
        "run",
        appPath,
        "--input-json",
        JSON.stringify(input),
        "--json",
      ],
      {
        cwd: repositoryRoot,
        ...output.environment,
      },
    );
    const envelope = JSON.parse(output.stdout()) as {
      schema: string;
      ok: boolean;
      status: string;
      value: RuntimeValue;
      output: RuntimeValue[];
      emissions: RuntimeValue[];
      trace: { kind: string; message: string }[];
    };

    expect(exitCode).toBe(0);
    expect(output.stderr()).toBe("");
    expect(envelope).toMatchObject({
      schema: "axirune-cli/run@1",
      ok: true,
      status: "completed",
      value: expected,
      output: [expected],
    });
    expect(envelope.emissions).toHaveLength(1);
    expect(JSON.parse(String(envelope.emissions[0]))).toEqual(expected);
    expect(
      envelope.trace.filter(
        (event) =>
          event.kind.startsWith("tool.") ||
          /\b(?:agent|mcp|model|prompt)\b/iu.test(event.message),
      ),
    ).toEqual([]);
  });

  it("returns byte-for-byte stable observable results for the same input", async () => {
    const source = await readShowcase();
    const input =
      await readFixture<Record<string, RuntimeValue>>("sample-input.json");
    const options = {
      input,
      capabilities: [],
      tools: {},
      mockTools: false,
      sandbox: {
        maxToolCalls: 0,
        maxSteps: 100_000,
        maxTraceEvents: 20_000,
      },
    } as const;

    const first = await runSource(source, options);
    const second = await runSource(source, options);

    expect(first.status).toBe("completed");
    expect(first.diagnostics).toEqual([]);
    expect(second).toEqual(first);
  });

  it("processes 1,000 transactions in the real runtime without mocks", async () => {
    const source = await readShowcase();
    const input = ledgerInput(1_000);
    const result = await runLargeLedger(source, input);

    expect(result.status).toBe("completed");
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toMatchObject({
      schema: "axirune-ledger-report/1",
      currency: "USD",
      transaction_count: 1_000,
      valid_count: 1_000,
      invalid_count: 0,
      income_cents: 0,
      expense_cents: input.expense,
      net_cents: -input.expense,
      remaining_cents: 1_000,
      over_budget: false,
      categories: input.categories,
    });
    expect(
      result.trace.some((event) => event.kind.startsWith("tool.")),
    ).toBe(false);
  });

  const stressIt =
    process.env.AXIRUNE_LEDGER_STRESS === "1" ? it : it.skip;

  stressIt(
    "processes 10,000 transactions when the opt-in stress suite is enabled",
    async () => {
      const source = await readShowcase();
      const input = ledgerInput(10_000);
      const result = await runLargeLedger(source, input);

      expect(result.status).toBe("completed");
      expect(result.diagnostics).toEqual([]);
      expect(result.value).toMatchObject({
        transaction_count: 10_000,
        valid_count: 10_000,
        invalid_count: 0,
        expense_cents: input.expense,
        categories: input.categories,
      });
    },
    60_000,
  );
});

function ledgerInput(count: number): {
  runtime: Readonly<Record<string, RuntimeValue>>;
  expense: number;
  categories: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  let expense = 0;
  const transactions = Array.from({ length: count }, (_, index) => {
    const category = `category-${index % 10}`;
    const amount = (index % 100) + 1;
    categories[category] = (categories[category] ?? 0) + amount;
    expense += amount;
    return {
      id: `stress-${index}`,
      description: `Generated transaction ${index}`,
      kind: "expense",
      category,
      amount_cents: amount,
    };
  });

  return {
    runtime: {
      transactions,
      budget_cents: expense + 1_000,
    },
    expense,
    categories,
  };
}

async function runLargeLedger(
  source: string,
  input: ReturnType<typeof ledgerInput>,
) {
  return runSource(source, {
    input: input.runtime,
    capabilities: [],
    tools: {},
    mockTools: false,
    sandbox: {
      maxSteps: 2_000_000,
      maxToolCalls: 0,
      maxLaunches: 32,
      maxFrameDepth: 32,
      maxTraceEvents: 500,
      maxCollectionItems: 50_000,
      timeoutMs: 30_000,
    },
  });
}

function capture(): {
  environment: {
    stdout: (chunk: string) => void;
    stderr: (chunk: string) => void;
  };
  stdout: () => string;
  stderr: () => string;
} {
  let stdout = "";
  let stderr = "";
  return {
    environment: {
      stdout: (chunk) => {
        stdout += chunk;
      },
      stderr: (chunk) => {
        stderr += chunk;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}
