/**
 * The Axirune Classics catalog describes original compact-play worlds.
 * It intentionally contains no renderer imports or copyrighted game assets.
 */

export const ARCADE_CATALOG_SCHEMA = "axirune-arcade/classics-catalog/1" as const;
export const ARCADE_SNAPSHOT_SCHEMA = "axirune-arcade/classics-snapshot/1" as const;

export const ARCADE_CLASSIC_GAME_IDS = [
  "aetherstep-foundry",
  "bastion-treads",
  "sunwake-corsairs",
  "vector-siege",
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
  "prism-bastion",
  "orbit-foundry",
  "lumen-labyrinth",
  "harbor-brawl",
  "circuit-strikers",
  "signal-bloom",
] as const;

export type ArcadeClassicGameId = (typeof ARCADE_CLASSIC_GAME_IDS)[number];

export type ArcadeEngineFamily =
  | "projectile-field"
  | "ricochet-field"
  | "grid-field"
  | "lane-field"
  | "platform-field"
  | "falling-grid"
  | "collection-field"
  | "arena-field";

export type ArcadeControlKind = "axis" | "button";
export type ArcadeAvailability = "playable" | "prototype" | "planned";
export type ArcadeViewport = "portrait" | "landscape" | "square";
export type ArcadeRuleEvaluationPoint =
  | "session-start"
  | "stage-transition"
  | "wave-transition"
  | "round-transition"
  | "turn-transition";

export interface LocalizedArcadeText {
  readonly zh: string;
  readonly en: string;
}

export interface ArcadeControlDefinition {
  readonly id: string;
  readonly kind: ArcadeControlKind;
}

export interface ArcadeEngineFamilyDefinition {
  readonly id: ArcadeEngineFamily;
  readonly fixedStepHz: number;
  readonly controls: readonly ArcadeControlDefinition[];
  readonly deterministic: true;
}

export const ARCADE_ENGINE_FAMILIES: Readonly<
  Record<ArcadeEngineFamily, ArcadeEngineFamilyDefinition>
> = Object.freeze({
  "projectile-field": family("projectile-field", 60, [
    axis("moveX"),
    axis("moveY"),
    button("primary"),
    button("secondary"),
    button("pause"),
  ]),
  "ricochet-field": family("ricochet-field", 120, [
    axis("moveX"),
    button("launch"),
    button("ability"),
    button("pause"),
  ]),
  "grid-field": family("grid-field", 20, [
    axis("moveX"),
    axis("moveY"),
    button("primary"),
    button("pause"),
  ]),
  "lane-field": family("lane-field", 60, [
    axis("moveX"),
    axis("moveY"),
    button("primary"),
    button("pause"),
  ]),
  "platform-field": family("platform-field", 120, [
    axis("moveX"),
    button("jump"),
    button("primary"),
    button("pause"),
  ]),
  "falling-grid": family("falling-grid", 30, [
    axis("moveX"),
    button("rotate"),
    button("softDrop"),
    button("hardDrop"),
    button("pause"),
  ]),
  "collection-field": family("collection-field", 60, [
    axis("moveX"),
    axis("moveY"),
    button("primary"),
    button("pause"),
  ]),
  "arena-field": family("arena-field", 60, [
    axis("moveX"),
    axis("moveY"),
    button("primary"),
    button("secondary"),
    button("pause"),
  ]),
});

export const ARCADE_ENGINE_FAMILY_BY_GAME = Object.freeze({
  "aetherstep-foundry": "platform-field",
  "bastion-treads": "projectile-field",
  "sunwake-corsairs": "projectile-field",
  "vector-siege": "projectile-field",
  "emberglass-atlas": "grid-field",
  "moonthread-ronin": "platform-field",
  "alloy-tempest": "projectile-field",
  "chromaline-circuit": "lane-field",
  "dustcoil-courier": "lane-field",
  "prism-stack": "falling-grid",
  "glyph-current": "collection-field",
  "vault-cartographer": "grid-field",
  "sparkcell-siege": "projectile-field",
  "neon-coil": "grid-field",
  "prism-bastion": "ricochet-field",
  "orbit-foundry": "arena-field",
  "lumen-labyrinth": "grid-field",
  "harbor-brawl": "arena-field",
  "circuit-strikers": "arena-field",
  "signal-bloom": "collection-field",
} as const satisfies Record<ArcadeClassicGameId, ArcadeEngineFamily>);

