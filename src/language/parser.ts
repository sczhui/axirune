import {
  FRAME_KINDS,
  STATEMENT_VERBS,
  emptySpan,
  type BooleanLiteral,
  type BudgetStatement,
  type CallExpression,
  type DirectiveStatement,
  type EditionDeclaration,
  type EmitStatement,
  type Expression,
  type FailStatement,
  type Frame,
  type FrameBodyNode,
  type FrameKind,
  type GiveStatement,
  type GrantStatement,
  type GroupExpression,
  type InstructionStatement,
  type InvokeStatement,
  type LaunchStatement,
  type LetStatement,
  type ListExpression,
  type NeedStatement,
  type NamedArgument,
  type NothingLiteral,
  type NumberLiteral,
  type OptionalType,
  type Program,
  type RecordEntry,
  type RecordExpression,
  type ReferenceExpression,
  type SourceSpan,
  type SpaceDeclaration,
  type Statement,
  type StringLiteral,
  type AttachStatement,
  type TakeStatement,
  type TypeApplication,
  type TypeNode,
  type TypeReference,
  type UnionType,
  type UseStatement,
  type WeaveBranch,
  type WeaveStatement,
  type WithinStatement,
  type YieldStatement,
} from "./ast.js";
import { diagnostic, type Diagnostic } from "./diagnostics.js";
import { lexSource } from "./lexer.js";
import { SUPPORTED_EDITIONS } from "./metadata.js";
import { isWordToken, type Token } from "./tokens.js";

export interface ParseOptions {
  sourceName?: string;
}

export interface ParseResult {
  program: Program;
  tokens: Token[];
  diagnostics: Diagnostic[];
}

interface LogicalLine {
  tokens: Token[];
  span: SourceSpan;
  raw: string;
}

const frameKinds = new Set<string>(FRAME_KINDS);
const statementVerbs = new Set<string>(STATEMENT_VERBS);
const builtinTypes = new Set([
  "Any",
  "Bool",
  "Bytes",
  "Context",
  "Decimal",
  "Duration",
  "Error",
  "Int",
  "Json",
  "List",
  "Map",
  "Memory",
  "Nothing",
  "Number",
  "Observed",
  "Outcome",
  "Permission",
  "Record",
  "Result",
  "Secret",
  "Stream",
  "Task",
  "Text",
  "Time",
  "Url",
  "Verified",
]);

export function parseSource(source: string, _options: ParseOptions = {}): ParseResult {
  const lexed = lexSource(source);
  const diagnostics = [...lexed.diagnostics];
  const lines = toLogicalLines(source, lexed.tokens);
  const eof = lexed.tokens[lexed.tokens.length - 1]?.span ?? emptySpan();
  const items: Program["items"] = [];
  let space: SpaceDeclaration | null = null;
  let edition: EditionDeclaration | null = null;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]!;
    const first = line.tokens[0];
    if (!first) {
      lineIndex += 1;
      continue;
    }

    if (first.lexeme === "space") {
      const declaration = parseSpace(line, diagnostics);
      if (space) {
        diagnostics.push(
          diagnostic(
            "N2001",
            "error",
            "parse",
            "A file belongs to exactly one space.",
            line.span,
            `Keep \`space ${space.name}\` and remove the later declaration.`,
          ),
        );
      } else {
        space = declaration;
      }
      lineIndex += 1;
      continue;
    }

    if (first.lexeme === "edition") {
      const valueToken = line.tokens[1];
      const value = valueToken?.kind === "number" ? Number(valueToken.lexeme) : Number.NaN;
      if (
        !Number.isInteger(value) ||
        !SUPPORTED_EDITIONS.includes(value as (typeof SUPPORTED_EDITIONS)[number])
      ) {
        diagnostics.push(
          diagnostic(
            "N2045",
            "error",
            "parse",
            `Edition ${Number.isFinite(value) ? value : "?"} is not supported.`,
            line.span,
            "Use `edition 1` for compatibility or `edition 2` for the pure function kernel.",
          ),
        );
      } else if (edition) {
        diagnostics.push(
          diagnostic("N2046", "error", "parse", "edition may be declared only once.", line.span),
        );
      } else {
        edition = { kind: "EditionDeclaration", value, span: line.span };
      }
      lineIndex += 1;
      continue;
    }

    if (isFrameOpen(line)) {
      const parsed = parseFrame(lines, lineIndex, diagnostics);
      items.push(parsed.frame);
      lineIndex = parsed.nextLine;
      continue;
    }

    if (first.kind === "slash") {
      diagnostics.push(
        diagnostic(
          "N2002",
          "error",
          "parse",
          `Closing frame ${line.tokens[1]?.lexeme ?? ""} has no matching opening frame.`,
          line.span,
        ),
      );
      lineIndex += 1;
      continue;
    }

    const statement = parseStatementLine(line, diagnostics);
    if (statement) items.push(statement);
    lineIndex += 1;
  }

  const program: Program = {
    kind: "Program",
    space,
    edition,
    items,
    span: {
      start: { offset: 0, line: 1, column: 1 },
      end: eof.end,
    },
  };
  return { program, tokens: lexed.tokens, diagnostics };
}

function toLogicalLines(source: string, tokens: Token[]): LogicalLine[] {
  const lines: LogicalLine[] = [];
  let current: Token[] = [];
  let depth = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    const span = tokensSpan(current);
    lines.push({
      tokens: current,
      span,
      raw: source.slice(span.start.offset, span.end.offset),
    });
    current = [];
  };

  for (const token of tokens) {
    if (token.kind === "eof") {
      flush();
      continue;
    }
    if (token.kind === "newline") {
      if (depth === 0) flush();
      continue;
    }
    current.push(token);
    if (
      token.kind === "left-bracket" ||
      token.kind === "left-paren" ||
      token.kind === "less"
    ) {
      depth += 1;
    } else if (
      token.kind === "right-bracket" ||
      token.kind === "right-paren" ||
      token.kind === "greater"
    ) {
      depth = Math.max(0, depth - 1);
    }
  }
  return lines;
}

