import type { IRProgram } from "./ir.js";

export const WIRE_IR_VERSION = "axirune-wire-ir/1" as const;

export interface WireIRDocument {
  schema: typeof WIRE_IR_VERSION;
  program: unknown;
}

/**
 * Converts insertion-ordered IR maps into explicit ordered pairs before
 * canonical object-key sorting. Evaluation order is therefore part of the
 * artifact rather than an accident of a JavaScript object implementation.
 */
export function toWireIR(ir: IRProgram): WireIRDocument {
  return {
    schema: WIRE_IR_VERSION,
    program: encodeNode(ir),
  };
}

export function fromWireIR(value: unknown): unknown {
  const document = asObject(value, "wire IR document");
  if (document.schema !== WIRE_IR_VERSION) {
    throw new WireIRError(
      "E_CAPSULE_IR_VERSION",
      `Unsupported Wire IR schema ${String(document.schema)}.`,
    );
  }
  return decodeNode(document.program, "$program");
}

/** Produces a formatting-independent semantic view for content identity. */
export function semanticWireIR(ir: IRProgram): unknown {
  return removeLocations(toWireIR(ir));
}

export class WireIRError extends Error {
  readonly name = "WireIRError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function encodeNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(encodeNode);
  if (value === null || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  const encoded: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const [key, entry] of Object.entries(object)) {
    if (
      (object.kind === "record" && key === "entries") ||
      (object.kind === "call" && key === "arguments") ||
      (typeof object.qualifiedName === "string" && key === "budgets")
    ) {
      const ordered = asObject(entry, key);
      encoded[key] = Object.entries(ordered).map(([name, item]) => [
        name,
        encodeNode(item),
      ]);
    } else {
      encoded[key] = encodeNode(entry);
    }
  }
  return encoded;
}

function decodeNode(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => decodeNode(entry, `${path}[${index}]`));
  }
  if (value === null || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  const decoded: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const [key, entry] of Object.entries(object)) {
    if (
      (object.kind === "record" && key === "entries") ||
      (object.kind === "call" && key === "arguments") ||
      (typeof object.qualifiedName === "string" && key === "budgets")
    ) {
      decoded[key] = decodePairs(entry, `${path}.${key}`);
    } else {
      decoded[key] = decodeNode(entry, `${path}.${key}`);
    }
  }
  return decoded;
}

function decodePairs(value: unknown, path: string): Record<string, unknown> {
  if (!Array.isArray(value)) {
    throw new WireIRError("E_CAPSULE_IR_SCHEMA", `${path} must be ordered pairs.`);
  }
  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  value.forEach((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string") {
      throw new WireIRError(
        "E_CAPSULE_IR_SCHEMA",
        `${path}[${index}] must be a [name, value] pair.`,
      );
    }
    const key = pair[0];
    if (isUnsafeKey(key)) {
      throw new WireIRError(
        "E_CAPSULE_IR_SCHEMA",
        `${path}[${index}] contains unsafe key ${JSON.stringify(key)}.`,
      );
    }
    if (Object.hasOwn(result, key)) {
      throw new WireIRError(
        "E_CAPSULE_IR_SCHEMA",
        `${path} contains duplicate key ${JSON.stringify(key)}.`,
      );
    }
    result[key] = decodeNode(pair[1], `${path}[${index}][1]`);
  });
  return result;
}

function removeLocations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeLocations);
  if (value === null || typeof value !== "object") return value;
  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "span" || key === "sourceSpan") continue;
    result[key] = removeLocations(entry);
  }
  return result;
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new WireIRError("E_CAPSULE_IR_SCHEMA", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function isUnsafeKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

