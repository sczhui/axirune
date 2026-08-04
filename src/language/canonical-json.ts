export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const encoder = new TextEncoder();

/** Schema-independent deterministic JSON used by portable Axirune artifacts. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value, new Set<object>(), "$"));
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return encoder.encode(canonicalJson(value));
}

/**
 * Parses UTF-8 JSON and proves that its bytes are already in canonical form.
 * The round trip also rejects duplicate keys, non-finite numbers, and trivia.
 */
export function parseCanonicalJson(bytes: Uint8Array, label = "JSON"): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CanonicalJsonError(`${label} is not valid UTF-8.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CanonicalJsonError(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let encoded: string;
  try {
    encoded = canonicalJson(parsed);
  } catch (error) {
    throw new CanonicalJsonError(
      `${label} is not canonical: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (encoded !== text) {
    throw new CanonicalJsonError(
      `${label} must use Axirune canonical JSON without duplicate keys or trivia.`,
    );
  }
  return parsed;
}

export class CanonicalJsonError extends Error {
  readonly name = "CanonicalJsonError";
}

function normalize(
  value: unknown,
  ancestors: Set<object>,
  path: string,
): CanonicalJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError(`${path} contains a non-finite number.`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new CanonicalJsonError(`${path} contains an unsupported ${typeof value} value.`);
  }
  if (ancestors.has(value)) {
    throw new CanonicalJsonError(`${path} contains a cycle.`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const result: CanonicalJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new CanonicalJsonError(`${path}[${index}] is an array hole.`);
        }
        result.push(normalize(value[index], ancestors, `${path}[${index}]`));
      }
      return result;
    }
    const result: { [key: string]: CanonicalJsonValue } = Object.create(null) as {
      [key: string]: CanonicalJsonValue;
    };
    for (const key of Object.keys(value).sort()) {
      result[key] = normalize(
        (value as Record<string, unknown>)[key],
        ancestors,
        `${path}.${key}`,
      );
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