export type ArcadeEngineFamilyFor<GameId extends ArcadeClassicGameId> =
  (typeof ARCADE_ENGINE_FAMILY_BY_GAME)[GameId];

export interface AxiruneArcadeRuleBinding {
  readonly status: "implemented" | "planned";
  readonly sourcePath: `apps/arcade/${string}.axi`;
  readonly space: string;
  readonly entryTask: "main";
  readonly contractSchema: string;
  readonly evaluation: ArcadeRuleEvaluationPoint;
  readonly dimensions: readonly string[];
  readonly execution: "verified-checked-ir";
  readonly emptyAuthorityRequired: true;
}

export interface ArcadeGameDefinition<GameId extends ArcadeClassicGameId> {
  readonly id: GameId;
  readonly ordinal: number;
  readonly title: string;
  readonly localTitle: LocalizedArcadeText;
  readonly summary: LocalizedArcadeText;
  readonly availability: ArcadeAvailability;
  readonly engineFamily: ArcadeEngineFamilyFor<GameId>;
  readonly engineVersion: `${string}/${number}`;
  readonly fixedStepHz: number;
  readonly viewport: ArcadeViewport;
  readonly players: Readonly<{ min: 1; max: 1 | 2 }>;
  readonly tags: readonly string[];
  readonly artDirection: string;
  readonly ipPolicy: "original-world";
  readonly inputSchema: `axirune-arcade/${GameId}/input/1`;
  readonly stateSchema: `axirune-arcade/${GameId}/state/1`;
  readonly snapshotSchema: typeof ARCADE_SNAPSHOT_SCHEMA;
  readonly rules: AxiruneArcadeRuleBinding;
}

type ArcadeCatalogRecord = {
  readonly [GameId in ArcadeClassicGameId]: ArcadeGameDefinition<GameId>;
};

