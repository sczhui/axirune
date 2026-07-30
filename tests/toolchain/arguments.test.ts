import { describe, expect, it } from "vitest";
import {
  parseArguments,
  UsageError,
} from "../../src/cli/arguments.js";

describe("CLI arguments", () => {
  it("accepts global options before and after the command", () => {
    expect(parseArguments(["--json", "build", "hello.axi", "--out", "artifacts"])).toMatchObject({
      command: "build",
      input: "hello.axi",
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
    expect(() => parseArguments(["fmt", "hello.axi", "--write", "--check"])).toThrow(
      UsageError,
    );
  });

  it("collects repeatable host authority and entry input", () => {
    expect(
      parseArguments([
        "run",
        "app.axi",
        "--allow-read",
        "data",
        "--allow-read=fixtures",
        "--allow-write",
        "output",
        "--allow-net=127.0.0.1:43100",
        "--input-json",
        "{\"invoice\":42}",
      ]),
    ).toMatchObject({
      command: "run",
      allowRead: ["data", "fixtures"],
      allowWrite: ["output"],
      allowNet: ["127.0.0.1:43100"],
      inputJson: "{\"invoice\":42}",
    });
  });
});
