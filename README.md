# Axirune

**Official website:** [https://axirune.velhu.com/](https://axirune.velhu.com/)

**Make intent axiomatic. Bound every effect.**

Axirune 0.3 is a deterministic general-purpose language and interpreter
designed to be easy for both people and LLMs to write, inspect, and refactor.
Programs do not require a model: shapes, user-defined tasks, named calls,
recursion, control flow, collection transforms, JSON, and explicit outcomes
execute in the deterministic core. Files, network tools, MCP, prompts, and
models are optional effects behind capabilities and sandboxes.

The name combines **axiom**—a rule made explicit enough to inspect—with
**rune**—a compact symbol meant to be read and carried forward. Axirune makes
intent axiomatic while keeping every effect bounded.

This repository includes:

- a recoverable parser, canonical formatter, semantic compiler, checked IR,
  fuel-bounded interpreter, and structured execution trace;
- pure builtins for `Number`, `Bool`, `Text`, `List`, `Record`, `Json`, and
  `Outcome`;
- a browser Playground and multi-panel IDE using the same compiler and
  interpreter as the CLI;
- [AxiLedger](https://axirune.velhu.com/showcase/ledger), a complete browser
  application whose validation and financial aggregation run from checked
  Axirune source with no model or network access;
- a Node.js CLI, JSON-RPC Language Server, and self-contained VS Code extension;
- deterministic examples for recursion, collection processing, invoices,
  errors, and command-line I/O, plus separately labelled optional AI/MCP
  examples;
- measured benchmarks and a hardened static Docker deployment.

## Try it

Node.js 22+ and npm 10+ are recommended.

```bash
npm ci
npm run build
npm test
npm run check:examples
node dist-toolchain/src/cli/axirune.js run examples/hello.axi
```

The following complete program calls a user-defined task and runs without a
model, tool, network connection, or API key:

```axirune
space hello
edition 2

task greet
  take name Text
  give Text
  yield [call Text.join
    :parts [list «Hello, » name «!»]
  ]
/task

task main
  give Text
  let message = [call greet
    :name «Axirune»
  ]
  emit message
  yield message
/task

launch main
```

Expected output:

```text
Hello, Axirune!
```

Frames have explicit kind closers. Indentation is presentation, not hidden
block syntax. Calls use named arguments. A task may call another task in an
expression, including itself recursively. Pure builtins never require
capabilities.

Run the [AxiLedger web showcase](https://axirune.velhu.com/showcase/ledger), or
read the [language tour](docs/LANGUAGE_TOUR.md), [0.3
specification](docs/SPEC.md), [design rationale](docs/DESIGN.md), [security
model](docs/SECURITY.md), [toolchain guide](docs/TOOLCHAIN.md), and
[implementation architecture](docs/ARCHITECTURE.md). The
[AxiLedger application guide](docs/LEDGER_SHOWCASE.md) documents its input,
output, authority, determinism, and scale acceptance tests.

## Programming model

The deterministic core covers ordinary application logic:

- `shape` describes immutable records;
- `task` is a named, typed callable with named parameters;
- recursive task calls are fuel-bounded by the interpreter;
- `Core.if` selects one lazy branch;
- `List.map`, `List.filter`, and `List.fold` call a named task supplied with
  `:using «task-name»`;
- `Outcome` represents success and failure as values;
- `Json.encode` and `Json.decode` move between typed values and JSON.

The effect layer is opt-in:

- filesystem, network, process, clock, and other host I/O require a
  `capability`;
- `permission` decides whether an available capability may be used now;
- `sandbox` bounds what the host adapter can reach;
- MCP and model adapters use the same effect boundary;
- a pure program has an empty authority manifest.

## Commands

```text
axirune check <file>          parse and validate
axirune run <file>            execute checked IR
axirune fmt <file> [--write]  produce canonical source
axirune ast <file>            print semantic AST JSON
axirune ir <file>             print checked IR JSON
axirune manifest <file>       print required authority JSON
axirune build <file> --out X  write IR, manifest, and diagnostics
axirune bench                 run the measured reference benchmark
```

Diagnostics, AST, IR, manifests, and traces are serializable surfaces for
editor tooling and automated refactoring.

## Examples

```text
examples/hello.axi             user task call; no LLM
examples/factorial.axi         deterministic recursion; no LLM
examples/invoice-total.axi     shapes, arithmetic, List.fold, JSON; no LLM
examples/outcome-division.axi  explicit success/failure values; no LLM
examples/word-frequency.axi    capability-gated file CLI
examples/mcp-native.axi        optional MCP integration
examples/optional-ai.axi       optional prompt/model integration
```

Run any deterministic example directly:

```bash
axirune check examples/invoice-total.axi
axirune run examples/invoice-total.axi
axirune ir examples/factorial.axi
axirune manifest examples/word-frequency.axi
axirune run examples/word-frequency.axi --allow-read .
```

## Project map

```text
src/language/              parser, semantic compiler, IR, builtins, interpreter
src/cli/                   command-line compiler and runner
src/lsp/                   stdio Language Server
src/ui/                    website, Playground, and online IDE
packages/vscode-extension/ editor integration and grammar
apps/                      complete applications written in Axirune
examples/                  deterministic and optional-effect programs
benchmarks/                measured parser/compiler/runtime suite
docs/                      specification and guides
scripts/                   release and conformance helpers
```

## Docker

```bash
docker build -t axirune:local .
docker run --rm -p 8080:8080 axirune:local
curl -fsS http://127.0.0.1:8080/healthz
```

The image is a multi-stage Node build followed by unprivileged Nginx. The
Compose definition uses a read-only filesystem, drops Linux capabilities,
enables `no-new-privileges`, and joins the external reverse-proxy network
without publishing a host port.

## 148 production deployment

Production path: `/opt/docker-apps/axirune`

Public route: [https://axirune.velhu.com/](https://axirune.velhu.com/)

The static website, Playground, documentation, release artifacts, and browser
interpreter are served from the same deployment.

## Preview status

Axirune 0.3 is a coherent, runnable language preview. Its deterministic core,
CLI, browser interpreter, editor tooling, examples, and benchmark harness are
implemented in this repository. Host I/O, MCP, and model adapters remain
explicit integration surfaces and never become ambient powers of a program.

Source and releases: [github.com/sczhui/axirune](https://github.com/sczhui/axirune)

Licensed under Apache-2.0.
