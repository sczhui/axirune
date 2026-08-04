import { FRAME_KINDS } from "./ast.js";
import { canonicalJson } from "./canonical-json.js";
import type { IRProgram } from "./ir.js";
import { IR_VERSION, SUPPORTED_EDITIONS } from "./metadata.js";

export interface IRValidationIssue {
  code: string;
  message: string;
  path: string;
}

export type IRValidationResult =
  | { ok: true; issues: []; ir: IRProgram }
  | { ok: false; issues: IRValidationIssue[] };

const MAX_DEPTH = 128;
const MAX_NODES = 200_000;
const MAX_FRAMES = 4_096;
const MAX_INSTRUCTIONS = 100_000;
const MAX_COLLECTION_ITEMS = 100_000;
const MAX_STRING_LENGTH = 1_048_576;
const frameKinds = new Set<string>(FRAME_KINDS);
const requirementKinds = new Set(["capability", "context", "permission", "tool"]);
const instructionOps = new Set([
  "take",
  "give",
  "grant",
  "within",
  "budget",
  "let",
  "emit",
  "yield",
  "invoke",
  "launch",
  "weave",
  "need",
  "use",
  "attach",
  "directive",
  "instruction",
]);

/** Validates untrusted decoded IR before the interpreter can observe it. */
export function validateIRProgram(value: unknown): IRValidationResult {
  const issues: IRValidationIssue[] = [];
  const context: ValidationContext = { issues, nodes: 0 };
  scan(value, "$", 0, context);
  const root = record(value, "$", context);
  if (!root) return { ok: false, issues };
  exactKeys(
    root,
    ["version", "space", "edition", "frames", "entry", "permissions", "sourceSpan"],
    "$",
    context,
  );
  if (root.version !== IR_VERSION) {
    issue(
      context,
      "E_CAPSULE_IR_VERSION",
      `Expected IR ${IR_VERSION}, received ${String(root.version)}.`,
      "$.version",
    );
  }
  text(root.space, "$.space", context);
  if (
    !Number.isSafeInteger(root.edition) ||
    !SUPPORTED_EDITIONS.includes(root.edition as (typeof SUPPORTED_EDITIONS)[number])
  ) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Unsupported language edition.", "$.edition");
  }
  span(root.sourceSpan, "$.sourceSpan", context);
  stringArray(root.permissions, "$.permissions", context, true);

  const frames = list(root.frames, "$.frames", context, MAX_FRAMES);
  const entry = list(root.entry, "$.entry", context, MAX_INSTRUCTIONS);
  const frameIds = new Set<string>();
  const qualifiedNames = new Set<string>();
  const instructionIds = new Set<string>();
  const frameRecords: Record<string, unknown>[] = [];
  if (frames) {
    frames.forEach((frame, index) => {
      const item = validateFrame(
        frame,
        `$.frames[${index}]`,
        context,
        frameIds,
        qualifiedNames,
        instructionIds,
      );
      if (item) frameRecords.push(item);
    });
  }
  if (entry) {
    entry.forEach((instruction, index) =>
      validateInstruction(
        instruction,
        `$.entry[${index}]`,
        context,
        instructionIds,
      ),
    );
  }
  validateFrameGraph(frameRecords, frameIds, context);
  validateRootPermissions(root, context);

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, issues: [], ir: value as IRProgram };
}

interface ValidationContext {
  issues: IRValidationIssue[];
  nodes: number;
}

