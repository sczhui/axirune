import { canonicalJson } from "../../language/canonical-json.js";
import {
  ARCADE_CATALOG_SCHEMA,
  ARCADE_CLASSICS_CATALOG,
  ARCADE_ENGINE_FAMILIES,
  ARCADE_SNAPSHOT_SCHEMA,
  getArcadeClassicGame,
  isArcadeClassicGameId,
  type ArcadeClassicGameId,
  type ArcadeEngineFamily,
  type ArcadeEngineFamilyFor,
} from "./catalog.js";

export const ARCADE_SEED_ALGORITHM = "xorshift32-v1" as const;

export type ArcadeJsonPrimitive = null | boolean | number | string;
export type ArcadeJsonValue =
  | ArcadeJsonPrimitive
  | readonly ArcadeJsonValue[]
  | ArcadeJsonObject;
export interface ArcadeJsonObject {
  readonly [key: string]: ArcadeJsonValue;
}

export interface ProjectileFieldControls {
  readonly moveX: number;
  readonly moveY: number;
  readonly primary: boolean;
  readonly secondary: boolean;
  readonly pause: boolean;
}

export interface RicochetFieldControls {
  readonly moveX: number;
  readonly launch: boolean;
  readonly ability: boolean;
  readonly pause: boolean;
}

export interface GridFieldControls {
  readonly moveX: number;
  readonly moveY: number;
  readonly primary: boolean;
  readonly pause: boolean;
}

export interface LaneFieldControls {
  readonly moveX: number;
  readonly moveY: number;
  readonly primary: boolean;
  readonly pause: boolean;
}

export interface PlatformFieldControls {
  readonly moveX: number;
  readonly jump: boolean;
  readonly primary: boolean;
  readonly pause: boolean;
}

export interface FallingGridControls {
  readonly moveX: number;
  readonly rotate: boolean;
  readonly softDrop: boolean;
  readonly hardDrop: boolean;
  readonly pause: boolean;
}

export interface CollectionFieldControls {
  readonly moveX: number;
  readonly moveY: number;
  readonly primary: boolean;
  readonly pause: boolean;
}

export interface ArenaFieldControls {
  readonly moveX: number;
  readonly moveY: number;
  readonly primary: boolean;
  readonly secondary: boolean;
  readonly pause: boolean;
}

export interface ArcadeControlsByFamily {
  readonly "projectile-field": ProjectileFieldControls;
  readonly "ricochet-field": RicochetFieldControls;
  readonly "grid-field": GridFieldControls;
  readonly "lane-field": LaneFieldControls;
  readonly "platform-field": PlatformFieldControls;
  readonly "falling-grid": FallingGridControls;
  readonly "collection-field": CollectionFieldControls;
  readonly "arena-field": ArenaFieldControls;
}

export type ArcadeControlsFor<GameId extends ArcadeClassicGameId> =
  ArcadeControlsByFamily[ArcadeEngineFamilyFor<GameId>];

export interface ArcadeInputFrame<GameId extends ArcadeClassicGameId> {
  readonly schema: `axirune-arcade/${GameId}/input/1`;
  readonly gameId: GameId;
  readonly engineFamily: ArcadeEngineFamilyFor<GameId>;
  readonly tick: number;
  readonly sequence: number;
  readonly controls: ArcadeControlsFor<GameId>;
}

export type AnyArcadeInputFrame = {
  [GameId in ArcadeClassicGameId]: ArcadeInputFrame<GameId>;
}[ArcadeClassicGameId];

export interface ArcadeSeedState {
  readonly algorithm: typeof ARCADE_SEED_ALGORITHM;
  readonly initial: number;
  readonly current: number;
}

export type ArcadeSessionStatus =
  | "ready"
  | "running"
  | "paused"
  | "stage-clear"
  | "won"
  | "game-over";

export interface ArcadeSessionState<
  GameId extends ArcadeClassicGameId,
  Payload extends ArcadeJsonObject = ArcadeJsonObject,
