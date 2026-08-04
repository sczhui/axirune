import type {
  IRFrame,
  IRInstruction,
  IRProgram,
  IRValue,
} from "./ir.js";
import { HOST_CAPABILITIES } from "./host-capabilities.js";

export interface CapabilityManifest {
  schema: "axirune-capability-manifest/1";
  space: string;
  edition: number;
  capabilities: {
    name: string;
    effects: unknown[];
    resources: unknown[];
    requiredBy: string[];
  }[];
  tools: {
    name: string;
    kind: "tool" | "mcp";
    capabilities: string[];
  }[];
  sandboxes: {
    name: string;
    policies: { name: string; arguments: IRValue[] }[];
  }[];
  /** Requested program authority. Deployments still decide effective grants. */
  permissions: string[];
}

export function capabilityManifestFromIR(ir: IRProgram): CapabilityManifest {
  const capabilityFrames = ir.frames.filter((frame) => frame.kind === "capability");
  const requirements = new Map<string, Set<string>>();
  for (const frame of ir.frames) {
    for (const requirement of frame.requirements) {
      if (requirement.kind !== "capability") continue;
      const consumers = requirements.get(requirement.target) ?? new Set<string>();
      consumers.add(frame.qualifiedName);
      requirements.set(requirement.target, consumers);
    }
  }
  const hostOperations = collectHostOperations(ir);
  for (const [capability, consumers] of hostOperations.consumers) {
    const existing = requirements.get(capability) ?? new Set<string>();
    for (const consumer of consumers) existing.add(consumer);
    requirements.set(capability, existing);
  }
  const declaredNames = new Set(capabilityFrames.map((frame) => frame.name));
  const hostCapabilities = [...hostOperations.operations]
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([capability]) => !declaredNames.has(capability))
    .map(([capability, operations]) => ({
      name: capability,
      effects: [...operations]
        .sort()
        .map((operation) => ({ kind: "host-tool", operation })),
      resources: [],
      requiredBy: [...(requirements.get(capability) ?? new Set<string>())].sort(),
    }));

  return {
    schema: "axirune-capability-manifest/1",
    space: ir.space,
    edition: ir.edition,
    capabilities: [
      ...capabilityFrames.map((frame) => ({
        name: frame.qualifiedName,
        effects: directiveArguments(frame, "effect"),
        resources: directiveArguments(frame, "resource"),
        requiredBy: [...(requirements.get(frame.name) ?? new Set<string>())].sort(),
      })),
      ...hostCapabilities,
    ],
    tools: ir.frames
      .filter(
        (frame): frame is IRFrame & { kind: "tool" | "mcp" } =>
          frame.kind === "tool" || frame.kind === "mcp",
      )
      .map((frame) => ({
        name: frame.qualifiedName,
        kind: frame.kind,
        capabilities: frame.requirements
          .filter((item) => item.kind === "capability")
          .map((item) => item.target)
          .sort(),
      })),
    sandboxes: ir.frames
      .filter((frame) => frame.kind === "sandbox")
      .map((frame) => ({
        name: frame.qualifiedName,
        policies: frame.instructions
          .filter(isDirective)
          .map((instruction) => ({
            name: instruction.verb,
            arguments: instruction.arguments,
          })),
      })),
    permissions: [...ir.permissions].sort(),
  };
}

const HOST_TOOL_CAPABILITY: Readonly<Record<string, string>> = {
  "File.readText": HOST_CAPABILITIES.fileRead,
  "File.exists": HOST_CAPABILITIES.fileRead,
  "File.list": HOST_CAPABILITIES.fileRead,
  "File.writeText": HOST_CAPABILITIES.fileWrite,
  "Http.get": HOST_CAPABILITIES.networkFetch,
};

function collectHostOperations(ir: IRProgram): {
  operations: Map<string, Set<string>>;
  consumers: Map<string, Set<string>>;
} {
  const operations = new Map<string, Set<string>>();
  const consumers = new Map<string, Set<string>>();
  const record = (target: string, consumer: string): void => {
    const capability = HOST_TOOL_CAPABILITY[target];
    if (!capability) return;
    const names = operations.get(capability) ?? new Set<string>();
    names.add(target);
    operations.set(capability, names);
    const owners = consumers.get(capability) ?? new Set<string>();
    owners.add(consumer);
    consumers.set(capability, owners);
  };
  for (const frame of ir.frames) {
    for (const instruction of frame.instructions) {
      visitInstruction(instruction, frame.qualifiedName, record);
    }
  }
  for (const instruction of ir.entry) visitInstruction(instruction, "<entry>", record);
  return { operations, consumers };
}

function visitInstruction(
  instruction: IRInstruction,
  consumer: string,
  record: (target: string, consumer: string) => void,
): void {
  switch (instruction.op) {
    case "take":
      if (instruction.source) visitValue(instruction.source, consumer, record);
      break;
    case "give":
    case "let":
    case "emit":
    case "yield":
    case "attach":
    case "instruction":
      visitValue(instruction.value, consumer, record);
      break;
    case "within":
    case "budget":
      visitValue(instruction.limit, consumer, record);
      break;
    case "invoke":
    case "launch":
      record(instruction.target, consumer);
      instruction.arguments.forEach((value) => visitValue(value, consumer, record));
      break;
    case "weave":
      for (const branch of instruction.branches) {
        record(branch.target, consumer);
        branch.arguments.forEach((value) => visitValue(value, consumer, record));
      }
      break;
    case "directive":
      instruction.arguments.forEach((value) => visitValue(value, consumer, record));
      break;
    case "grant":
    case "need":
    case "use":
      break;
  }
}

function visitValue(
  value: IRValue,
  consumer: string,
  record: (target: string, consumer: string) => void,
): void {
  switch (value.kind) {
    case "call":
      record(value.target, consumer);
      Object.values(value.arguments).forEach((argument) =>
        visitValue(argument, consumer, record),
      );
      break;
    case "list":
      value.items.forEach((item) => visitValue(item, consumer, record));
      break;
    case "record":
      Object.values(value.entries).forEach((entry) =>
        visitValue(entry, consumer, record),
      );
      break;
    case "literal":
    case "reference":
    case "missing":
      break;
  }
}

function directiveArguments(frame: IRFrame, verb: string): IRValue[] {
  return frame.instructions
    .filter(isDirective)
    .filter((instruction) => instruction.verb === verb)
    .flatMap((instruction) => instruction.arguments);
}

function isDirective(
  instruction: IRInstruction,
): instruction is Extract<IRInstruction, { op: "directive" }> {
  return instruction.op === "directive";
}