const CATALOG_BY_ID: ArcadeCatalogRecord = {
  "aetherstep-foundry": playableGame({
    id: "aetherstep-foundry",
    ordinal: 1,
    title: "AETHERSTEP FOUNDRY",
    localTitle: { zh: "以太踏铸厂", en: "Aetherstep Foundry" },
    summary: {
      zh: "在活塞、熔流与升降平台之间攀登，让每次踏步都接续铸造节拍。",
      en: "Climb through pistons, molten channels, and lifts while every step extends the forge rhythm.",
    },
    engineFamily: "platform-field",
    viewport: "portrait",
    tags: ["ASCENT", "FORGE", "TIMING"],
    artDirection: "Oxidized brass, ember haze, and layered industrial silhouettes.",
    evaluation: "stage-transition",
    dimensions: ["gravity", "forge tempo", "enemy speed", "reward"],
  }),
  "bastion-treads": playableGame({
    id: "bastion-treads",
    ordinal: 2,
    title: "BASTION TREADS",
    localTitle: { zh: "堡垒履带", en: "Bastion Treads" },
    summary: {
      zh: "驾驶重型履带平台守卫荒原通道，在掩体与弹道间规划推进路线。",
      en: "Command a tracked bastion across a frontier corridor, planning advances through cover and projectile lanes.",
    },
    engineFamily: "projectile-field",
    viewport: "landscape",
    tags: ["ARMOR", "PROJECTILES", "DEFENSE"],
    artDirection: "Weathered alloy, ochre terrain, and precise mechanical silhouettes.",
    evaluation: "wave-transition",
    dimensions: ["armor pressure", "enemy speed", "spawn cadence", "reward"],
  }),
  "sunwake-corsairs": playableGame({
    id: "sunwake-corsairs",
    ordinal: 3,
    title: "SUNWAKE CORSAIRS",
    localTitle: { zh: "曦浪游骑", en: "Sunwake Corsairs" },
    summary: {
      zh: "率领太阳帆艇穿越金色云潮，用编队射击保护能量航线。",
      en: "Lead solar-sail craft through golden cloud tides and defend energy routes with formation fire.",
    },
    engineFamily: "projectile-field",
    viewport: "landscape",
    tags: ["FLEET", "WAKES", "FORMATION"],
    artDirection: "Luminous sails, warm cloud oceans, and turquoise energy wakes.",
    evaluation: "wave-transition",
    dimensions: ["fleet tempo", "enemy speed", "formation density", "reward"],
  }),
  "vector-siege": playableGame({
    id: "vector-siege",
    ordinal: 4,
    title: "VECTOR SIEGE",
    localTitle: { zh: "矢量防线", en: "Vector Siege" },
    summary: {
      zh: "在折叠星图中守住航道，以连续命中构筑编队火力。",
      en: "Hold a folding star lane and build formation power through clean hit chains.",
    },
    engineFamily: "projectile-field",
    viewport: "portrait",
    tags: ["WAVES", "COMBO", "SEEDED RNG"],
    artDirection: "Obsidian space, cyan vector craft, and warm ion trails.",
    evaluation: "wave-transition",
    dimensions: ["enemy speed", "formation", "armor", "scoring"],
  }),
  "emberglass-atlas": playableGame({
    id: "emberglass-atlas",
    ordinal: 5,
    title: "EMBERGLASS ATLAS",
    localTitle: { zh: "烬玻图谱", en: "Emberglass Atlas" },
    summary: {
      zh: "在灼热玻璃地图上标记安全节点，让不断变化的路线避开热浪。",
      en: "Chart safe nodes across a heated glass atlas while routes shift around advancing thermal waves.",
    },
    engineFamily: "grid-field",
    viewport: "square",
    tags: ["MAP", "HEAT", "ROUTES"],
    artDirection: "Smoked glass, glowing cartography, and mineral-red thermal gradients.",
    evaluation: "turn-transition",
    dimensions: ["map density", "heat tempo", "route risk", "reward"],
  }),
  "moonthread-ronin": playableGame({
    id: "moonthread-ronin",
    ordinal: 6,
    title: "MOONTHREAD RONIN",
    localTitle: { zh: "月丝浪客", en: "Moonthread Ronin" },
    summary: {
      zh: "沿月光丝线跃过屋脊，以短促冲刺切断机械妖影的包围。",
      en: "Leap along moonlit threads above tiled roofs and break clockwork shades with measured dashes.",
    },
    engineFamily: "platform-field",
    viewport: "landscape",
    tags: ["DASH", "ROOFTOPS", "THREAD"],
    artDirection: "Indigo rooftops, silver thread light, and original lacquered automata.",
    evaluation: "stage-transition",
    dimensions: ["gravity", "dash tempo", "enemy speed", "reward"],
  }),
  "alloy-tempest": playableGame({
    id: "alloy-tempest",
    ordinal: 7,
    title: "ALLOY TEMPEST",
    localTitle: { zh: "合金风暴", en: "Alloy Tempest" },
    summary: {
      zh: "驾驶可变翼飞行器穿过金属风暴，在碎片间切换火力形态。",
      en: "Fly a variable-wing craft through a metallic storm and switch fire forms between debris fronts.",
    },
    engineFamily: "projectile-field",
    viewport: "portrait",
    tags: ["STORM", "WINGS", "BARRAGE"],
    artDirection: "Gunmetal cloud bands, orange sparks, and crisp transforming aircraft.",
    evaluation: "wave-transition",
    dimensions: ["storm tempo", "enemy speed", "spawn cadence", "reward"],
  }),
  "chromaline-circuit": playableGame({
    id: "chromaline-circuit",
    ordinal: 8,
    title: "CHROMALINE CIRCUIT",
    localTitle: { zh: "彩线回路", en: "Chromaline Circuit" },
    summary: {
      zh: "沿颜色线路高速穿行，只在匹配的光门之间保持完整能量链。",
      en: "Race along chromatic lanes and preserve an energy chain by crossing gates of the matching light.",
    },
    engineFamily: "lane-field",
    viewport: "landscape",
    tags: ["COLOR", "CIRCUIT", "SPEED"],
    artDirection: "Black ceramic track, spectral lane ribbons, and restrained bloom.",
    evaluation: "stage-transition",
    dimensions: ["lane tempo", "gate pattern", "speed ceiling", "reward"],
  }),
  "dustcoil-courier": playableGame({
    id: "dustcoil-courier",
    ordinal: 9,
    title: "DUSTCOIL COURIER",
    localTitle: { zh: "尘环信使", en: "Dustcoil Courier" },
    summary: {
      zh: "骑乘磁轮穿过沙尘环路，在移动车队之间完成高风险递送。",
      en: "Ride a magnetic wheel through dust-ring roads and make risky deliveries between moving caravans.",
    },
    engineFamily: "lane-field",
    viewport: "landscape",
    tags: ["COURIER", "DUST", "LANES"],
    artDirection: "Copper dust, cobalt machinery, and long atmospheric speed trails.",
    evaluation: "stage-transition",
    dimensions: ["traffic", "delivery window", "lane speed", "reward"],
  }),
  "prism-stack": playableGame({
    id: "prism-stack",
    ordinal: 10,
    title: "PRISM STACK",
    localTitle: { zh: "棱晶叠阵", en: "Prism Stack" },
    summary: {
      zh: "旋转落下的棱晶组合，让相邻光谱闭合成可连锁消散的图案。",
      en: "Rotate falling prism clusters and close neighboring spectra into chain-reactive patterns.",
    },
    engineFamily: "falling-grid",
    viewport: "portrait",
    tags: ["STACK", "SPECTRUM", "CHAIN"],
    artDirection: "Faceted crystal pieces, deep violet space, and clean spectral refraction.",
    evaluation: "round-transition",
    dimensions: ["piece cadence", "spectrum rules", "cascade value", "reward"],
  }),
  "glyph-current": playableGame({
    id: "glyph-current",
    ordinal: 11,
    title: "GLYPH CURRENT",
    localTitle: { zh: "符文潮流", en: "Glyph Current" },
    summary: {
      zh: "引导符文字群穿过流场，收集能够组成短暂语句的发光字符。",
      en: "Guide schools of glyphs through a current and gather luminous characters into fleeting phrases.",
    },
    engineFamily: "collection-field",
    viewport: "landscape",
    tags: ["GLYPHS", "CURRENT", "COLLECT"],
    artDirection: "Ink-blue water, illuminated letterforms, and fine calligraphic particles.",
    evaluation: "wave-transition",
    dimensions: ["current field", "glyph density", "phrase value", "reward"],
  }),
  "vault-cartographer": playableGame({
    id: "vault-cartographer",
    ordinal: 12,
    title: "VAULT CARTOGRAPHER",
    localTitle: { zh: "秘库绘图师", en: "Vault Cartographer" },
    summary: {
      zh: "探索每一步都会折叠的地下秘库，把短暂通道记录成可靠地图。",
      en: "Explore an underground vault that folds after every move and turn temporary passages into a reliable map.",
    },
    engineFamily: "grid-field",
    viewport: "square",
    tags: ["EXPLORE", "MAP", "TURNS"],
    artDirection: "Dark stone plans, brass survey tools, and pools of cool archival light.",
    evaluation: "turn-transition",
    dimensions: ["vault seed", "fold cadence", "relic value", "reward"],
  }),
  "sparkcell-siege": playableGame({
    id: "sparkcell-siege",
    ordinal: 13,
    title: "SPARKCELL SIEGE",
    localTitle: { zh: "火花晶胞", en: "Sparkcell Siege" },
    summary: {
      zh: "守住微型能源晶胞，在电弧连接中部署防御脉冲与无人机。",
      en: "Defend a miniature energy cell by placing pulse defenses and drones along shifting electric arcs.",
    },
    engineFamily: "projectile-field",
    viewport: "square",
    tags: ["CELL", "DEFENSE", "ARCS"],
    artDirection: "Microscopic circuitry, electric amber cells, and cool laboratory darkness.",
    evaluation: "wave-transition",
    dimensions: ["arc layout", "enemy speed", "spawn cadence", "reward"],
  }),
  "neon-coil": playableGame({
    id: "neon-coil",
    ordinal: 14,
    title: "NEON COIL",
    localTitle: { zh: "霓虹线圈", en: "Neon Coil" },
    summary: {
      zh: "在城市电网中延伸发光线圈，以封闭回路激活整片街区。",
      en: "Extend a luminous coil through a city grid and close circuits to awaken entire districts.",
    },
    engineFamily: "grid-field",
    viewport: "square",
    tags: ["TRAIL", "CIRCUIT", "GRID"],
    artDirection: "Rain-black city tiles, neon circuitry, and precise reflected light.",
    evaluation: "round-transition",
    dimensions: ["grid density", "coil tempo", "circuit value", "reward"],
  }),
  "prism-bastion": playableGame({
    id: "prism-bastion",
    ordinal: 15,
    title: "PRISM BASTION",
    localTitle: { zh: "棱镜堡垒", en: "Prism Bastion" },
    summary: {
      zh: "折射光球击穿多层晶墙，引爆会连续传递的星核砖。",
      en: "Refract a light orb through layered crystal walls and chain-reactive nova bricks.",
    },
    engineFamily: "ricochet-field",
    viewport: "landscape",
    tags: ["STAGES", "NOVA CHAIN", "REPLAY"],
    artDirection: "Deep indigo glass, spectral caustics, and precise gold architecture.",
    evaluation: "stage-transition",
    dimensions: ["orb speed", "paddle width", "armor density", "brick value"],
  }),
  "orbit-foundry": playableGame({
    id: "orbit-foundry",
    ordinal: 16,
    title: "ORBIT FOUNDRY",
    localTitle: { zh: "轨道铸造厂", en: "Orbit Foundry" },
    summary: {
      zh: "围绕微型恒星锻造卫星，以引力弹道清理不断涌入的碎片。",
      en: "Forge satellites around a pocket star and clear incoming debris with carefully shaped gravity arcs.",
    },
    engineFamily: "arena-field",
    viewport: "square",
    tags: ["ORBITS", "GRAVITY", "FORGE"],
    artDirection: "Dark celestial metal, molten cores, and engraved orbital lines.",
    evaluation: "wave-transition",
    dimensions: ["gravity", "debris speed", "forge yield", "reward"],
  }),
  "lumen-labyrinth": playableGame({
    id: "lumen-labyrinth",
    ordinal: 17,
    title: "LUMEN LABYRINTH",
    localTitle: { zh: "流明迷宫", en: "Lumen Labyrinth" },
    summary: {
      zh: "用有限光束照亮动态迷宫，在黑暗重新合拢前记住安全路线。",
      en: "Illuminate a shifting maze with limited beams and remember safe routes before darkness closes again.",
    },
    engineFamily: "grid-field",
    viewport: "square",
    tags: ["LIGHT", "MAZE", "MEMORY"],
    artDirection: "Velvet darkness, pearl architecture, and soft volumetric light cones.",
    evaluation: "stage-transition",
    dimensions: ["maze seed", "light range", "pursuit tempo", "reward"],
  }),
  "harbor-brawl": playableGame({
    id: "harbor-brawl",
    ordinal: 18,
    title: "HARBOR BRAWL",
    localTitle: { zh: "港湾乱斗", en: "Harbor Brawl" },
    summary: {
      zh: "在摇晃浮台与起重机之间争夺货箱，以环境动量赢得短局对抗。",
      en: "Contest cargo across rocking pontoons and cranes, using environmental momentum to win compact rounds.",
    },
    engineFamily: "arena-field",
    viewport: "landscape",
    players: 2,
    tags: ["ARENA", "CARGO", "MOMENTUM"],
    artDirection: "Storm-blue water, painted harbor machinery, and expressive original dock crews.",
    evaluation: "round-transition",
    dimensions: ["arena motion", "cargo timing", "opponent speed", "reward"],
  }),
  "circuit-strikers": playableGame({
    id: "circuit-strikers",
    ordinal: 19,
    title: "CIRCUIT STRIKERS",
    localTitle: { zh: "回路击手", en: "Circuit Strikers" },
    summary: {
      zh: "在导电竞技场中争夺脉冲核心，连线越完整，击球能量越强。",
      en: "Contest a pulse core inside a conductive arena where completed circuits amplify every strike.",
    },
    engineFamily: "arena-field",
    viewport: "landscape",
    players: 2,
    tags: ["SPORT", "CIRCUITS", "DUEL"],
    artDirection: "Matte black court surfaces, cyan circuitry, and sharp kinetic trails.",
    evaluation: "round-transition",
    dimensions: ["core speed", "circuit charge", "round target", "reward"],
  }),
  "signal-bloom": playableGame({
    id: "signal-bloom",
    ordinal: 20,
    title: "SIGNAL BLOOM",
    localTitle: { zh: "信号花园", en: "Signal Bloom" },
    summary: {
      zh: "培育会传播信号的机械花朵，在干扰到来前完成整片网络共振。",
      en: "Cultivate mechanical flowers that relay signals and bring the network into resonance before interference arrives.",
    },
    engineFamily: "collection-field",
    viewport: "landscape",
    tags: ["GARDEN", "SIGNALS", "RESONANCE"],
    artDirection: "Bioluminescent machinery, midnight foliage, and delicate signal filaments.",
    evaluation: "wave-transition",
    dimensions: ["bloom density", "signal range", "interference", "reward"],
  }),
};
export const ARCADE_CLASSICS_CATALOG: readonly ArcadeGameDefinition<ArcadeClassicGameId>[] =
  Object.freeze(ARCADE_CLASSIC_GAME_IDS.map((id) => CATALOG_BY_ID[id]));

