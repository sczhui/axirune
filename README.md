# Nexilume

**Official website:** [https://nexilume.velhu.com/](https://nexilume.velhu.com/)

**Illuminate intent. Bound every effect.**

Nexilume 0.2 is a deterministic general-purpose language and interpreter
designed to be easy for both people and LLMs to write, inspect, and refactor.
Programs do not require a model: shapes, user-defined tasks, named calls,
recursion, control flow, collection transforms, JSON, and explicit outcomes
execute in the deterministic core. Files, network tools, MCP, prompts, and
models are optional effects behind capabilities and sandboxes.

This repository includes:

- a recoverable parser, canonical formatter, semantic compiler, checked IR,
  fuel-bounded interpreter, and structured execution trace;
- pure builtins for `Number`, `Bool`, `Text`, `List`, `Record`, `Json`, and
  `Outcome`;
- a browser Playground and multi-panel IDE using the same compiler and
  interpreter as the CLI;
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
node dist-toolchain/src/cli/nexilume.js run examples/hello.nxl
```

The following complete program calls a user-defined task and runs without a
model, tool, network connection, or API key:

```nexilume
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
    :name «Nexilume»
  ]
  emit message
  yield message
/task

launch main
```

Expected output:

```text
Hello, Nexilume!
```

Frames have explicit kind closers. Indentation is presentation, not hidden
block syntax. Calls use named arguments. A task may call another task in an
expression, including itself recursively. Pure builtins never require
capabilities.

Read the [language tour](docs/LANGUAGE_TOUR.md), [0.2
specification](docs/SPEC.md), [design rationale](docs/DESIGN.md), [security
model](docs/SECURITY.md), [toolchain guide](docs/TOOLCHAIN.md), and
[implementation architecture](docs/ARCHITECTURE.md).

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
nexilume check <file>          parse and validate
nexilume run <file>            execute checked IR
nexilume fmt <file> [--write]  produce canonical source
nexilume ast <file>            print semantic AST JSON
nexilume ir <file>             print checked IR JSON
nexilume manifest <file>       print required authority JSON
nexilume build <file> --out X  write IR, manifest, and diagnostics
nexilume bench                 run the measured reference benchmark
```

Diagnostics, AST, IR, manifests, and traces are serializable surfaces for
editor tooling and automated refactoring.

## Examples

```text
examples/hello.nxl             user task call; no LLM
examples/factorial.nxl         deterministic recursion; no LLM
examples/invoice-total.nxl     shapes, arithmetic, List.fold, JSON; no LLM
examples/outcome-division.nxl  explicit success/failure values; no LLM
examples/word-frequency.nxl    capability-gated file CLI
examples/mcp-native.nxl        optional MCP integration
examples/optional-ai.nxl       optional prompt/model integration
```

Run any deterministic example directly:

```bash
nexilume check examples/invoice-total.nxl
nexilume run examples/invoice-total.nxl
nexilume ir examples/factorial.nxl
nexilume manifest examples/word-frequency.nxl
nexilume run examples/word-frequency.nxl --allow-read .
```

## Project map

```text
src/language/              parser, semantic compiler, IR, builtins, interpreter
src/cli/                   command-line compiler and runner
src/lsp/                   stdio Language Server
src/ui/                    website, Playground, and online IDE
packages/vscode-extension/ editor integration and grammar
examples/                  deterministic and optional-effect programs
benchmarks/                measured parser/compiler/runtime suite
docs/                      specification and guides
scripts/                   release and conformance helpers
```

## Docker

```bash
docker build -t nexilume:local .
docker run --rm -p 8080:8080 nexilume:local
curl -fsS http://127.0.0.1:8080/healthz
```

The image is a multi-stage Node build followed by unprivileged Nginx. The
Compose definition uses a read-only filesystem, drops Linux capabilities,
enables `no-new-privileges`, and joins the external reverse-proxy network
without publishing a host port.

## 148 production deployment

Production path: `/opt/docker-apps/nexilume`

Public route: [https://nexilume.velhu.com/](https://nexilume.velhu.com/)

The static website, Playground, documentation, release artifacts, and browser
interpreter are served from the same deployment.

## Preview status

Nexilume 0.2 is a coherent, runnable language preview. Its deterministic core,
CLI, browser interpreter, editor tooling, examples, and benchmark harness are
implemented in this repository. Host I/O, MCP, and model adapters remain
explicit integration surfaces and never become ambient powers of a program.

Licensed under Apache-2.0.
