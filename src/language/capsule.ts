import { capabilityManifestFromIR, type CapabilityManifest } from "./capability-manifest.js";
import {
  canonicalJson,
  canonicalJsonBytes,
  parseCanonicalJson,
} from "./canonical-json.js";
import { compileSource } from "./compiler.js";
import { hasErrors } from "./diagnostics.js";
import { formatSource } from "./formatter.js";
import type { IRProgram } from "./ir.js";
import { validateIRProgram, type IRValidationIssue } from "./ir-validator.js";
import { fromWireIR, semanticWireIR, toWireIR } from "./ir-wire.js";
import {
  CAPSULE_SCHEMA,
  IR_VERSION,
  KERNEL_ABI,
  LANGUAGE_VERSION,
  RUNTIME_ABI,
} from "./metadata.js";

const MAGIC = new Uint8Array([0x41, 0x58, 0x43, 0x00, 0x0d, 0x0a, 0x1a, 0x0a]);
const DOMAIN = new TextEncoder().encode("Axirune Capsule v1\0");
const HEADER_SIZE = 60;
const DIGEST_OFFSET = 28;
const DIGEST_SIZE = 32;
const CAPSULE_MAJOR = 1;
const CAPSULE_MINOR = 0;
const MAX_METADATA_BYTES = 262_144;
const MAX_PAYLOAD_BYTES = 16_777_216;
const MAX_SIGNATURE_BYTES = 8_192;
const KNOWN_CRITICAL_SECTIONS = new Set(["ir", "authority"]);

export interface CapsuleIssue {
  code: string;
  message: string;
  path?: string;
}

export interface CapsuleBuild {
  bytes: Uint8Array;
  contentId: string;
  semanticDigest: string;
}

export interface CreateCapsuleOptions {
  source: string;
  /** A display hint only; it is excluded from reproducible artifact identity. */
  sourceName?: string;
}

export interface CreateCapsuleFromIROptions {
  /** Untrusted IR is structurally and semantically verified before packaging. */
  ir: unknown;
  /** Optional human/LLM projection; omit it for direct artifact generation. */
  source?: string;
}

export interface CapsuleHeader {
  major: number;
  minor: number;
  flags: number;
  metadataLength: number;
  payloadLength: number;
  signatureLength: number;
}

export interface CapsuleSection {
  name: string;
  encoding: string;
  offset: number;
  length: number;
  sha256: string;
}

export interface CapsuleMetadata {
  schema: typeof CAPSULE_SCHEMA;
  producer: { name: "Axirune"; version: string };
  target: {
    ir: typeof IR_VERSION;
    runtimeAbi: typeof RUNTIME_ABI;
    kernelAbi: typeof KERNEL_ABI;
    edition: number;
  };
  program: {
    space: string;
    entry: { kind: "root" } | { kind: "frame"; frame: string };
  };
  identity: { semanticSha256: string };
  provenance: {
    generation: "source-compile" | "direct-ir";
    sourceEmbedded: boolean;
  };
  sections: CapsuleSection[];
  critical: string[];
}

export interface CapsuleInspection {
  contentId: string;
  semanticDigest: string;
  header: CapsuleHeader;
  metadata: CapsuleMetadata;
  manifest: CapabilityManifest;
  ir: IRProgram;
  source: string | null;
}

export type CapsuleVerification =
  | ({ ok: true; issues: [] } & CapsuleInspection)
  | { ok: false; issues: CapsuleIssue[] };

export class CapsuleError extends Error {
  readonly name = "CapsuleError";

  constructor(
    readonly code: string,
    message: string,
    readonly issues: CapsuleIssue[] = [{ code, message }],
  ) {
    super(message);
  }
}

