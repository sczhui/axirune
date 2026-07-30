/**
 * Axirune 0.3 pure standard library.
 *
 * Signatures and evaluators intentionally live in one registry so the
 * compiler and every runtime surface agree on names, parameters, laziness,
 * and result types. Builtins cannot access time, randomness, I/O, tools, or
 * ambient host state.
 */

export type BuiltinValue =
  | null
  | boolean
  | number
  | string
  | BuiltinValue[]
  | { [key: string]: BuiltinValue };

export type BuiltinValueType =
  | "Any"
  | "Nothing"
  | "Bool"
  | "Number"
  | "Text"
  | "List"
  | "Record"
  | "Outcome";

export interface BuiltinParameter {
  name: string;
  type: BuiltinValueType;
  required: boolean;
  aliases?: readonly string[];
  /** Lazy parameters are evaluated only if the builtin selects them. */
  lazy?: boolean;
}

export interface BuiltinSignature {
  name: string;
  parameters: readonly BuiltinParameter[];
  returns: BuiltinValueType;
  pure: true;
}

export type BuiltinArgument = () => Promise<BuiltinValue>;

export interface BuiltinInvocation {
  arguments: Readonly<Record<string, BuiltinArgument>>;
  callTask: (
    taskName: string,
    arguments_: Readonly<Record<string, BuiltinValue>>,
  ) => Promise<BuiltinValue>;
  maxCollectionItems: number;
}

type BuiltinEvaluator = (invocation: BuiltinInvocation) => Promise<BuiltinValue>;

interface BuiltinDefinition extends BuiltinSignature {
  evaluate: BuiltinEvaluator;
}

export class BuiltinFault extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BuiltinFault";
  }
}

const required = (
  name: string,
  type: BuiltinValueType,
  lazy = false,
  aliases: readonly string[] = [],
): BuiltinParameter => ({
  name,
  type,
  required: true,
  ...(lazy ? { lazy: true } : {}),
  ...(aliases.length > 0 ? { aliases } : {}),
});

const optional = (
  name: string,
  type: BuiltinValueType,
  lazy = false,
): BuiltinParameter => ({ name, type, required: false, ...(lazy ? { lazy: true } : {}) });

const define = (
  name: string,
  parameters: readonly BuiltinParameter[],
  returns: BuiltinValueType,
  evaluate: BuiltinEvaluator,
): BuiltinDefinition => ({ name, parameters, returns, pure: true, evaluate });

