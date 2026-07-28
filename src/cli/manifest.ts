import type {
  IRFrame,
  IRInstruction,
  IRProgram,
  IRValue,
} from "../language/index.js";

export interface CapabilityManifest {
  schema: "nexilume-capability-manifest/1";
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

  return {
    schema: "nexilume-capability-manifest/1",
    space: ir.space,
    edition: ir.edition,
    capabilities: capabilityFrames.map((frame) => ({
      name: frame.qualifiedName,
      effects: directiveArguments(frame, "effect"),
      resources: directiveArguments(frame, "resource"),
      requiredBy: [...(requirements.get(frame.name) ?? new Set<string>())].sort(),
    })),
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