export async function createCapsule(
  options: CreateCapsuleOptions,
): Promise<CapsuleBuild> {
  const initial = compileSource(options.source);
  const formatted = formatSource(options.source);
  const diagnostics = [...initial.diagnostics, ...formatted.diagnostics];
  if (!initial.ok || hasErrors(diagnostics)) {
    throw new CapsuleError(
      "E_CAPSULE_COMPILE",
      `Cannot create a capsule from invalid source (${diagnostics.filter((item) => item.severity === "error").length} errors).`,
    );
  }
  const canonicalSource = formatted.code;
  const canonical = compileSource(canonicalSource);
  if (!canonical.ok || hasErrors(canonical.diagnostics)) {
    throw new CapsuleError(
      "E_CAPSULE_TOOLCHAIN",
      "Canonical source did not compile; the toolchain violated its own invariant.",
    );
  }
  const initialSemantic = await digestJson(semanticWireIR(initial.ir));
  const semanticDigest = await digestJson(semanticWireIR(canonical.ir));
  if (initialSemantic !== semanticDigest) {
    throw new CapsuleError(
      "E_CAPSULE_TOOLCHAIN",
      "Canonical formatting changed program semantics.",
    );
  }

  return packageCapsule(canonical.ir, canonicalSource, "source-compile");
}

export async function createCapsuleFromIR(
  options: CreateCapsuleFromIROptions,
): Promise<CapsuleBuild> {
  const checked = validateIRProgram(options.ir);
  if (!checked.ok) throw validationError(checked.issues);
  let source: string | null = null;
  if (options.source !== undefined) {
    const formatted = formatSource(options.source);
    const compiled = compileSource(formatted.code);
    if (!compiled.ok || hasErrors([...formatted.diagnostics, ...compiled.diagnostics])) {
      throw new CapsuleError(
        "E_CAPSULE_SOURCE_MISMATCH",
        "The supplied source projection does not compile.",
      );
    }
    const expected = await digestJson(semanticWireIR(checked.ir));
    const actual = await digestJson(semanticWireIR(compiled.ir));
    if (expected !== actual) {
      throw new CapsuleError(
        "E_CAPSULE_SOURCE_MISMATCH",
        "The supplied source projection does not describe the checked IR.",
      );
    }
    source = formatted.code;
  }
  return packageCapsule(checked.ir, source, "direct-ir");
}

async function packageCapsule(
  ir: IRProgram,
  source: string | null,
  generation: CapsuleMetadata["provenance"]["generation"],
): Promise<CapsuleBuild> {
  const semanticDigest = await digestJson(semanticWireIR(ir));
  const manifest = capabilityManifestFromIR(ir);
  const irBytes = canonicalJsonBytes(toWireIR(ir));
  const authorityBytes = canonicalJsonBytes(manifest);
  const sectionInputs: { name: string; encoding: string; bytes: Uint8Array }[] = [
    { name: "ir", encoding: "axirune-wire-ir+json", bytes: irBytes },
    { name: "authority", encoding: "axirune-manifest+json", bytes: authorityBytes },
  ];
  if (source !== null) {
    sectionInputs.push({
      name: "source",
      encoding: "utf-8",
      bytes: new TextEncoder().encode(source),
    });
  }
  let offset = 0;
  const sections: CapsuleSection[] = [];
  for (const section of sectionInputs) {
    sections.push({
      name: section.name,
      encoding: section.encoding,
      offset,
      length: section.bytes.length,
      sha256: await digestBytes(section.bytes),
    });
    offset += section.bytes.length;
  }
  const payload = concatBytes(sectionInputs.map((section) => section.bytes));
  const metadata: CapsuleMetadata = {
    schema: CAPSULE_SCHEMA,
    producer: { name: "Axirune", version: LANGUAGE_VERSION },
    target: {
      ir: IR_VERSION,
      runtimeAbi: RUNTIME_ABI,
      kernelAbi: KERNEL_ABI,
      edition: ir.edition,
    },
    program: {
      space: ir.space,
      entry: capsuleEntry(ir),
    },
    identity: { semanticSha256: semanticDigest },
    provenance: { generation, sourceEmbedded: source !== null },
    sections,
    critical: ["authority", "ir"],
  };
  const metadataBytes = canonicalJsonBytes(metadata);
  enforceBuildLimits(metadataBytes.length, payload.length);

  const header = new Uint8Array(HEADER_SIZE);
  header.set(MAGIC, 0);
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  view.setUint16(8, CAPSULE_MAJOR, false);
  view.setUint16(10, CAPSULE_MINOR, false);
  view.setUint32(12, 0, false);
  view.setUint32(16, metadataBytes.length, false);
  view.setUint32(20, payload.length, false);
  view.setUint32(24, 0, false);
  const digest = await sha256Raw(
    concatBytes([DOMAIN, header.slice(0, DIGEST_OFFSET), metadataBytes, payload]),
  );
  header.set(digest, DIGEST_OFFSET);
  const bytes = concatBytes([header, metadataBytes, payload]);
  return {
    bytes,
    contentId: `sha256:${hex(digest)}`,
    semanticDigest,
  };
}