function parseSpace(line: LogicalLine, diagnostics: Diagnostic[]): SpaceDeclaration {
  const name = line.tokens[1];
  if (!isWordToken(name)) {
    diagnostics.push(
      diagnostic(
        "N2003",
        "error",
        "parse",
        "A space needs a stable name.",
        line.span,
        "For example: `space horizon`.",
      ),
    );
  }
  if (line.tokens.length > 2) {
    diagnostics.push(
      diagnostic(
        "N2004",
        "warning",
        "parse",
        "Extra words after the space name are ignored.",
        tokensSpan(line.tokens.slice(2)),
      ),
    );
  }
  return {
    kind: "SpaceDeclaration",
    name: isWordToken(name) ? name.lexeme : "anonymous",
    span: line.span,
  };
}

function isFrameOpen(line: LogicalLine): boolean {
  const first = line.tokens[0];
  if (!first || first.kind === "slash" || !frameKinds.has(first.lexeme)) return false;
  if (first.lexeme === "invoke" || first.lexeme === "launch") {
    return (
      line.tokens.length >= 3 &&
      ["task", "tool", "agent", "workflow"].includes(line.tokens[1]?.lexeme ?? "")
    );
  }
  if (first.lexeme === "weave") return line.tokens.length === 2;
  return true;
}

function parseFrame(
  lines: LogicalLine[],
  startLine: number,
  diagnostics: Diagnostic[],
): { frame: Frame; nextLine: number } {
  const header = lines[startLine]!;
  const kind = header.tokens[0]!.lexeme as FrameKind;
  const nameToken = header.tokens[1];
  let headerIndex = 2;
  const nameParts = isWordToken(nameToken) ? [nameToken.lexeme] : [];
  while (
    header.tokens[headerIndex]?.kind === "dot" &&
    isWordToken(header.tokens[headerIndex + 1])
  ) {
    nameParts.push(header.tokens[headerIndex + 1]!.lexeme);
    headerIndex += 2;
  }
  const name = nameParts.length > 0 ? nameParts.join(".") : `anonymous-${kind}`;
  if (!isWordToken(nameToken)) {
    diagnostics.push(
      diagnostic(
        "N2005",
        "error",
        "parse",
        `The ${kind} frame needs a name.`,
        header.span,
        `For example: \`${kind} main\`.`,
      ),
    );
  }
  const parameters = header.tokens
    .slice(headerIndex)
    .map((token) => token.value ?? token.lexeme);
  const body: FrameBodyNode[] = [];
  let closeSpan: SourceSpan | null = null;
  let lineIndex = startLine + 1;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]!;
    const first = line.tokens[0];

    if (first?.kind === "slash") {
      const closingKind = line.tokens[1]?.lexeme;
      if (closingKind === kind) {
        closeSpan = line.span;
        lineIndex += 1;
        break;
      }
      diagnostics.push(
        diagnostic(
          "N2007",
          "error",
          "parse",
          `Expected /${kind}, received /${closingKind ?? ""}.`,
          line.span,
          `Close this frame with \`/${kind}\`.`,
        ),
      );
      lineIndex += 1;
      continue;
    }

    if (isFrameOpen(line) && canNestFrame(kind, first?.lexeme ?? "")) {
      const nested = parseFrame(lines, lineIndex, diagnostics);
      body.push(nested.frame);
      lineIndex = nested.nextLine;
      continue;
    }

    const statement = parseStatementLine(line, diagnostics);
    if (statement) body.push(statement);
    lineIndex += 1;
  }

  if (!closeSpan) {
    diagnostics.push(
      diagnostic(
        "N2009",
        "error",
        "parse",
        `The ${kind} frame ${name} is not closed.`,
        header.span,
        `Add \`/${kind}\` on its own line.`,
      ),
    );
  }

  const frame: Frame = {
    kind: "Frame",
    frameKind: kind,
    name,
    body,
    parameters,
    headerSpan: header.span,
    closeSpan,
    span: {
      start: header.span.start,
      end: (closeSpan ?? body[body.length - 1]?.span ?? header.span).end,
    },
  };
  return { frame, nextLine: lineIndex };
}

function canNestFrame(parent: FrameKind, child: string): boolean {
  if (child === "weave" || child === "invoke" || child === "launch" || child === "choice") {
    return true;
  }
  return parent === "weave" && child === "branch";
}