> {
  readonly schema: `axirune-arcade/${GameId}/state/1`;
  readonly gameId: GameId;
  readonly engineFamily: ArcadeEngineFamilyFor<GameId>;
  readonly tick: number;
  readonly lastInputSequence: number;
  readonly status: ArcadeSessionStatus;
  readonly score: number;
  readonly stage: number;
  readonly seed: ArcadeSeedState;
  readonly payload: Payload;
}

export type AnyArcadeSessionState = {
  [GameId in ArcadeClassicGameId]: ArcadeSessionState<GameId>;
}[ArcadeClassicGameId];

export interface ArcadeRuleEvidence {
  readonly contractSchema: string;
  readonly contentId: `sha256:${string}`;
  readonly semanticDigest: `sha256:${string}`;
}

export interface ArcadeSnapshot<
  GameId extends ArcadeClassicGameId,
  Payload extends ArcadeJsonObject = ArcadeJsonObject,
> {
  readonly schema: typeof ARCADE_SNAPSHOT_SCHEMA;
  readonly catalogSchema: typeof ARCADE_CATALOG_SCHEMA;
  readonly gameId: GameId;
  readonly engineFamily: ArcadeEngineFamilyFor<GameId>;
  readonly engineVersion: string;
  readonly fixedStepHz: number;
  readonly rules: ArcadeRuleEvidence;
  readonly state: ArcadeSessionState<GameId, Payload>;
}

export type AnyArcadeSnapshot = {
  [GameId in ArcadeClassicGameId]: ArcadeSnapshot<GameId>;
}[ArcadeClassicGameId];

export interface ArcadeContractIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type ArcadeContractVerification<Value> =
  | { readonly ok: true; readonly value: Value; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly ArcadeContractIssue[] };

export class ArcadeContractError extends Error {
  readonly issues: readonly ArcadeContractIssue[];

  constructor(issues: readonly ArcadeContractIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ArcadeContractError";
    this.issues = issues;
  }
}

export interface ArcadeEngineAdapter<
  GameId extends ArcadeClassicGameId,
  Payload extends ArcadeJsonObject = ArcadeJsonObject,
> {
  readonly gameId: GameId;
  readonly engineFamily: ArcadeEngineFamilyFor<GameId>;
  readonly engineVersion: string;
  readonly create: (seed: ArcadeSeedState) => ArcadeSessionState<GameId, Payload>;
  readonly step: (
    state: ArcadeSessionState<GameId, Payload>,
    input: ArcadeInputFrame<GameId>,
  ) => ArcadeSessionState<GameId, Payload>;
}

export type ArcadeRuntimePayloadBindings = Partial<{
  readonly [GameId in ArcadeClassicGameId]: ArcadeJsonObject;
}>;

type BoundPayload<
  Bindings extends ArcadeRuntimePayloadBindings,
  GameId extends ArcadeClassicGameId,
> = GameId extends keyof Bindings
  ? Bindings[GameId] extends ArcadeJsonObject
    ? Bindings[GameId]
    : never
  : ArcadeJsonObject;

/** Type-safe adapter registry. It deliberately owns no render or frame clock. */
export class ArcadeRuntimeRegistry<
  Bindings extends ArcadeRuntimePayloadBindings = Record<never, never>,
