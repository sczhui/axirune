import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAxiruneRuleModule } from "../../src/arcade/axirune-rule-module.js";
import { createCapsule, verifyCapsule } from "../../src/language/index.js";

const SOURCE_URL = new URL("../../apps/arcade/river-oath.axi", import.meta.url);

function source(): string {
  return readFileSync(SOURCE_URL, "utf8");
}

function asRecord(value: unknown): Record<string, unknown> {
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  expect(typeof value).toBe("object");
  return value as Record<string, unknown>;
}

async function runAt(
  stage: number,
  wave: number,
  defeated: number,
  combo: number,
): Promise<Record<string, unknown>> {
  const module = await createAxiruneRuleModule(source());
  return asRecord((await module.run({ stage, wave, defeated, combo })).value);
}

describe("River Oath Axirune rules", () => {
  it("builds one reproducible, uniquely addressed zero-authority capsule", async () => {
    const content = source();
    const first = await createCapsule({ source: content, sourceName: "river-oath.axi" });
    const second = await createCapsule({ source: content, sourceName: "river-oath.axi" });
    const vector = await createCapsule({
      source: readFileSync(new URL("../../apps/arcade/vector-siege.axi", import.meta.url), "utf8"),
      sourceName: "vector-siege.axi",
    });

    expect(first.bytes).toEqual(second.bytes);
    expect(first.contentId).toBe(second.contentId);
    expect(first.semanticDigest).toBe(second.semanticDigest);
    expect(first.contentId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.contentId).not.toBe(vector.contentId);
    expect(first.bytes.byteLength).toBeGreaterThan(3_000);

    const verified = await verifyCapsule(first.bytes);
    expect(verified.ok).toBe(true);
    if (!verified.ok || !verified.manifest) throw new Error("River Oath capsule did not verify.");

    expect(verified.manifest).toMatchObject({
      schema: "axirune-capability-manifest/1",
      space: "river_oath",
      capabilities: [],
      tools: [],
      permissions: [],
      sandboxes: [],
    });
    expect(content).not.toMatch(
      /^\s*(?:agent|capability|mcp|model|network|permission|prompt|sandbox|tool)\b/mu,
    );
  });

  it("returns the complete opening encounter contract", async () => {
    const opening = await runAt(1, 1, 0, 0);

    expect(opening).toEqual({
      schema: "axirune-arcade/river-oath/1",
      game: "river-oath",
      stage: 1,
      stage_key: "reedwater-causeway",
      wave: 1,
      wave_key: "causeway-vanguard",
      campaign_index: 1,
      defeated: 0,
      enemy_speed: 123,
      enemy_health: 89,
      enemy_damage: 14,
      enemy_guard: 10,
      spawn_interval_ms: 1_235,
      enemy_count: 4,
      boss_active: false,
      boss_phase: "dormant",
      boss_health: 0,
      boss_damage: 0,
      boss_guard: 0,
      reward_score: 365,
      reward_renown: 16,
      drop_kind: "field-tonic",
      drop_count: 1,
      drop_rate_percent: 29,
      difficulty: "gathering",
    });
  });

  it("addresses every stage and wave in the four-by-three campaign exactly once", async () => {
    const module = await createAxiruneRuleModule(source());
    const campaign = [
      {
        stage: "reedwater-causeway",
        waves: ["causeway-vanguard", "lantern-crossfire", "reedwater-warden"],
      },
      {
        stage: "cinder-foundry",
        waves: ["furnace-line", "anvil-rush", "cinder-overseer"],
      },
      {
        stage: "moonwake-harbor",
        waves: ["moonwake-ambush", "tidewall-guard", "harbor-master"],
      },
      {
        stage: "cloudbreak-beacon",
        waves: ["beacon-ring", "skyfire-guard", "cloudbreak-oath"],
      },
    ] as const;
    const addressedWaves = new Set<string>();

    for (const [stageOffset, definition] of campaign.entries()) {
      for (const [waveOffset, waveKey] of definition.waves.entries()) {
        const stage = stageOffset + 1;
        const wave = waveOffset + 1;
        const contract = asRecord(
          (await module.run({ stage, wave, defeated: stageOffset * 5, combo: waveOffset })).value,
        );

        expect(contract).toMatchObject({
          schema: "axirune-arcade/river-oath/1",
          stage,
          stage_key: definition.stage,
          wave,
          wave_key: waveKey,
          campaign_index: stageOffset * 3 + wave,
          boss_active: wave === 3,
        });
        addressedWaves.add(String(contract.wave_key));
      }
    }

    expect(addressedWaves.size).toBe(12);
  });

  it("maps all four stage bosses to their original campaign phases", async () => {
    const reedwater = await runAt(1, 3, 8, 3);
    const cinder = await runAt(2, 3, 12, 5);
    const moonwake = await runAt(3, 3, 18, 9);
    const cloudbreak = await runAt(4, 3, 35, 15);

    expect(reedwater).toMatchObject({
      stage_key: "reedwater-causeway",
      wave_key: "reedwater-warden",
      boss_active: true,
      boss_phase: "reedwater-keeper",
    });
    expect(cinder).toMatchObject({
      stage_key: "cinder-foundry",
      wave_key: "cinder-overseer",
      boss_active: true,
      boss_phase: "cinder-fury",
    });
    expect(moonwake).toMatchObject({
      stage_key: "moonwake-harbor",
      wave_key: "harbor-master",
      campaign_index: 9,
      enemy_speed: 177,
      enemy_health: 179,
      enemy_damage: 28,
      boss_active: true,
      boss_phase: "moonwake-veil",
      boss_health: 1_860,
      boss_damage: 50,
      boss_guard: 37,
      reward_score: 1_645,
      reward_renown: 71,
      drop_kind: "river-jade",
      drop_count: 3,
      drop_rate_percent: 73,
      difficulty: "legend-bound",
    });
    expect(cloudbreak).toMatchObject({
      stage_key: "cloudbreak-beacon",
      wave_key: "cloudbreak-oath",
      campaign_index: 12,
      enemy_speed: 192,
      enemy_health: 204,
      enemy_damage: 32,
      enemy_guard: 23,
      enemy_count: 13,
      spawn_interval_ms: 710,
      boss_active: true,
      boss_phase: "cloudbreak-oath",
      boss_health: 2_280,
      boss_damage: 62,
      boss_guard: 44,
      reward_score: 2_035,
      reward_renown: 88,
      drop_kind: "cloudbreak-signet",
      drop_count: 4,
      drop_rate_percent: 91,
      difficulty: "legend-bound",
    });

    expect(Number(cloudbreak.enemy_speed)).toBeGreaterThan(Number(reedwater.enemy_speed));
    expect(Number(cloudbreak.enemy_health)).toBeGreaterThan(Number(reedwater.enemy_health));
    expect(Number(cloudbreak.enemy_damage)).toBeGreaterThan(Number(reedwater.enemy_damage));
    expect(Number(cloudbreak.reward_score)).toBeGreaterThan(Number(reedwater.reward_score));
    expect(Number(cloudbreak.spawn_interval_ms)).toBeLessThan(
      Number(reedwater.spawn_interval_ms),
    );
  });

  it("changes non-boss rewards, drops, and difficulty across ordinary waves", async () => {
    const tempered = await runAt(2, 2, 7, 5);

    expect(tempered).toMatchObject({
      stage_key: "cinder-foundry",
      wave_key: "anvil-rush",
      campaign_index: 5,
      defeated: 7,
      enemy_speed: 150,
      enemy_health: 134,
      enemy_damage: 21,
      enemy_guard: 15,
      spawn_interval_ms: 1_020,
      enemy_count: 7,
      boss_active: false,
      boss_phase: "dormant",
      reward_score: 688,
      reward_renown: 34,
      drop_kind: "lantern-charm",
      drop_count: 1,
      drop_rate_percent: 52,
      difficulty: "tempered",
    });
  });

  it("clamps invalid progression inputs to the published four-by-three campaign", async () => {
    const clamped = await runAt(99, 99, -50, 999);

    expect(clamped).toMatchObject({
      stage: 4,
      stage_key: "cloudbreak-beacon",
      wave: 3,
      wave_key: "cloudbreak-oath",
      campaign_index: 12,
      defeated: 0,
      boss_phase: "cloudbreak-oath",
      drop_rate_percent: 95,
      difficulty: "legend-bound",
    });
  });
});