function parseStatementLine(
  line: LogicalLine,
  diagnostics: Diagnostic[],
): Statement | null {
  let tokens = line.tokens;
  let bracketedCall = false;
  if (
    tokens[0]?.kind === "left-bracket" &&
    tokens[1]?.lexeme === "call" &&
    tokens[2]?.kind === "right-bracket"
  ) {
    bracketedCall = true;
    tokens = [
      {
        kind: "keyword",
        lexeme: "call",
        value: "call",
        span: {
          start: tokens[0].span.start,
          end: tokens[2].span.end,
        },
      },
      ...tokens.slice(3),
    ];
  }

  const verb = tokens[0]?.lexeme;
  if (!verb || !statementVerbs.has(verb)) {
    diagnostics.push(
      diagnostic(
        "N2010",
        "error",
        "parse",
        `Every sentence starts with a Nexilume speech act; found ${JSON.stringify(verb ?? "")}.`,
        line.span,
        "Use take, give, use, need, grant, within, budget, let, emit, yield, call, invoke, launch, or weave.",
      ),
    );
    return null;
  }

  const rest = tokens.slice(1);
  switch (verb) {
    case "take":
      return parseTake(line.span, rest, diagnostics);
    case "give":
      return parseGive(line.span, rest, diagnostics);
    case "use":
      return parseUse(line.span, rest, diagnostics);
    case "need":
      return parseNeed(line.span, rest, diagnostics);
    case "grant":
      return parseGrant(line.span, rest, diagnostics);
    case "within":
      return {
        kind: "Statement",
        verb: "within",
        limit: parseExpressionTokens(
          rest[0]?.lexeme === "sandbox" && rest.length > 1 ? rest.slice(1) : rest,
          line.span,
          diagnostics,
        ),
        span: line.span,
      } satisfies WithinStatement;
    case "budget":
      return parseBudget(line.span, rest, diagnostics);
    case "let":
      return parseLet(line.span, rest, diagnostics);
    case "emit":
      return {
        kind: "Statement",
        verb: "emit",
        value: parseExpressionTokens(rest, line.span, diagnostics),
        span: line.span,
      } satisfies EmitStatement;
    case "yield":
      return {
        kind: "Statement",
        verb: "yield",
        value: parseExpressionTokens(rest, line.span, diagnostics),
        span: line.span,
      } satisfies YieldStatement;
    case "invoke":
    case "call":
      return parseInvoke(
        verb,
        bracketedCall,
        line.span,
        rest,
        diagnostics,
      );
    case "launch":
      return parseLaunch(line.span, rest, diagnostics);
    case "weave":
      return parseWeave(line.span, rest, diagnostics);
    case "fail":
      return {
        kind: "Statement",
        verb: "fail",
        faultType: parseTypeTokens(rest, line.span, diagnostics),
        span: line.span,
      } satisfies FailStatement;
    case "instruction":
      return {
        kind: "Statement",
        verb: "instruction",
        value: parseExpressionTokens(rest, line.span, diagnostics),
        span: line.span,
      } satisfies InstructionStatement;
    case "attach": {
      const asIndex = findTopLevelWord(rest, "as");
      const valueTokens = asIndex < 0 ? rest : rest.slice(0, asIndex);
      const roleToken = asIndex < 0 ? undefined : rest[asIndex + 1];
      if (!isWordToken(roleToken)) {
        diagnostics.push(
          diagnostic(
            "N2036",
            "error",
            "parse",
            "attach must name a data role with `as`.",
            line.span,
            "Observed values should be attached `as data`.",
          ),
        );
      }
      return {
        kind: "Statement",
        verb: "attach",
        value: parseExpressionTokens(valueTokens, line.span, diagnostics),
        role: isWordToken(roleToken) ? roleToken.lexeme : "data",
        span: line.span,
      } satisfies AttachStatement;
    }
    case "field":
    case "effect":
    case "transport":
    case "endpoint":
    case "pin":
    case "overflow":
    case "filesystem":
    case "network":
    case "process":
    case "limit":
    case "settle":
    case "stage":
    case "recover":
    case "compensate":
    case "resource":
    case "needs":
    case "model":
    case "remember":
    case "handle":
    case "slot":
    case "expect":
    case "lifetime":
    case "merge":
    case "retention":
    case "compact":
    case "trust":
    case "import":
    case "command":
    case "protocol":
    case "clock":
    case "shape":
    case "permission":
    case "context":
    case "fault":
    case "version":
    case "edition":
    case "source":
    case "entry":
    case "runtime":
    case "expose":
    case "require":
    case "authority":
    case "diagnostics":
      return {
        kind: "Statement",
        verb,
        arguments: parseExpressionSequence(rest, line.span, diagnostics),
        span: line.span,
      } satisfies DirectiveStatement;
    default:
      return null;
  }
}

function parseTake(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): TakeStatement {
  const bindingToken = tokens[0];
  const binding = isWordToken(bindingToken) ? bindingToken.lexeme : "_missing";
  if (!isWordToken(bindingToken)) {
    diagnostics.push(
      diagnostic("N2011", "error", "parse", "take needs a binding name.", span),
    );
  }

  const tail = tokens.slice(isWordToken(bindingToken) ? 1 : 0);
  const fromIndex = findTopLevelWord(tail, "from");
  const trustIndex = findTopLevelWord(tail, "trust");
  const clauseIndexes = [fromIndex, trustIndex].filter((index) => index >= 0);
  const typeEnd = clauseIndexes.length > 0 ? Math.min(...clauseIndexes) : tail.length;
  const typeTokens = tail.slice(0, typeEnd).filter(
    (token, index) => !(index === 0 && token.kind === "colon"),
  );
  const sourceEnd = trustIndex > fromIndex ? trustIndex : tail.length;
  const sourceTokens =
    fromIndex < 0 ? [] : tail.slice(fromIndex + 1, sourceEnd);
  const trustToken = trustIndex < 0 ? undefined : tail[trustIndex + 1];
  const valueType =
    typeTokens.length > 0 ? parseTypeTokens(typeTokens, span, diagnostics) : null;
  const source =
    sourceTokens.length > 0
      ? parseExpressionTokens(sourceTokens, span, diagnostics)
      : null;

  return {
    kind: "Statement",
    verb: "take",
    binding,
    valueType,
    source,
    trust: isWordToken(trustToken) ? trustToken.lexeme : null,
    span,
  };
}

function parseGive(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): GiveStatement {
  if (tokens.length === 0) {
    diagnostics.push(
      diagnostic("N2012", "error", "parse", "give needs a type or a value.", span),
    );
    return {
      kind: "Statement",
      verb: "give",
      valueType: null,
      value: null,
      source: null,
      span,
    };
  }
  const fromIndex = findTopLevelWord(tokens, "from");
  const head = fromIndex < 0 ? tokens : tokens.slice(0, fromIndex);
  const source =
    fromIndex < 0
      ? null
      : parseExpressionTokens(tokens.slice(fromIndex + 1), span, diagnostics);
  if (looksLikeType(head)) {
    return {
      kind: "Statement",
      verb: "give",
      valueType: parseTypeTokens(head, span, diagnostics),
      value: null,
      source,
      span,
    };
  }
  return {
    kind: "Statement",
    verb: "give",
    valueType: null,
    value: parseExpressionTokens(head, span, diagnostics),
    source,
    span,
  };
}