const definitions: readonly BuiltinDefinition[] = [
  define(
    "Core.if",
    [required("when", "Bool"), required("then", "Any", true), required("else", "Any", true)],
    "Any",
    async (call) =>
      expectBool(await argument(call, "when"), "Core.if", "when")
        ? argument(call, "then")
        : argument(call, "else"),
  ),
  define(
    "Core.coalesce",
    [required("value", "Any"), required("fallback", "Any", true)],
    "Any",
    async (call) => {
      const value = await argument(call, "value");
      return value === null ? argument(call, "fallback") : value;
    },
  ),
  define(
    "Core.type",
    [required("value", "Any")],
    "Text",
    async (call) => valueType(await argument(call, "value")),
  ),

  numberBinary("Number.add", (left, right) => left + right),
  numberBinary("Number.subtract", (left, right) => left - right),
  numberBinary("Number.multiply", (left, right) => left * right),
  numberBinary("Number.divide", (left, right) => {
    if (right === 0) {
      throw new BuiltinFault("E_DIVIDE_BY_ZERO", "Number.divide cannot divide by zero.");
    }
    return left / right;
  }),
  numberBinary("Number.remainder", (left, right) => {
    if (right === 0) {
      throw new BuiltinFault("E_DIVIDE_BY_ZERO", "Number.remainder cannot divide by zero.");
    }
    return left % right;
  }),
  numberBinary("Number.power", (left, right) => left ** right),
  numberUnary("Number.abs", Math.abs),
  numberBinary("Number.min", Math.min),
  numberBinary("Number.max", Math.max),
  numberUnary("Number.floor", Math.floor),
  numberUnary("Number.ceil", Math.ceil),
  numberUnary("Number.round", Math.round),
  numberComparison("Number.equal", (left, right) => left === right),
  numberComparison("Number.notEqual", (left, right) => left !== right),
  numberComparison("Number.less", (left, right) => left < right),
  numberComparison("Number.lessOrEqual", (left, right) => left <= right),
  numberComparison("Number.greater", (left, right) => left > right),
  numberComparison("Number.greaterOrEqual", (left, right) => left >= right),

  define(
    "Bool.not",
    [required("value", "Bool")],
    "Bool",
    async (call) => !expectBool(await argument(call, "value"), "Bool.not", "value"),
  ),
  define(
    "Bool.and",
    [required("left", "Bool"), required("right", "Bool", true)],
    "Bool",
    async (call) => {
      const left = expectBool(await argument(call, "left"), "Bool.and", "left");
      return left
        ? expectBool(await argument(call, "right"), "Bool.and", "right")
        : false;
    },
  ),
  define(
    "Bool.or",
    [required("left", "Bool"), required("right", "Bool", true)],
    "Bool",
    async (call) => {
      const left = expectBool(await argument(call, "left"), "Bool.or", "left");
      return left
        ? true
        : expectBool(await argument(call, "right"), "Bool.or", "right");
    },
  ),

  define(
    "Text.join",
    [required("parts", "List"), optional("separator", "Text")],
    "Text",
    async (call) => {
      const parts = expectList(await argument(call, "parts"), "Text.join", "parts");
      const separator = await optionalArgument(call, "separator", "");
      return parts.map(displayText).join(expectText(separator, "Text.join", "separator"));
    },
  ),
  define(
    "Text.concat",
    [required("left", "Text"), required("right", "Text")],
    "Text",
    async (call) =>
      expectText(await argument(call, "left"), "Text.concat", "left") +
      expectText(await argument(call, "right"), "Text.concat", "right"),
  ),
  define(
    "Text.length",
    [required("text", "Text")],
    "Number",
    async (call) =>
      expectText(await argument(call, "text"), "Text.length", "text").length,
  ),
  textUnary("Text.upper", (text) => text.toLocaleUpperCase("en-US")),
  textUnary("Text.lower", (text) => text.toLocaleLowerCase("en-US")),
  textUnary("Text.trim", (text) => text.trim()),
  textPredicate("Text.contains", (text, search) => text.includes(search)),
  textPredicate("Text.startsWith", (text, search) => text.startsWith(search)),
  textPredicate("Text.endsWith", (text, search) => text.endsWith(search)),
  define(
    "Text.replace",
    [
      required("text", "Text"),
      required("search", "Text"),
      required("replacement", "Text"),
    ],
    "Text",
    async (call) =>
      expectText(await argument(call, "text"), "Text.replace", "text").replaceAll(
        expectText(await argument(call, "search"), "Text.replace", "search"),
        expectText(
          await argument(call, "replacement"),
          "Text.replace",
          "replacement",
        ),
      ),
  ),
  define(
    "Text.slice",
    [required("text", "Text"), required("start", "Number"), optional("end", "Number")],
    "Text",
    async (call) => {
      const text = expectText(await argument(call, "text"), "Text.slice", "text");
      const start = expectInteger(
        await argument(call, "start"),
        "Text.slice",
        "start",
      );
      const endValue = await optionalArgument(call, "end", null);
      const end =
        endValue === null ? undefined : expectInteger(endValue, "Text.slice", "end");
      return text.slice(start, end);
    },
  ),
  define(
    "Text.split",
    [required("text", "Text"), required("separator", "Text")],
    "List",
    async (call) =>
      expectText(await argument(call, "text"), "Text.split", "text").split(
        expectText(await argument(call, "separator"), "Text.split", "separator"),
      ),
  ),

  define(
    "List.length",
    [required("list", "List", false, ["items"])],
    "Number",
    async (call) => expectList(await argument(call, "list"), "List.length", "list").length,
  ),
  define(
    "List.at",
    [required("list", "List", false, ["items"]), required("index", "Number")],
    "Any",
    async (call) => {
      const list = expectList(await argument(call, "list"), "List.at", "list");
      const index = expectInteger(await argument(call, "index"), "List.at", "index");
      if (index < 0 || index >= list.length) {
        throw new BuiltinFault(
          "E_INDEX_OUT_OF_BOUNDS",
          `List.at index ${index} is outside 0..${Math.max(0, list.length - 1)}.`,
        );
      }
      return list[index]!;
    },
  ),
  define(
    "List.append",
    [required("list", "List", false, ["items"]), required("value", "Any")],
    "List",
    async (call) => [
      ...expectList(await argument(call, "list"), "List.append", "list"),
      await argument(call, "value"),
    ],
  ),
  define(
    "List.prepend",
    [required("list", "List", false, ["items"]), required("value", "Any")],
    "List",
    async (call) => [
      await argument(call, "value"),
      ...expectList(await argument(call, "list"), "List.prepend", "list"),
    ],
  ),
  define(
    "List.concat",
    [required("left", "List"), required("right", "List")],
    "List",
    async (call) => [
      ...expectList(await argument(call, "left"), "List.concat", "left"),
      ...expectList(await argument(call, "right"), "List.concat", "right"),
    ],
  ),
  define(
    "List.slice",
    [
      required("list", "List", false, ["items"]),
      required("start", "Number"),
      optional("end", "Number"),
    ],
    "List",
    async (call) => {
      const list = expectList(await argument(call, "list"), "List.slice", "list");
      const start = expectInteger(
        await argument(call, "start"),
        "List.slice",
        "start",
      );
      const endValue = await optionalArgument(call, "end", null);
      const end =
        endValue === null ? undefined : expectInteger(endValue, "List.slice", "end");
      return list.slice(start, end);
    },
  ),
  define(
    "List.contains",
    [required("list", "List", false, ["items"]), required("value", "Any")],
    "Bool",
    async (call) => {
      const list = expectList(await argument(call, "list"), "List.contains", "list");
      const value = await argument(call, "value");
      return list.some((item) => deepEqual(item, value));
    },
  ),
  define(
    "List.reverse",
    [required("list", "List", false, ["items"])],
    "List",
    async (call) => [
      ...expectList(await argument(call, "list"), "List.reverse", "list"),
    ].reverse(),
  ),
  define(
    "List.range",
    [optional("start", "Number"), required("end", "Number"), optional("step", "Number")],
    "List",
    async (call) => {
      const start = expectInteger(
        await optionalArgument(call, "start", 0),
        "List.range",
        "start",
      );
      const end = expectInteger(await argument(call, "end"), "List.range", "end");
      const step = expectInteger(
        await optionalArgument(call, "step", 1),
        "List.range",
        "step",
      );
      if (step === 0) {
        throw new BuiltinFault("E_BUILTIN_ARGUMENT", "List.range :step cannot be zero.");
      }
      const values: BuiltinValue[] = [];
      const continues = step > 0
        ? (value: number): boolean => value < end
        : (value: number): boolean => value > end;
      for (let value = start; continues(value); value += step) {
        if (values.length >= call.maxCollectionItems) {
          throw new BuiltinFault(
            "E_VALUE_SIZE",
            "List.range exceeds the sandbox collection limit.",
          );
        }
        values.push(value);
      }
      return values;
    },
  ),
  define(
    "List.map",
    [required("list", "List", false, ["items"]), required("using", "Text")],
    "List",
    async (call) => {
      const list = expectList(await argument(call, "list"), "List.map", "list");
      const task = expectText(await argument(call, "using"), "List.map", "using");
      const mapped: BuiltinValue[] = [];
      for (let index = 0; index < list.length; index += 1) {
        mapped.push(await call.callTask(task, { item: list[index]!, index }));
      }
      return mapped;
    },
  ),
  define(
    "List.filter",
    [required("list", "List", false, ["items"]), required("using", "Text")],
    "List",
    async (call) => {
      const list = expectList(await argument(call, "list"), "List.filter", "list");
      const task = expectText(await argument(call, "using"), "List.filter", "using");
      const filtered: BuiltinValue[] = [];
      for (let index = 0; index < list.length; index += 1) {
        const keep = await call.callTask(task, { item: list[index]!, index });
        if (expectBool(keep, "List.filter", `task ${task} result`)) {
          filtered.push(list[index]!);
        }
      }
      return filtered;
    },
  ),
  define(
    "List.fold",
    [
      required("list", "List", false, ["items"]),
      required("using", "Text"),
      required("initial", "Any"),
    ],
    "Any",
    async (call) => {
      const list = expectList(await argument(call, "list"), "List.fold", "list");
      const task = expectText(await argument(call, "using"), "List.fold", "using");
      let accumulator = await argument(call, "initial");
      for (let index = 0; index < list.length; index += 1) {
        accumulator = await call.callTask(task, {
          accumulator,
          item: list[index]!,
          index,
        });
      }
      return accumulator;
    },
  ),

  define(
    "Record.get",
    [required("record", "Record"), required("key", "Text")],
    "Any",
    async (call) => {
      const record = expectRecord(
        await argument(call, "record"),
        "Record.get",
        "record",
      );
      const key = expectText(await argument(call, "key"), "Record.get", "key");
      if (!Object.hasOwn(record, key)) {
        throw new BuiltinFault("E_RECORD_KEY", `Record.get cannot find key ${JSON.stringify(key)}.`);
      }
      return record[key]!;
    },
  ),
  define(
    "Record.put",
    [required("record", "Record"), required("key", "Text"), required("value", "Any")],
    "Record",
    async (call) => {
      const record = expectRecord(
        await argument(call, "record"),
        "Record.put",
        "record",
      );
      const key = safeKey(
        expectText(await argument(call, "key"), "Record.put", "key"),
      );
      return copyRecord(record, { [key]: await argument(call, "value") });
    },
  ),
  define(
    "Record.has",
    [required("record", "Record"), required("key", "Text")],
    "Bool",
    async (call) =>
      Object.hasOwn(
        expectRecord(await argument(call, "record"), "Record.has", "record"),
        expectText(await argument(call, "key"), "Record.has", "key"),
      ),
  ),
  define(
    "Record.keys",
    [required("record", "Record")],
    "List",
    async (call) =>
      Object.keys(
        expectRecord(await argument(call, "record"), "Record.keys", "record"),
      ),
  ),
  define(
    "Record.values",
    [required("record", "Record")],
    "List",
    async (call) =>
      Object.values(
        expectRecord(await argument(call, "record"), "Record.values", "record"),
      ),
  ),
  define(
    "Record.merge",
    [required("left", "Record"), required("right", "Record")],
    "Record",
    async (call) =>
      copyRecord(
        expectRecord(await argument(call, "left"), "Record.merge", "left"),
        expectRecord(await argument(call, "right"), "Record.merge", "right"),
      ),
  ),

  define(
    "Json.encode",
    [required("value", "Any")],
    "Text",
    async (call) => stableJson(await argument(call, "value")),
  ),
  define(
    "Json.decode",
    [required("text", "Text")],
    "Any",
    async (call) => {
      const text = expectText(await argument(call, "text"), "Json.decode", "text");
      try {
        return normalizeJson(JSON.parse(text) as unknown, call.maxCollectionItems);
      } catch (error) {
        if (error instanceof BuiltinFault) throw error;
        throw new BuiltinFault(
          "E_JSON_DECODE",
          `Json.decode received invalid JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  ),

  define(
    "Outcome.ok",
    [required("value", "Any")],
    "Outcome",
    async (call) => ({ ok: true, value: await argument(call, "value") }),
  ),
  define(
    "Outcome.fail",
    [required("fault", "Any")],
    "Outcome",
    async (call) => ({ ok: false, fault: await argument(call, "fault") }),
  ),
  define(
    "Outcome.isOk",
    [required("outcome", "Outcome")],
    "Bool",
    async (call) =>
      expectOutcome(await argument(call, "outcome"), "Outcome.isOk").ok,
  ),
  define(
    "Outcome.value",
    [required("outcome", "Outcome")],
    "Any",
    async (call) => {
      const outcome = expectOutcome(await argument(call, "outcome"), "Outcome.value");
      if (!outcome.ok) {
        throw new BuiltinFault(
          "E_OUTCOME_FAULT",
          "Outcome.value cannot unwrap a failed outcome.",
        );
      }
      return outcome.value;
    },
  ),
  define(
    "Outcome.fault",
    [required("outcome", "Outcome")],
    "Any",
    async (call) => {
      const outcome = expectOutcome(await argument(call, "outcome"), "Outcome.fault");
      if (outcome.ok) {
        throw new BuiltinFault(
          "E_OUTCOME_OK",
          "Outcome.fault cannot unwrap a successful outcome.",
        );
      }
      return outcome.fault;
    },
  ),
];

const definitionMap = new Map(definitions.map((definition) => [definition.name, definition]));

export const BUILTIN_REGISTRY: Readonly<Record<string, BuiltinSignature>> =
  Object.freeze(
    Object.fromEntries(
      definitions.map(({ evaluate: _evaluate, ...signature }) => [
        signature.name,
        Object.freeze({
          ...signature,
          parameters: Object.freeze(
            signature.parameters.map((parameter) =>
              Object.freeze({
                ...parameter,
                ...(parameter.aliases
                  ? { aliases: Object.freeze([...parameter.aliases]) }
                  : {}),
              }),
            ),
          ),
        }),
      ]),
    ) as Record<string, BuiltinSignature>,
  );

export const BUILTIN_NAMES: readonly string[] = Object.freeze(
  definitions.map((definition) => definition.name),
);

export function getBuiltinSignature(name: string): BuiltinSignature | undefined {
  return BUILTIN_REGISTRY[name];
}

export function isBuiltinName(name: string): boolean {
  return definitionMap.has(name);
}

export async function invokeBuiltin(
  name: string,
  invocation: BuiltinInvocation,
): Promise<BuiltinValue> {
  const definition = definitionMap.get(name);
  if (!definition) {
    throw new BuiltinFault("E_UNKNOWN_BUILTIN", `Builtin ${name} is not registered.`);
  }
  const accepted = new Set(
    definition.parameters.flatMap((parameter) => [
      parameter.name,
      ...(parameter.aliases ?? []),
    ]),
  );
  for (const supplied of Object.keys(invocation.arguments)) {
    if (!accepted.has(supplied)) {
      throw new BuiltinFault(
        "E_BUILTIN_ARGUMENT",
        `${name} does not accept named argument :${supplied}.`,
      );
    }
  }
  const normalized: Record<string, BuiltinArgument> = Object.create(
    null,
  ) as Record<string, BuiltinArgument>;
  for (const parameter of definition.parameters) {
    const suppliedNames = [parameter.name, ...(parameter.aliases ?? [])].filter(
      (candidate) => invocation.arguments[candidate],
    );
    if (suppliedNames.length > 1) {
      throw new BuiltinFault(
        "E_BUILTIN_ARGUMENT",
        `${name} received aliases ${suppliedNames
          .map((candidate) => `:${candidate}`)
          .join(" and ")} for the same argument.`,
      );
    }
    const supplied = suppliedNames[0];
    if (supplied) normalized[parameter.name] = invocation.arguments[supplied]!;
    else if (parameter.required) {
      throw new BuiltinFault(
        "E_BUILTIN_ARGUMENT",
        `${name} requires named argument :${parameter.name}.`,
      );
    }
  }
  return definition.evaluate({ ...invocation, arguments: normalized });
}

function numberBinary(
  name: string,
  operation: (left: number, right: number) => number,
): BuiltinDefinition {
  return define(
    name,
    [required("left", "Number"), required("right", "Number")],
    "Number",
    async (call) => {
      const left = expectNumber(await argument(call, "left"), name, "left");
      const right = expectNumber(await argument(call, "right"), name, "right");
      const result = operation(left, right);
      if (!Number.isFinite(result)) {
        throw new BuiltinFault(
          "E_NUMBER_RANGE",
          `${name} produced a non-finite number.`,
        );
      }
      return result;
    },
  );
}

function numberUnary(
  name: string,
  operation: (value: number) => number,
): BuiltinDefinition {
  return define(name, [required("value", "Number")], "Number", async (call) => {
    const result = operation(expectNumber(await argument(call, "value"), name, "value"));
    if (!Number.isFinite(result)) {
      throw new BuiltinFault("E_NUMBER_RANGE", `${name} produced a non-finite number.`);
    }
    return result;
  });
}

function numberComparison(
  name: string,
  operation: (left: number, right: number) => boolean,
): BuiltinDefinition {
  return define(
    name,
    [required("left", "Number"), required("right", "Number")],
    "Bool",
    async (call) =>
      operation(
        expectNumber(await argument(call, "left"), name, "left"),
        expectNumber(await argument(call, "right"), name, "right"),
      ),
  );
}

function textUnary(
  name: string,
  operation: (text: string) => string,
): BuiltinDefinition {
  return define(name, [required("text", "Text")], "Text", async (call) =>
    operation(expectText(await argument(call, "text"), name, "text")),
  );
}

function textPredicate(
  name: string,
  operation: (text: string, search: string) => boolean,
): BuiltinDefinition {
  return define(
    name,
    [required("text", "Text"), required("search", "Text")],
    "Bool",
    async (call) =>
      operation(
        expectText(await argument(call, "text"), name, "text"),
        expectText(await argument(call, "search"), name, "search"),
      ),
  );
}

async function argument(
  invocation: BuiltinInvocation,
  name: string,
): Promise<BuiltinValue> {
  const thunk = invocation.arguments[name];
  if (!thunk) {
    throw new BuiltinFault(
      "E_BUILTIN_ARGUMENT",
      `Builtin argument :${name} is required.`,
    );
  }
  return thunk();
}

async function optionalArgument(
  invocation: BuiltinInvocation,
  name: string,
  fallback: BuiltinValue,
): Promise<BuiltinValue> {
  const thunk = invocation.arguments[name];
  return thunk ? thunk() : fallback;
}

function expectNumber(value: BuiltinValue, builtin: string, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw typeFault(builtin, name, "Number", value);
  }
  return value;
}

function expectInteger(value: BuiltinValue, builtin: string, name: string): number {
  const number = expectNumber(value, builtin, name);
  if (!Number.isSafeInteger(number)) {
    throw new BuiltinFault(
      "E_BUILTIN_ARGUMENT",
      `${builtin} :${name} requires a safe integer.`,
    );
  }
  return number;
}

function expectBool(value: BuiltinValue, builtin: string, name: string): boolean {
  if (typeof value !== "boolean") throw typeFault(builtin, name, "Bool", value);
  return value;
}

function expectText(value: BuiltinValue, builtin: string, name: string): string {
  if (typeof value !== "string") throw typeFault(builtin, name, "Text", value);
  return value;
}

function expectList(value: BuiltinValue, builtin: string, name: string): BuiltinValue[] {
  if (!Array.isArray(value)) throw typeFault(builtin, name, "List", value);
  return value;
}

function expectRecord(
  value: BuiltinValue,
  builtin: string,
  name: string,
): Record<string, BuiltinValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw typeFault(builtin, name, "Record", value);
  }
  return value;
}

type Outcome =
  | { ok: true; value: BuiltinValue }
  | { ok: false; fault: BuiltinValue };

function expectOutcome(value: BuiltinValue, builtin: string): Outcome {
  const record = expectRecord(value, builtin, "outcome");
  if (record.ok === true && Object.hasOwn(record, "value")) {
    return { ok: true, value: record.value! };
  }
  if (record.ok === false && Object.hasOwn(record, "fault")) {
    return { ok: false, fault: record.fault! };
  }
  throw new BuiltinFault(
    "E_BUILTIN_TYPE",
    `${builtin} :outcome requires an Outcome.ok or Outcome.fail value.`,
  );
}

function typeFault(
  builtin: string,
  argumentName: string,
  expected: BuiltinValueType,
  value: BuiltinValue,
): BuiltinFault {
  return new BuiltinFault(
    "E_BUILTIN_TYPE",
    `${builtin} :${argumentName} requires ${expected}, received ${valueType(value)}.`,
  );
}

function valueType(value: BuiltinValue): BuiltinValueType {
  if (value === null) return "Nothing";
  if (typeof value === "boolean") return "Bool";
  if (typeof value === "number") return "Number";
  if (typeof value === "string") return "Text";
  if (Array.isArray(value)) return "List";
  if (
    typeof value === "object" &&
    typeof value.ok === "boolean" &&
    ((value.ok && Object.hasOwn(value, "value")) ||
      (!value.ok && Object.hasOwn(value, "fault")))
  ) {
    return "Outcome";
  }
  return "Record";
}

function displayText(value: BuiltinValue): string {
  if (value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stableJson(value);
}

function safeKey(key: string): string {
  if (key === "__proto__" || key === "prototype" || key === "constructor") {
    throw new BuiltinFault(
      "E_RECORD_KEY",
      `Record key ${JSON.stringify(key)} is reserved by the sandbox.`,
    );
  }
  return key;
}

function copyRecord(
  ...records: Readonly<Record<string, BuiltinValue>>[]
): Record<string, BuiltinValue> {
  const result: Record<string, BuiltinValue> = Object.create(null) as Record<
    string,
    BuiltinValue
  >;
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      result[safeKey(key)] = value;
    }
  }
  return result;
}

function deepEqual(left: BuiltinValue, right: BuiltinValue): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => deepEqual(item, right[index]!))
    );
  }
  if (
    left !== null &&
    right !== null &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] &&
          Object.hasOwn(right, key) &&
          deepEqual(left[key]!, right[key]!),
      )
    );
  }
  return false;
}

function stableJson(value: BuiltinValue): string {
  return JSON.stringify(sortRecordKeys(value));
}

function sortRecordKeys(value: BuiltinValue): BuiltinValue {
  if (Array.isArray(value)) return value.map(sortRecordKeys);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, BuiltinValue> = Object.create(null) as Record<
      string,
      BuiltinValue
    >;
    for (const key of Object.keys(value).sort()) {
      sorted[safeKey(key)] = sortRecordKeys(value[key]!);
    }
    return sorted;
  }
  return value;
}

function normalizeJson(
  value: unknown,
  maxCollectionItems: number,
  counter = { count: 0 },
): BuiltinValue {
  counter.count += 1;
  if (counter.count > maxCollectionItems) {
    throw new BuiltinFault(
      "E_VALUE_SIZE",
      "Decoded JSON exceeds the sandbox collection limit.",
    );
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BuiltinFault("E_JSON_DECODE", "Decoded JSON contains a non-finite number.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item, maxCollectionItems, counter));
  }
  if (typeof value === "object") {
    const result: Record<string, BuiltinValue> = Object.create(null) as Record<
      string,
      BuiltinValue
    >;
    for (const [key, item] of Object.entries(value)) {
      result[safeKey(key)] = normalizeJson(item, maxCollectionItems, counter);
    }
    return result;
  }
  throw new BuiltinFault("E_JSON_DECODE", "Decoded JSON contains an unsupported value.");
}
