import { describe, expect, it } from "vitest";
import {
  applyContentChange,
  offsetToPosition,
  positionToOffset,
} from "../../src/lsp/documents.js";

describe("LSP text documents", () => {
  it("applies UTF-16 incremental edits", () => {
    const source = "space glow\nemit «💡»\n";
    const changed = applyContentChange(source, {
      range: {
        start: { line: 1, character: 5 },
        end: { line: 1, character: 9 },
      },
      text: "«AI»",
    });
    expect(changed).toBe("space glow\nemit «AI»\n");
  });

  it("round-trips offsets and positions", () => {
    const source = "space a\nemit value\n";
    const offset = source.indexOf("value");
    const position = offsetToPosition(source, offset);
    expect(position).toEqual({ line: 1, character: 5 });
    expect(positionToOffset(source, position)).toBe(offset);
  });
});