function parseUse(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): UseStatement {
  const asIndex = findTopLevelWord(tokens, "as");
  let targetTokens = asIndex < 0 ? tokens : tokens.slice(0, asIndex);
  if (
    targetTokens.length > 1 &&
    targetTokens[0] &&
    frameKinds.has(targetTokens[0].lexeme)
  ) {
    targetTokens = targetTokens.slice(1);
  }
  const target = parseReferenceTokens(targetTokens, span, diagnostics, "use");
  const aliasToken = asIndex < 0 ? undefined : tokens[asIndex + 1];
  if (asIndex >= 0 && !isWordToken(aliasToken)) {
    diagnostics.push(
      diagnostic("N2013", "error", "parse", "as needs an alias name.", span),
    );
  }
  return {
    kind: "Statement",
    verb: "use",
    target,
    alias: isWordToken(aliasToken) ? aliasToken.lexeme : null,
    span,
  };
}

function parseNeed(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): NeedStatement {
  const requirements = new Set(["capability", "context", "permission", "tool"]);
  const first = tokens[0];
  const requirement =
    first && requirements.has(first.lexeme)
      ? (first.lexeme as NeedStatement["requirement"])
      : "capability";
  const targetTokens = first && requirements.has(first.lexeme) ? tokens.slice(1) : tokens;
  const targets = splitTopLevel(targetTokens, "comma").map((part) =>
    parseReferenceTokens(part, span, diagnostics, "need"),
  );
  if (targets.length === 0) {
    diagnostics.push(
      diagnostic("N2014", "error", "parse", "need requires at least one target.", span),
    );
  }
  return { kind: "Statement", verb: "need", requirement, targets, span };
}

function parseGrant(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): GrantStatement {
  const toIndex = findTopLevelWord(tokens, "to");
  const capabilityTokens = toIndex < 0 ? tokens : tokens.slice(0, toIndex);
  const capabilities = splitTopLevel(capabilityTokens, "comma").map((part) =>
    parseReferenceTokens(part, span, diagnostics, "grant"),
  );
  const target =
    toIndex < 0
      ? null
      : parseReferenceTokens(tokens.slice(toIndex + 1), span, diagnostics, "grant to");
  if (capabilities.length === 0) {
    diagnostics.push(
      diagnostic(
        "N2015",
        "error",
        "parse",
        "grant requires at least one capability or permission.",
        span,
      ),
    );
  }
  return { kind: "Statement", verb: "grant", capabilities, target, span };
}

function parseBudget(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): BudgetStatement {
  const resourceToken = tokens[0];
  if (!isWordToken(resourceToken)) {
    diagnostics.push(
      diagnostic("N2016", "error", "parse", "budget needs a resource name.", span),
    );
  }
  let limitTokens = tokens.slice(isWordToken(resourceToken) ? 1 : 0);
  if (limitTokens[0]?.kind === "colon" || limitTokens[0]?.kind === "equal") {
    limitTokens = limitTokens.slice(1);
  }
  return {
    kind: "Statement",
    verb: "budget",
    resource: isWordToken(resourceToken) ? resourceToken.lexeme : "steps",
    limit: parseExpressionTokens(limitTokens, span, diagnostics),
    span,
  };
}

function parseLet(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): LetStatement {
  const bindingToken = tokens[0];
  const binding = isWordToken(bindingToken) ? bindingToken.lexeme : "_missing";
  if (!isWordToken(bindingToken)) {
    diagnostics.push(
      diagnostic("N2017", "error", "parse", "let needs a binding name.", span),
    );
  }
  const equalIndex = findTopLevelKind(tokens, "equal");
  const tail = tokens.slice(1);
  const inferredTypeLength =
    equalIndex < 0 ? leadingTypeTokenCount(tail) : 0;
  let typeTokens =
    equalIndex < 0
      ? tail.slice(0, inferredTypeLength)
      : tokens.slice(1, equalIndex);
  if (typeTokens[0]?.kind === "colon") typeTokens = typeTokens.slice(1);
  const valueTokens =
    equalIndex < 0
      ? tail.slice(inferredTypeLength)
      : tokens.slice(equalIndex + 1);
  return {
    kind: "Statement",
    verb: "let",
    binding,
    valueType:
      typeTokens.length > 0 ? parseTypeTokens(typeTokens, span, diagnostics) : null,
    value: parseExpressionTokens(valueTokens, span, diagnostics),
    span,
  };
}

function leadingTypeTokenCount(tokens: Token[]): number {
  const first = tokens[0];
  if (!first) return 0;
  if (first.kind === "left-bracket") {
    if (!looksLikeType(tokens)) return 0;
    let depth = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index]?.kind === "left-bracket") depth += 1;
      if (tokens[index]?.kind === "right-bracket") {
        depth -= 1;
        if (depth === 0) return index + 1;
      }
    }
    return 0;
  }
  if (!isWordToken(first)) return 0;
  const initial = first.lexeme[0] ?? "";
  if (
    !builtinTypes.has(first.lexeme) &&
    initial.toLocaleUpperCase() !== initial
  ) {
    return 0;
  }
  let index = 1;
  while (
    tokens[index]?.kind === "dot" &&
    isWordToken(tokens[index + 1])
  ) {
    index += 2;
  }
  if (tokens[index]?.kind === "less") {
    let depth = 0;
    while (index < tokens.length) {
      if (tokens[index]?.kind === "less") depth += 1;
      if (tokens[index]?.kind === "greater") {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
      }
      index += 1;
    }
  }
  if (tokens[index]?.kind === "question") index += 1;
  return index;
}

function parseInvoke(
  verb: "invoke" | "call",
  bracketed: boolean,
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): InvokeStatement {
  const parsed = parseTargetArgumentsBinding(tokens, span, diagnostics, verb);
  return {
    kind: "Statement",
    verb,
    bracketed,
    ...parsed,
    span,
  };
}

