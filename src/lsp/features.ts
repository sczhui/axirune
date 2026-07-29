import {
  BUILTIN_NAMES,
  BUILTIN_REGISTRY,
  compileSource,
  formatSource,
  KEYWORDS,
  parseSource,
  type Diagnostic,
  type Frame,
  type Program,
  type SourceSpan,
  type Token,
  type BuiltinParameter,
  type BuiltinSignature,
} from "../language/index.js";
import {
  fullDocumentRange,
  positionToOffset,
  type TextDocument,
} from "./documents.js";
import type {
  DocumentSymbol,
  Location,
  LspDiagnostic,
  Position,
  Range,
  TextEdit,
} from "./types.js";

const COMPLETION_ITEM_KIND = {
  text: 1,
  method: 2,
  function: 3,
  variable: 6,
  class: 7,
  module: 9,
  keyword: 14,
  snippet: 15,
} as const;

const SYMBOL_KIND = {
  file: 1,
  module: 2,
  namespace: 3,
  class: 5,
  method: 6,
  function: 12,
  variable: 13,
  object: 19,
} as const;

const KEYWORD_HELP: Readonly<Record<string, string>> = {
  space: "Declares the stable namespace for every symbol in this file.",
  task: "A deterministic callable frame with typed inputs and output.",
  tool: "A typed boundary to a host-provided effect adapter.",
  prompt: "A typed instruction template whose attached data keeps its trust label.",
  memory: "A bounded, explicit event journal.",
  agent: "A bounded inference loop with an explicit context and capability budget.",
  workflow: "A durable graph of named stages, recovery edges, and compensation.",
  capability: "Names an effect and narrows the resource on which it may operate.",
  sandbox: "Constrains process, filesystem, network, time, and runtime fuel.",
  context: "Compiles selected evidence into a bounded view for an agent.",
  permission: "Declares when an effect requires a host or human decision.",
  take: "Declares a named input.",
  give: "Declares or returns the frame output.",
  need: "Adds an explicit authority or context requirement.",
  grant: "Transfers a narrowed capability lease.",
  within: "Selects the sandbox or scope for subsequent effects.",
  budget: "Places a numeric bound on a resource.",
  let: "Binds an immutable value.",
  emit: "Appends a visible value to the semantic trace.",
  yield: "Completes a frame with a value.",
  invoke: "Performs a checked call after schema, trust, capability, sandbox, and permission checks.",
  launch: "Starts a root task or scoped child.",
  weave: "Runs named branches concurrently inside one structured scope.",
  fail: "Completes with a typed fault.",
  mcp: "Declares a Model Context Protocol boundary as typed tools and resources.",
};

const FRAME_SNIPPETS = [
  {
    label: "task frame",
    insertText: "task ${1:name}\n  give ${2:Text}\n  yield ${3:nothing}\n/task",
    detail: "Bounded deterministic task",
  },
  {
    label: "tool frame",
    insertText:
      "tool ${1:name}\n  take ${2:input} ${3:Text}\n  give ${4:Text}\n  need capability ${5:capability}\n/tool",
    detail: "Typed effect boundary",
  },
  {
    label: "agent frame",
    insertText:
      "agent ${1:name}\n  need context ${2:context}\n  budget tokens ${3:2000}\n/agent",
    detail: "Bounded inference loop",
  },
  {
    label: "workflow frame",
    insertText: "workflow ${1:name}\n  give ${2:Text}\n/workflow",
    detail: "Durable workflow graph",
  },
] as const;

interface CallableHelp {
  name: string;
  parameters: readonly BuiltinParameter[];
  returns: string;
  pure: boolean;
  capability?: string;
  summary?: string;
}

