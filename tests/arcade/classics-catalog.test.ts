import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARCADE_CLASSIC_GAME_IDS,
  ARCADE_CLASSICS_CATALOG,
  ARCADE_ENGINE_FAMILIES,
  ARCADE_ENGINE_FAMILY_BY_GAME,
  ARCADE_SNAPSHOT_SCHEMA,
  ArcadeCatalogError,
  assertArcadeCatalog,
  getArcadeClassicGame,
  validateArcadeCatalog,
} from "../../src/arcade/classics/catalog.js";

describe("Axirune Classics catalog", () => {
  it("contains one ordered, valid definition for each of the 20 original worlds", () => {
    expect(ARCADE_CLASSICS_CATALOG).toHaveLength(20);
    expect(ARCADE_CLASSICS_CATALOG.map(({ id }) => id)).toEqual(
      ARCADE_CLASSIC_GAME_IDS,
    );
    expect(ARCADE_CLASSICS_CATALOG.map(({ ordinal }) => ordinal)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(validateArcadeCatalog(ARCADE_CLASSICS_CATALOG)).toEqual([]);
    expect(() => assertArcadeCatalog(ARCADE_CLASSICS_CATALOG)).not.toThrow();
    expect(new Set(ARCADE_CLASSICS_CATALOG.map(({ title }) => title)).size).toBe(20);
    expect(ARCADE_CLASSICS_CATALOG.every(({ ipPolicy }) => ipPolicy === "original-world")).toBe(
      true,
    );
  });

  it("keeps every definition immutable and ready for bilingual catalog UI", () => {
    expect(Object.isFrozen(ARCADE_CLASSICS_CATALOG)).toBe(true);
    for (const game of ARCADE_CLASSICS_CATALOG) {
      expect(Object.isFrozen(game)).toBe(true);
      expect(Object.isFrozen(game.localTitle)).toBe(true);
      expect(Object.isFrozen(game.summary)).toBe(true);
      expect(Object.isFrozen(game.tags)).toBe(true);
      expect(game.localTitle.zh.length).toBeGreaterThan(0);
      expect(game.localTitle.en.length).toBeGreaterThan(0);
      expect(game.summary.zh.length).toBeGreaterThan(10);
      expect(game.summary.en.length).toBeGreaterThan(20);
      expect(game.tags.length).toBeGreaterThanOrEqual(2);
      expect(game.tags.length).toBeLessThanOrEqual(5);
    }
  });

  it("binds each game to one shared deterministic engine family", () => {
    const usedFamilies = new Set(ARCADE_CLASSICS_CATALOG.map(({ engineFamily }) => engineFamily));
    expect(usedFamilies).toEqual(new Set(Object.keys(ARCADE_ENGINE_FAMILIES)));

    for (const game of ARCADE_CLASSICS_CATALOG) {
      const family = ARCADE_ENGINE_FAMILIES[game.engineFamily];
      expect(game.engineFamily).toBe(ARCADE_ENGINE_FAMILY_BY_GAME[game.id]);
      expect(game.fixedStepHz).toBe(family.fixedStepHz);
      expect(game.engineVersion).toBe(`${game.engineFamily}/1`);
      expect(family.deterministic).toBe(true);
      expect(new Set(family.controls.map(({ id }) => id)).size).toBe(
        family.controls.length,
      );
      expect(family.controls.some(({ id }) => id === "pause")).toBe(true);
    }
  });

  it("describes checked Axirune rule bindings without granting runtime authority", () => {
    const implemented = ARCADE_CLASSICS_CATALOG.filter(
      ({ rules }) => rules.status === "implemented",
    );
    expect(implemented.map(({ id }) => id)).toEqual(ARCADE_CLASSIC_GAME_IDS);

    for (const game of ARCADE_CLASSICS_CATALOG) {
      expect(game.availability).toBe("playable");
      expect(game.rules.execution).toBe("verified-checked-ir");
      expect(game.rules.emptyAuthorityRequired).toBe(true);
      expect(game.rules.entryTask).toBe("main");
      expect(game.rules.sourcePath).toMatch(/^apps\/arcade\/.+\.axi$/u);
      expect(game.rules.dimensions.length).toBeGreaterThan(0);
      expect(game.inputSchema).toBe(`axirune-arcade/${game.id}/input/1`);
      expect(game.stateSchema).toBe(`axirune-arcade/${game.id}/state/1`);
      expect(game.snapshotSchema).toBe(ARCADE_SNAPSHOT_SCHEMA);

      const sourceUrl = new URL(`../../${game.rules.sourcePath}`, import.meta.url);
      expect(existsSync(sourceUrl), game.rules.sourcePath).toBe(true);
      const source = readFileSync(sourceUrl, "utf8");
      expect(source).toContain(`space ${game.rules.space}`);
      expect(source).toContain(`:schema «${game.rules.contractSchema}»`);
    }
    expect(new Set(ARCADE_CLASSICS_CATALOG.map(({ rules }) => rules.space)).size).toBe(20);
    expect(
      new Set(ARCADE_CLASSICS_CATALOG.map(({ rules }) => rules.sourcePath)).size,
    ).toBe(20);
  });

  it("provides a literal-id lookup suitable for discriminated UI branches", () => {
    const prism = getArcadeClassicGame("prism-bastion");
    expect(prism.engineFamily).toBe("ricochet-field");
    expect(prism.fixedStepHz).toBe(120);
    expect(prism.availability).toBe("playable");

    const cartographer = getArcadeClassicGame("vault-cartographer");
    expect(cartographer.engineFamily).toBe("grid-field");
    expect(cartographer.fixedStepHz).toBe(20);
    expect(cartographer.availability).toBe("playable");
  });

  it("rejects missing, duplicate, mismatched, or authority-bearing catalog data", () => {
    const forged = structuredClone(ARCADE_CLASSICS_CATALOG);
    forged[1] = structuredClone(forged[0]!);
    Object.assign(forged[2]!, {
      engineFamily: "grid-field",
      fixedStepHz: 17,
    });
    Object.assign(forged[3]!.rules, {
      emptyAuthorityRequired: false,
    });

    const issues = validateArcadeCatalog(forged);
    expect(issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "E_GAME_DUPLICATE",
        "E_GAME_MISSING",
        "E_ENGINE_FAMILY",
        "E_FIXED_STEP",
        "E_RULE_AUTHORITY",
      ]),
    );
    expect(() => assertArcadeCatalog(forged)).toThrow(ArcadeCatalogError);
    expect(validateArcadeCatalog({})).toContainEqual(
      expect.objectContaining({ code: "E_CATALOG_TYPE" }),
    );
  });
});