> {
  readonly #adapters = new Map<ArcadeClassicGameId, unknown>();

  register<GameId extends ArcadeClassicGameId>(
    adapter: ArcadeEngineAdapter<GameId, BoundPayload<Bindings, GameId>>,
  ): void {
    const game = getArcadeClassicGame(adapter.gameId);
    if (adapter.engineFamily !== game.engineFamily) {
      throw new ArcadeContractError([
        contractIssue(
          "$.engineFamily",
          "E_ADAPTER_FAMILY",
          `Adapter for ${adapter.gameId} must use ${game.engineFamily}.`,
        ),
      ]);
    }
    if (adapter.engineVersion !== game.engineVersion) {
      throw new ArcadeContractError([
        contractIssue(
          "$.engineVersion",
          "E_ADAPTER_VERSION",
          `Adapter for ${adapter.gameId} must use ${game.engineVersion}.`,
        ),
      ]);
    }
    if (this.#adapters.has(adapter.gameId)) {
      throw new ArcadeContractError([
        contractIssue("$.gameId", "E_ADAPTER_DUPLICATE", `${adapter.gameId} is already registered.`),
      ]);
    }
    this.#adapters.set(adapter.gameId, adapter);
  }

  get<GameId extends ArcadeClassicGameId>(
    gameId: GameId,
  ): ArcadeEngineAdapter<GameId, BoundPayload<Bindings, GameId>> | undefined {
    return this.#adapters.get(gameId) as
      | ArcadeEngineAdapter<GameId, BoundPayload<Bindings, GameId>>
      | undefined;
  }

  has(gameId: ArcadeClassicGameId): boolean {
    return this.#adapters.has(gameId);
  }

  list(): readonly ArcadeClassicGameId[] {
    return Object.freeze([...this.#adapters.keys()]);
  }
}

export function createArcadeSeed(seed: number): ArcadeSeedState {
  const normalized = normalizeSeed(seed);
  return Object.freeze({
    algorithm: ARCADE_SEED_ALGORITHM,
    initial: normalized,
    current: normalized,
  });
}

export function advanceArcadeSeed(seed: ArcadeSeedState): Readonly<{
  seed: ArcadeSeedState;
  value: number;
}> {
  const issues: ArcadeContractIssue[] = [];
  validateSeed(seed, "$.seed", issues);
  if (issues.length > 0) throw new ArcadeContractError(issues);

  let current = seed.current >>> 0;
  current ^= current << 13;
  current ^= current >>> 17;
  current ^= current << 5;
  current >>>= 0;
  return Object.freeze({
    seed: Object.freeze({ ...seed, current }),
    value: current / 0x1_0000_0000,
  });
}

export function createNeutralArcadeInput<GameId extends ArcadeClassicGameId>(
  gameId: GameId,
  tick = 0,
  sequence = 0,
): ArcadeInputFrame<GameId> {
  const game = getArcadeClassicGame(gameId);
  const family = ARCADE_ENGINE_FAMILIES[game.engineFamily];
  const controls: Record<string, boolean | number> = {};
  for (const control of family.controls) {
    controls[control.id] = control.kind === "axis" ? 0 : false;
  }
  return Object.freeze({
    schema: game.inputSchema,
    gameId,
    engineFamily: game.engineFamily,
    tick,
    sequence,
    controls: Object.freeze(controls) as unknown as ArcadeControlsFor<GameId>,
  });
}

export function createArcadeSessionState<
  GameId extends ArcadeClassicGameId,
  Payload extends ArcadeJsonObject,
>(options: {
  readonly gameId: GameId;
  readonly seed: number;
  readonly payload: Payload;
  readonly status?: ArcadeSessionStatus;
  readonly score?: number;
  readonly stage?: number;
}): ArcadeSessionState<GameId, Payload> {
  const game = getArcadeClassicGame(options.gameId);
  const state: ArcadeSessionState<GameId, Payload> = {
    schema: game.stateSchema,
    gameId: options.gameId,
    engineFamily: game.engineFamily,
    tick: 0,
    lastInputSequence: 0,
    status: options.status ?? "ready",
    score: options.score ?? 0,
    stage: options.stage ?? 1,
    seed: createArcadeSeed(options.seed),
    payload: options.payload,
  };
  const verified = verifyArcadeSessionState(state);
  if (!verified.ok) throw new ArcadeContractError(verified.issues);
  return state;
}

export function createArcadeSnapshot<
  GameId extends ArcadeClassicGameId,
  Payload extends ArcadeJsonObject,
>(
  state: ArcadeSessionState<GameId, Payload>,
  rules: ArcadeRuleEvidence,
): ArcadeSnapshot<GameId, Payload> {
  const game = getArcadeClassicGame(state.gameId);
  const snapshot: ArcadeSnapshot<GameId, Payload> = {
    schema: ARCADE_SNAPSHOT_SCHEMA,
    catalogSchema: ARCADE_CATALOG_SCHEMA,
    gameId: state.gameId,
    engineFamily: state.engineFamily,
    engineVersion: game.engineVersion,
    fixedStepHz: game.fixedStepHz,
    rules,
    state,
  };
  const verified = verifyArcadeSnapshot(snapshot);
  if (!verified.ok) throw new ArcadeContractError(verified.issues);
  return snapshot;
}

export function verifyArcadeInputFrame(
  value: unknown,
): ArcadeContractVerification<AnyArcadeInputFrame> {
  const issues: ArcadeContractIssue[] = [];
  if (!isRecord(value)) {
    return failed(contractIssue("$", "E_INPUT_TYPE", "Input frame must be an object."));
  }
  const game = gameFromRecord(value, issues);
  if (!game) return failed(...issues);

  if (value.schema !== game.inputSchema) {
    issues.push(contractIssue("$.schema", "E_INPUT_SCHEMA", `Expected ${game.inputSchema}.`));
  }
  if (value.engineFamily !== game.engineFamily) {
    issues.push(contractIssue("$.engineFamily", "E_INPUT_FAMILY", `Expected ${game.engineFamily}.`));
  }
  validateInteger(value.tick, "$.tick", 0, issues);
  validateInteger(value.sequence, "$.sequence", 0, issues);
  validateControls(value.controls, game.engineFamily, issues);
  return issues.length === 0
    ? passed(value as unknown as AnyArcadeInputFrame)
    : failed(...issues);
}

export function verifyArcadeSessionState(
  value: unknown,
): ArcadeContractVerification<AnyArcadeSessionState> {
  const issues: ArcadeContractIssue[] = [];
  if (!isRecord(value)) {
    return failed(contractIssue("$", "E_STATE_TYPE", "Session state must be an object."));
  }
  const game = gameFromRecord(value, issues);
  if (!game) return failed(...issues);

  if (value.schema !== game.stateSchema) {
    issues.push(contractIssue("$.schema", "E_STATE_SCHEMA", `Expected ${game.stateSchema}.`));
  }
  if (value.engineFamily !== game.engineFamily) {
    issues.push(contractIssue("$.engineFamily", "E_STATE_FAMILY", `Expected ${game.engineFamily}.`));
  }
  validateInteger(value.tick, "$.tick", 0, issues);
  validateInteger(value.lastInputSequence, "$.lastInputSequence", 0, issues);
  if (!isSessionStatus(value.status)) {
    issues.push(contractIssue("$.status", "E_STATE_STATUS", "Session status is invalid."));
  }
  validateInteger(value.score, "$.score", 0, issues);
  validateInteger(value.stage, "$.stage", 1, issues);
  validateSeed(value.seed, "$.seed", issues);
  validateJsonValue(value.payload, "$.payload", 0, { count: 0 }, issues);
  return issues.length === 0
    ? passed(value as unknown as AnyArcadeSessionState)
    : failed(...issues);
}

export function verifyArcadeSnapshot(
  value: unknown,
): ArcadeContractVerification<AnyArcadeSnapshot> {
  const issues: ArcadeContractIssue[] = [];
  if (!isRecord(value)) {
    return failed(contractIssue("$", "E_SNAPSHOT_TYPE", "Snapshot must be an object."));
  }
  const game = gameFromRecord(value, issues);
  if (!game) return failed(...issues);

  if (value.schema !== ARCADE_SNAPSHOT_SCHEMA) {
    issues.push(contractIssue("$.schema", "E_SNAPSHOT_SCHEMA", "Snapshot schema is invalid."));
  }
  if (value.catalogSchema !== ARCADE_CATALOG_SCHEMA) {
    issues.push(contractIssue("$.catalogSchema", "E_CATALOG_SCHEMA", "Catalog schema is invalid."));
  }
  if (value.engineFamily !== game.engineFamily) {
    issues.push(contractIssue("$.engineFamily", "E_SNAPSHOT_FAMILY", `Expected ${game.engineFamily}.`));
  }
  if (value.engineVersion !== game.engineVersion) {
    issues.push(contractIssue("$.engineVersion", "E_ENGINE_VERSION", `Expected ${game.engineVersion}.`));
  }
  if (value.fixedStepHz !== game.fixedStepHz) {
    issues.push(contractIssue("$.fixedStepHz", "E_FIXED_STEP", `Expected ${game.fixedStepHz}.`));
  }
  validateRuleEvidence(value.rules, game.rules.contractSchema, issues);

  const stateVerification = verifyArcadeSessionState(value.state);
  if (!stateVerification.ok) {
    issues.push(
      ...stateVerification.issues.map((entry) => ({
        ...entry,
        path: `$.state${entry.path === "$" ? "" : entry.path.slice(1)}`,
      })),
    );
  } else if (
    stateVerification.value.gameId !== game.id ||
    stateVerification.value.engineFamily !== game.engineFamily
  ) {
    issues.push(
      contractIssue("$.state.gameId", "E_STATE_BINDING", "Snapshot state belongs to another game."),
    );
  }
  return issues.length === 0
    ? passed(value as unknown as AnyArcadeSnapshot)
    : failed(...issues);
}

export function serializeArcadeSnapshot(snapshot: AnyArcadeSnapshot): string {
  const verified = verifyArcadeSnapshot(snapshot);
  if (!verified.ok) throw new ArcadeContractError(verified.issues);
  return canonicalJson(snapshot);
}

export function restoreArcadeSnapshot(
  serialized: string,
): ArcadeContractVerification<AnyArcadeSnapshot> {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return failed(contractIssue("$", "E_SNAPSHOT_JSON", "Snapshot is not valid JSON."));
  }
  return verifyArcadeSnapshot(value);
}

function validateControls(
  value: unknown,
  family: ArcadeEngineFamily,
  issues: ArcadeContractIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(contractIssue("$.controls", "E_CONTROLS_TYPE", "Controls must be an object."));
    return;
  }
  const definitions = ARCADE_ENGINE_FAMILIES[family].controls;
  const expectedIds = new Set(definitions.map(({ id }) => id));
  for (const key of Object.keys(value)) {
    if (!expectedIds.has(key)) {
      issues.push(contractIssue(`$.controls.${key}`, "E_CONTROL_UNKNOWN", "Control is not in this engine family."));
    }
  }
  for (const definition of definitions) {
    const control = value[definition.id];
    if (definition.kind === "button") {
      if (typeof control !== "boolean") {
        issues.push(contractIssue(`$.controls.${definition.id}`, "E_CONTROL_BUTTON", "Button must be boolean."));
      }
    } else if (
      typeof control !== "number" ||
      !Number.isFinite(control) ||
      control < -1 ||
      control > 1
    ) {
      issues.push(contractIssue(`$.controls.${definition.id}`, "E_CONTROL_AXIS", "Axis must be finite from -1 to 1."));
    }
  }
}