const HOST_CALLABLES: readonly CallableHelp[] = [
  hostCallable(
    "File.readText",
    [["path", "Text"]],
    "Text",
    "host.fs.read",
    "Read one UTF-8 text file below an explicitly authorized root.",
  ),
  hostCallable(
    "File.writeText",
    [["path", "Text"], ["text", "Text"]],
    "Record",
    "host.fs.write",
    "Write one UTF-8 text file below an explicitly authorized root.",
  ),
  hostCallable(
    "File.exists",
    [["path", "Text"]],
    "Bool",
    "host.fs.read",
    "Check whether a path exists without escaping an authorized read root.",
  ),
  hostCallable(
    "File.list",
    [["path", "Text"]],
    "List",
    "host.fs.read",
    "List names in an authorized directory in stable sorted order.",
  ),
  hostCallable(
    "Http.get",
    [["url", "Text"]],
    "Record",
    "host.net.fetch",
    "Perform an HTTP GET to an exact authorized host; every redirect is rechecked.",
  ),
];

const CALLABLES: readonly CallableHelp[] = [
  ...BUILTIN_NAMES.map((name) => BUILTIN_REGISTRY[name]!).filter(Boolean),
  ...HOST_CALLABLES,
];

const CALLABLE_BY_NAME = new Map(CALLABLES.map((signature) => [signature.name, signature]));

export function diagnosticsFor(document: TextDocument): LspDiagnostic[] {
  return compileSource(document.text).diagnostics.map(toLspDiagnostic);
}

export function completionsFor(document: TextDocument, _position: Position): unknown {
  const parsed = parseSource(document.text);
  const declarationItems = collectFrames(parsed.program).map((frame) => ({
    label: frame.name,
    kind: frameCompletionKind(frame.frameKind),
    detail: `${frame.frameKind} ${frame.name}`,
    documentation: `Declared in this Nexilume space as a ${frame.frameKind} frame.`,
    sortText: `1-${frame.name}`,
  }));
  const keywordItems = KEYWORDS.map((keyword) => ({
    label: keyword,
    kind: COMPLETION_ITEM_KIND.keyword,
    detail: "Nexilume keyword",
    documentation: KEYWORD_HELP[keyword] ?? "Nexilume language keyword.",
    sortText: `2-${keyword}`,
  }));
  const snippetItems = FRAME_SNIPPETS.map((snippet) => ({
    ...snippet,
    kind: COMPLETION_ITEM_KIND.snippet,
    insertTextFormat: 2,
    sortText: `0-${snippet.label}`,
  }));
  const callableItems = CALLABLES.map((signature) => ({
    label: signature.name,
    kind: COMPLETION_ITEM_KIND.function,
    detail: formatCallableSignature(signature),
    documentation: callableDocumentation(signature),
    insertText: callableSnippet(signature),
    insertTextFormat: 2,
    sortText: `0b-${signature.name}`,
  }));
  return {
    isIncomplete: false,
    items: uniqueByLabel([
      ...snippetItems,
      ...callableItems,
      ...declarationItems,
      ...keywordItems,
    ]),
  };
}

export function hoverFor(
  document: TextDocument,
  position: Position,
): { contents: { kind: "markdown"; value: string }; range: Range } | null {
  const parsed = parseSource(document.text);
  const offset = positionToOffset(document.text, position);
  const token = tokenAtOffset(parsed.tokens, offset);
  if (!token || token.kind === "eof" || token.kind === "newline") return null;

  const qualified = qualifiedNameAtOffset(parsed.tokens, offset);
  const callable = qualified ? CALLABLE_BY_NAME.get(qualified.name) : undefined;
  if (callable && qualified) {
    return {
      contents: {
        kind: "markdown",
        value: callableDocumentation(callable),
      },
      range: spanToRange(qualified.span),
    };
  }

  const help = KEYWORD_HELP[token.lexeme];
  if (help) {
    return {
      contents: {
        kind: "markdown",
        value: `\`${token.lexeme}\` — Nexilume keyword\n\n${help}`,
      },
      range: spanToRange(token.span),
    };
  }

  const frame = collectFrames(parsed.program).find(
    (candidate) => candidate.name === token.lexeme,
  );
  if (frame) {
    const qualified = parsed.program.space
      ? `${parsed.program.space.name}.${frame.name}`
      : frame.name;
    return {
      contents: {
        kind: "markdown",
        value: `\`${qualified}\`\n\n**${frame.frameKind}** · ${frame.body.length} body item${frame.body.length === 1 ? "" : "s"}`,
      },
      range: spanToRange(token.span),
    };
  }
  return null;
}

