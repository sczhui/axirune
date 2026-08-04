import { createHash } from "node:crypto";

const HEADER_SIZE = 60;
const DIGEST_OFFSET = 28;
const DIGEST_SIZE = 32;
const DOMAIN = new TextEncoder().encode("Axirune Capsule v1\0");

type SectionDescriptor = {
  name: string;
  encoding: string;
  offset: number;
  length: number;
  sha256: string;
};

export type CapsuleFixtureDraft = {
  metadata: Record<string, unknown>;
  sections: Map<string, unknown>;
};

/**
 * Repackages a generated capsule after a semantic mutation while preserving
 * valid framing and digests. Tests can therefore reach verifier invariants
 * beyond the ordinary byte-integrity gate.
 */
export function repackCapsuleForTest(
  bytes: Uint8Array,
  mutate: (draft: CapsuleFixtureDraft) => void,
): Uint8Array {
  if (bytes.length < HEADER_SIZE) throw new Error("Fixture capsule is truncated.");
  const inputView = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  const metadataLength = inputView.getUint32(16, false);
  const payloadLength = inputView.getUint32(20, false);
  const metadataStart = HEADER_SIZE;
  const payloadStart = metadataStart + metadataLength;
  if (payloadStart + payloadLength > bytes.length) {
    throw new Error("Fixture capsule payload is truncated.");
  }
  const metadata = asRecord(
    JSON.parse(new TextDecoder().decode(bytes.subarray(metadataStart, payloadStart))),
  );
  const descriptors = asArray(metadata.sections).map((value) =>
    asDescriptor(value),
  );
  const sections = new Map<string, unknown>();
  for (const descriptor of descriptors) {
    const section = bytes.subarray(
      payloadStart + descriptor.offset,
      payloadStart + descriptor.offset + descriptor.length,
    );
    sections.set(
      descriptor.name,
      descriptor.encoding === "utf-8"
        ? new TextDecoder().decode(section)
        : JSON.parse(new TextDecoder().decode(section)),
    );
  }

  mutate({ metadata, sections });

  let offset = 0;
  const sectionBytes: Uint8Array[] = [];
  const rebuiltDescriptors = descriptors.map((descriptor) => {
    const value = sections.get(descriptor.name);
    if (value === undefined) {
      throw new Error(`Fixture mutation removed section ${descriptor.name}.`);
    }
    const encoded =
      descriptor.encoding === "utf-8"
        ? new TextEncoder().encode(String(value))
        : canonicalJsonBytes(value);
    sectionBytes.push(encoded);
    const rebuilt = {
      ...descriptor,
      offset,
      length: encoded.length,
      sha256: digestId(encoded),
    };
    offset += encoded.length;
    return rebuilt;
  });
  metadata.sections = rebuiltDescriptors;

  const metadataBytes = canonicalJsonBytes(metadata);
  const payload = concat(sectionBytes);
  const header = new Uint8Array(HEADER_SIZE);
  header.set(bytes.subarray(0, DIGEST_OFFSET), 0);
  const outputView = new DataView(header.buffer);
  outputView.setUint32(16, metadataBytes.length, false);
  outputView.setUint32(20, payload.length, false);
  outputView.setUint32(24, 0, false);
  const digest = rawDigest(
    concat([DOMAIN, header.subarray(0, DIGEST_OFFSET), metadataBytes, payload]),
  );
  if (digest.length !== DIGEST_SIZE) throw new Error("Unexpected SHA-256 size.");
  header.set(digest, DIGEST_OFFSET);
  return concat([header, metadataBytes, payload]);
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a record in capsule test fixture.");
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array in capsule test fixture.");
  }
  return value;
}

function asDescriptor(value: unknown): SectionDescriptor {
  const descriptor = asRecord(value);
  if (
    typeof descriptor.name !== "string" ||
    typeof descriptor.encoding !== "string" ||
    typeof descriptor.offset !== "number" ||
    typeof descriptor.length !== "number" ||
    typeof descriptor.sha256 !== "string"
  ) {
    throw new Error("Invalid section descriptor in capsule test fixture.");
  }
  return descriptor as SectionDescriptor;
}

function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(normalize(value)));
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalize((value as Record<string, unknown>)[key])]),
  );
}

function digestId(value: Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function rawDigest(value: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(value).digest());
}

function concat(values: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((total, value) => total + value.length, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}