function validateSeed(value: unknown, path: string, issues: ArcadeContractIssue[]): void {
  if (!isRecord(value)) {
    issues.push(contractIssue(path, "E_SEED_TYPE", "Seed state must be an object."));
    return;
  }
  if (value.algorithm !== ARCADE_SEED_ALGORITHM) {
    issues.push(contractIssue(`${path}.algorithm`, "E_SEED_ALGORITHM", "Seed algorithm is unsupported."));
  }
  validateUint32(value.initial, `${path}.initial`, issues, true);
  validateUint32(value.current, `${path}.current`, issues, true);
}

function validateRuleEvidence(
  value: unknown,
  expectedSchema: string,
  issues: ArcadeContractIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(contractIssue("$.rules", "E_RULE_EVIDENCE", "Rule evidence must be an object."));
    return;
  }
  if (value.contractSchema !== expectedSchema) {
    issues.push(contractIssue("$.rules.contractSchema", "E_RULE_SCHEMA", `Expected ${expectedSchema}.`));
  }
  validateDigest(value.contentId, "$.rules.contentId", issues);
  validateDigest(value.semanticDigest, "$.rules.semanticDigest", issues);
}

function validateDigest(value: unknown, path: string, issues: ArcadeContractIssue[]): void {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    issues.push(contractIssue(path, "E_DIGEST", "Digest must be a lowercase SHA-256 content id."));
  }
}

