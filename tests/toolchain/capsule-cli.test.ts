import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/axirune.js";

const SOURCE = `space capsule_cli

edition 2

task main
  give Text
  let message = «Hello from a verified capsule.»
  emit message
  yield message
/task

launch main
`;

describe("Axirune capsule CLI", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "axirune-capsule-cli-"));
    await writeFile(join(directory, "hello.axi"), SOURCE, "utf8");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("compiles, verifies, inspects, and decompiles an execution capsule", async () => {
    const compiled = capture();
    expect(
      await runCli(["compile", "hello.axi", "--out", "hello.axc", "--json"], {
        cwd: directory,
        ...compiled.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(compiled.stdout())).toMatchObject({
      schema: "axirune-cli/compile@1",
      command: "compile",
      ok: true,
      artifact: expect.stringMatching(/hello\.axc$/u),
      contentId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      semanticDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect((await readFile(join(directory, "hello.axc"))).length).toBeGreaterThan(0);

    const verified = capture();
    expect(
      await runCli(["verify", "hello.axc", "--json"], {
        cwd: directory,
        ...verified.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(verified.stdout())).toMatchObject({
      schema: "axirune-cli/verify@1",
      command: "verify",
      ok: true,
      issues: [],
      manifest: {
        capabilities: [],
        tools: [],
        sandboxes: [],
        permissions: [],
      },
    });

    const inspected = capture();
    expect(
      await runCli(["inspect", "hello.axc", "--json"], {
        cwd: directory,
        ...inspected.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(inspected.stdout())).toMatchObject({
      schema: "axirune-cli/inspect@1",
      command: "inspect",
      ok: true,
      ir: { space: "capsule_cli", edition: 2 },
      manifest: { capabilities: [] },
    });

    const decompiled = capture();
    expect(
      await runCli(
        ["decompile", "hello.axc", "--out", "recovered.axi", "--json"],
        { cwd: directory, ...decompiled.environment },
      ),
    ).toBe(0);
    expect(JSON.parse(decompiled.stdout())).toMatchObject({
      schema: "axirune-cli/decompile@1",
      command: "decompile",
      ok: true,
      output: expect.stringMatching(/recovered\.axi$/u),
    });
    expect(await readFile(join(directory, "recovered.axi"), "utf8")).toBe(SOURCE);
  });

  it("runs source and its capsule with the same observable result", async () => {
    const compiled = capture();
    expect(
      await runCli(["compile", "hello.axi", "--out", "hello.axc", "--json"], {
        cwd: directory,
        ...compiled.environment,
      }),
    ).toBe(0);

    const sourceRun = capture();
    const capsuleRun = capture();
    expect(
      await runCli(["run", "hello.axi", "--json"], {
        cwd: directory,
        ...sourceRun.environment,
      }),
    ).toBe(0);
    expect(
      await runCli(["run", "hello.axc", "--json"], {
        cwd: directory,
        ...capsuleRun.environment,
      }),
    ).toBe(0);

    expect(observableRun(JSON.parse(capsuleRun.stdout()))).toEqual(
      observableRun(JSON.parse(sourceRun.stdout())),
    );
  });

  it("includes a verified capsule in the existing build bundle", async () => {
    const built = capture();
    expect(
      await runCli(["build", "hello.axi", "--out", "build", "--json"], {
        cwd: directory,
        ...built.environment,
      }),
    ).toBe(0);
    const envelope = JSON.parse(built.stdout()) as {
      artifacts: Record<string, string>;
    };

    expect(envelope.artifacts.capsule).toMatch(/hello\.axc$/u);
    expect((await readFile(envelope.artifacts.capsule!)).length).toBeGreaterThan(0);

    const verified = capture();
    expect(
      await runCli(["verify", envelope.artifacts.capsule!, "--json"], {
        cwd: directory,
        ...verified.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(verified.stdout())).toMatchObject({ ok: true, issues: [] });
  });

  it("assembles checked IR into a source-free capsule for direct generation", async () => {
    const built = capture();
    expect(
      await runCli(["build", "hello.axi", "--out", "direct", "--json"], {
        cwd: directory,
        ...built.environment,
      }),
    ).toBe(0);
    const irPath = (JSON.parse(built.stdout()) as { artifacts: { ir: string } }).artifacts.ir;
    const assembled = capture();
    expect(
      await runCli(["assemble", irPath, "--out", "direct.axc", "--json"], {
        cwd: directory,
        ...assembled.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(assembled.stdout())).toMatchObject({
      schema: "axirune-cli/assemble@1",
      ok: true,
      sourceEmbedded: false,
    });

    const inspected = capture();
    expect(
      await runCli(["inspect", "direct.axc", "--json"], {
        cwd: directory,
        ...inspected.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(inspected.stdout())).toMatchObject({
      ok: true,
      source: null,
      metadata: {
        provenance: { generation: "direct-ir", sourceEmbedded: false },
      },
    });

    const ran = capture();
    expect(
      await runCli(["run", "direct.axc", "--json"], {
        cwd: directory,
        ...ran.environment,
      }),
    ).toBe(0);
    expect(JSON.parse(ran.stdout())).toMatchObject({
      status: "completed",
      value: "Hello from a verified capsule.",
    });
  });

  it("treats capsule authority as a request instead of a self-grant", async () => {
    await writeFile(
      join(directory, "authority.axi"),
      `space capsule_authority
grant host.fs.read to main
task main
  give Text
  yield [call File.readText :path «secret.txt»]
/task
launch main
`,
      "utf8",
    );
    const compiled = capture();
    expect(
      await runCli(["compile", "authority.axi", "--out", "authority.axc", "--json"], {
        cwd: directory,
        ...compiled.environment,
      }),
    ).toBe(0);

    const run = capture();
    expect(
      await runCli(["run", "authority.axc", "--json"], {
        cwd: directory,
        ...run.environment,
      }),
    ).toBe(1);
    expect(JSON.parse(run.stdout())).toMatchObject({
      status: "denied",
      diagnostics: [expect.objectContaining({ code: "E_PERMISSION_DENIED" })],
    });
  });
});

function observableRun(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ok: value.ok,
    status: value.status,
    output: value.output,
    emissions: value.emissions,
    value: value.value,
    diagnostics: value.diagnostics,
  };
}

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
