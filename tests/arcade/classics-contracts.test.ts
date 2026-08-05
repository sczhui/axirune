import { describe, expect, it } from "vitest";
import {
  ARCADE_CLASSIC_GAME_IDS,
  ARCADE_CLASSICS_CATALOG,
  getArcadeClassicGame,
} from "../../src/arcade/classics/catalog.js";
import {
  ArcadeContractError,
  ArcadeRuntimeRegistry,
  advanceArcadeSeed,
  createArcadeSeed,
  createArcadeSessionState,
  createArcadeSnapshot,
  createNeutralArcadeInput,
  restoreArcadeSnapshot,
  serializeArcadeSnapshot,
  verifyArcadeInputFrame,
  verifyArcadeSessionState,
  verifyArcadeSnapshot,
  type ArcadeEngineAdapter,
  type ArcadeJsonObject,
  type ArcadeRuleEvidence,
} from "../../src/arcade/classics/contracts.js";

const RULE_EVIDENCE: ArcadeRuleEvidence = {
  contractSchema: "axirune-arcade/vector-siege/1",
  contentId: `sha256:${"a".repeat(64)}`,
  semanticDigest: `sha256:${"b".repeat(64)}`,
};

describe("Axirune Classics runtime contracts", () => {
  it("creates a family-correct neutral input frame for all 20 games", () => {
    for (const gameId of ARCADE_CLASSIC_GAME_IDS) {
      const game = getArcadeClassicGame(gameId);
      const input = createNeutralArcadeInput(gameId, 12, 8);
      const verified = verifyArcadeInputFrame(input);

      expect(verified.ok).toBe(true);
      expect(input.schema).toBe(game.inputSchema);
      expect(input.engineFamily).toBe(game.engineFamily);
      expect(input.tick).toBe(12);
      expect(input.sequence).toBe(8);
    }

    const shooterInput = createNeutralArcadeInput("vector-siege");
    expect(shooterInput.controls.primary).toBe(false);
    expect(shooterInput.controls.moveX).toBe(0);
    // @ts-expect-error projectile-field controls intentionally have no launch key.
    expect(shooterInput.controls.launch).toBeUndefined();
  });

  it("rejects family mismatches, unknown controls, and invalid axis samples", () => {
    const invalid = structuredClone(createNeutralArcadeInput("vector-siege")) as unknown as {
      engineFamily: string;
      controls: Record<string, unknown>;
    };
    invalid.engineFamily = "grid-field";
    invalid.controls.moveX = Number.NaN;
    invalid.controls.cheat = true;

    const verified = verifyArcadeInputFrame(invalid);
    expect(verified.ok).toBe(false);
    if (verified.ok) throw new Error("Expected an invalid input frame.");
    expect(verified.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["E_INPUT_FAMILY", "E_CONTROL_AXIS", "E_CONTROL_UNKNOWN"]),
    );
  });

  it("advances a non-zero 32-bit seed reproducibly without mutating it", () => {
    const original = createArcadeSeed(42);
    const firstSequence: number[] = [];
    const secondSequence: number[] = [];
    let first = original;
    let second = createArcadeSeed(42);

    for (let index = 0; index < 8; index += 1) {
      const firstResult = advanceArcadeSeed(first);
      const secondResult = advanceArcadeSeed(second);
      first = firstResult.seed;
      second = secondResult.seed;
      firstSequence.push(firstResult.value);
      secondSequence.push(secondResult.value);
    }

    expect(firstSequence).toEqual(secondSequence);
    expect(new Set(firstSequence).size).toBeGreaterThan(1);
    expect(firstSequence.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(original.current).toBe(42);
    expect(createArcadeSeed(0).current).not.toBe(0);
    expect(() => createArcadeSeed(Number.POSITIVE_INFINITY)).toThrow(ArcadeContractError);
  });

  it("validates finite, bounded, JSON-only session payloads", () => {
    const state = createArcadeSessionState({
      gameId: "vector-siege",
      seed: 7,
      status: "running",
      payload: {
        player: { x: 120, y: 480 },
        enemies: [{ id: 1, health: 2 }],
      },
    });
    expect(verifyArcadeSessionState(state)).toMatchObject({ ok: true, issues: [] });

    const nonFinite = structuredClone(state) as unknown as {
      payload: { player: { x: number } };
    };
    nonFinite.payload.player.x = Number.NaN;
    const invalidNumber = verifyArcadeSessionState(nonFinite);
    expect(invalidNumber.ok).toBe(false);
    if (!invalidNumber.ok) {
      expect(invalidNumber.issues).toContainEqual(
        expect.objectContaining({ code: "E_PAYLOAD_NUMBER" }),
      );
    }

    const nonJson = structuredClone(state) as unknown as { payload: Record<string, unknown> };
    nonJson.payload.callback = () => undefined;
    const invalidValue = verifyArcadeSessionState(nonJson);
    expect(invalidValue.ok).toBe(false);
    if (!invalidValue.ok) {
      expect(invalidValue.issues).toContainEqual(
        expect.objectContaining({ code: "E_PAYLOAD_VALUE" }),
      );
    }
  });

  it("round-trips a canonical snapshot bound to engine and verified rule evidence", () => {
    const state = createArcadeSessionState({
      gameId: "vector-siege",
      seed: 21,
      status: "running",
      score: 1_200,
      stage: 3,
      payload: {
        player: { x: 160, health: 3 },
        wave: 3,
        entities: [
          { id: 2, kind: "scout", x: 44, y: 80 },
          { id: 3, kind: "striker", x: 91, y: 120 },
        ],
      },
    });
    const snapshot = createArcadeSnapshot(state, RULE_EVIDENCE);
    const first = serializeArcadeSnapshot(snapshot);
    const second = serializeArcadeSnapshot(snapshot);
    const restored = restoreArcadeSnapshot(first);

    expect(first).toBe(second);
    expect(first.startsWith('{"catalogSchema"')).toBe(true);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(serializeArcadeSnapshot(restored.value)).toBe(first);
      expect(restored.value.state.seed.initial).toBe(21);
      expect(restored.value.rules.semanticDigest).toBe(RULE_EVIDENCE.semanticDigest);
    }
  });

  it("fails closed when snapshot bindings, digests, or state payloads are forged", () => {
    const state = createArcadeSessionState({
      gameId: "vector-siege",
      seed: 5,
      payload: { player: { x: 10 } },
    });
    const snapshot = structuredClone(createArcadeSnapshot(state, RULE_EVIDENCE)) as unknown as {
      engineFamily: string;
      engineVersion: string;
      fixedStepHz: number;
      rules: { semanticDigest: string };
      state: { payload: { player: { x: number } } };
    };
    snapshot.engineFamily = "grid-field";
    snapshot.engineVersion = "projectile-field/999";
    snapshot.fixedStepHz = 20;
    snapshot.rules.semanticDigest = "sha256:not-a-digest";
    snapshot.state.payload.player.x = Number.POSITIVE_INFINITY;

    const verified = verifyArcadeSnapshot(snapshot);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          "E_SNAPSHOT_FAMILY",
          "E_ENGINE_VERSION",
          "E_FIXED_STEP",
          "E_DIGEST",
          "E_PAYLOAD_NUMBER",
        ]),
      );
    }
    expect(restoreArcadeSnapshot("not json")).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "E_SNAPSHOT_JSON" })],
    });
  });

  it("registers adapters only when game, family, and engine version agree", () => {
    const registry = new ArcadeRuntimeRegistry();
    const game = getArcadeClassicGame("vector-siege");
    const adapter: ArcadeEngineAdapter<"vector-siege"> = {
      gameId: "vector-siege",
      engineFamily: "projectile-field",
      engineVersion: game.engineVersion,
      create(seed) {
        return createArcadeSessionState({
          gameId: "vector-siege",
          seed: seed.initial,
          payload: {},
        });
      },
      step(state) {
        return state;
      },
    };

    registry.register(adapter);
    expect(registry.has("vector-siege")).toBe(true);
    expect(registry.get("vector-siege")).toBe(adapter);
    expect(registry.list()).toEqual(["vector-siege"]);
    expect(() => registry.register(adapter)).toThrow(ArcadeContractError);

    const wrongFamily = {
      ...adapter,
      gameId: "prism-bastion",
      engineFamily: "projectile-field",
      engineVersion: getArcadeClassicGame("prism-bastion").engineVersion,
    } as unknown as ArcadeEngineAdapter<"prism-bastion">;
    expect(() => new ArcadeRuntimeRegistry().register(wrongFamily)).toThrow(
      /must use ricochet-field/u,
    );
  });

  it("keeps all shared definitions JSON-safe for future catalog delivery", () => {
    const serialized = JSON.stringify(ARCADE_CLASSICS_CATALOG);
    expect(JSON.parse(serialized)).toHaveLength(20);
    expect(serialized).not.toContain("undefined");
  });
});

// Compile-time fixture: arbitrary engine payloads remain JSON records.
const _payloadFixture: ArcadeJsonObject = { entities: [{ id: 1 }] };
void _payloadFixture;