export function symbolsFor(document: TextDocument): DocumentSymbol[] {
  const { program } = parseSource(document.text);
  const symbols = program.items
    .filter((item): item is Frame => item.kind === "Frame")
    .map(frameToSymbol);
  if (!program.space) return symbols;
  return [
    {
      name: program.space.name,
      detail: "Nexilume space",
      kind: SYMBOL_KIND.namespace,
      range: spanToRange(program.span),
      selectionRange: spanToRange(program.space.span),
      children: symbols,
    },
  ];
}

export function formattingFor(document: TextDocument): TextEdit[] {
  const result = formatSource(document.text);
  if (result.code === document.text) return [];
  return [{ range: fullDocumentRange(document.text), newText: result.code }];
}

export function definitionFor(
  document: TextDocument,
  position: Position,
): Location | null {
  const parsed = parseSource(document.text);
  const token = tokenAtOffset(parsed.tokens, positionToOffset(document.text, position));
  if (!token) return null;
  const frame = collectFrames(parsed.program).find(
    (candidate) => candidate.name === token.lexeme,
  );
  return frame ? { uri: document.uri, range: spanToRange(frame.headerSpan) } : null;
}

export function toLspDiagnostic(item: Diagnostic): LspDiagnostic {
  const severity: LspDiagnostic["severity"] =
    item.severity === "error" ? 1 : item.severity === "warning" ? 2 : 3;
  return {
    range: spanToRange(item.span),
    severity,
    code: item.code,
    source: "Nexilume",
    message: item.message,
    data: item.hint
      ? { phase: item.phase, hint: item.hint }
      : { phase: item.phase },
  };
}

export function spanToRange(span: SourceSpan): Range {
  return {
    start: {
      line: Math.max(0, span.start.line - 1),
      character: Math.max(0, span.start.column - 1),
    },
    end: {
      line: Math.max(0, span.end.line - 1),
      character: Math.max(0, span.end.column - 1),
    },
  };
}

function frameToSymbol(frame: Frame): DocumentSymbol {
  const children = frame.body
    .filter((item): item is Frame => item.kind === "Frame")
    .map(frameToSymbol);
  return {
    name: frame.name,
    detail: frame.frameKind,
    kind: frameSymbolKind(frame.frameKind),
    range: spanToRange(frame.span),
    selectionRange: spanToRange(frame.headerSpan),
    ...(children.length > 0 ? { children } : {}),
  };
}

function collectFrames(program: Program): Frame[] {
  const frames: Frame[] = [];
  const visit = (frame: Frame): void => {
    frames.push(frame);
    for (const child of frame.body) {
      if (child.kind === "Frame") visit(child);
    }
  };
  for (const item of program.items) {
    if (item.kind === "Frame") visit(item);
  }
  return frames;
}

function tokenAtOffset(tokens: readonly Token[], offset: number): Token | undefined {
  return tokens.find(
    (token) =>
      token.span.start.offset <= offset &&
      (offset < token.span.end.offset ||
        (token.span.start.offset === token.span.end.offset && offset === token.span.start.offset)),
  );
}

