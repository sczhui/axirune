import { createHash } from "node:crypto";

export interface BenchmarkFixture {
  name: string;
  source: string;
  bytes: number;
  lines: number;
  checksum: string;
}

export function builtinBenchmarkFixtures(): BenchmarkFixture[] {
  return [
    fixture(
      "hello",
      `space benchmark_hello

task main
  give Text
  let greeting = «Hello from the Nexilume benchmark.»
  emit greeting
  yield greeting
/task

launch main
`,
    ),
    fixture("agent-graph", generatedAgentGraph(24)),
  ];
}

export function fixture(name: string, source: string): BenchmarkFixture {
  const normalized = source.endsWith("\n") ? source : `${source}\n`;
  return {
    name,
    source: normalized,
    bytes: Buffer.byteLength(normalized, "utf8"),
    lines: normalized.split("\n").length - 1,
    checksum: `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`,
  };
}

function generatedAgentGraph(width: number): string {
  const frames: string[] = ["space benchmark_agent_graph", ""];
  for (let index = 0; index < width; index += 1) {
    frames.push(
      `task step_${index}`,
      "  give Text",
      `  let result = «bounded result ${index}»`,
      "  emit result",
      "  yield result",
      "/task",
      "",
    );
  }
  frames.push(
    "task main",
    "  give Text",
    "  let first [call step_0]",
    "  emit first",
    "  yield first",
    "/task",
    "",
    "launch main",
  );
  return frames.join("\n");
}
