import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/axirune.js";

const SOURCE = `space cli_test

task main
  give Text
  let greeting = «Hello from CLI.»
  emit greeting
  yield greeting
/task

launch main
`;

describe("Axirune CLI", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "axirune-cli-"));
    await writeFile(join(directory, "hello.axi"), SOURCE, "utf8");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("checks and runs source with clean JSON output", async () => {
    const checked = capture();
    expect(
      await runCli(["check", "hello.axi", "--json"], {
        cwd: directory,
        ...checked.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(checked.stdout())).toMatchObject({
      schema: "axirune-cli/check@1",
      ok: true,
      diagnostics: [],
    });
    expect(checked.stderr()).toBe("");

    const ran = capture();
    expect(
      await runCli(["run", "hello.axi", "--json"], {
        cwd: directory,
        ...ran.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(ran.stdout())).toMatchObject({
      schema: "axirune-cli/run@1",
      ok: true,
      status: "completed",
      emissions: ["Hello from CLI."],
    });
  });

  it("formats idempotently and supports --check", async () => {
    const sourcePath = join(directory, "hello.axi");
    await writeFile(
      sourcePath,
      "space cli_test\ntask main\nemit «hello»\nyield «done»\n/task\nlaunch main",
      "utf8",
    );
    const checkBefore = capture();
    expect(
      await runCli(["fmt", "hello.axi", "--check"], {
        cwd: directory,
        ...checkBefore.environment,
      }),
    ).toBe(1);

    const write = capture();
    expect(
      await runCli(["fmt", "hello.axi", "--write"], {
        cwd: directory,
        ...write.environment,
      }),
    ).toBe(0);
    const formatted = await readFile(sourcePath, "utf8");
    expect(formatted).toContain("  emit «hello»");
    expect(formatted.endsWith("\n")).toBe(true);

    const checkAfter = capture();
    expect(
      await runCli(["fmt", "hello.axi", "--check"], {
        cwd: directory,
        ...checkAfter.environment,
      }),
    ).toBe(0);
  });

  it("emits inspectable AST, IR, manifest and build artifacts", async () => {
    for (const command of ["ast", "ir", "manifest"] as const) {
      const output = capture();
      expect(
        await runCli([command, "hello.axi", "--json"], {
          cwd: directory,
          ...output.environment,
        }),
      ).toBe(0);
      expect(JSON.parse(output.stdout()).schema).toMatch(/^axirune-/u);
    }

    const build = capture();
    expect(
      await runCli(["build", "hello.axi", "--out", "artifacts", "--json"], {
        cwd: directory,
        ...build.environment,
      }),
    ).toBe(0);
    const result = JSON.parse(build.stdout()) as {
      artifacts: Record<string, string>;
    };
    expect(Object.keys(result.artifacts)).toEqual([
      "source",
      "ast",
      "ir",
      "manifest",
      "build",
    ]);
    expect(result.artifacts.source).toMatch(/\.axi$/u);
    for (const path of Object.values(result.artifacts)) {
      expect((await readFile(path, "utf8")).length).toBeGreaterThan(0);
    }
  });

  it("rejects non-Axirune source extensions", async () => {
    const output = capture();
    expect(
      await runCli(["check", "hello.txt", "--json"], {
        cwd: directory,
        ...output.environment,
      }),
    ).toBe(2);
    expect(JSON.parse(output.stdout())).toMatchObject({
      schema: "axirune-cli/error@1",
      ok: false,
    });
  });

  it("accepts the legacy .nxl extension during the rename transition", async () => {
    await writeFile(join(directory, "legacy.nxl"), SOURCE, "utf8");
    const output = capture();
    expect(
      await runCli(["check", "legacy.nxl", "--json"], {
        cwd: directory,
        ...output.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(output.stdout())).toMatchObject({
      schema: "axirune-cli/check@1",
      source: "legacy.nxl",
      ok: true,
    });
  });

  it("runs a measured benchmark through the CLI", async () => {
    const output = capture();
    expect(
      await runCli(
        ["bench", "hello.axi", "--samples", "1", "--warmup", "0", "--json"],
        {
          cwd: directory,
          ...output.environment,
        },
      ),
    ).toBe(0);
    const report = JSON.parse(output.stdout()) as {
      schema: string;
      cases: { name: string; timing: { samples: number } }[];
    };
    expect(report.schema).toBe("axirune-benchmark/1");
    expect(report.cases.map((entry) => entry.name)).toEqual([
      "parse",
      "compile",
      "run",
    ]);
    expect(report.cases.every((entry) => entry.timing.samples === 1)).toBe(true);
  });

  it("runs a pure task without any mock or LLM dependency", async () => {
    await writeFile(
      join(directory, "pure.axi"),
      `space pure
task main
  give Text
  yield [call Text.join :parts [list «deterministic» « task»]]
/task
launch main
`,
      "utf8",
    );
    const output = capture();
    expect(
      await runCli(["run", "pure.axi", "--json"], {
        cwd: directory,
        ...output.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(output.stdout())).toMatchObject({
      ok: true,
      status: "completed",
      value: "deterministic task",
    });
  });

  it("passes a validated JSON object to main", async () => {
    await writeFile(
      join(directory, "input.axi"),
      `space input
task main
  take name Text
  give Text
  yield name
/task
launch main
`,
      "utf8",
    );
    const output = capture();
    expect(
      await runCli(
        ["run", "input.axi", "--input-json", "{\"name\":\"Axirune 0.3\"}", "--json"],
        {
          cwd: directory,
          ...output.environment,
        },
      ),
    ).toBe(0);
    expect(JSON.parse(output.stdout())).toMatchObject({
      status: "completed",
      value: "Axirune 0.3",
    });

    const invalid = capture();
    expect(
      await runCli(["run", "input.axi", "--input-json", "[]", "--json"], {
        cwd: directory,
        ...invalid.environment,
      }),
    ).toBe(2);
    expect(JSON.parse(invalid.stdout()).error).toMatch(/JSON object/u);
  });

  it("reads a real file only with explicit CLI authority", async () => {
    const data = join(directory, "data");
    await mkdir(data);
    const input = join(data, "input.txt");
    await writeFile(input, "host-backed value", "utf8");
    await writeFile(
      join(directory, "read.axi"),
      `space read
task main
  give Text
  yield [call File.readText :path «${input}»]
/task
launch main
`,
      "utf8",
    );

    const denied = capture();
    expect(
      await runCli(["run", "read.axi", "--json"], {
        cwd: directory,
        ...denied.environment,
      }),
    ).toBe(1);
    expect(JSON.parse(denied.stdout())).toMatchObject({
      status: "denied",
      diagnostics: [expect.objectContaining({ code: "E_PERMISSION_DENIED" })],
    });

    const allowed = capture();
    expect(
      await runCli(["run", "read.axi", "--allow-read", data, "--json"], {
        cwd: directory,
        ...allowed.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(allowed.stdout())).toMatchObject({
      status: "completed",
      value: "host-backed value",
    });
  });

  it("enforces write roots and never mocks an unknown tool", async () => {
    const outputDirectory = join(directory, "output");
    const outsideDirectory = join(directory, "outside");
    await Promise.all([mkdir(outputDirectory), mkdir(outsideDirectory)]);
    const deniedTarget = join(outsideDirectory, "denied.txt");
    await writeFile(
      join(directory, "write.axi"),
      `space write
task main
  give Text
  let receipt [call File.writeText :path «${deniedTarget}» :text «no escape»]
  yield «done»
/task
launch main
`,
      "utf8",
    );
    const denied = capture();
    expect(
      await runCli(["run", "write.axi", "--allow-write", outputDirectory, "--json"], {
        cwd: directory,
        ...denied.environment,
      }),
    ).toBe(1);
    expect(JSON.parse(denied.stdout())).toMatchObject({
      status: "failed",
      diagnostics: [
        expect.objectContaining({
          code: "E_RUNTIME",
          message: expect.stringMatching(/escapes every authorized root/u),
        }),
      ],
    });
    await expect(readFile(deniedTarget, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const allowedTarget = join(outputDirectory, "result.txt");
    await writeFile(
      join(directory, "write.axi"),
      `space write
task main
  give Text
  let receipt [call File.writeText :path «${allowedTarget}» :text «written by Axirune»]
  yield «done»
/task
launch main
`,
      "utf8",
    );
    const allowed = capture();
    expect(
      await runCli(["run", "write.axi", "--allow-write", outputDirectory, "--json"], {
        cwd: directory,
        ...allowed.environment,
      }),
    ).toBe(0);
    expect(await readFile(allowedTarget, "utf8")).toBe("written by Axirune");

    await writeFile(
      join(directory, "unknown.axi"),
      `space unknown
task main
  give Text
  yield [call Missing.tool :value «not mocked»]
/task
launch main
`,
      "utf8",
    );
    const unknown = capture();
    expect(
      await runCli(["run", "unknown.axi", "--json"], {
        cwd: directory,
        ...unknown.environment,
      }),
    ).toBe(1);
    expect(JSON.parse(unknown.stdout())).toMatchObject({
      status: "failed",
      diagnostics: [expect.objectContaining({ code: "E_TOOL_NOT_BOUND" })],
    });
  });

  it("denies Http.get before any network request when no host is allowed", async () => {
    await writeFile(
      join(directory, "network.axi"),
      `space network
task main
  give Record
  yield [call Http.get :url «https://example.invalid/never-requested»]
/task
launch main
`,
      "utf8",
    );
    const output = capture();
    expect(
      await runCli(["run", "network.axi", "--json"], {
        cwd: directory,
        ...output.environment,
      }),
    ).toBe(1);
    expect(JSON.parse(output.stdout())).toMatchObject({
      status: "denied",
      diagnostics: [expect.objectContaining({ code: "E_PERMISSION_DENIED" })],
    });
  });
});

function capture(): {
  environment: {
    stdout: (chunk: string) => void;
    stderr: (chunk: string) => void;
  };
  stdout: () => string;
  stderr: () => string;
} {
  let stdout = "";
  let stderr = "";
  return {
    environment: {
      stdout: (chunk) => {
        stdout += chunk;
      },
      stderr: (chunk) => {
        stderr += chunk;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}
