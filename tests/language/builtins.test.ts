import { describe, expect, it } from "vitest";
import {
  BUILTIN_NAMES,
  BUILTIN_REGISTRY,
  BuiltinFault,
  invokeBuiltin,
  type BuiltinValue,
} from "../../src/language/index.js";

async function callBuiltin(
  name: string,
  values: Readonly<Record<string, BuiltinValue>>,
  callTask: (
    taskName: string,
    arguments_: Readonly<Record<string, BuiltinValue>>,
  ) => Promise<BuiltinValue> = async (taskName) => {
    throw new Error(`Unexpected task ${taskName}`);
  },
): Promise<BuiltinValue> {
  return invokeBuiltin(name, {
    arguments: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, async () => value]),
    ),
    callTask,
    maxCollectionItems: 10_000,
  });
}

describe("Axirune 0.3 pure builtin registry", () => {
  it("exports one immutable signature for every required builtin", () => {
    expect(BUILTIN_NAMES).toEqual(
      expect.arrayContaining([
        "Core.if",
        "Number.power",
        "Number.isInteger",
        "Bool.and",
        "Text.equal",
        "Text.replace",
        "List.fold",
        "Record.merge",
        "Json.decode",
        "Outcome.fault",
      ]),
    );
    expect(Object.keys(BUILTIN_REGISTRY)).toHaveLength(BUILTIN_NAMES.length);
    expect(BUILTIN_REGISTRY["Core.if"]?.parameters).toEqual([
      { name: "when", type: "Bool", required: true },
      { name: "then", type: "Any", required: true, lazy: true },
      { name: "else", type: "Any", required: true, lazy: true },
    ]);
  });

  it("evaluates lazy core and short-circuit boolean branches only when selected", async () => {
    let forbiddenEvaluations = 0;
    const selectedBranch = ["th", "en"].join("");
    const lazyArguments = Object.fromEntries([
      ["when", async () => true],
      [selectedBranch, async () => "selected"],
      [
        "else",
        async () => {
          forbiddenEvaluations += 1;
          throw new Error("must stay lazy");
        },
      ],
    ]);
    const result = await invokeBuiltin("Core.if", {
      arguments: lazyArguments,
      callTask: async () => null,
      maxCollectionItems: 100,
    });
    const and = await invokeBuiltin("Bool.and", {
      arguments: {
        left: async () => false,
        right: async () => {
          forbiddenEvaluations += 1;
          return true;
        },
      },
      callTask: async () => null,
      maxCollectionItems: 100,
    });

    expect(result).toBe("selected");
    expect(and).toBe(false);
    expect(forbiddenEvaluations).toBe(0);
    await expect(callBuiltin("Core.coalesce", { value: null, fallback: 9 })).resolves.toBe(9);
    await expect(callBuiltin("Core.type", { value: [1, 2] })).resolves.toBe("List");
  });

  it("covers deterministic number arithmetic and comparisons", async () => {
    await expect(callBuiltin("Number.add", { left: 7, right: 5 })).resolves.toBe(12);
    await expect(callBuiltin("Number.subtract", { left: 7, right: 5 })).resolves.toBe(2);
    await expect(callBuiltin("Number.multiply", { left: 7, right: 5 })).resolves.toBe(35);
    await expect(callBuiltin("Number.divide", { left: 7, right: 2 })).resolves.toBe(3.5);
    await expect(callBuiltin("Number.remainder", { left: 7, right: 5 })).resolves.toBe(2);
    await expect(callBuiltin("Number.power", { left: 2, right: 8 })).resolves.toBe(256);
    await expect(callBuiltin("Number.abs", { value: -3 })).resolves.toBe(3);
    await expect(callBuiltin("Number.min", { left: 7, right: 5 })).resolves.toBe(5);
    await expect(callBuiltin("Number.max", { left: 7, right: 5 })).resolves.toBe(7);
    await expect(callBuiltin("Number.floor", { value: 2.9 })).resolves.toBe(2);
    await expect(callBuiltin("Number.ceil", { value: 2.1 })).resolves.toBe(3);
    await expect(callBuiltin("Number.round", { value: 2.5 })).resolves.toBe(3);
    await expect(callBuiltin("Number.equal", { left: 2, right: 2 })).resolves.toBe(true);
    await expect(callBuiltin("Number.notEqual", { left: 2, right: 3 })).resolves.toBe(true);
    await expect(callBuiltin("Number.less", { left: 2, right: 3 })).resolves.toBe(true);
    await expect(callBuiltin("Number.lessOrEqual", { left: 3, right: 3 })).resolves.toBe(true);
    await expect(callBuiltin("Number.greater", { left: 4, right: 3 })).resolves.toBe(true);
    await expect(callBuiltin("Number.greaterOrEqual", { left: 4, right: 4 })).resolves.toBe(true);
    await expect(callBuiltin("Number.isInteger", { value: 42 })).resolves.toBe(true);
    await expect(callBuiltin("Number.isInteger", { value: 1.5 })).resolves.toBe(false);
    await expect(
      callBuiltin("Number.isInteger", { value: Number.MAX_SAFE_INTEGER + 1 }),
    ).resolves.toBe(false);
  });

  it("covers text transformation and inspection", async () => {
    await expect(
      callBuiltin("Text.join", { parts: ["a", "b", "c"], separator: "-" }),
    ).resolves.toBe("a-b-c");
    await expect(callBuiltin("Text.concat", { left: "Axi", right: "rune" })).resolves.toBe(
      "Axirune",
    );
    await expect(callBuiltin("Text.length", { text: "agent" })).resolves.toBe(5);
    await expect(callBuiltin("Text.upper", { text: "agent" })).resolves.toBe("AGENT");
    await expect(callBuiltin("Text.lower", { text: "AGENT" })).resolves.toBe("agent");
    await expect(callBuiltin("Text.trim", { text: "  agent  " })).resolves.toBe("agent");
    await expect(callBuiltin("Text.equal", { left: "expense", right: "expense" })).resolves.toBe(
      true,
    );
    await expect(callBuiltin("Text.equal", { left: "expense", right: "income" })).resolves.toBe(
      false,
    );
    await expect(
      callBuiltin("Text.contains", { text: "agent kernel", search: "kernel" }),
    ).resolves.toBe(true);
    await expect(
      callBuiltin("Text.startsWith", { text: "agent kernel", search: "agent" }),
    ).resolves.toBe(true);
    await expect(
      callBuiltin("Text.endsWith", { text: "agent kernel", search: "kernel" }),
    ).resolves.toBe(true);
    await expect(
      callBuiltin("Text.replace", {
        text: "a-a-a",
        search: "a",
        replacement: "b",
      }),
    ).resolves.toBe("b-b-b");
    await expect(
      callBuiltin("Text.slice", { text: "Axirune", start: 3, end: 7 }),
    ).resolves.toBe("rune");
    await expect(
      callBuiltin("Text.split", { text: "a,b,c", separator: "," }),
    ).resolves.toEqual(["a", "b", "c"]);
  });

  it("covers persistent list and record operations", async () => {
    const source = [1, 2, 3];
    await expect(callBuiltin("List.length", { list: source })).resolves.toBe(3);
    await expect(callBuiltin("List.at", { list: source, index: 1 })).resolves.toBe(2);
    await expect(callBuiltin("List.append", { list: source, value: 4 })).resolves.toEqual([
      1, 2, 3, 4,
    ]);
    await expect(callBuiltin("List.prepend", { list: source, value: 0 })).resolves.toEqual([
      0, 1, 2, 3,
    ]);
    await expect(callBuiltin("List.concat", { left: [1], right: [2, 3] })).resolves.toEqual([
      1, 2, 3,
    ]);
    await expect(callBuiltin("List.slice", { list: source, start: 1 })).resolves.toEqual([
      2, 3,
    ]);
    await expect(callBuiltin("List.contains", { list: source, value: 2 })).resolves.toBe(true);
    await expect(callBuiltin("List.reverse", { list: source })).resolves.toEqual([3, 2, 1]);
    await expect(callBuiltin("List.range", { start: 1, end: 6, step: 2 })).resolves.toEqual([
      1, 3, 5,
    ]);
    expect(source).toEqual([1, 2, 3]);

    const record = { a: 1, b: 2 };
    await expect(callBuiltin("Record.get", { record, key: "a" })).resolves.toBe(1);
    await expect(callBuiltin("Record.has", { record, key: "b" })).resolves.toBe(true);
    await expect(callBuiltin("Record.keys", { record })).resolves.toEqual(["a", "b"]);
    await expect(callBuiltin("Record.values", { record })).resolves.toEqual([1, 2]);
    await expect(callBuiltin("Record.put", { record, key: "c", value: 3 })).resolves.toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
    await expect(
      callBuiltin("Record.merge", { left: record, right: { b: 9, c: 3 } }),
    ).resolves.toEqual({ a: 1, b: 9, c: 3 });
    expect(record).toEqual({ a: 1, b: 2 });
  });

  it("maps, filters, and folds through named user-task contracts", async () => {
    const task = async (
      name: string,
      args: Readonly<Record<string, BuiltinValue>>,
    ): Promise<BuiltinValue> => {
      if (name === "double") return Number(args.item) * 2;
      if (name === "even") return Number(args.item) % 2 === 0;
      if (name === "sum") return Number(args.accumulator) + Number(args.item);
      throw new Error(name);
    };

    await expect(
      callBuiltin("List.map", { list: [1, 2, 3], using: "double" }, task),
    ).resolves.toEqual([2, 4, 6]);
    await expect(
      callBuiltin("List.filter", { list: [1, 2, 3, 4], using: "even" }, task),
    ).resolves.toEqual([2, 4]);
    await expect(
      callBuiltin("List.fold", { list: [1, 2, 3], using: "sum", initial: 0 }, task),
    ).resolves.toBe(6);
  });

  it("encodes canonical JSON and models explicit outcomes", async () => {
    await expect(
      callBuiltin("Json.encode", { value: { z: 1, a: [2, 3] } }),
    ).resolves.toBe('{"a":[2,3],"z":1}');
    await expect(
      callBuiltin("Json.decode", { text: '{"ok":true,"value":7}' }),
    ).resolves.toEqual({ ok: true, value: 7 });

    const ok = await callBuiltin("Outcome.ok", { value: 7 });
    const failed = await callBuiltin("Outcome.fail", { fault: "offline" });
    await expect(callBuiltin("Outcome.isOk", { outcome: ok })).resolves.toBe(true);
    await expect(callBuiltin("Outcome.value", { outcome: ok })).resolves.toBe(7);
    await expect(callBuiltin("Outcome.fault", { outcome: failed })).resolves.toBe("offline");
  });

  it("returns stable faults instead of silent nulls", async () => {
    await expect(callBuiltin("Number.divide", { left: 1, right: 0 })).rejects.toMatchObject<
      Partial<BuiltinFault>
    >({ code: "E_DIVIDE_BY_ZERO" });
    await expect(callBuiltin("List.at", { list: [], index: 0 })).rejects.toMatchObject<
      Partial<BuiltinFault>
    >({ code: "E_INDEX_OUT_OF_BOUNDS" });
    await expect(callBuiltin("Json.decode", { text: "{" })).rejects.toMatchObject<
      Partial<BuiltinFault>
    >({ code: "E_JSON_DECODE" });
  });
});
