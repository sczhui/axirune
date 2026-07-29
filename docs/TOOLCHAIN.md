# Nexilume 0.2 toolchain

The reference toolchain exposes every stage from source to deterministic
execution:

```text
nexilume check examples/hello.nxl
nexilume run examples/factorial.nxl
nexilume fmt examples/invoice-total.nxl --write
nexilume ast examples/outcome-division.nxl
nexilume ir examples/invoice-total.nxl
nexilume manifest examples/word-frequency.nxl
nexilume build examples/hello.nxl --out build/
nexilume bench
```

## `check`

Parses source, resolves frame and task references, checks named arguments,
builds task/effect requirements, and reports stable diagnostics with source
spans. Pure builtin names and signatures are checked by the compiler rather
than discovered at runtime.

## `run`

Compiles to checked IR and executes it in the fuel-bounded interpreter.
User-defined task calls, recursion, lazy `Core.if`, pure collection operations,
JSON, and Outcome values run without adapters:

```bash
nexilume run examples/invoice-total.nxl
```

Programs that declare files, network, tools, MCP, or model access additionally
need matching host adapters and capabilities. A missing effect binding fails
explicitly; it does not turn into a model request.

## `fmt`

Produces canonical source with explicit frame closers, two-space presentation
indentation, guillemet text literals, and stable expression layout. Formatting
is idempotent.

## `ast`, `ir`, and `manifest`

- `ast` prints source-level semantic frames and expressions.
- `ir` prints the versioned execution plan, task contracts, calls, and effects.
- `manifest` prints only external authority requirements. A pure program emits
  an empty manifest.

These outputs are JSON surfaces intended for editors, CI, and automated
refactoring.

## `build`

Writes checked IR, diagnostics, and the authority manifest to an output
directory. The interpreter consumes checked IR; the toolchain does not execute
generated source code.

## `bench`

Runs the measured parser, compiler, and interpreter harness. The report records
runtime, platform, fixture checksums, warmup count, sample count, raw timing
values, median, P95, and operations per second. The website reads the generated
`benchmark-results.json`; it does not embed marketing numbers.

## Language Server

`nexilume-lsp --stdio` starts the JSON-RPC Language Server. It supports
initialization, incremental text synchronization, diagnostics, completion,
hover, definition, document symbols, formatting, and shutdown.

Task and builtin completion use the same registry as the compiler. Named task
calls and callback task names can therefore be inspected without evaluating the
program.

## Browser IDE

The Playground and online IDE import the same parser, compiler, and interpreter
as the CLI. Deterministic examples run entirely in the page. Source is not sent
to a model or remote evaluator.

Optional tool, MCP, and AI examples are labelled separately. Their demonstration
bindings are deterministic and have no ambient authority.
