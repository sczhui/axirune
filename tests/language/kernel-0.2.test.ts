import { describe, expect, it } from "vitest";
import {
  compileSource,
  formatSource,
  LANGUAGE_VERSION,
  parseSource,
  runSource,
} from "../../src/language/index.js";

const factorial = `space compute
edition 2

task factorial
  take n Number
  give Number
  yield [call Core.if
    :when [call Number.lessOrEqual :left n :right 1]
    :then 1
    :else [call Number.multiply
      :left n
      :right [call factorial
        :n [call Number.subtract :left n :right 1]
      ]
    ]
  ]
/task

task main
  give Number
  yield [call factorial :n 6]
/task

launch main
`;

describe("Nexilume 0.2 deterministic task kernel", () => {
  it("runs recursive tasks as named pure function calls", async () => {
    const compiled = compileSource(factorial);
    const result = await runSource(factorial);

    expect(compiled.ok).toBe(true);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.ir.edition).toBe(2);
    expect(compiled.ir.version).toBe("nexilume-ir/0.2");
    expect(LANGUAGE_VERSION).toBe("0.2.0");
    expect(result.status).toBe("completed");
    expect(result.value).toBe(720);
    expect(result.output).toEqual([720]);
    expect(result.trace).toContainEqual(
      expect.objectContaining({ kind: "function.call", message: "Task factorial." }),
    );
    expect(result.trace).toContainEqual(
      expect.objectContaining({ kind: "builtin.call", message: "Builtin Core.if." }),
    );
    expect(result.trace.some((event) => event.message.includes("Tool factorial"))).toBe(false);
  });

  it("does not evaluate the unselected Core.if branch", async () => {
    const result = await runSource(`edition 2
task main
  give Number
  yield [call Core.if
    :when true
    :then 42
    :else [call Number.divide :left 1 :right 0]
  ]
/task
launch main
`);

    expect(result.status).toBe("completed");
    expect(result.value).toBe(42);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.trace.filter(
        (event) =>
          event.kind === "builtin.call" && event.message.includes("Number.divide"),
      ),
    ).toEqual([]);
  });

  it("runs deterministic map, filter, and fold through user tasks", async () => {
    const result = await runSource(`edition 2
task double
  take item Number
  take index Number
  give Number
  yield [call Number.multiply :left item :right 2]
/task

task keep_even
  take item Number
  take index Number
  give Bool
  yield [call Number.equal
    :left [call Number.remainder :left item :right 2]
    :right 0
  ]
/task

task sum
  take accumulator Number
  take item Number
  take index Number
  give Number
  yield [call Number.add :left accumulator :right item]
/task

task main
  give Record
  let values [call List.range :start 1 :end 6]
  let doubled [call List.map :list values :using «double»]
  let evens [call List.filter :list values :using «keep_even»]
  let total [call List.fold :list values :using «sum» :initial 0]
  yield [record :doubled doubled :evens evens :total total]
/task

launch main
`);

    expect(result.status).toBe("completed");
    expect(result.value).toEqual({
      doubled: [2, 4, 6, 8, 10],
      evens: [2, 4],
      total: 15,
    });
    expect(result.output).toHaveLength(1);
  });

  it("builds records with prefix fields and emits stable JSON", async () => {
    const source = `edition 2
task add_price
  take accumulator Number
  take item Record
  take index Number
  give Number
  let price [call Record.get :record item :key «price»]
  yield [call Number.add :left accumulator :right price]
/task

task main
  give Text
  let items [list
    [record :name «Tea» :price 12]
    [record :name «Cake» :price 8]
  ]
  let total [call List.fold :list items :using «add_price» :initial 0]
  let invoice [record :currency «SGD» :total total]
  yield [call Json.encode :value invoice]
/task

launch main
`;
    const parsed = parseSource(source);
    const formatted = formatSource(source);
    const result = await runSource(source);

    expect(parsed.diagnostics).toEqual([]);
    expect(formatted.diagnostics).toEqual([]);
    expect(formatted.code).toContain("[record :name «Tea» :price 12]");
    expect(result.status).toBe("completed");
    expect(result.value).toBe('{"currency":"SGD","total":20}');
  });

  it("canonicalizes typed and untyped let with = and remains idempotent", () => {
    const legacy = `edition 2
task main
  let values List<Int> [list 2, 3, 5]
  let empty [record]
  yield [record :values values :empty empty]
/task
`;
    const first = formatSource(legacy);
    const second = formatSource(first.code);

    expect(first.diagnostics).toEqual([]);
    expect(first.code).toContain("let values [List Int] = [list 2 3 5]");
    expect(first.code).toContain("let empty = [record]");
    expect(second.diagnostics).toEqual([]);
    expect(second.code).toBe(first.code);
  });

  it("passes host input through an explicit root launch", async () => {
    const result = await runSource(
      `edition 2
task main
  take name Text
  give Text
  yield [call Text.concat :left «Hello, » :right name]
/task
launch main
`,
      { input: { name: "Ada" } },
    );

    expect(result.status).toBe("completed");
    expect(result.value).toBe("Hello, Ada");
  });

  it("keeps capability-bound host I/O explicit while pure tasks transform data", async () => {
    const result = await runSource(
      `space files
edition 2

capability host.fs.read
  effect filesystem.read
/capability

tool File.readText
  take path Text
  give Text
  need capability host.fs.read
/tool

grant host.fs.read to main

task main
  give Number
  let source = [call File.readText :path «./input.txt»]
  let words = [call Text.split :text source :separator « »]
  yield [call List.length :items words]
/task

launch main
`,
      {
        tools: {
          "File.readText": ({ namedArguments }) =>
            namedArguments.path === "./input.txt" ? "one two three" : "",
        },
      },
    );

    expect(result.status).toBe("completed");
    expect(result.value).toBe(3);
    expect(result.trace).toContainEqual(
      expect.objectContaining({ kind: "tool.call", message: "Tool File.readText." }),
    );
  });

  it("enforces recursive frame depth and global step budgets", async () => {
    const depth = await runSource(factorial, { sandbox: { maxFrameDepth: 3 } });
    const steps = await runSource(factorial, { sandbox: { maxSteps: 5 } });

    expect(depth.status).toBe("budget-exhausted");
    expect(depth.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_FRAME_DEPTH" }),
    );
    expect(steps.status).toBe("budget-exhausted");
    expect(steps.diagnostics).toContainEqual(
      expect.objectContaining({ code: "E_STEP_BUDGET" }),
    );
  });
});
