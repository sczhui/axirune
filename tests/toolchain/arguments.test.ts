import { describe, expect, it } from "vitest";
import {
  parseArguments,
  UsageError,
} from "../../src/cli/arguments.js";

describe("CLI arguments", () => {
  it("accepts global options before and after the command", () => {
    expect(parseArguments(["--json", "build", "hello.nxl", "--out", "artifacts"])).toMatchObject({
      command: "build",
      input: "hello.nxl",
      json: true,
      out: "artifacts",
    });
  });

  it("parses benchmark sample controls", () => {
    expect(parseArguments(["bench", "--samples=7", "--warmup", "2"])).toMatchObject({
      command: "bench",
      samples: 7,
      warmup: 2,
    });
  });

  it("rejects conflicting formatter modes", () => {
    expect(() => parseArguments(["fmt", "hello.nxl", "--write", "--check"])).toThrow(
      UsageError,
    );
  });
});