function parseLaunch(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): LaunchStatement {
  const parsed = parseTargetArgumentsBinding(tokens, span, diagnostics, "launch");
  return { kind: "Statement", verb: "launch", ...parsed, span };
}

function parseTargetArgumentsBinding(
  tokens: Token[],
  span: SourceSpan,
  diagnostics: Diagnostic[],
  context: string,
): {
  target: ReferenceExpression;
  arguments: Expression[];
  binding: string | null;
} {
  const asIndex = findTopLevelWord(tokens, "as");
  const beforeAs = asIndex < 0 ? tokens : tokens.slice(0, asIndex);
  const withIndex = findTopLevelWord(beforeAs, "with");
  let targetTokens = withIndex < 0 ? beforeAs : beforeAs.slice(0, withIndex);
  if (
    targetTokens.length > 1 &&
    targetTokens[0] &&
    frameKinds.has(targetTokens[0].lexeme)
  ) {
    targetTokens = targetTokens.slice(1);
  }
  const target = parseReferenceTokens(targetTokens, span, diagnostics, context);
  const argumentTokens = withIndex < 0 ? [] : beforeAs.slice(withIndex + 1);
  const args =
    argumentTokens.length === 0
      ? []
      : splitTopLevel(argumentTokens, "comma").map((part) =>
          parseExpressionTokens(part, span, diagnostics),
        );
  const bindingToken = asIndex < 0 ? undefined : tokens[asIndex + 1];
  if (asIndex >= 0 && !isWordToken(bindingToken)) {
    diagnostics.push(
      diagnostic("N2019", "error", "parse", `${context} as needs a binding name.`, span),
    );
  }
  return {
    target,
    arguments: args,
    binding: isWordToken(bindingToken) ? bindingToken.lexeme : null,
  };
}

function parseWeave(
  span: SourceSpan,
  tokens: Token[],
  diagnostics: Diagnostic[],
): WeaveStatement {
  const asIndex = findTopLevelWord(tokens, "as");
  const branchTokens = asIndex < 0 ? tokens : tokens.slice(0, asIndex);
  let parts = splitTopLevel(branchTokens, "pipe");
  if (parts.length === 1 && findTopLevelWord(branchTokens, "with") < 0) {
    parts = splitTopLevel(branchTokens, "comma");
  }
  const branches: WeaveBranch[] = parts
    .filter((part) => part.length > 0)
    .map((part) => {
      const parsed = parseTargetArgumentsBinding(part, span, diagnostics, "weave");
      return {
        target: parsed.target,
        arguments: parsed.arguments,
        span: tokensSpan(part),
      };
    });
  if (branches.length === 0) {
    diagnostics.push(
      diagnostic(
        "N2020",
        "error",
        "parse",
        "weave needs at least one branch.",
        span,
        "Separate concurrent branches with |.",
      ),
    );
  }
  const bindingToken = asIndex < 0 ? undefined : tokens[asIndex + 1];
  if (asIndex >= 0 && !isWordToken(bindingToken)) {
    diagnostics.push(
      diagnostic("N2021", "error", "parse", "weave as needs a binding name.", span),
    );
  }
  return {
    kind: "Statement",
    verb: "weave",
    branches,
    binding: isWordToken(bindingToken) ? bindingToken.lexeme : null,
    span,
  };
}

function looksLikeType(tokens: Token[]): boolean {
  const first = tokens[0];
  if (first?.kind === "left-bracket") {
    const constructor = tokens[1];
    return (
      isWordToken(constructor) &&
      constructor.lexeme !== "call" &&
      constructor.lexeme !== "list" &&
      constructor.lexeme !== "record"
    );
  }
  if (!isWordToken(first)) return false;
  const firstCharacter = first.lexeme[0] ?? "";
  return builtinTypes.has(first.lexeme) || firstCharacter.toLocaleUpperCase() === firstCharacter;
}

function parseTypeTokens(
  tokens: Token[],
  fallback: SourceSpan,
  diagnostics: Diagnostic[],
): TypeNode {
  if (tokens.length === 0) {
    diagnostics.push(
      diagnostic("N2022", "error", "parse", "Expected a type.", fallback),
    );
    return { kind: "MissingType", span: fallback };
  }
  const parser = new TypeParser(tokens, diagnostics);
  const value = parser.parseUnion();
  if (!parser.done()) {
    diagnostics.push(
      diagnostic(
        "N2023",
        "error",
        "parse",
        `Unexpected token ${JSON.stringify(parser.peek()?.lexeme ?? "")} in type.`,
        parser.peek()?.span ?? fallback,
      ),
    );
  }
  return value;
}

