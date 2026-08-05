# Axirune 0.5 alpha reference architecture

Axirune has a deterministic general-purpose core and an optional effect
boundary. The same strict TypeScript implementation runs in Node.js and in the
browser.

```text
Axirune source (.axi)
  → recoverable parser
  → semantic frames + diagnostics
  → task signatures + call graph + effect requirements
  → checked Axirune IR
  ├─→ fuel-bounded deterministic interpreter
  └─→ canonical ordered Wire IR + derived authority + optional source projection
       → framed Execution Capsule (.axc)
       → independent verifier + ABI checks
       → checked Axirune IR
       → fuel-bounded deterministic interpreter
  → values + emissions + semantic trace
                         │
                         └─ optional capability gate
                              ├─ filesystem / process / network host tools
                              ├─ MCP adapters
                              └─ prompt / model adapters
```

## Deterministic core

The core can execute complete programs without any host adapter. It owns:

- immutable scalar, list, and record values;
- `shape` declarations and typed task contracts;
- user-defined task calls with named arguments;
- recursive task evaluation with frame-depth, launch, step, time, value-depth,
  collection-size, trace-size, and output-size limits;
- lazy `Core.if` control flow;
- pure `Number`, `Bool`, `Text`, `List`, `Record`, `Json`, and `Outcome`
  builtins;
- `List.map`, `List.filter`, and `List.fold` callbacks resolved to named
  user tasks;
- emissions, final values, diagnostics, and replayable semantic trace events.

Pure builtins are implemented by the interpreter. They do not pass through the
tool registry and cannot acquire capabilities.

## Optional effect adapters

The compiler records effect requirements separately from ordinary task calls.
A host may bind a declared tool to filesystem, process, network, MCP, or model
functionality. Before an adapter runs, the interpreter checks:

1. the called frame contract;
2. the required capability;
3. the current permission decision;
4. the sandbox limits;
5. the runtime resource budgets.

A program that uses only tasks and pure builtins has an empty authority
manifest. Adding an AI capability does not alter the semantics of the
deterministic core.

## Execution Capsule boundary

An `.axc` file is a portable execution capsule, not native machine code. Its
fixed 60-byte big-endian header carries magic bytes, capsule major/minor,
flags, metadata/payload/signature lengths, and a SHA-256 content digest.
Canonical metadata then describes the target IR, runtime ABI, kernel ABI,
entry point, semantic digest, generation provenance, source-presence flag, and
byte ranges for the payload sections.

The implemented payload always contains the first two sections and may contain
the third:

- `ir`: canonical JSON for ordered Wire IR;
- `authority`: the capability manifest derived from that IR;
- `source`: an optional canonical UTF-8 source projection included by source
  compilation.

IR record fields, named call arguments, and budget maps are converted to
ordered name/value pairs before object keys are canonically sorted. This keeps
evaluation order explicit and portable instead of depending on JavaScript
object insertion behavior. The semantic digest omits source locations while
preserving executable ordering.

Verification is a separate phase and never runs the program. It checks the
binary framing and size bounds, canonical JSON, whole-content and per-section
digests, Wire IR decoding, structural IR invariants, entry metadata, ABI pins,
the semantic digest, any embedded source projection, and equality between the
embedded authority manifest and a freshly derived one. Only then may the IR
reach the interpreter.

The header reserves a signature length, but capsule signatures and publisher
trust stores are not implemented. A successful SHA-256 verification establishes
content integrity, not publisher authenticity.

Artifact-first is therefore not source-less. The interpreter consumes verified
IR, while `inspect` exposes the semantic form and `decompile` recovers an
embedded canonical source for human or agent maintenance. A deliberately
source-free capsule assembled from checked IR remains inspectable rather than
becoming opaque; verification and execution work normally, while `decompile`
returns an explicit source-missing error.

## Source layout

```text
src/language/
  ast.ts          source-level semantic nodes
  lexer.ts        UTF-8 tokenization and source spans
  parser.ts       recoverable frame/expression parser
  formatter.ts    canonical source formatting
  builtins.ts     pure signatures and evaluators
  compiler.ts     signatures, references, effects, and checked IR
  ir.ts           versioned execution representation
  ir-wire.ts      ordered portable representation of IR maps
  ir-validator.ts structural validation for untrusted decoded IR
  canonical-json.ts deterministic JSON encoding and decoding
  capability-manifest.ts browser-safe authority derivation
  capsule.ts      framing, compilation, verification, and inspection
  runtime.ts      builtins, task calls, recursion, effects, and trace

src/cli/          source tools, capsule commands, host adapters, and build
src/lsp/          JSON-RPC Language Server over stdio
src/ui/           website, Playground, and browser IDE
```

The CLI and web surfaces import the same language package. Example source that
runs in the Playground therefore passes through the same parser, compiler, IR,
and interpreter used by `axirune run`.

The CLI also accepts a verified capsule directly:

```text
axirune compile examples/hello.axi --out hello.axc
axirune verify hello.axc
axirune inspect hello.axc --json
axirune decompile hello.axc --out recovered.axi
axirune run hello.axc

axirune build examples/hello.axi --out build/
axirune assemble build/hello.air.json --out direct.axc
axirune verify direct.axc
axirune run direct.axc
```

`build` emits the capsule beside canonical source, AST, IR, authority, and
build-record artifacts. Future Wasm or native code may be an optional section
derived from the same semantic identity; neither backend exists in the current
toolchain, and neither may bypass IR or authority verification.

## Evaluation

An expression call first resolves against pure builtins and user-defined
non-tool frames. A user task receives a record of named inputs and executes in
a child frame scope. Recursion is ordinary task invocation; it is bounded by
the interpreter rather than treated as a special host feature.

`Core.if` is lazy: only the chosen branch is evaluated. This property is
essential for recursion because an unchosen recursive branch must not consume
fuel or produce effects.

`List.map`, `List.filter`, and `List.fold` accept `:using «task-name»`. The
interpreter resolves that text to a task, validates its contract, and invokes
it for each element. No function pointer or hidden closure crosses the source
boundary.

## Web deployment

The production website is a static Vite build served by unprivileged Nginx.
There is no account service, telemetry collector, or remote evaluator. Source
entered in the Playground is parsed, compiled, and interpreted in the page.

The container uses a read-only root filesystem, drops Linux capabilities,
enables `no-new-privileges`, and exposes only the static server to the existing
reverse-proxy network.