function validateJsonValue(
  value: unknown,
  path: string,
  depth: number,
  counter: { count: number },
  issues: ArcadeContractIssue[],
): void {
  counter.count += 1;
  if (counter.count > 10_000) {
    if (!issues.some(({ code }) => code === "E_PAYLOAD_ITEMS")) {
      issues.push(contractIssue(path, "E_PAYLOAD_ITEMS", "Payload exceeds 10,000 values."));
    }
    return;
  }
  if (depth > 16) {
    issues.push(contractIssue(path, "E_PAYLOAD_DEPTH", "Payload exceeds 16 levels."));
    return;
  }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      issues.push(contractIssue(path, "E_PAYLOAD_NUMBER", "Payload numbers must be finite."));
    }
    return;
  }
  if (typeof value === "string") {
    if (value.length > 65_536) {
      issues.push(contractIssue(path, "E_PAYLOAD_STRING", "Payload string is too long."));
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 2_048) {
      issues.push(contractIssue(path, "E_PAYLOAD_ARRAY", "Payload array exceeds 2,048 items."));
      return;
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        issues.push(contractIssue(`${path}[${index}]`, "E_PAYLOAD_HOLE", "Payload arrays cannot contain holes."));
        continue;
      }
      validateJsonValue(value[index], `${path}[${index}]`, depth + 1, counter, issues);
    }
    return;
  }
  if (isRecord(value)) {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      issues.push(contractIssue(path, "E_PAYLOAD_OBJECT", "Payload objects must be plain records."));
      return;
    }
    const keys = Object.keys(value);
    if (keys.length > 2_048) {
      issues.push(contractIssue(path, "E_PAYLOAD_KEYS", "Payload object exceeds 2,048 keys."));
      return;
    }
    for (const key of keys) {
      validateJsonValue(value[key], `${path}.${key}`, depth + 1, counter, issues);
    }
    return;
  }
  issues.push(contractIssue(path, "E_PAYLOAD_VALUE", "Payload contains a non-JSON value."));
}