function validateFrame(
  value: unknown,
  path: string,
  context: ValidationContext,
  frameIds: Set<string>,
  qualifiedNames: Set<string>,
  instructionIds: Set<string>,
): Record<string, unknown> | null {
  const frame = record(value, path, context);
  if (!frame) return null;
  exactKeys(
    frame,
    [
      "id",
      "kind",
      "name",
      "qualifiedName",
      "parentId",
      "parameters",
      "contract",
      "requirements",
      "uses",
      "sandbox",
      "budgets",
      "instructions",
      "sourceSpan",
    ],
    path,
    context,
  );
  const id = text(frame.id, `${path}.id`, context);
  const qualifiedName = text(frame.qualifiedName, `${path}.qualifiedName`, context);
  text(frame.name, `${path}.name`, context);
  if (typeof frame.kind !== "string" || !frameKinds.has(frame.kind)) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown frame kind.", `${path}.kind`);
  }
  if (frame.parentId !== null) text(frame.parentId, `${path}.parentId`, context);
  stringArray(frame.parameters, `${path}.parameters`, context, true);
  span(frame.sourceSpan, `${path}.sourceSpan`, context);
  if (frame.sandbox !== null) text(frame.sandbox, `${path}.sandbox`, context);
  if (id) unique(id, frameIds, `${path}.id`, "frame id", context);
  if (qualifiedName) {
    unique(qualifiedName, qualifiedNames, `${path}.qualifiedName`, "frame name", context);
  }

  validateContract(frame.contract, `${path}.contract`, context);
  const requirements = list(frame.requirements, `${path}.requirements`, context);
  requirements?.forEach((requirement, index) =>
    validateRequirement(requirement, `${path}.requirements[${index}]`, context),
  );
  const uses = list(frame.uses, `${path}.uses`, context);
  uses?.forEach((use, index) => validateUse(use, `${path}.uses[${index}]`, context));

  const budgets = record(frame.budgets, `${path}.budgets`, context);
  if (budgets) {
    for (const [resource, limit] of Object.entries(budgets)) {
      safeKey(resource, `${path}.budgets`, context);
      validateValue(limit, `${path}.budgets.${resource}`, context, 0);
    }
  }
  const instructions = list(
    frame.instructions,
    `${path}.instructions`,
    context,
    MAX_INSTRUCTIONS,
  );
  instructions?.forEach((instruction, index) =>
    validateInstruction(
      instruction,
      `${path}.instructions[${index}]`,
      context,
      instructionIds,
    ),
  );
  validateFrameMirrors(frame, path, context);
  return frame;
}

function validateContract(value: unknown, path: string, context: ValidationContext): void {
  const contract = record(value, path, context);
  if (!contract) return;
  exactKeys(contract, ["inputs", "output", "failure"], path, context);
  const inputs = list(contract.inputs, `${path}.inputs`, context);
  const names = new Set<string>();
  inputs?.forEach((value_, index) => {
    const inputPath = `${path}.inputs[${index}]`;
    const input = record(value_, inputPath, context);
    if (!input) return;
    exactKeys(input, ["name", "type", "source", "span"], inputPath, context);
    const name = text(input.name, `${inputPath}.name`, context);
    if (name) unique(name, names, `${inputPath}.name`, "input name", context);
    if (input.type !== null) validateType(input.type, `${inputPath}.type`, context, 0);
    if (input.source !== null) validateValue(input.source, `${inputPath}.source`, context, 0);
    span(input.span, `${inputPath}.span`, context);
  });
  if (contract.output !== null) validateType(contract.output, `${path}.output`, context, 0);
  if (contract.failure !== null) validateType(contract.failure, `${path}.failure`, context, 0);
}

function validateType(
  value: unknown,
  path: string,
  context: ValidationContext,
  depth: number,
): void {
  if (depth > MAX_DEPTH) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Type nesting is too deep.", path);
    return;
  }
  const type = record(value, path, context);
  if (!type || typeof type.kind !== "string") return;
  switch (type.kind) {
    case "name":
      exactKeys(type, ["kind", "path"], path, context);
      stringArray(type.path, `${path}.path`, context, false);
      break;
    case "apply": {
      exactKeys(type, ["kind", "base", "arguments"], path, context);
      validateType(type.base, `${path}.base`, context, depth + 1);
      const arguments_ = list(type.arguments, `${path}.arguments`, context);
      arguments_?.forEach((entry, index) =>
        validateType(entry, `${path}.arguments[${index}]`, context, depth + 1),
      );
      break;
    }
    case "union": {
      exactKeys(type, ["kind", "options"], path, context);
      const options = list(type.options, `${path}.options`, context);
      options?.forEach((entry, index) =>
        validateType(entry, `${path}.options[${index}]`, context, depth + 1),
      );
      break;
    }
    case "optional":
      exactKeys(type, ["kind", "value"], path, context);
      validateType(type.value, `${path}.value`, context, depth + 1);
      break;
    case "any":
      exactKeys(type, ["kind"], path, context);
      break;
    default:
      issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown IR type kind.", `${path}.kind`);
  }
}

