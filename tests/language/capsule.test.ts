import { describe, expect, it } from "vitest";
import {
  createCapsule,
  createCapsuleFromIR,
  decompileCapsule,
  inspectCapsule,
  verifyCapsule,
} from "../../src/language/capsule.js";
import { compileSource } from "../../src/language/compiler.js";
import {
  asArray,
  asRecord,
  repackCapsuleForTest,
} from "../support/capsule-fixture.js";

const SOURCE = `space capsule_acceptance

edition 2

task greet
  take name Text
  give Text
  yield [call Text.join :parts [list «Hello, » name «!»]]
/task

task main
  give Text
  let message = [call greet :name «Axirune»]
  emit message
  yield message
/task

launch main
`;

const EQUIVALENT_UNFORMATTED_SOURCE = `space capsule_acceptance
edition 2
task greet
 take name Text
 give Text
 yield [call Text.join :parts [list «Hello, » name «!»]]
/task
task main
 give Text
 let message [call greet :name «Axirune»]
 emit message
 yield message
/task
launch main`;

const AUTHORITY_SOURCE = `space capsule_authority

edition 2

task main
  give Text
  yield [call File.readText :path «input.txt»]
/task

launch main
`;

describe("Axirune execution capsules", () => {
  it("creates, verifies, inspects, and decompiles a deterministic capsule", async () => {
    const first = await createCapsule({
      source: SOURCE,
      sourceName: "capsule-acceptance.axi",
    });
    const second = await createCapsule({
      source: SOURCE,
      sourceName: "capsule-acceptance.axi",
    });

    expect(first.bytes).toEqual(second.bytes);
    expect(first.contentId).toBe(second.contentId);
    expect(first.semanticDigest).toBe(second.semanticDigest);
    expect(first.contentId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.semanticDigest).toMatch(/^sha256:[a-f0-9]{64}$/u);

    const verified = await verifyCapsule(first.bytes);
    expect(verified).toMatchObject({
      ok: true,
      issues: [],
      contentId: first.contentId,
      semanticDigest: first.semanticDigest,
      manifest: {
        schema: "axirune-capability-manifest/1",
        space: "capsule_acceptance",
        capabilities: [],
        tools: [],
        sandboxes: [],
        permissions: [],
      },
      ir: { space: "capsule_acceptance", edition: 2 },
    });

    const inspected = await inspectCapsule(first.bytes);
    expect(inspected).toMatchObject({
      contentId: first.contentId,
      semanticDigest: first.semanticDigest,
      manifest: verified.manifest,
      ir: { space: "capsule_acceptance", edition: 2 },
    });
    expect(await decompileCapsule(first.bytes)).toBe(SOURCE);
  });

  it("canonicalizes equivalent source into the same reproducible capsule", async () => {
    const canonical = await createCapsule({ source: SOURCE });
    const unformatted = await createCapsule({
      source: EQUIVALENT_UNFORMATTED_SOURCE,
    });

    expect(unformatted.bytes).toEqual(canonical.bytes);
    expect(unformatted.contentId).toBe(canonical.contentId);
    expect(unformatted.semanticDigest).toBe(canonical.semanticDigest);
    expect(await decompileCapsule(unformatted.bytes)).toBe(SOURCE);
  });

  it("carries the authority manifest derived from checked IR", async () => {
    const capsule = await createCapsule({ source: AUTHORITY_SOURCE });

    const verified = await verifyCapsule(capsule.bytes);

    expect(verified.ok).toBe(true);
    expect(verified.manifest?.capabilities).toContainEqual(
      expect.objectContaining({
        name: "host.fs.read",
        requiredBy: ["main"],
      }),
    );
  });

  it("rejects a corrupted header without throwing from verify", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const corrupted = mutate(capsule.bytes, 0);

    const result = await verifyCapsule(corrupted);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_MAGIC" }),
    );
  });

  it("rejects a corrupted payload without throwing from verify", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const payloadOffset = Math.max(1, Math.floor(capsule.bytes.length * 0.75));
    const corrupted = mutate(capsule.bytes, payloadOffset);

    const result = await verifyCapsule(corrupted);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_DIGEST" }),
    );
  });

  it("rejects a truncated capsule without throwing from verify", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const truncated = capsule.bytes.slice(0, -1);

    const result = await verifyCapsule(truncated);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_TRUNCATED" }),
    );
  });

  it("rejects trailing data without throwing from verify", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const extended = new Uint8Array(capsule.bytes.length + 1);
    extended.set(capsule.bytes);
    extended[extended.length - 1] = 0xa5;

    const result = await verifyCapsule(extended);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_TRAILING_DATA" }),
    );
  });

  it("makes inspect and decompile fail with a stable CapsuleError", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const corrupted = mutate(capsule.bytes, 0);

    await expect(inspectCapsule(corrupted)).rejects.toMatchObject({
      name: "CapsuleError",
      code: "E_CAPSULE_MAGIC",
    });
    await expect(decompileCapsule(corrupted)).rejects.toMatchObject({
      name: "CapsuleError",
      code: "E_CAPSULE_MAGIC",
    });
  });

  it("rejects an integrity-valid authority manifest that does not match its IR", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const forged = repackCapsuleForTest(capsule.bytes, ({ sections }) => {
      const authority = asRecord(sections.get("authority"));
      authority.permissions = ["forged.host.access"];
    });

    const result = await verifyCapsule(forged);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_MANIFEST_MISMATCH" }),
    );
  });

  it("rejects an integrity-valid capsule with an unsupported IR version", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const forged = repackCapsuleForTest(capsule.bytes, ({ sections }) => {
      const wire = asRecord(sections.get("ir"));
      const program = asRecord(wire.program);
      program.version = "axirune-ir/999";
    });

    const result = await verifyCapsule(forged);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_IR_VERSION" }),
    );
  });

  it("rejects an integrity-valid capsule containing an unknown IR operation", async () => {
    const capsule = await createCapsule({ source: SOURCE });
    const forged = repackCapsuleForTest(capsule.bytes, ({ sections }) => {
      const wire = asRecord(sections.get("ir"));
      const program = asRecord(wire.program);
      const frames = asArray(program.frames).map(asRecord);
      const main = frames.find((frame) => frame.name === "main");
      if (!main) throw new Error("Expected main frame in capsule fixture.");
      const instruction = asRecord(asArray(main.instructions)[0]);
      instruction.op = "teleport";
    });

    const result = await verifyCapsule(forged);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "E_CAPSULE_UNKNOWN_OP" }),
    );
  });

  it("packages verified IR directly without requiring or inventing source", async () => {
    const compiled = compileSource(SOURCE);
    expect(compiled.ok).toBe(true);
    const capsule = await createCapsuleFromIR({ ir: compiled.ir });
    const inspected = await inspectCapsule(capsule.bytes);

    expect(inspected.source).toBeNull();
    expect(inspected.metadata.provenance).toEqual({
      generation: "direct-ir",
      sourceEmbedded: false,
    });
    expect(inspected.semanticDigest).toBe(capsule.semanticDigest);
    await expect(decompileCapsule(capsule.bytes)).rejects.toMatchObject({
      name: "CapsuleError",
      code: "E_CAPSULE_SOURCE_MISSING",
    });
  });
});

function mutate(bytes: Uint8Array, offset: number): Uint8Array {
  const copy = bytes.slice();
  copy[offset] = copy[offset]! ^ 0xff;
  return copy;
}