class TypeParser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly diagnostics: Diagnostic[],
  ) {}

  peek(): Token | undefined {
    return this.tokens[this.index];
  }

  done(): boolean {
    return this.index >= this.tokens.length;
  }

  parseUnion(): TypeNode {
    const options = [this.parsePostfix()];
    while (this.peek()?.kind === "pipe") {
      this.index += 1;
      options.push(this.parsePostfix());
    }
    if (options.length === 1) return options[0]!;
    return {
      kind: "UnionType",
      options,
      span: {
        start: options[0]!.span.start,
        end: options[options.length - 1]!.span.end,
      },
    } satisfies UnionType;
  }

  private parsePostfix(): TypeNode {
    let value = this.parsePrimary();
    if (this.peek()?.kind === "question") {
      const question = this.tokens[this.index++]!;
      value = {
        kind: "OptionalType",
        value,
        span: { start: value.span.start, end: question.span.end },
      } satisfies OptionalType;
    }
    return value;
  }

  private parsePrimary(): TypeNode {
    const start = this.peek();
    if (start?.kind === "left-bracket") {
      this.index += 1;
      const constructor = this.peek();
      if (!isWordToken(constructor)) {
        const span = constructor?.span ?? start.span;
        if (constructor) this.index += 1;
        this.diagnostics.push(
          diagnostic(
            "N2038",
            "error",
            "parse",
            "A prefix type starts with its constructor name.",
            span,
          ),
        );
        return { kind: "MissingType", span };
      }
      this.index += 1;
      const base: TypeReference = {
        kind: "TypeReference",
        path: [constructor.lexeme],
        span: constructor.span,
      };
      const arguments_: TypeNode[] = [];
      while (!this.done() && this.peek()?.kind !== "right-bracket") {
        if (this.peek()?.kind === "comma") {
          this.index += 1;
          continue;
        }
        arguments_.push(this.parsePostfix());
      }
      const close = this.peek();
      if (close?.kind === "right-bracket") {
        this.index += 1;
      } else {
        this.diagnostics.push(
          diagnostic(
            "N2039",
            "error",
            "parse",
            `Prefix type ${constructor.lexeme} is missing ].`,
            start.span,
          ),
        );
      }
      return {
        kind: "TypeApplication",
        base,
        arguments: arguments_,
        span: {
          start: start.span.start,
          end: close?.kind === "right-bracket"
            ? close.span.end
            : arguments_[arguments_.length - 1]?.span.end ?? constructor.span.end,
        },
      } satisfies TypeApplication;
    }
    if (!isWordToken(start)) {
      const span = start?.span ?? this.tokens[this.tokens.length - 1]?.span ?? emptySpan();
      if (start) this.index += 1;
      this.diagnostics.push(
        diagnostic("N2024", "error", "parse", "A type starts with a type name.", span),
      );
      return { kind: "MissingType", span };
    }
    this.index += 1;
    const path = [start.lexeme];
    let end = start.span.end;
    while (
      this.peek()?.kind === "dot" &&
      isWordToken(this.tokens[this.index + 1])
    ) {
      this.index += 1;
      const segment = this.tokens[this.index++]!;
      path.push(segment.lexeme);
      end = segment.span.end;
    }
    const base: TypeReference = {
      kind: "TypeReference",
      path,
      span: { start: start.span.start, end },
    };
    if (this.peek()?.kind !== "less") return base;
    this.index += 1;
    const arguments_: TypeNode[] = [];
    while (!this.done() && this.peek()?.kind !== "greater") {
      arguments_.push(this.parseUnion());
      if (this.peek()?.kind === "comma") {
        this.index += 1;
      } else {
        break;
      }
    }
    const greater = this.peek();
    if (greater?.kind === "greater") {
      this.index += 1;
    } else {
      this.diagnostics.push(
        diagnostic(
          "N2025",
          "error",
          "parse",
          `Type ${path.join(".")} is missing >.`,
          base.span,
        ),
      );
    }
    return {
      kind: "TypeApplication",
      base,
      arguments: arguments_,
      span: {
        start: base.span.start,
        end: greater?.kind === "greater"
          ? greater.span.end
          : arguments_[arguments_.length - 1]?.span.end ?? base.span.end,
      },
    } satisfies TypeApplication;
  }
}

function parseExpressionTokens(
  tokens: Token[],
  fallback: SourceSpan,
  diagnostics: Diagnostic[],
): Expression {
  if (tokens.length === 0) {
    diagnostics.push(
      diagnostic("N2026", "error", "parse", "Expected a value.", fallback),
    );
    return { kind: "MissingExpression", span: fallback };
  }
  const parser = new ExpressionParser(tokens, diagnostics);
  const expression = parser.parse();
  if (!parser.done()) {
    diagnostics.push(
      diagnostic(
        "N2027",
        "error",
        "parse",
        `Unexpected token ${JSON.stringify(parser.peek()?.lexeme ?? "")} after value.`,
        parser.peek()?.span ?? fallback,
        "Wrap structured values in [ ] and separate entries with commas.",
      ),
    );
  }
  return expression;
}

function parseExpressionSequence(
  tokens: Token[],
  fallback: SourceSpan,
  diagnostics: Diagnostic[],
): Expression[] {
  if (tokens.length === 0) {
    diagnostics.push(
      diagnostic("N2037", "error", "parse", "Expected at least one value.", fallback),
    );
    return [];
  }
  const parser = new ExpressionParser(tokens, diagnostics);
  const values: Expression[] = [];
  while (!parser.done()) {
    if (
      parser.peek()?.kind === "comma" ||
      parser.peek()?.kind === "colon" ||
      parser.peek()?.kind === "equal" ||
      parser.peek()?.kind === "less" ||
      parser.peek()?.kind === "greater" ||
      parser.peek()?.kind === "question"
    ) {
      parser.skip();
      continue;
    }
    values.push(parser.parse());
  }
  return values;
}