function validateValue(
  value: unknown,
  path: string,
  context: ValidationContext,
  depth: number,
): void {
  if (depth > MAX_DEPTH) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Value nesting is too deep.", path);
    return;
  }
  const item = record(value, path, context);
  if (!item || typeof item.kind !== "string") return;
  switch (item.kind) {
    case "literal":
      exactKeys(item, ["kind", "value", "unit"], path, context, ["unit"]);
      if (
        item.value !== null &&
        typeof item.value !== "boolean" &&
        typeof item.value !== "number" &&
        typeof item.value !== "string"
      ) {
        issue(context, "E_CAPSULE_IR_SCHEMA", "Invalid literal value.", `${path}.value`);
      }
      if (typeof item.value === "number" && !Number.isFinite(item.value)) {
        issue(context, "E_CAPSULE_IR_SCHEMA", "Literal number must be finite.", `${path}.value`);
      }
      if (item.unit !== undefined) text(item.unit, `${path}.unit`, context);
      break;
    case "reference":
      exactKeys(item, ["kind", "path"], path, context);
      stringArray(item.path, `${path}.path`, context, false);
      break;
    case "list": {
      exactKeys(item, ["kind", "items"], path, context);
      const items = list(item.items, `${path}.items`, context);
      items?.forEach((entry, index) =>
        validateValue(entry, `${path}.items[${index}]`, context, depth + 1),
      );
      break;
    }
    case "record": {
      exactKeys(item, ["kind", "entries"], path, context);
      const entries = record(item.entries, `${path}.entries`, context);
      if (entries) {
        for (const [key, entry] of Object.entries(entries)) {
          safeKey(key, `${path}.entries`, context);
          validateValue(entry, `${path}.entries.${key}`, context, depth + 1);
        }
      }
      break;
    }
    case "call": {
      exactKeys(item, ["kind", "verb", "target", "arguments", "span"], path, context);
      text(item.verb, `${path}.verb`, context);
      text(item.target, `${path}.target`, context);
      span(item.span, `${path}.span`, context);
      const arguments_ = record(item.arguments, `${path}.arguments`, context);
      if (arguments_) {
        for (const [key, entry] of Object.entries(arguments_)) {
          safeKey(key, `${path}.arguments`, context);
          validateValue(entry, `${path}.arguments.${key}`, context, depth + 1);
        }
      }
      break;
    }
    case "missing":
      exactKeys(item, ["kind"], path, context);
      break;
    default:
      issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown IR value kind.", `${path}.kind`);
  }
}

function validateRequirement(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  const requirement = record(value, path, context);
  if (!requirement) return;
  exactKeys(requirement, ["kind", "target", "span"], path, context);
  if (typeof requirement.kind !== "string" || !requirementKinds.has(requirement.kind)) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown requirement kind.", `${path}.kind`);
  }
  text(requirement.target, `${path}.target`, context);
  span(requirement.span, `${path}.span`, context);
}

function validateUse(value: unknown, path: string, context: ValidationContext): void {
  const use = record(value, path, context);
  if (!use) return;
  exactKeys(use, ["target", "alias", "span"], path, context);
  text(use.target, `${path}.target`, context);
  if (use.alias !== null) text(use.alias, `${path}.alias`, context);
  span(use.span, `${path}.span`, context);
}