function qualifiedNameAtOffset(
  tokens: readonly Token[],
  offset: number,
): { name: string; span: SourceSpan } | null {
  const index = tokens.findIndex(
    (token) => token.span.start.offset <= offset && offset <= token.span.end.offset,
  );
  if (index < 0) return null;
  let wordIndex = index;
  if (tokens[wordIndex]?.kind === "dot") {
    if (isNameToken(tokens[wordIndex - 1])) wordIndex -= 1;
    else if (isNameToken(tokens[wordIndex + 1])) wordIndex += 1;
  }
  if (!isNameToken(tokens[wordIndex])) return null;

  let start = wordIndex;
  let end = wordIndex;
  while (start >= 2 && tokens[start - 1]?.kind === "dot" && isNameToken(tokens[start - 2])) {
    start -= 2;
  }
  while (
    end + 2 < tokens.length &&
    tokens[end + 1]?.kind === "dot" &&
    isNameToken(tokens[end + 2])
  ) {
    end += 2;
  }
  const parts: string[] = [];
  for (let cursor = start; cursor <= end; cursor += 2) {
    parts.push(tokens[cursor]!.lexeme);
  }
  return {
    name: parts.join("."),
    span: {
      start: tokens[start]!.span.start,
      end: tokens[end]!.span.end,
    },
  };
}

function isNameToken(token: Token | undefined): token is Token {
  return token?.kind === "identifier" || token?.kind === "keyword";
}

function frameCompletionKind(kind: Frame["frameKind"]): number {
  if (kind === "task" || kind === "workflow") return COMPLETION_ITEM_KIND.function;
  if (kind === "tool" || kind === "mcp") return COMPLETION_ITEM_KIND.method;
  if (kind === "agent") return COMPLETION_ITEM_KIND.class;
  if (kind === "memory" || kind === "context") return COMPLETION_ITEM_KIND.variable;
  return COMPLETION_ITEM_KIND.module;
}

function frameSymbolKind(kind: Frame["frameKind"]): number {
  if (kind === "task" || kind === "workflow") return SYMBOL_KIND.function;
  if (kind === "tool" || kind === "mcp") return SYMBOL_KIND.method;
  if (kind === "agent") return SYMBOL_KIND.class;
  if (kind === "memory" || kind === "context") return SYMBOL_KIND.variable;
  if (kind === "shape") return SYMBOL_KIND.object;
  return SYMBOL_KIND.module;
}

function uniqueByLabel<T extends { label: string }>(items: readonly T[]): T[] {
  const labels = new Set<string>();
  return items.filter((item) => {
    if (labels.has(item.label)) return false;
    labels.add(item.label);
    return true;
  });
}

function hostCallable(
  name: string,
  parameters: readonly (readonly [string, BuiltinParameter["type"]])[],
  returns: string,
  capability: string,
  summary: string,
): CallableHelp {
  return {
    name,
    parameters: parameters.map(([parameterName, type]) => ({
      name: parameterName,
      type,
      required: true,
    })),
    returns,
    pure: false,
    capability,
    summary,
  };
}

function formatCallableSignature(signature: CallableHelp | BuiltinSignature): string {
  const parameters = signature.parameters
    .map(
      (parameter) =>
        `:${parameter.name}${parameter.required ? "" : "?"} ${parameter.type}${
          parameter.lazy ? " lazy" : ""
        }`,
    )
    .join(", ");
  return `${signature.name}(${parameters}) → ${signature.returns}`;
}

function callableSnippet(signature: CallableHelp): string {
  const arguments_ = signature.parameters.map((parameter, index) => {
    const placeholder = "${" + `${index + 1}:${parameter.name}` + "}";
    return `:${parameter.name} ${placeholder}`;
  });
  return [signature.name, ...arguments_].join(" ");
}

function callableDocumentation(signature: CallableHelp): string {
  const authority = signature.pure
    ? "**pure** · deterministic · no host authority"
    : `**host effect** · requires \`${signature.capability ?? "explicit authority"}\``;
  return [
    `\`${formatCallableSignature(signature)}\``,
    "",
    authority,
    ...(signature.summary ? ["", signature.summary] : []),
  ].join("\n");
}