export interface ArcadeCatalogIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export class ArcadeCatalogError extends Error {
  readonly issues: readonly ArcadeCatalogIssue[];

  constructor(issues: readonly ArcadeCatalogIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ArcadeCatalogError";
    this.issues = issues;
  }
}

export function isArcadeClassicGameId(value: unknown): value is ArcadeClassicGameId {
  return (
    typeof value === "string" &&
    (ARCADE_CLASSIC_GAME_IDS as readonly string[]).includes(value)
  );
}

export function getArcadeClassicGame<GameId extends ArcadeClassicGameId>(
  id: GameId,
): ArcadeGameDefinition<GameId> {
  return CATALOG_BY_ID[id];
}

/** Audits catalog-shaped external data before a UI or registry consumes it. */
export function validateArcadeCatalog(value: unknown): readonly ArcadeCatalogIssue[] {
  const issues: ArcadeCatalogIssue[] = [];
  if (!Array.isArray(value)) {
    return [issue("$", "E_CATALOG_TYPE", "Catalog must be an array.")];
  }
  if (value.length !== ARCADE_CLASSIC_GAME_IDS.length) {
    issues.push(
      issue(
        "$",
        "E_CATALOG_SIZE",
        `Catalog must contain exactly ${ARCADE_CLASSIC_GAME_IDS.length} games.`,
      ),
    );
  }

  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const path = `$[${index}]`;
    const candidate = value[index];
    if (!isRecord(candidate)) {
      issues.push(issue(path, "E_GAME_TYPE", "Game definition must be an object."));
      continue;
    }
    if (!isArcadeClassicGameId(candidate.id)) {
      issues.push(issue(`${path}.id`, "E_GAME_ID", "Game id is not registered."));
      continue;
    }

    const id = candidate.id;
    if (seen.has(id)) {
      issues.push(issue(`${path}.id`, "E_GAME_DUPLICATE", `Duplicate game id ${id}.`));
    }
    seen.add(id);
    if (candidate.ordinal !== index + 1) {
      issues.push(issue(`${path}.ordinal`, "E_GAME_ORDER", "Ordinal must match catalog order."));
    }
    validateText(candidate.title, `${path}.title`, issues);
    validateLocalizedText(candidate.localTitle, `${path}.localTitle`, issues);
    validateLocalizedText(candidate.summary, `${path}.summary`, issues);
    if (candidate.availability !== "playable") {
      issues.push(issue(`${path}.availability`, "E_AVAILABILITY", "Catalog games must be playable."));
    }

    const expectedFamily = ARCADE_ENGINE_FAMILY_BY_GAME[id];
    if (candidate.engineFamily !== expectedFamily) {
      issues.push(issue(`${path}.engineFamily`, "E_ENGINE_FAMILY", `Expected ${expectedFamily}.`));
    }
    const familyDefinition = ARCADE_ENGINE_FAMILIES[expectedFamily];
    if (candidate.fixedStepHz !== familyDefinition.fixedStepHz) {
      issues.push(
        issue(
          `${path}.fixedStepHz`,
          "E_FIXED_STEP",
          `Expected ${familyDefinition.fixedStepHz} Hz for ${expectedFamily}.`,
        ),
      );
    }
    if (typeof candidate.engineVersion !== "string" || !/^[a-z0-9-]+\/[1-9][0-9]*$/u.test(candidate.engineVersion)) {
      issues.push(issue(`${path}.engineVersion`, "E_ENGINE_VERSION", "Engine version is invalid."));
    }
    if (candidate.inputSchema !== inputSchema(id)) {
      issues.push(issue(`${path}.inputSchema`, "E_INPUT_SCHEMA", "Input schema does not match game id."));
    }
    if (candidate.stateSchema !== stateSchema(id)) {
      issues.push(issue(`${path}.stateSchema`, "E_STATE_SCHEMA", "State schema does not match game id."));
    }
    if (candidate.snapshotSchema !== ARCADE_SNAPSHOT_SCHEMA) {
      issues.push(issue(`${path}.snapshotSchema`, "E_SNAPSHOT_SCHEMA", "Snapshot schema is invalid."));
    }
    if (candidate.ipPolicy !== "original-world") {
      issues.push(issue(`${path}.ipPolicy`, "E_IP_POLICY", "Only original-world entries are allowed."));
    }
    if (!Array.isArray(candidate.tags) || candidate.tags.length < 2 || candidate.tags.length > 5) {
      issues.push(issue(`${path}.tags`, "E_TAGS", "Games require two to five tags."));
    }
    validateRuleBinding(candidate.rules, id, `${path}.rules`, issues);
  }

  for (const id of ARCADE_CLASSIC_GAME_IDS) {
    if (!seen.has(id)) {
      issues.push(issue("$", "E_GAME_MISSING", `Catalog is missing ${id}.`));
    }
  }
  return issues;
}