function validateInstruction(
  value: unknown,
  path: string,
  context: ValidationContext,
  instructionIds: Set<string>,
): void {
  const instruction = record(value, path, context);
  if (!instruction) return;
  const id = text(instruction.id, `${path}.id`, context);
  if (id) unique(id, instructionIds, `${path}.id`, "instruction id", context);
  span(instruction.span, `${path}.span`, context);
  if (typeof instruction.op !== "string" || !instructionOps.has(instruction.op)) {
    issue(context, "E_CAPSULE_UNKNOWN_OP", "Unknown IR instruction operation.", `${path}.op`);
    return;
  }
  switch (instruction.op) {
    case "take":
      exactKeys(instruction, ["op", "id", "span", "name", "source"], path, context);
      text(instruction.name, `${path}.name`, context);
      if (instruction.source !== null) {
        validateValue(instruction.source, `${path}.source`, context, 0);
      }
      break;
    case "give":
    case "emit":
    case "yield":
    case "instruction":
      exactKeys(instruction, ["op", "id", "span", "value"], path, context);
      validateValue(instruction.value, `${path}.value`, context, 0);
      break;
    case "let":
      exactKeys(instruction, ["op", "id", "span", "name", "value"], path, context);
      text(instruction.name, `${path}.name`, context);
      validateValue(instruction.value, `${path}.value`, context, 0);
      break;
    case "attach":
      exactKeys(instruction, ["op", "id", "span", "value", "role"], path, context);
      text(instruction.role, `${path}.role`, context);
      validateValue(instruction.value, `${path}.value`, context, 0);
      break;
    case "grant":
      exactKeys(
        instruction,
        ["op", "id", "span", "capabilities", "target"],
        path,
        context,
      );
      stringArray(instruction.capabilities, `${path}.capabilities`, context, true);
      if (instruction.target !== null) text(instruction.target, `${path}.target`, context);
      break;
    case "within":
      exactKeys(instruction, ["op", "id", "span", "sandbox", "limit"], path, context);
      if (instruction.sandbox !== null) {
        text(instruction.sandbox, `${path}.sandbox`, context);
      }
      validateValue(instruction.limit, `${path}.limit`, context, 0);
      break;
    case "budget":
      exactKeys(instruction, ["op", "id", "span", "resource", "limit"], path, context);
      text(instruction.resource, `${path}.resource`, context);
      validateValue(instruction.limit, `${path}.limit`, context, 0);
      break;
    case "invoke":
      exactKeys(
        instruction,
        ["op", "id", "span", "mode", "target", "arguments", "binding"],
        path,
        context,
      );
      if (instruction.mode !== "invoke" && instruction.mode !== "call") {
        issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown invoke mode.", `${path}.mode`);
      }
      text(instruction.target, `${path}.target`, context);
      if (instruction.binding !== null) text(instruction.binding, `${path}.binding`, context);
      validateValues(instruction.arguments, `${path}.arguments`, context);
      break;
    case "launch":
      exactKeys(
        instruction,
        ["op", "id", "span", "target", "arguments", "binding"],
        path,
        context,
      );
      text(instruction.target, `${path}.target`, context);
      if (instruction.binding !== null) text(instruction.binding, `${path}.binding`, context);
      validateValues(instruction.arguments, `${path}.arguments`, context);
      break;
    case "weave": {
      exactKeys(
        instruction,
        ["op", "id", "span", "branches", "binding", "settle"],
        path,
        context,
      );
      if (instruction.binding !== null) text(instruction.binding, `${path}.binding`, context);
      if (!new Set(["all", "all_ok", "first_ok"]).has(String(instruction.settle))) {
        issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown weave settle mode.", `${path}.settle`);
      }
      const branches = list(instruction.branches, `${path}.branches`, context);
      branches?.forEach((branchValue, index) => {
        const branchPath = `${path}.branches[${index}]`;
        const branch = record(branchValue, branchPath, context);
        if (!branch) return;
        exactKeys(branch, ["name", "target", "arguments"], branchPath, context);
        text(branch.name, `${branchPath}.name`, context);
        text(branch.target, `${branchPath}.target`, context);
        validateValues(branch.arguments, `${branchPath}.arguments`, context);
      });
      break;
    }
    case "need":
      exactKeys(
        instruction,
        ["op", "id", "span", "requirement", "targets"],
        path,
        context,
      );
      if (
        typeof instruction.requirement !== "string" ||
        !requirementKinds.has(instruction.requirement)
      ) {
        issue(context, "E_CAPSULE_IR_SCHEMA", "Unknown requirement kind.", `${path}.requirement`);
      }
      stringArray(instruction.targets, `${path}.targets`, context, true);
      break;
    case "use":
      exactKeys(instruction, ["op", "id", "span", "target", "alias"], path, context);
      text(instruction.target, `${path}.target`, context);
      if (instruction.alias !== null) text(instruction.alias, `${path}.alias`, context);
      break;
    case "directive":
      exactKeys(instruction, ["op", "id", "span", "verb", "arguments"], path, context);
      text(instruction.verb, `${path}.verb`, context);
      validateValues(instruction.arguments, `${path}.arguments`, context);
      break;
  }
}