class ExpressionParser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly diagnostics: Diagnostic[],
  ) {}

  done(): boolean {
    return this.index >= this.tokens.length;
  }

  peek(): Token | undefined {
    return this.tokens[this.index];
  }

  skip(): void {
    this.index += 1;
  }

  parse(): Expression {
    const token = this.peek();
    if (!token) return { kind: "MissingExpression", span: emptySpan() };

    if (token.kind === "string") {
      this.index += 1;
      return {
        kind: "StringLiteral",
        value: token.value ?? "",
        quote: token.lexeme.startsWith("«")
          ? "angle"
          : token.lexeme.startsWith("'")
            ? "single"
            : "double",
        span: token.span,
      } satisfies StringLiteral;
    }

    if (token.kind === "number") {
      this.index += 1;
      const match =
        /^([+-]?\d[\d_]*(?:\.\d[\d_]*)?)([\p{L}%]+)?$/u.exec(token.lexeme);
      return {
        kind: "NumberLiteral",
        value: Number((match?.[1] ?? "0").replaceAll("_", "")),
        unit: match?.[2] ?? null,
        span: token.span,
      } satisfies NumberLiteral;
    }

    if (token.lexeme === "true" || token.lexeme === "false") {
      this.index += 1;
      return {
        kind: "BooleanLiteral",
        value: token.lexeme === "true",
        span: token.span,
      } satisfies BooleanLiteral;
    }

    if (token.lexeme === "nothing" || token.lexeme === "none") {
      this.index += 1;
      return {
        kind: "NothingLiteral",
        value: null,
        span: token.span,
      } satisfies NothingLiteral;
    }

    if (isWordToken(token)) return this.parseReference();
    if (token.kind === "left-bracket") return this.parseBracket();
    if (token.kind === "left-paren") {
      this.index += 1;
      const value = this.parse();
      const close = this.peek();
      if (close?.kind === "right-paren") {
        this.index += 1;
      } else {
        this.diagnostics.push(
          diagnostic("N2028", "error", "parse", "Grouped value is missing ).", token.span),
        );
      }
      return {
        kind: "GroupExpression",
        value,
        span: {
          start: token.span.start,
          end: close?.kind === "right-paren" ? close.span.end : value.span.end,
        },
      } satisfies GroupExpression;
    }

    this.index += 1;
    this.diagnostics.push(
      diagnostic(
        "N2029",
        "error",
        "parse",
        `Expected a value, received ${JSON.stringify(token.lexeme)}.`,
        token.span,
      ),
    );
    return { kind: "MissingExpression", span: token.span };
  }

  parseReference(): ReferenceExpression {
    const first = this.tokens[this.index++]!;
    const path = [first.lexeme];
    let end = first.span.end;
    while (
      this.peek()?.kind === "dot" &&
      isWordToken(this.tokens[this.index + 1])
    ) {
      this.index += 1;
      const segment = this.tokens[this.index++]!;
      path.push(segment.lexeme);
      end = segment.span.end;
    }
    return {
      kind: "ReferenceExpression",
      path,
      span: { start: first.span.start, end },
    };
  }

  private parseBracket(): ListExpression | RecordExpression | CallExpression {
    const open = this.tokens[this.index++]!;
    if (this.peek()?.kind === "right-bracket") {
      const close = this.tokens[this.index++]!;
      return {
        kind: "ListExpression",
        items: [],
        span: { start: open.span.start, end: close.span.end },
      };
    }

    if (this.peek()?.lexeme === "list") {
      this.index += 1;
      const items: Expression[] = [];
      while (!this.done() && this.peek()?.kind !== "right-bracket") {
        if (this.peek()?.kind === "comma") {
          this.index += 1;
          continue;
        }
        items.push(this.parse());
      }
      const close = this.peek();
      if (close?.kind === "right-bracket") {
        this.index += 1;
      } else {
        this.diagnostics.push(
          diagnostic("N2040", "error", "parse", "[list ...] is missing ].", open.span),
        );
      }
      return {
        kind: "ListExpression",
        items,
        span: {
          start: open.span.start,
          end: close?.kind === "right-bracket"
            ? close.span.end
            : items[items.length - 1]?.span.end ?? open.span.end,
        },
      };
    }

    if (this.peek()?.lexeme === "record") {
      this.index += 1;
      const entries: RecordEntry[] = [];
      while (!this.done() && this.peek()?.kind !== "right-bracket") {
        const colon = this.peek();
        if (colon?.kind !== "colon") {
          this.diagnostics.push(
            diagnostic(
              "N2047",
              "error",
              "parse",
              "Record fields must be named with :key.",
              colon?.span ?? open.span,
            ),
          );
          if (colon) this.index += 1;
          continue;
        }
        this.index += 1;
        const keyToken = this.peek();
        if (!isWordToken(keyToken) && keyToken?.kind !== "string") {
          this.diagnostics.push(
            diagnostic(
              "N2048",
              "error",
              "parse",
              "Record field needs a name after :.",
              keyToken?.span ?? colon.span,
            ),
          );
          if (keyToken) this.index += 1;
          continue;
        }
        this.index += 1;
        const value = this.parse();
        entries.push({
          key: keyToken.value ?? keyToken.lexeme,
          value,
          span: { start: colon.span.start, end: value.span.end },
        });
      }
      const close = this.peek();
      if (close?.kind === "right-bracket") {
        this.index += 1;
      } else {
        this.diagnostics.push(
          diagnostic("N2049", "error", "parse", "[record ...] is missing ].", open.span),
        );
      }
      return {
        kind: "RecordExpression",
        entries,
        span: {
          start: open.span.start,
          end: close?.kind === "right-bracket"
            ? close.span.end
            : entries[entries.length - 1]?.span.end ?? open.span.end,
        },
      };
    }

    if (this.peek()?.lexeme === "call") {
      return this.parseCall(open);
    }

    const first = this.parse();
    if (this.peek()?.kind === "colon" && recordKey(first) !== null) {
      const entries: RecordEntry[] = [];
      let keyExpression: Expression = first;
      while (true) {
        const colon = this.peek();
        if (colon?.kind !== "colon") {
          this.diagnostics.push(
            diagnostic("N2030", "error", "parse", "Record entry needs :.", keyExpression.span),
          );
          break;
        }
        this.index += 1;
        const value = this.parse();
        entries.push({
          key: recordKey(keyExpression) ?? "<missing>",
          value,
          span: { start: keyExpression.span.start, end: value.span.end },
        });
        if (this.peek()?.kind !== "comma") break;
        this.index += 1;
        if (this.peek()?.kind === "right-bracket") break;
        keyExpression = this.parse();
      }
      const close = this.peek();
      if (close?.kind === "right-bracket") {
        this.index += 1;
      } else {
        this.diagnostics.push(
          diagnostic("N2031", "error", "parse", "Record value is missing ].", open.span),
        );
      }
      return {
        kind: "RecordExpression",
        entries,
        span: {
          start: open.span.start,
          end: close?.kind === "right-bracket"
            ? close.span.end
            : entries[entries.length - 1]?.span.end ?? open.span.end,
        },
      };
    }

    const items: Expression[] = [first];
    while (this.peek()?.kind === "comma") {
      this.index += 1;
      if (this.peek()?.kind === "right-bracket") break;
      items.push(this.parse());
    }
    const close = this.peek();
    if (close?.kind === "right-bracket") {
      this.index += 1;
    } else {
      this.diagnostics.push(
        diagnostic("N2032", "error", "parse", "List value is missing ].", open.span),
      );
    }
    return {
      kind: "ListExpression",
      items,
      span: {
        start: open.span.start,
        end: close?.kind === "right-bracket"
          ? close.span.end
          : items[items.length - 1]?.span.end ?? open.span.end,
      },
    };
  }

  private parseCall(open: Token): CallExpression {
    const verbToken = this.tokens[this.index++]!;
    const targetToken = this.peek();
    let target: ReferenceExpression;
    if (isWordToken(targetToken)) {
      target = this.parseReference();
    } else {
      const span = targetToken?.span ?? verbToken.span;
      this.diagnostics.push(
        diagnostic("N2041", "error", "parse", "[call ...] needs a target.", span),
      );
      target = { kind: "ReferenceExpression", path: ["<missing>"], span };
    }

    const arguments_: NamedArgument[] = [];
    while (!this.done() && this.peek()?.kind !== "right-bracket") {
      const colon = this.peek();
      if (colon?.kind !== "colon") {
        this.diagnostics.push(
          diagnostic(
            "N2042",
            "error",
            "parse",
            "Call arguments must be named with :name.",
            colon?.span ?? target.span,
            "Put positional values inside [list ...].",
          ),
        );
        if (colon) this.index += 1;
        continue;
      }
      this.index += 1;
      const nameToken = this.peek();
      if (!isWordToken(nameToken)) {
        const argumentSpan = nameToken?.span ?? colon.span;
        this.diagnostics.push(
          diagnostic("N2043", "error", "parse", "Named argument needs a name.", argumentSpan),
        );
        if (nameToken) this.index += 1;
        continue;
      }
      this.index += 1;
      const value = this.parse();
      arguments_.push({
        name: nameToken.lexeme,
        value,
        span: { start: colon.span.start, end: value.span.end },
      });
    }
    const close = this.peek();
    if (close?.kind === "right-bracket") {
      this.index += 1;
    } else {
      this.diagnostics.push(
        diagnostic("N2044", "error", "parse", "[call ...] is missing ].", open.span),
      );
    }
    return {
      kind: "CallExpression",
      verb: verbToken.lexeme,
      target,
      arguments: arguments_,
      span: {
        start: open.span.start,
        end: close?.kind === "right-bracket"
          ? close.span.end
          : arguments_[arguments_.length - 1]?.span.end ?? target.span.end,
      },
    };
  }
}

