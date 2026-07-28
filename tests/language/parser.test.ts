import { describe, expect, it } from "vitest";
import {
  FRAME_KINDS,
  lexSource,
  parseSource,
  type Frame,
} from "../../src/language/index.js";

describe("Nexilume lexer and parser", () => {
  it("lexes angle and ordinary strings without losing their decoded value", () => {
    const result = lexSource("emit «hello\\»»\nemit \"world\"\n");
    const strings = result.tokens.filter((token) => token.kind === "string");

    expect(result.diagnostics).toEqual([]);
    expect(strings.map((token) => token.value)).toEqual(["hello»", "world"]);
    expect(strings[1]?.span.start.line).toBe(2);
  });

  it("parses balanced multiline prefix calls with named arguments", () => {
    const source = `space hello
edition 1

task greet
  take name Text
  give Text
  let message [call Text.join
    :parts [list «Hello, » name «!»]
  ]
  yield message
/task
`;
    const result = parseSource(source);
    const frame = result.program.items[0] as Frame;
    const binding = frame.body.find(
      (node) => node.kind === "Statement" && node.verb === "let",
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.program.space?.name).toBe("hello");
    expect(result.program.edition?.value).toBe(1);
    expect(binding?.kind).toBe("Statement");
    expect(binding && binding.kind === "Statement" && binding.verb === "let"
      ? binding.value.kind
      : null).toBe("CallExpression");
  });

  it("accepts every first-class frame in the compiler surface", () => {
    const source = FRAME_KINDS.map((kind, index) => {
      const header =
        kind === "invoke"
          ? "invoke tool frame_invoke"
          : kind === "launch"
            ? "launch agent frame_launch"
            : `${kind} frame_${index}`;
      return `${header}\n/${kind}`;
    }).join("\n\n");
    const result = parseSource(source);
    const parsedKinds = result.program.items
      .filter((node): node is Frame => node.kind === "Frame")
      .map((frame) => frame.frameKind);

    expect(result.diagnostics).toEqual([]);
    expect(parsedKinds).toEqual([...FRAME_KINDS]);
  });

  it("parses a typed package manifest as ordinary language data", () => {
    const result = parseSource(`package refund-review
  version «0.1.0»
  edition «first-intent»
  source «src/**/*.nxl»
  entry «src/main.nxl»
  runtime «web»
  require «mcp:ledger@1.4.2»
  authority «manifest»
  diagnostics «canonical_json»
/package
`);
    const manifest = result.program.items[0] as Frame;
    const verbs = manifest.body
      .filter((node) => node.kind === "Statement")
      .map((statement) => statement.verb);

    expect(result.diagnostics).toEqual([]);
    expect(manifest.frameKind).toBe("package");
    expect(verbs).toEqual([
      "version",
      "edition",
      "source",
      "entry",
      "runtime",
      "require",
      "authority",
      "diagnostics",
    ]);
  });

  it("reports a precise diagnostic for an unclosed frame", () => {
    const result = parseSource("task main\n  emit «hello»\n");

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "N2009",
        severity: "error",
        phase: "parse",
      }),
    );
  });
});
