import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/nexilume.js";

const SOURCE = `space cli_test

task main
  give Text
  let greeting = «Hello from CLI.»
  emit greeting
  yield greeting
/task

launch main
`;

describe("Nexilume CLI", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "nexilume-cli-"));
    await writeFile(join(directory, "hello.nxl"), SOURCE, "utf8");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("checks and runs source with clean JSON output", async () => {
    const checked = capture();
    expect(
      await runCli(["check", "hello.nxl", "--json"], {
        cwd: directory,
        ...checked.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(checked.stdout())).toMatchObject({
      schema: "nexilume-cli/check@1",
      ok: true,
      diagnostics: [],
    });
    expect(checked.stderr()).toBe("");

    const ran = capture();
    expect(
      await runCli(["run", "hello.nxl", "--json"], {
        cwd: directory,
        ...ran.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(ran.stdout())).toMatchObject({
      schema: "nexilume-cli/run@1",
      ok: true,
      status: "completed",
      emissions: ["Hello from CLI."],
    });
  });

  it("formats idempotently and supports --check", async () => {
    const sourcePath = join(directory, "hello.nxl");
    await writeFile(
      sourcePath,
      "space cli_test\ntask main\nemit «hello»\nyield «done»\n/task\nlaunch main",
      "utf8",
    );
    const checkBefore = capture();
    expect(
      await runCli(["fmt", "hello.nxl", "--check"], {
        cwd: directory,
        ...checkBefore.environment,
      }),
    ).toBe(1);

    const write = capture();
    expect(
      await runCli(["fmt", "hello.nxl", "--write"], {
        cwd: directory,
        ...write.environment,
      }),
    ).toBe(0);
    const formatted = await readFile(sourcePath, "utf8");
    expect(formatted).toContain("  emit «hello»");
    expect(formatted.endsWith("\n")).toBe(true);

    const checkAfter = capture();
    expect(
      await runCli(["fmt", "hello.nxl", "--check"], {
        cwd: directory,
        ...checkAfter.environment,
      }),
    ).toBe(0);
  });

  it("emits inspectable AST, IR, manifest and build artifacts", async () => {
    for (const command of ["ast", "ir", "manifest"] as const) {
      const output = capture();
      expect(
        await runCli([command, "hello.nxl", "--json"], {
          cwd: directory,
          ...output.environment,
        }),
      ).toBe(0);
      expect(JSON.parse(output.stdout()).schema).toMatch(/^nexilume-/u);
    }

    const build = capture();
    expect(
      await runCli(["build", "hello.nxl", "--out", "artifacts", "--json"], {
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
    for (const path of Object.values(result.artifacts)) {
      expect((await readFile(path, "utf8")).length).toBeGreaterThan(0);
    }
  });

  it("rejects non-Nexilume source extensions", async () => {
    const output = capture();
    expect(
      await runCli(["check", "hello.txt", "--json"], {
        cwd: directory,
        ...output.environment,
      }),
    ).toBe(2);
    expect(JSON.parse(output.stdout())).toMatchObject({
      schema: "nexilume-cli/error@1",
      ok: false,
    });
  });

  it("runs a measured benchmark through the CLI", async () => {
    const output = capture();
    expect(
      await runCli(
        ["bench", "hello.nxl", "--samples", "1", "--warmup", "0", "--json"],
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
    expect(report.schema).toBe("nexilume-benchmark/1");
    expect(report.cases.map((entry) => entry.name)).toEqual([
      "parse",
      "compile",
      "run",
    ]);
    expect(report.cases.every((entry) => entry.timing.samples === 1)).toBe(true);
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