function validateValues(value: unknown, path: string, context: ValidationContext): void {
  const values = list(value, path, context);
  values?.forEach((entry, index) => validateValue(entry, `${path}[${index}]`, context, 0));
}

function validateFrameMirrors(
  frame: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  if (!Array.isArray(frame.instructions)) return;
  const required = frame.instructions.flatMap((instruction) => {
    const item = instruction as Record<string, unknown>;
    if (item.op !== "need" || !Array.isArray(item.targets)) return [];
    return item.targets.map((target) => `${String(item.requirement)}\0${String(target)}`);
  });
  const mirrored = Array.isArray(frame.requirements)
    ? frame.requirements.map((requirement) => {
        const item = requirement as Record<string, unknown>;
        return `${String(item.kind)}\0${String(item.target)}`;
      })
    : [];
  if (canonicalJson(required) !== canonicalJson(mirrored)) {
    issue(
      context,
      "E_CAPSULE_IR_INVARIANT",
      "Frame requirements do not match need instructions.",
      `${path}.requirements`,
    );
  }
  const used = frame.instructions
    .filter((instruction) => (instruction as Record<string, unknown>).op === "use")
    .map((instruction) => {
      const item = instruction as Record<string, unknown>;
      return [item.target, item.alias];
    });
  const mirroredUses = Array.isArray(frame.uses)
    ? frame.uses.map((use) => {
        const item = use as Record<string, unknown>;
        return [item.target, item.alias];
      })
    : [];
  if (canonicalJson(used) !== canonicalJson(mirroredUses)) {
    issue(
      context,
      "E_CAPSULE_IR_INVARIANT",
      "Frame uses do not match use instructions.",
      `${path}.uses`,
    );
  }
}

function validateFrameGraph(
  frames: Record<string, unknown>[],
  ids: Set<string>,
  context: ValidationContext,
): void {
  const parents = new Map<string, string | null>();
  for (const frame of frames) {
    if (typeof frame.id !== "string") continue;
    const parent = typeof frame.parentId === "string" ? frame.parentId : null;
    parents.set(frame.id, parent);
    if (parent && !ids.has(parent)) {
      issue(
        context,
        "E_CAPSULE_IR_INVARIANT",
        `Parent frame ${parent} does not exist.`,
        `$.frames.${frame.id}.parentId`,
      );
    }
  }
  for (const id of parents.keys()) {
    const seen = new Set<string>();
    let current: string | null | undefined = id;
    while (current) {
      if (seen.has(current)) {
        issue(
          context,
          "E_CAPSULE_IR_INVARIANT",
          `Frame parent cycle includes ${current}.`,
          "$.frames",
        );
        break;
      }
      seen.add(current);
      current = parents.get(current);
    }
  }
}

function validateRootPermissions(
  root: Record<string, unknown>,
  context: ValidationContext,
): void {
  if (!Array.isArray(root.entry) || !Array.isArray(root.permissions)) return;
  const granted = new Set<string>();
  for (const instruction of root.entry) {
    const item = instruction as Record<string, unknown>;
    if (item.op !== "grant" || !Array.isArray(item.capabilities)) continue;
    for (const capability of item.capabilities) {
      if (typeof capability === "string") granted.add(capability);
    }
  }
  const expected = [...granted].sort();
  if (canonicalJson(expected) !== canonicalJson(root.permissions)) {
    issue(
      context,
      "E_CAPSULE_IR_INVARIANT",
      "Requested permissions do not match root grant instructions.",
      "$.permissions",
    );
  }
}