export async function verifyCapsule(bytes: Uint8Array): Promise<CapsuleVerification> {
  try {
    const inspection = await decodeAndVerify(bytes);
    return { ok: true, issues: [], ...inspection };
  } catch (error) {
    if (error instanceof CapsuleError) {
      return { ok: false, issues: error.issues };
    }
    return {
      ok: false,
      issues: [
        {
          code: "E_CAPSULE_INVALID",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

export async function inspectCapsule(bytes: Uint8Array): Promise<CapsuleInspection> {
  return decodeAndVerify(bytes);
}

export async function decompileCapsule(bytes: Uint8Array): Promise<string> {
  const inspected = await decodeAndVerify(bytes);
  if (inspected.source === null) {
    throw new CapsuleError(
      "E_CAPSULE_SOURCE_MISSING",
      "This execution capsule does not contain a source projection.",
    );
  }
  return inspected.source;
}

async function decodeAndVerify(bytes: Uint8Array): Promise<CapsuleInspection> {
  if (!(bytes instanceof Uint8Array)) {
    throw new CapsuleError("E_CAPSULE_TYPE", "Capsule input must be Uint8Array bytes.");
  }
  if (bytes.length < HEADER_SIZE) {
    throw new CapsuleError("E_CAPSULE_TRUNCATED", "Capsule header is truncated.");
  }
  if (!equalBytes(bytes.subarray(0, MAGIC.length), MAGIC)) {
    throw new CapsuleError("E_CAPSULE_MAGIC", "Capsule magic bytes do not match AXC v1.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  const header: CapsuleHeader = {
    major: view.getUint16(8, false),
    minor: view.getUint16(10, false),
    flags: view.getUint32(12, false),
    metadataLength: view.getUint32(16, false),
    payloadLength: view.getUint32(20, false),
    signatureLength: view.getUint32(24, false),
  };
  if (header.major !== CAPSULE_MAJOR || header.minor !== CAPSULE_MINOR) {
    throw new CapsuleError(
      "E_CAPSULE_VERSION",
      `Unsupported capsule version ${header.major}.${header.minor}.`,
    );
  }
  if (header.flags !== 0) {
    throw new CapsuleError("E_CAPSULE_FLAGS", "Capsule uses unsupported critical flags.");
  }
  if (
    header.metadataLength > MAX_METADATA_BYTES ||
    header.payloadLength > MAX_PAYLOAD_BYTES ||
    header.signatureLength > MAX_SIGNATURE_BYTES
  ) {
    throw new CapsuleError("E_CAPSULE_LIMIT", "Capsule exceeds a verifier size limit.");
  }
  if (header.signatureLength !== 0) {
    throw new CapsuleError(
      "E_CAPSULE_SIGNATURE_UNSUPPORTED",
      "Capsule v1 signatures require an external trust-store implementation.",
    );
  }
  const expectedLength =
    HEADER_SIZE +
    header.metadataLength +
    header.payloadLength +
    header.signatureLength;
  if (bytes.length < expectedLength) {
    throw new CapsuleError("E_CAPSULE_TRUNCATED", "Capsule payload is truncated.");
  }
  if (bytes.length > expectedLength) {
    throw new CapsuleError(
      "E_CAPSULE_TRAILING_DATA",
      "Capsule contains unframed trailing bytes.",
    );
  }
  const metadataStart = HEADER_SIZE;
  const payloadStart = metadataStart + header.metadataLength;
  const metadataBytes = bytes.subarray(metadataStart, payloadStart);
  const payload = bytes.subarray(payloadStart, payloadStart + header.payloadLength);
  const expectedDigest = bytes.subarray(DIGEST_OFFSET, DIGEST_OFFSET + DIGEST_SIZE);
  const actualDigest = await sha256Raw(
    concatBytes([
      DOMAIN,
      bytes.slice(0, DIGEST_OFFSET),
      metadataBytes,
      payload,
    ]),
  );
  if (!equalBytes(expectedDigest, actualDigest)) {
    throw new CapsuleError(
      "E_CAPSULE_DIGEST",
      "Capsule content digest does not match its framed content.",
    );
  }

  let parsedMetadata: unknown;
  try {
    parsedMetadata = parseCanonicalJson(metadataBytes, "capsule metadata");
  } catch (error) {
    throw new CapsuleError(
      "E_CAPSULE_METADATA",
      error instanceof Error ? error.message : String(error),
    );
  }
  const metadata = validateMetadata(parsedMetadata, header.payloadLength);
  const sectionBytes = new Map<string, Uint8Array>();
  for (const section of metadata.sections) {
    const value = payload.subarray(section.offset, section.offset + section.length);
    if ((await digestBytes(value)) !== section.sha256) {
      throw new CapsuleError(
        "E_CAPSULE_SECTION_DIGEST",
        `Section ${section.name} failed its digest check.`,
      );
    }
    sectionBytes.set(section.name, value);
  }

  const irSection = requiredSection(sectionBytes, "ir");
  let wire: unknown;
  let decodedIR: unknown;
  try {
    wire = parseCanonicalJson(irSection, "IR section");
    decodedIR = fromWireIR(wire);
  } catch (error) {
    const candidate = error as { code?: unknown; message?: unknown };
    throw new CapsuleError(
      typeof candidate.code === "string" ? candidate.code : "E_CAPSULE_IR_SCHEMA",
      typeof candidate.message === "string" ? candidate.message : String(error),
    );
  }
  const checked = validateIRProgram(decodedIR);
  if (!checked.ok) throw validationError(checked.issues);
  const ir = checked.ir;
  if (
    metadata.target.ir !== ir.version ||
    metadata.target.edition !== ir.edition ||
    metadata.program.space !== ir.space
  ) {
    throw new CapsuleError(
      "E_CAPSULE_TARGET_MISMATCH",
      "Capsule metadata target does not match checked IR.",
    );
  }
  const entry = metadata.program.entry;
  if (
    (entry.kind === "root" && ir.entry.length === 0) ||
    (entry.kind === "frame" &&
      !ir.frames.some(
        (frame) =>
          frame.id === entry.frame ||
          frame.qualifiedName === entry.frame,
      ))
  ) {
    throw new CapsuleError(
      "E_CAPSULE_ENTRY",
      "Capsule entry descriptor does not resolve in checked IR.",
    );
  }

  const semanticDigest = await digestJson(semanticWireIR(ir));
  if (semanticDigest !== metadata.identity.semanticSha256) {
    throw new CapsuleError(
      "E_CAPSULE_SEMANTIC_DIGEST",
      "Checked IR does not match its semantic identity.",
    );
  }
  const authoritySection = requiredSection(sectionBytes, "authority");
  let embeddedManifest: unknown;
  try {
    embeddedManifest = parseCanonicalJson(authoritySection, "authority section");
  } catch (error) {
    throw new CapsuleError(
      "E_CAPSULE_MANIFEST_MISMATCH",
      error instanceof Error ? error.message : String(error),
    );
  }
  const manifest = capabilityManifestFromIR(ir);
  if (canonicalJson(embeddedManifest) !== canonicalJson(manifest)) {
    throw new CapsuleError(
      "E_CAPSULE_MANIFEST_MISMATCH",
      "Authority manifest does not match the capabilities derived from checked IR.",
    );
  }

  const sourceSection = sectionBytes.get("source");
  const source = sourceSection ? decodeSource(sourceSection) : null;
  if (source !== null) {
    const rebuilt = compileSource(source);
    if (!rebuilt.ok || hasErrors(rebuilt.diagnostics)) {
      throw new CapsuleError(
        "E_CAPSULE_SOURCE_MISMATCH",
        "Embedded source projection does not compile.",
      );
    }
    if ((await digestJson(semanticWireIR(rebuilt.ir))) !== semanticDigest) {
      throw new CapsuleError(
        "E_CAPSULE_SOURCE_MISMATCH",
        "Embedded source projection does not describe the checked IR.",
      );
    }
  }
  return {
    contentId: `sha256:${hex(actualDigest)}`,
    semanticDigest,
    header,
    metadata,
    manifest,
    ir,
    source,
  };
}

function validateMetadata(value: unknown, payloadLength: number): CapsuleMetadata {
  const metadata = object(value, "metadata");
  if (metadata.schema !== CAPSULE_SCHEMA) {
    throw new CapsuleError(
      "E_CAPSULE_SCHEMA",
      `Unsupported capsule schema ${String(metadata.schema)}.`,
    );
  }
  const producer = object(metadata.producer, "metadata.producer");
  if (producer.name !== "Axirune" || typeof producer.version !== "string") {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid capsule producer metadata.");
  }
  const target = object(metadata.target, "metadata.target");
  if (target.ir !== IR_VERSION) {
    throw new CapsuleError(
      "E_CAPSULE_IR_VERSION",
      `Capsule targets unsupported IR ${String(target.ir)}.`,
    );
  }
  if (target.runtimeAbi !== RUNTIME_ABI || target.kernelAbi !== KERNEL_ABI) {
    throw new CapsuleError(
      "E_CAPSULE_ABI",
      `Capsule requires ${String(target.runtimeAbi)} and ${String(target.kernelAbi)}.`,
    );
  }
  if (!Number.isSafeInteger(target.edition)) {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid target edition.");
  }
  const program = object(metadata.program, "metadata.program");
  if (typeof program.space !== "string") {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid program space.");
  }
  const entry = object(program.entry, "metadata.program.entry");
  if (
    entry.kind !== "root" &&
    !(entry.kind === "frame" && typeof entry.frame === "string")
  ) {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid program entry descriptor.");
  }
  const identity = object(metadata.identity, "metadata.identity");
  if (!isDigest(identity.semanticSha256)) {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid semantic digest.");
  }
  const provenance = object(metadata.provenance, "metadata.provenance");
  if (
    (provenance.generation !== "source-compile" && provenance.generation !== "direct-ir") ||
    typeof provenance.sourceEmbedded !== "boolean"
  ) {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid provenance claim.");
  }
  if (!Array.isArray(metadata.critical) || metadata.critical.some((item) => typeof item !== "string")) {
    throw new CapsuleError("E_CAPSULE_METADATA", "Invalid critical section list.");
  }
  for (const name of metadata.critical as string[]) {
    if (!KNOWN_CRITICAL_SECTIONS.has(name)) {
      throw new CapsuleError(
        "E_CAPSULE_CRITICAL_SECTION",
        `Unknown critical section ${name}.`,
      );
    }
  }
  if (!Array.isArray(metadata.sections)) {
    throw new CapsuleError("E_CAPSULE_METADATA", "Capsule sections must be an array.");
  }
  const names = new Set<string>();
  const sections: CapsuleSection[] = [];
  let nextOffset = 0;
  for (const [index, raw] of metadata.sections.entries()) {
    const section = object(raw, `metadata.sections[${index}]`);
    if (
      typeof section.name !== "string" ||
      typeof section.encoding !== "string" ||
      !Number.isSafeInteger(section.offset) ||
      !Number.isSafeInteger(section.length) ||
      (section.offset as number) !== nextOffset ||
      (section.length as number) < 0 ||
      !isDigest(section.sha256)
    ) {
      throw new CapsuleError(
        "E_CAPSULE_METADATA",
        `Invalid or non-contiguous section descriptor at index ${index}.`,
      );
    }
    if (names.has(section.name)) {
      throw new CapsuleError(
        "E_CAPSULE_METADATA",
        `Duplicate capsule section ${section.name}.`,
      );
    }
    names.add(section.name);
    const descriptor: CapsuleSection = {
      name: section.name,
      encoding: section.encoding,
      offset: section.offset as number,
      length: section.length as number,
      sha256: section.sha256 as string,
    };
    sections.push(descriptor);
    nextOffset += descriptor.length;
  }
  if (nextOffset !== payloadLength) {
    throw new CapsuleError(
      "E_CAPSULE_METADATA",
      "Section descriptors do not cover the entire payload.",
    );
  }
  for (const required of ["ir", "authority"]) {
    if (!names.has(required)) {
      throw new CapsuleError("E_CAPSULE_METADATA", `Missing required section ${required}.`);
    }
  }
  if (provenance.sourceEmbedded !== names.has("source")) {
    throw new CapsuleError(
      "E_CAPSULE_METADATA",
      "Provenance sourceEmbedded claim does not match capsule sections.",
    );
  }
  return {
    schema: CAPSULE_SCHEMA,
    producer: { name: "Axirune", version: producer.version },
    target: {
      ir: IR_VERSION,
      runtimeAbi: RUNTIME_ABI,
      kernelAbi: KERNEL_ABI,
      edition: target.edition as number,
    },
    program: {
      space: program.space,
      entry:
        entry.kind === "root"
          ? { kind: "root" }
          : { kind: "frame", frame: entry.frame as string },
    },
    identity: { semanticSha256: identity.semanticSha256 as string },
    provenance: {
      generation: provenance.generation as "source-compile" | "direct-ir",
      sourceEmbedded: provenance.sourceEmbedded,
    },
    sections,
    critical: [...(metadata.critical as string[])],
  };
}

function capsuleEntry(ir: IRProgram): CapsuleMetadata["program"]["entry"] {
  if (ir.entry.length > 0) return { kind: "root" };
  const main =
    ir.frames.find((frame) => frame.qualifiedName === "main") ??
    ir.frames.find(
      (frame) =>
        frame.parentId === null && ["workflow", "task", "agent"].includes(frame.kind),
    );
  if (!main) {
    throw new CapsuleError(
      "E_CAPSULE_ENTRY",
      "Capsules require a root entry or an unambiguous runnable frame.",
    );
  }
  return { kind: "frame", frame: main.qualifiedName };
}

function decodeSource(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CapsuleError("E_CAPSULE_SOURCE_MISMATCH", "Source section is not UTF-8.");
  }
}

function requiredSection(
  sections: ReadonlyMap<string, Uint8Array>,
  name: string,
): Uint8Array {
  const section = sections.get(name);
  if (!section) throw new CapsuleError("E_CAPSULE_METADATA", `Missing section ${name}.`);
  return section;
}

function validationError(issues: IRValidationIssue[]): CapsuleError {
  return new CapsuleError(
    issues[0]?.code ?? "E_CAPSULE_IR_SCHEMA",
    issues[0]?.message ?? "Checked IR validation failed.",
    issues,
  );
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CapsuleError("E_CAPSULE_METADATA", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function enforceBuildLimits(metadataLength: number, payloadLength: number): void {
  if (metadataLength > MAX_METADATA_BYTES || payloadLength > MAX_PAYLOAD_BYTES) {
    throw new CapsuleError("E_CAPSULE_LIMIT", "Generated capsule exceeds v1 size limits.");
  }
}

async function digestJson(value: unknown): Promise<string> {
  return digestBytes(canonicalJsonBytes(value));
}

async function digestBytes(value: Uint8Array): Promise<string> {
  return `sha256:${hex(await sha256Raw(value))}`;
}

async function sha256Raw(value: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", value.slice().buffer);
  return new Uint8Array(digest);
}

function concatBytes(values: readonly Uint8Array[]): Uint8Array {
  const length = values.reduce((total, value) => total + value.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function hex(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