function gameFromRecord(
  value: Record<string, unknown>,
  issues: ArcadeContractIssue[],
) {
  if (!isArcadeClassicGameId(value.gameId)) {
    issues.push(contractIssue("$.gameId", "E_GAME_ID", "Game id is not in the Classics catalog."));
    return null;
  }
  return getArcadeClassicGame(value.gameId);
}

function validateInteger(
  value: unknown,
  path: string,
  minimum: number,
  issues: ArcadeContractIssue[],
): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    issues.push(contractIssue(path, "E_INTEGER", `Value must be a safe integer at least ${minimum}.`));
  }
}

function validateUint32(
  value: unknown,
  path: string,
  issues: ArcadeContractIssue[],
  nonZero: boolean,
): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < (nonZero ? 1 : 0) ||
    value > 0xffff_ffff
  ) {
    issues.push(contractIssue(path, "E_UINT32", "Value must be a non-zero unsigned 32-bit integer."));
  }
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new ArcadeContractError([
      contractIssue("$.seed", "E_SEED_VALUE", "Seed must be finite."),
    ]);
  }
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? 0x6d2b_79f5 : normalized;
}

function isSessionStatus(value: unknown): value is ArcadeSessionStatus {
  return (
    value === "ready" ||
    value === "running" ||
    value === "paused" ||
    value === "stage-clear" ||
    value === "won" ||
    value === "game-over"
  );
}

function passed<Value>(value: Value): ArcadeContractVerification<Value> {
  return { ok: true, value, issues: [] };
}

function failed(...issues: ArcadeContractIssue[]): ArcadeContractVerification<never> {
  return { ok: false, issues };
}

function contractIssue(path: string, code: string, message: string): ArcadeContractIssue {
  return { path, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keep the exported catalog close to its runtime contract in generated docs.
export { ARCADE_CLASSICS_CATALOG };