function scan(
  value: unknown,
  path: string,
  depth: number,
  context: ValidationContext,
): void {
  context.nodes += 1;
  if (context.nodes > MAX_NODES) {
    if (!context.issues.some((item) => item.code === "E_CAPSULE_IR_LIMIT")) {
      issue(context, "E_CAPSULE_IR_LIMIT", "IR contains too many nodes.", path);
    }
    return;
  }
  if (depth > MAX_DEPTH) {
    issue(context, "E_CAPSULE_IR_LIMIT", "IR nesting is too deep.", path);
    return;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "IR numbers must be finite.", path);
  }
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    issue(context, "E_CAPSULE_IR_LIMIT", "IR string is too large.", path);
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION_ITEMS) {
      issue(context, "E_CAPSULE_IR_LIMIT", "IR collection is too large.", path);
      return;
    }
    value.forEach((entry, index) => scan(entry, `${path}[${index}]`, depth + 1, context));
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      safeKey(key, path, context);
      scan(entry, `${path}.${key}`, depth + 1, context);
    }
  }
}

function record(
  value: unknown,
  path: string,
  context: ValidationContext,
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Expected an object.", path);
    return null;
  }
  return value as Record<string, unknown>;
}

function list(
  value: unknown,
  path: string,
  context: ValidationContext,
  maximum = MAX_COLLECTION_ITEMS,
): unknown[] | null {
  if (!Array.isArray(value)) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Expected an array.", path);
    return null;
  }
  if (value.length > maximum) {
    issue(context, "E_CAPSULE_IR_LIMIT", `Array exceeds ${maximum} items.`, path);
    return null;
  }
  return value;
}

function text(value: unknown, path: string, context: ValidationContext): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_STRING_LENGTH) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Expected a non-empty string.", path);
    return null;
  }
  return value;
}

function stringArray(
  value: unknown,
  path: string,
  context: ValidationContext,
  allowEmpty: boolean,
): void {
  const items = list(value, path, context);
  if (!items) return;
  if (!allowEmpty && items.length === 0) {
    issue(context, "E_CAPSULE_IR_SCHEMA", "Array must not be empty.", path);
  }
  const names = new Set<string>();
  items.forEach((entry, index) => {
    const item = text(entry, `${path}[${index}]`, context);
    if (item) unique(item, names, `${path}[${index}]`, "value", context);
  });
}

function span(value: unknown, path: string, context: ValidationContext): void {
  const sourceSpan = record(value, path, context);
  if (!sourceSpan) return;
  exactKeys(sourceSpan, ["start", "end"], path, context);
  for (const edge of ["start", "end"] as const) {
    const position = record(sourceSpan[edge], `${path}.${edge}`, context);
    if (!position) continue;
    exactKeys(position, ["offset", "line", "column"], `${path}.${edge}`, context);
    for (const field of ["offset", "line", "column"] as const) {
      const number = position[field];
      const minimum = field === "offset" ? 0 : 1;
      if (!Number.isSafeInteger(number) || (number as number) < minimum) {
        issue(
          context,
          "E_CAPSULE_IR_SCHEMA",
          `${field} must be a safe integer >= ${minimum}.`,
          `${path}.${edge}.${field}`,
        );
      }
    }
  }
}

function exactKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  context: ValidationContext,
  optional: readonly string[] = [],
): void {
  const allowedSet = new Set(allowed);
  const optionalSet = new Set(optional);
  for (const key of Object.keys(object)) {
    if (!allowedSet.has(key)) {
      issue(context, "E_CAPSULE_IR_SCHEMA", `Unknown field ${key}.`, `${path}.${key}`);
    }
  }
  for (const key of allowed) {
    if (!optionalSet.has(key) && !Object.hasOwn(object, key)) {
      issue(context, "E_CAPSULE_IR_SCHEMA", `Missing field ${key}.`, `${path}.${key}`);
    }
  }
}

function unique(
  value: string,
  values: Set<string>,
  path: string,
  label: string,
  context: ValidationContext,
): void {
  if (values.has(value)) {
    issue(context, "E_CAPSULE_IR_INVARIANT", `Duplicate ${label} ${value}.`, path);
  }
  values.add(value);
}

function safeKey(key: string, path: string, context: ValidationContext): void {
  if (key === "__proto__" || key === "prototype" || key === "constructor") {
    issue(context, "E_CAPSULE_IR_SCHEMA", `Unsafe key ${key}.`, path);
  }
}

function issue(
  context: ValidationContext,
  code: string,
  message: string,
  path: string,
): void {
  if (context.issues.length < 100) context.issues.push({ code, message, path });
}