export function assertArcadeCatalog(value: unknown): asserts value is typeof ARCADE_CLASSICS_CATALOG {
  const issues = validateArcadeCatalog(value);
  if (issues.length > 0) throw new ArcadeCatalogError(issues);
}

function playableGame<GameId extends ArcadeClassicGameId>(definition: {
  readonly id: GameId;
  readonly ordinal: number;
  readonly title: string;
  readonly localTitle: LocalizedArcadeText;
  readonly summary: LocalizedArcadeText;
  readonly engineFamily: ArcadeEngineFamilyFor<GameId>;
  readonly viewport: ArcadeViewport;
  readonly players?: 1 | 2;
  readonly tags: readonly string[];
  readonly artDirection: string;
  readonly evaluation: ArcadeRuleEvaluationPoint;
  readonly dimensions: readonly string[];
}): ArcadeGameDefinition<GameId> {
  const { evaluation, dimensions, ...metadata } = definition;

  return defineGame({
    ...metadata,
    availability: "playable",
    rules: implementedRule(
      ruleSourcePath(definition.id),
      ruleSpace(definition.id),
      ruleContractSchema(definition.id),
      evaluation,
      dimensions,
    ),
  });
}

function defineGame<GameId extends ArcadeClassicGameId>(
  definition: Omit<
    ArcadeGameDefinition<GameId>,
    | "engineVersion"
    | "fixedStepHz"
    | "ipPolicy"
    | "inputSchema"
    | "stateSchema"
    | "snapshotSchema"
    | "players"
  > & { readonly players?: 1 | 2 },
): ArcadeGameDefinition<GameId> {
  const familyDefinition = ARCADE_ENGINE_FAMILIES[definition.engineFamily];
  return Object.freeze({
    ...definition,
    localTitle: Object.freeze({ ...definition.localTitle }),
    summary: Object.freeze({ ...definition.summary }),
    engineVersion: `${definition.engineFamily}/1`,
    fixedStepHz: familyDefinition.fixedStepHz,
    players: Object.freeze({ min: 1 as const, max: definition.players ?? 1 }),
    tags: Object.freeze([...definition.tags]),
    ipPolicy: "original-world" as const,
    inputSchema: inputSchema(definition.id),
    stateSchema: stateSchema(definition.id),
    snapshotSchema: ARCADE_SNAPSHOT_SCHEMA,
    rules: Object.freeze({
      ...definition.rules,
      dimensions: Object.freeze([...definition.rules.dimensions]),
    }),
  });
}

