# Nexilume 0.2 reference architecture

Nexilume has a deterministic general-purpose core and an optional effect
boundary. The same strict TypeScript implementation runs in Node.js and in the
browser.

```text
Nexilume source (.nxl)
  → recoverable parser
  → semantic frames + diagnostics
  → task signatures + call graph + effect requirements
  → checked Nexilume IR
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
  runtime.ts      builtins, task calls, recursion, effects, and trace

src/cli/          check, run, fmt, ast, ir, manifest, build
src/lsp/          JSON-RPC Language Server over stdio
src/ui/           website, Playground, and browser IDE
```

The CLI and web surfaces import the same language package. Example source that
runs in the Playground therefore passes through the same parser, compiler, IR,
and interpreter used by `nexilume run`.

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
