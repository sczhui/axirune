# Axirune 0.6 alpha toolchain

The reference toolchain exposes every stage from source to deterministic
execution:

```text
axirune check examples/hello.axi
axirune run examples/factorial.axi
axirune fmt examples/invoice-total.axi --write
axirune ast examples/outcome-division.axi
axirune ir examples/invoice-total.axi
axirune manifest examples/word-frequency.axi
axirune compile examples/hello.axi --out hello.axc
axirune build examples/hello.axi --out build/
axirune assemble build/hello.air.json --out direct.axc
axirune verify hello.axc
axirune inspect hello.axc --json
axirune decompile hello.axc --out recovered.axi
axirune run hello.axc
axirune bench
```

## `check`

Parses source, resolves frame and task references, checks named arguments,
builds task/effect requirements, and reports stable diagnostics with source
spans. Pure builtin names and signatures are checked by the compiler rather
than discovered at runtime.

## `run`

Source input compiles to checked IR and executes it in the fuel-bounded
interpreter. `.axc` input first passes through the independent capsule verifier
and then executes the verified IR using the same interpreter.
User-defined task calls, recursion, lazy `Core.if`, pure collection operations,
JSON, and Outcome values run without adapters:

```bash
axirune run examples/invoice-total.axi
axirune compile examples/invoice-total.axi --out invoice.axc
axirune run invoice.axc
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

## `compile`

`compile` writes one portable `.axc` Execution Capsule. It formats and compiles
the source projection, checks that formatting preserved semantic identity,
converts insertion-ordered IR maps to canonical ordered Wire IR, derives the
authority manifest, and frames those sections with a fixed 60-byte header.

```bash
axirune compile examples/hello.axi --out hello.axc
```

The capsule contains executable Wire IR, requested authority, and canonical
source. It is artifact-first without being source-less or opaque.

## `assemble`

`assemble` is the direct artifact-generation path for an agent or another
frontend that already produced checked `.air.json`. It treats that IR as
untrusted input, runs the structural and semantic verifier, derives authority,
and emits a capsule with provenance `generation=direct-ir` and
`sourceEmbedded=false`:

```bash
axirune build examples/hello.axi --out build/
axirune assemble build/hello.air.json --out direct.axc
axirune verify direct.axc
axirune inspect direct.axc --json
axirune run direct.axc
```

The source-free form is still inspectable ordered IR, not an opaque native
binary. `verify` and `run` behave normally. `decompile direct.axc` fails with a
source-missing diagnostic because the toolchain does not invent source that
was never embedded.

## `verify`, `inspect`, and `decompile`

`verify` performs framing, canonical-encoding, digest, ABI, IR-invariant,
semantic-identity, optional source-projection, and derived-manifest checks
without executing an instruction:

```bash
axirune verify hello.axc
axirune verify hello.axc --json
```

A successful result says the bytes are intact and compatible. The current
capsule format has no implemented signing or external publisher trust store,
so SHA-256 verification does not authenticate who produced the artifact.

`inspect` verifies first and then emits content identity, semantic identity,
target ABIs, provenance, checked IR, and the requested authority manifest.
`decompile` verifies first and recovers an embedded canonical source
projection:

```bash
axirune inspect hello.axc --json
axirune decompile hello.axc
axirune decompile hello.axc --out recovered.axi
```

The manifest is a request for deployment authority, never a grant. Running a
capsule that reads files or contacts a host still requires the same explicit
CLI allowlists as running source:

```bash
axirune compile examples/word-frequency.axi --out word-frequency.axc
axirune run word-frequency.axc --allow-read .
```

## `build`

Writes canonical source, AST, checked IR, the authority manifest, a verified
`.axc` capsule, and a checksum-bearing build record to an output directory.
The interpreter consumes checked IR; the toolchain does not execute generated
source code.

```bash
axirune build examples/hello.axi --out build/
axirune verify build/hello.axc
axirune run build/hello.axc
```

WebAssembly and native code are not emitted. They may become optional capsule
backends in the future, but verified IR, ABI compatibility, and authority
checks remain the portable execution boundary.

## `bench`

Runs the measured parser, compiler, and interpreter harness. The report records
runtime, platform, fixture checksums, warmup count, sample count, raw timing
values, median, P95, and operations per second. The website reads the generated
`benchmark-results.json`; it does not embed marketing numbers.

## Language Server

`axirune-lsp --stdio` starts the JSON-RPC Language Server. It supports
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