function implementedRule(
  sourcePath: `apps/arcade/${string}.axi`,
  space: string,
  contractSchema: string,
  evaluation: ArcadeRuleEvaluationPoint,
  dimensions: readonly string[],
): AxiruneArcadeRuleBinding {
  return rule("implemented", sourcePath, space, contractSchema, evaluation, dimensions);
}

function rule(
  status: "implemented" | "planned",
  sourcePath: `apps/arcade/${string}.axi`,
  space: string,
  contractSchema: string,
  evaluation: ArcadeRuleEvaluationPoint,
  dimensions: readonly string[],
): AxiruneArcadeRuleBinding {
  return {
    status,
    sourcePath,
    space,
    entryTask: "main",
    contractSchema,
    evaluation,
    dimensions,
    execution: "verified-checked-ir",
    emptyAuthorityRequired: true,
  };
}

function inputSchema<GameId extends ArcadeClassicGameId>(
  id: GameId,
): `axirune-arcade/${GameId}/input/1` {
  return `axirune-arcade/${id}/input/1`;
}

function stateSchema<GameId extends ArcadeClassicGameId>(
  id: GameId,
): `axirune-arcade/${GameId}/state/1` {
  return `axirune-arcade/${id}/state/1`;
}

function family(
  id: ArcadeEngineFamily,
  fixedStepHz: number,
  controls: readonly ArcadeControlDefinition[],
): ArcadeEngineFamilyDefinition {
  return Object.freeze({
    id,
    fixedStepHz,
    controls: Object.freeze(controls.map((control) => Object.freeze({ ...control }))),
    deterministic: true,
  });
}

