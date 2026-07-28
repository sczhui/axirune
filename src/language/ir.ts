import type { FrameKind, SourceSpan } from "./ast.js";
import { IR_VERSION } from "./metadata.js";

export type IRVersion = typeof IR_VERSION;

export interface IRProgram {
  version: IRVersion;
  space: string;
  edition: number;
  frames: IRFrame[];
  entry: IRInstruction[];
  permissions: string[];
  sourceSpan: SourceSpan;
}

export interface IRFrame {
  id: string;
  kind: FrameKind;
  name: string;
  qualifiedName: string;
  parentId: string | null;
  parameters: string[];
  contract: IRContract;
  requirements: IRRequirement[];
  uses: IRUse[];
  sandbox: string | null;
  budgets: Record<string, IRValue>;
  instructions: IRInstruction[];
  sourceSpan: SourceSpan;
}

export interface IRContract {
  inputs: IRInput[];
  output: IRType | null;
  failure: IRType | null;
}

export interface IRInput {
  name: string;
  type: IRType | null;
  source: IRValue | null;
  span: SourceSpan;
}

export type IRType =
  | { kind: "name"; path: string[] }
  | { kind: "apply"; base: IRType; arguments: IRType[] }
  | { kind: "union"; options: IRType[] }
  | { kind: "optional"; value: IRType }
  | { kind: "any" };

export type IRValue =
  | { kind: "literal"; value: null | boolean | number | string; unit?: string }
  | { kind: "reference"; path: string[] }
  | { kind: "list"; items: IRValue[] }
  | { kind: "record"; entries: Record<string, IRValue> }
  | { kind: "call"; verb: string; target: string; arguments: Record<string, IRValue> }
  | { kind: "missing" };

export interface IRRequirement {
  kind: "capability" | "context" | "permission" | "tool";
  target: string;
  span: SourceSpan;
}

export interface IRUse {
  target: string;
  alias: string | null;
  span: SourceSpan;
}

interface IRInstructionBase {
  id: string;
  span: SourceSpan;
}

export interface IRTakeInstruction extends IRInstructionBase {
  op: "take";
  name: string;
  source: IRValue | null;
}

export interface IRGiveInstruction extends IRInstructionBase {
  op: "give";
  value: IRValue;
}

export interface IRGrantInstruction extends IRInstructionBase {
  op: "grant";
  capabilities: string[];
  target: string | null;
}

export interface IRWithinInstruction extends IRInstructionBase {
  op: "within";
  sandbox: string | null;
  limit: IRValue;
}

export interface IRBudgetInstruction extends IRInstructionBase {
  op: "budget";
  resource: string;
  limit: IRValue;
}

export interface IRLetInstruction extends IRInstructionBase {
  op: "let";
  name: string;
  value: IRValue;
}

export interface IREmitInstruction extends IRInstructionBase {
  op: "emit";
  value: IRValue;
}

export interface IRYieldInstruction extends IRInstructionBase {
  op: "yield";
  value: IRValue;
}

export interface IRInvokeInstruction extends IRInstructionBase {
  op: "invoke";
  mode: "invoke" | "call";
  target: string;
  arguments: IRValue[];
  binding: string | null;
}

export interface IRLaunchInstruction extends IRInstructionBase {
  op: "launch";
  target: string;
  arguments: IRValue[];
  binding: string | null;
}

export interface IRWeaveBranch {
  name: string;
  target: string;
  arguments: IRValue[];
}

export interface IRWeaveInstruction extends IRInstructionBase {
  op: "weave";
  branches: IRWeaveBranch[];
  binding: string | null;
  settle: "all" | "all_ok" | "first_ok";
}

export interface IRNeedInstruction extends IRInstructionBase {
  op: "need";
  requirement: IRRequirement["kind"];
  targets: string[];
}

export interface IRUseInstruction extends IRInstructionBase {
  op: "use";
  target: string;
  alias: string | null;
}

export interface IRAttachInstruction extends IRInstructionBase {
  op: "attach";
  value: IRValue;
  role: string;
}

export interface IRDirectiveInstruction extends IRInstructionBase {
  op: "directive";
  verb: string;
  arguments: IRValue[];
}

export interface IRInstructionTextInstruction extends IRInstructionBase {
  op: "instruction";
  value: IRValue;
}

export type IRInstruction =
  | IRTakeInstruction
  | IRGiveInstruction
  | IRGrantInstruction
  | IRWithinInstruction
  | IRBudgetInstruction
  | IRLetInstruction
  | IREmitInstruction
  | IRYieldInstruction
  | IRInvokeInstruction
  | IRLaunchInstruction
  | IRWeaveInstruction
  | IRNeedInstruction
  | IRUseInstruction
  | IRAttachInstruction
  | IRDirectiveInstruction
  | IRInstructionTextInstruction;