function recordKey(expression: Expression): string | null {
  if (expression.kind === "StringLiteral") return expression.value;
  if (expression.kind === "ReferenceExpression" && expression.path.length === 1) {
    return expression.path[0]!;
  }
  return null;
}

function parseReferenceTokens(
  tokens: Token[],
  fallback: SourceSpan,
  diagnostics: Diagnostic[],
  context: string,
): ReferenceExpression {
  if (tokens.length === 0) {
    diagnostics.push(
      diagnostic("N2033", "error", "parse", `${context} needs a target.`, fallback),
    );
    return { kind: "ReferenceExpression", path: ["<missing>"], span: fallback };
  }
  const parser = new ExpressionParser(tokens, diagnostics);
  const reference = parser.parse();
  if (reference.kind !== "ReferenceExpression") {
    diagnostics.push(
      diagnostic(
        "N2034",
        "error",
        "parse",
        `${context} target must be a stable name.`,
        reference.span,
      ),
    );
    return {
      kind: "ReferenceExpression",
      path: ["<missing>"],
      span: reference.span,
    };
  }
  if (!parser.done()) {
    diagnostics.push(
      diagnostic(
        "N2035",
        "error",
        "parse",
        `Unexpected words after ${context} target.`,
        parser.peek()?.span ?? fallback,
      ),
    );
  }
  return reference;
}

function findTopLevelWord(tokens: Token[], word: string): number {
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (
      token.kind === "left-bracket" ||
      token.kind === "left-paren" ||
      token.kind === "less"
    ) {
      depth += 1;
    } else if (
      token.kind === "right-bracket" ||
      token.kind === "right-paren" ||
      token.kind === "greater"
    ) {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && token.lexeme === word) {
      return index;
    }
  }
  return -1;
}

function findTopLevelKind(tokens: Token[], kind: Token["kind"]): number {
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (
      token.kind === "left-bracket" ||
      token.kind === "left-paren" ||
      token.kind === "less"
    ) {
      depth += 1;
    } else if (
      token.kind === "right-bracket" ||
      token.kind === "right-paren" ||
      token.kind === "greater"
    ) {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && token.kind === kind) {
      return index;
    }
  }
  return -1;
}

function splitTopLevel(
  tokens: Token[],
  separator: "comma" | "pipe",
): Token[][] {
  if (tokens.length === 0) return [];
  const parts: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (
      token.kind === "left-bracket" ||
      token.kind === "left-paren" ||
      token.kind === "less"
    ) {
      depth += 1;
    } else if (
      token.kind === "right-bracket" ||
      token.kind === "right-paren" ||
      token.kind === "greater"
    ) {
      depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && token.kind === separator) {
      parts.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  parts.push(current);
  return parts;
}

function tokensSpan(tokens: Token[]): SourceSpan {
  if (tokens.length === 0) return emptySpan();
  return {
    start: tokens[0]!.span.start,
    end: tokens[tokens.length - 1]!.span.end,
  };
}