function axis(id: string): ArcadeControlDefinition {
  return { id, kind: "axis" };
}

function button(id: string): ArcadeControlDefinition {
  return { id, kind: "button" };
}

function validateRuleBinding(
  value: unknown,
  gameId: ArcadeClassicGameId,
  path: string,
  issues: ArcadeCatalogIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "E_RULE_BINDING", "Rule binding must be an object."));
    return;
  }
  if (
    typeof value.sourcePath !== "string" ||
    !/^apps\/arcade\/(?:classics\/)?[a-z0-9-]+\.axi$/u.test(value.sourcePath)
  ) {
    issues.push(issue(`${path}.sourcePath`, "E_RULE_PATH", "Rule source path is invalid."));
  } else if (value.sourcePath !== ruleSourcePath(gameId)) {
    issues.push(issue(`${path}.sourcePath`, "E_RULE_PATH_BINDING", "Rule source belongs to another game."));
  }
  if (typeof value.space !== "string" || !/^[a-z][a-z0-9_]*$/u.test(value.space)) {
    issues.push(issue(`${path}.space`, "E_RULE_SPACE", "Axirune space name is invalid."));
  } else if (value.space !== ruleSpace(gameId)) {
    issues.push(issue(`${path}.space`, "E_RULE_SPACE_BINDING", "Axirune space belongs to another game."));
  }
  if (value.entryTask !== "main") {
    issues.push(issue(`${path}.entryTask`, "E_RULE_ENTRY", "Rule entry task must be main."));
  }
  if (
    typeof value.contractSchema !== "string" ||
    !/^axirune-arcade\/[a-z0-9/_-]+\/1$/u.test(value.contractSchema)
  ) {
    issues.push(issue(`${path}.contractSchema`, "E_RULE_SCHEMA", "Rule contract schema is invalid."));
  } else if (value.contractSchema !== ruleContractSchema(gameId)) {
    issues.push(issue(`${path}.contractSchema`, "E_RULE_SCHEMA_BINDING", "Rule schema does not match the game."));
  }
  if (value.status !== "implemented") {
    issues.push(issue(`${path}.status`, "E_RULE_STATUS", "Every catalog rule module must be implemented."));
  }
  if (value.execution !== "verified-checked-ir" || value.emptyAuthorityRequired !== true) {
    issues.push(
      issue(
        path,
        "E_RULE_AUTHORITY",
        "Rules must execute as verified Checked Programs with empty authority.",
      ),
    );
  }
  if (
    !Array.isArray(value.dimensions) ||
    value.dimensions.length === 0 ||
    value.dimensions.some((dimension) => typeof dimension !== "string" || dimension.length === 0)
  ) {
    issues.push(issue(`${path}.dimensions`, "E_RULE_DIMENSIONS", "Rules require declared dimensions."));
  }
}

