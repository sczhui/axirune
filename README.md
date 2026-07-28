# Nexilume

**Illuminate intent. Bound every effect.**

**Official website:** [https://nexilume.velhu.com/](https://nexilume.velhu.com/)

Nexilume is an executable preview of a language designed for AI Agent programs.
It treats prompts, context, memory, tools, MCP, agents, workflows, capabilities,
permissions, sandboxes, and budgets as typed language constructs rather than
framework conventions.

This repository includes:

- a recoverable parser, formatter, semantic compiler, checked IR, capability
  manifest, fuel-limited interpreter, and execution trace;
- a browser Playground and multi-panel online IDE using the same compiler;
- a Node.js CLI and JSON-RPC language server;
- a self-contained Visual Studio Code extension package;
- an interactive specification, language tour, examples, and measured
  benchmarks;
- a hardened static Docker deployment for the 148 server.

## Try it

Node.js 22+ and npm 10+ are recommended.

```bash
npm ci
npm run build
npm test
npm run check:examples
npm run bench
npm run dev
```

The development site is served by Vite. The production build is written to
`dist/`.

Compile and run an Nexilume source file:

```bash
npm run build:toolchain
node dist-toolchain/src/cli/nexilume.js check examples/hello.nxl
node dist-toolchain/src/cli/nexilume.js run examples/hello.nxl
node dist-toolchain/src/cli/nexilume.js manifest examples/tool-receipt.nxl
```

## Source in one minute

```nexilume
space hello
edition 1

task main
  give Text
  let greeting «Hello from Nexilume.»
  emit greeting
  yield greeting
/task

launch main
```

Frames have explicit kind closers. Indentation does not define semantics.
Arguments are named. Effects must name capabilities. Tools, agents, and
workflows produce receipts in a replayable event trace.

Read [the language tour](docs/LANGUAGE_TOUR.md), [the 0.1
specification](docs/SPEC.md), [security model](docs/SECURITY.md), and
[implementation architecture](docs/ARCHITECTURE.md).

## Commands

```text
nexilume check <file>          parse and validate
nexilume run <file>            run checked IR with bounded demo adapters
nexilume fmt <file> [--write]  produce canonical source
nexilume ast <file>            print semantic AST JSON
nexilume ir <file>             print checked IR JSON
nexilume manifest <file>       print required authority JSON
nexilume build <file> --out X  write IR, manifest, and diagnostics
nexilume bench                 run the reference benchmark suite
```

Diagnostics, AST, IR, manifests, and traces can be serialized as stable JSON
for agent tooling.

## Project map

```text
src/language/              parser, semantics, IR, formatter, runtime
src/cli/                   command-line compiler
src/lsp/                   stdio language server
src/ui/                    website, Playground, and online IDE
packages/vscode-extension/ editor integration and grammar
examples/                  representative Nexilume programs
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
enables `no-new-privileges`, and joins the external `proxy-net` network without
publishing a host port.

## 148 production deployment

Production path: `/opt/docker-apps/nexilume`

Public route: `https://nexilume.velhu.com`

The Compose router attaches to the existing Traefik `websecure` entrypoint.
After deployment, the `velhu.com` Homepage `AI` group contains a direct Nexilume
entry. Updates must merge the live Homepage configuration instead of replacing
it with a stale local snapshot.

## Preview status

Nexilume 0.1 is a coherent, runnable language preview rather than a claim of
production maturity. The reference interpreter and demo adapters are suitable
for language exploration and tool-building. Native durable stores, remote MCP
transports, signed package registries, and a self-hosted compiler are roadmap
work and remain behind explicit authority contracts.

Licensed under Apache-2.0.
