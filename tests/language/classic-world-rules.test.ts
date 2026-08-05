import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAxiruneRuleModule } from "../../src/arcade/axirune-rule-module.js";
import { validateClassicRuleContract } from "../../src/arcade/classic-rule-contract.js";

const CLASSIC_IDS = [
  "aetherstep-foundry",
  "bastion-treads",
  "sunwake-corsairs",
  "emberglass-atlas",
  "moonthread-ronin",
  "alloy-tempest",
  "chromaline-circuit",
  "dustcoil-courier",
  "prism-stack",
  "glyph-current",
  "vault-cartographer",
  "sparkcell-siege",
  "neon-coil",
  "orbit-foundry",
  "lumen-labyrinth",
  "harbor-brawl",
  "circuit-strikers",
  "signal-bloom",
] as const;

function source(id: string): string {
  return readFileSync(new URL(`../../apps/arcade/classics/${id}.axi`, import.meta.url), "utf8");
}

describe("Axirune Classic World rule modules", () => {
  it("compiles, verifies, and evaluates all 18 independent zero-authority programs", async () => {
    const contentIds = new Set<string>();
    for (const id of CLASSIC_IDS) {
      const module = await createAxiruneRuleModule(source(id));
      const first = await module.run({ stage: 2, score: 450, streak: 3 });
      const second = await module.run({ stage: 2, score: 450, streak: 3 });
      const contract = validateClassicRuleContract(first.value, id);

      expect(first.value).toEqual(second.value);
      expect(contract).toMatchObject({ game: id, stage: 2, score: 450 });
      expect(module.contentId).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(module.capsuleBytes).toBeGreaterThan(900);
      contentIds.add(module.contentId);
    }

    expect(contentIds.size).toBe(CLASSIC_IDS.length);
  });

  it("makes stage and streak changes observable in every game contract", async () => {
    for (const id of CLASSIC_IDS) {
      const module = await createAxiruneRuleModule(source(id));
      const early = validateClassicRuleContract(
        (await module.run({ stage: 1, score: 0, streak: 0 })).value,
        id,
      );
      const late = validateClassicRuleContract(
        (await module.run({ stage: 7, score: 2_000, streak: 8 })).value,
        id,
      );

      expect(late.tempo).toBeGreaterThan(early.tempo);
      expect(late.spawnIntervalMs).toBeLessThan(early.spawnIntervalMs);
      expect(late.reward).toBeGreaterThan(early.reward);
      expect(late.phase).toBe("surge");
    }
  });

  it("rejects a contract issued for a different game", async () => {
    const module = await createAxiruneRuleModule(source("aetherstep-foundry"));
    const value = (await module.run({ stage: 1, score: 0, streak: 0 })).value;
    expect(() => validateClassicRuleContract(value, "bastion-treads")).toThrow(
      "not bastion-treads",
    );
  });
});