function ruleSourcePath(gameId: ArcadeClassicGameId): `apps/arcade/${string}.axi` {
  if (gameId === "vector-siege") return "apps/arcade/vector-siege.axi";
  if (gameId === "prism-bastion") return "apps/arcade/prism-break.axi";
  return `apps/arcade/classics/${gameId}.axi`;
}

function ruleSpace(gameId: ArcadeClassicGameId): string {
  return gameId === "prism-bastion" ? "prism_break" : gameId.replaceAll("-", "_");
}

function ruleContractSchema(gameId: ArcadeClassicGameId): string {
  if (gameId === "vector-siege") return "axirune-arcade/vector-siege/1";
  if (gameId === "prism-bastion") return "axirune-arcade/prism-break/1";
  return "axirune-arcade/classic/1";
}

function validateLocalizedText(
  value: unknown,
  path: string,
  issues: ArcadeCatalogIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "E_LOCALIZED_TEXT", "Localized text must be an object."));
    return;
  }
  validateText(value.zh, `${path}.zh`, issues);
  validateText(value.en, `${path}.en`, issues);
}

function validateText(value: unknown, path: string, issues: ArcadeCatalogIssue[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(issue(path, "E_TEXT", "Text must be a non-empty string."));
  }
}

function issue(path: string, code: string, message: string): ArcadeCatalogIssue {
  return { path, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
