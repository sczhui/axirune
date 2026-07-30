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
edition 2

task main
  give Text
  let greeting = «Hello from the Axirune benchmark.»
  emit greeting
  yield greeting
/task

launch main
`,
    ),
    fixture("agent-graph", generatedAgentGraph(24)),
    fixture("invoice-calculation", invoiceCalculation()),
    fixture("data-transform", dataTransform()),
    fixture("recursive-factorial", recursiveFactorial()),
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
  const frames: string[] = ["space benchmark_agent_graph", "edition 2", ""];
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

function invoiceCalculation(): string {
  return `space benchmark_invoice
edition 2

task add_line
  take accumulator Number
  take item Record
  take index Number
  give Number
  let quantity [call Record.get :record item :key «quantity»]
  let unit_price [call Record.get :record item :key «unit_price»]
  let line_total [call Number.multiply :left quantity :right unit_price]
  yield [call Number.add :left accumulator :right line_total]
/task

task main
  give Record
  let lines [list
    [record :sku «NX-01» :quantity 3 :unit_price 19.95]
    [record :sku «NX-02» :quantity 2 :unit_price 8.5]
    [record :sku «NX-03» :quantity 5 :unit_price 3.25]
  ]
  let subtotal [call List.fold :list lines :using «add_line» :initial 0]
  let tax [call Number.multiply :left subtotal :right 0.09]
  let total [call Number.add :left subtotal :right tax]
  yield [record :subtotal subtotal :tax tax :total total]
/task

launch main
`;
}

function dataTransform(): string {
  return `space benchmark_data_transform
edition 2

task normalize
  take item Text
  take index Number
  give Text
  yield [call Text.upper :text [call Text.trim :text item]]
/task

task keep_long
  take item Text
  take index Number
  give Bool
  let length [call Text.length :text item]
  yield [call Number.greaterOrEqual :left length :right 5]
/task

task main
  give Text
  let raw [list «  alpha » « beta» «  gamma» «delta  » « xi »]
  let normalized [call List.map :list raw :using «normalize»]
  let selected [call List.filter :list normalized :using «keep_long»]
  yield [call Json.encode :value selected]
/task

launch main
`;
}

function recursiveFactorial(): string {
  return `space benchmark_recursive
edition 2

task factorial
  take n Number
  give Number
  yield [call Core.if
    :when [call Number.lessOrEqual :left n :right 1]
    :then 1
    :else [call Number.multiply
      :left n
      :right [call factorial
        :n [call Number.subtract :left n :right 1]
      ]
    ]
  ]
/task

task main
  give Number
  yield [call factorial :n 12]
/task

launch main
`;
}
