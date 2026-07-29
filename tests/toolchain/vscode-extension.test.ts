import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_NAMES } from "../../src/language/index.js";

const extensionRoot = resolve("packages/vscode-extension");

describe("VS Code extension 0.2 surface", () => {
  it("ships deterministic program and task-call snippets", async () => {
    const snippets = JSON.parse(
      await readFile(resolve(extensionRoot, "snippets/nexilume.json"), "utf8"),
    ) as Record<string, { prefix: string; body: string[] }>;
    expect(snippets["Nexilume deterministic program"]).toMatchObject({
      prefix: "program",
    });
    expect(snippets["Nexilume deterministic program"]?.body).toContain("launch main");
    expect(snippets["Nexilume task call"]?.body.join("\n")).toContain("[call ${2:task_name}");
    expect(snippets["Nexilume agent"]).toBeDefined();
  });

  it("documents pure execution and fail-closed host authority", async () => {
    const readme = await readFile(resolve(extensionRoot, "README.md"), "utf8");
    expect(readme).toContain("deterministic general-purpose task language");
    expect(readme).toContain("--allow-read");
    expect(readme).toContain("--allow-write");
    expect(readme).toContain("--allow-net");
    expect(readme).toContain("denied by default");
  });

  it("highlights pure and host builtin calls", async () => {
    const grammar = JSON.parse(
      await readFile(
        resolve(extensionRoot, "syntaxes/nexilume.tmLanguage.json"),
        "utf8",
      ),
    ) as {
      repository: {
        builtins: { patterns: { match: string }[] };
      };
    };
    const pattern = new RegExp(grammar.repository.builtins.patterns[0]!.match, "u");
    expect(BUILTIN_NAMES.every((name) => pattern.test(name))).toBe(true);
    expect(pattern.test("File.readText")).toBe(true);
    expect(pattern.test("File.writeText")).toBe(true);
    expect(pattern.test("Http.get")).toBe(true);
  });
});
