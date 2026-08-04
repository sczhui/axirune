# Axirune 0.4 alpha language specification

Status: executable preview

Language version: `0.4.0-alpha.1`

IR version: `axirune-ir/0.3`

Execution Capsule schema: `axirune-capsule/1`

Runtime ABI: `axirune-runtime/1`

Deterministic-kernel ABI: `axirune-kernel/0.3`

This document describes the behavior of the reference parser, compiler, and
interpreter. “Must” identifies a language rule implemented by the current
toolchain. Sections marked **declarative preview** define syntax carried into
AST and IR, but do not claim a complete production adapter.

## 1. Language boundary

Axirune is a deterministic, general-purpose language with an optional effect
layer. A valid program may contain only values, tasks, calls, collection
transforms, and an entry point. It does not require an LLM, an agent, MCP, a
tool server, a network, or an API key.

The architecture is:

```text
source
  -> loss-light AST
  -> checked Axirune IR
  |-> fuel-limited interpreter
  `-> ordered Wire IR + authority manifest + optional canonical source
        -> verified .axc Execution Capsule
        -> fuel-limited interpreter
       |-- pure builtin registry
       `-- optional host adapters
             |-- files / HTTP
             |-- MCP
             `-- model inference
```

The pure registry cannot read time, randomness, files, environment variables,
network state, model state, or any other ambient host resource.

## 2. Source model

Source is UTF-8. A file normally begins with a space and an edition:

```axirune
space invoices
edition 2
```

`edition 2` selects the callable task and pure builtin kernel described here.
Edition 1 remains parseable for compatibility.

`--` starts a line comment. Identifiers are case-sensitive. Dotted identifiers
such as `Number.add` and `File.readText` are ordinary qualified names.

The canonical text literal uses guillemets:

```axirune
«Hello, world»
```

The parser also accepts single- and double-quoted strings; `axirune fmt`
normalizes source to the canonical form where possible.

Semantic frames close explicitly:

```axirune
task greet
  take name Text
  give Text
  yield [call Text.join :parts [list «Hello, » name]]
/task
```

Indentation is presentation, not scope. `/task`, `/shape`, `/tool`, and the
other matching closers establish frame boundaries.

## 3. Values and expressions

The executable value universe in 0.3 is:

- `Nothing`, written `nothing`;
- `Bool`, written `true` or `false`;
- finite `Number`;
- `Text`;
- immutable `List`;
- immutable string-keyed `Record`;
- `Outcome`, represented by an immutable success or failure record.

Literal constructors are expressions:

```axirune
[list 2 3 5 7]

[record
  :sku «paper»
  :quantity 2
  :unit_price 12.5
]
```

Calls are prefix expressions with named arguments:

```axirune
[call Number.multiply :left quantity :right unit_price]
[call line_total :line item]
```

Argument order does not define meaning. Duplicate, missing, and unknown named
arguments are diagnostics for known builtins and user tasks.

References read immutable bindings. `let` creates a new binding; rebinding a
name in the same frame is a compile error:

```axirune
let subtotal = [call List.fold
  :list lines
  :using «add_line»
  :initial 0
]
```

The parser accepts the preview shorthand without `=`. The formatter emits the
canonical `let name = value` spelling.

## 4. Tasks: the function model

A `task` is a named callable:

```axirune
task line_total
  take line Line
  give Number
  let quantity = [call Record.get :record line :key «quantity»]
  let price = [call Record.get :record line :key «unit_price»]
  yield [call Number.multiply :left quantity :right price]
/task
```

- `take` declares a named input.
- `take name Type from expression` provides a default.
- `give Type` declares the result type.
- `yield expression` returns immediately from the task.
- `emit expression` appends an observable value without ending the task.
- Falling off the end yields the last computed frame value, normally
  `nothing`; explicit `yield` is recommended.

Tasks are callable anywhere an expression is accepted. Recursion uses the same
form as any other task call:

```axirune
[call factorial :n 6]
```

Calls are not dynamically dispatched. The interpreter resolves a unique task
frame by name and supplies its named inputs. Recursive execution is bounded by
the interpreter’s frame-depth, step, and time limits.

## 5. Types

The 0.3 compiler has a deliberately small, inspectable type kernel:

```text
Any | Nothing | Bool | Number | Text | List | Record | Outcome
```

It infers literal and builtin result categories, tracks `take` and `let`
bindings, checks task result categories, and validates the named arguments of
known builtins and tasks.

Source type nodes may also express domain names, applications, unions, and
optionality:

```axirune
take line Line
take values List<Number>
give Outcome<Invoice Fault>
```

`shape` gives domain records a stable declared schema:

```axirune
shape Line
  field sku Text
  field quantity Number
  field unit_price Number
/shape
```

In 0.3, domain type nodes and shape fields are preserved in AST/IR and exposed
to diagnostics and editor tooling. Full structural conformance, generic
instantiation, exhaustiveness, refinements, and trust-flow proof are future
type-checker work; the preview does not pretend those checks already exist.

Values are immutable. `Record.put`, `Record.merge`, and List operations return
new values instead of mutating their inputs.

## 6. Control flow and evaluation

Axirune does not require statement-level `if`. Conditional values use
`Core.if`:

```axirune
[call Core.if
  :when [call Number.lessOrEqual :left n :right 1]
  :then 1
  :else [call factorial
    :n [call Number.subtract :left n :right 1]
  ]
]
```

`:when` is evaluated first. Exactly one of `:then` and `:else` is evaluated.
This laziness is normative: an unselected branch cannot recurse, call a tool,
or fail.

`Bool.and` and `Bool.or` short-circuit their `:right` argument.
`Core.coalesce` evaluates `:fallback` only when `:value` is `nothing`.

List literals preserve source order. Records preserve values by key;
`Json.encode` writes keys in sorted order so equivalent records have stable
encoded text.

## 7. Pure standard library

All calls below are deterministic and authority-free.

### Core

```text
Core.if(:when Bool, :then lazy Any, :else lazy Any) -> Any
Core.coalesce(:value Any, :fallback lazy Any) -> Any
Core.type(:value Any) -> Text
```

### Number

Binary arithmetic uses `:left` and `:right`:

```text
Number.add        Number.subtract   Number.multiply
Number.divide     Number.remainder  Number.power
Number.min        Number.max
```

Unary operations use `:value`:

```text
Number.abs  Number.floor  Number.ceil  Number.round
```

Comparisons use `:left` and `:right` and return `Bool`:

```text
Number.equal       Number.notEqual
Number.less        Number.lessOrEqual
Number.greater     Number.greaterOrEqual
```

Division or remainder by zero fails with `E_DIVIDE_BY_ZERO`. Non-finite
results are rejected.

### Bool

```text
Bool.not(:value Bool) -> Bool
Bool.and(:left Bool, :right lazy Bool) -> Bool
Bool.or(:left Bool, :right lazy Bool) -> Bool
```

### Text

```text
Text.join(:parts List, :separator Text?) -> Text
Text.concat(:left Text, :right Text) -> Text
Text.length(:text Text) -> Number
Text.upper/lower/trim(:text Text) -> Text
Text.contains/startsWith/endsWith(:text Text, :search Text) -> Bool
Text.replace(:text Text, :search Text, :replacement Text) -> Text
Text.slice(:text Text, :start Number, :end Number?) -> Text
Text.split(:text Text, :separator Text) -> List
```

### List

```text
List.length(:list List) -> Number
List.at(:list List, :index Number) -> Any
List.append/prepend(:list List, :value Any) -> List
List.concat(:left List, :right List) -> List
List.slice(:list List, :start Number, :end Number?) -> List
List.contains(:list List, :value Any) -> Bool
List.reverse(:list List) -> List
List.range(:start Number?, :end Number, :step Number?) -> List
List.map(:list List, :using Text) -> List
List.filter(:list List, :using Text) -> List
List.fold(:list List, :using Text, :initial Any) -> Any
```

`:using` is a task name, not an opaque host closure. `map` and `filter` invoke
it with `item` and `index`. `fold` invokes it with `accumulator`, `item`, and
`index`. Iteration is left-to-right.

### Record and JSON

```text
Record.get(:record Record, :key Text) -> Any
Record.put(:record Record, :key Text, :value Any) -> Record
Record.has(:record Record, :key Text) -> Bool
Record.keys(:record Record) -> List
Record.values(:record Record) -> List
Record.merge(:left Record, :right Record) -> Record
Json.encode(:value Any) -> Text
Json.decode(:text Text) -> Any
```

`Record.get` fails for a missing key. Prototype-sensitive keys are rejected.
`Json.decode` accepts JSON values only and is subject to collection limits.

### Outcome

```text
Outcome.ok(:value Any) -> Outcome
Outcome.fail(:fault Any) -> Outcome
Outcome.isOk(:outcome Outcome) -> Bool
Outcome.value(:outcome Outcome) -> Any
Outcome.fault(:outcome Outcome) -> Any
```

An Outcome is either `{ok: true, value: ...}` or
`{ok: false, fault: ...}`. Unwrapping the wrong branch is a runtime fault.

## 8. Errors

Expected domain failure should be returned as `Outcome`. It can be inspected,
stored, encoded, and passed to another task like any other value.

Compiler and runtime faults are not Outcomes. They terminate the current run
with one of these statuses:

```text
completed | compile-error | failed | denied | cancelled | budget-exhausted
```

Diagnostics contain a stable code, severity, phase, message, and source span.
Examples include invalid syntax, rebinding, wrong named arguments, type-category
mismatches, division by zero, missing record keys, denied capabilities, missing
tool bindings, and exhausted budgets.

Cancellation is supplied by the host through an abort signal. It is a run
status, not a user-level exception value.

## 9. Entry points and execution

`launch main` is the normal deployment entry:

```axirune
task main
  give Text
  yield «ready»
/task

launch main
```

If no root launch exists, the interpreter tries `main`, then the first
top-level task, workflow, or agent frame. Hosts may explicitly select an entry.

The interpreter returns:

```text
status, output, emissions, value, diagnostics, trace
```

The trace records frame entry/exit, bindings, calls, builtin calls, task calls,
tool permission checks, tool results, emits, yields, launches, and faults.

Default runtime limits are 10,000 steps, 64 tool calls, 256 launches, frame
depth 32, 1 MiB output, 4,000 trace events, value depth 32, 10,000 collection
items, and 10 seconds. A host may lower or explicitly replace these limits.

## 10. Effects, tools, and host calls

Tools are the only executable bridge from a task to host behavior:

```axirune
capability host.fs.read
  effect filesystem.read
  resource «./input.txt»
/capability

tool File.readText
  take path Text
  give Text
  need capability host.fs.read
  permission ask
/tool

task main
  use File.readText
  need capability host.fs.read
  yield [call File.readText :path «./input.txt»]
/task
```

A tool declaration is a contract; it is not an implementation. The host must
bind a handler under the same name. The runtime checks declared and
adapter-required capabilities before calling it, normalizes the returned value,
and records the call/result in the trace.

The reference CLI provides:

```text
File.readText   host.fs.read
File.exists     host.fs.read
File.list       host.fs.read
File.writeText  host.fs.write
Http.get        host.net.fetch
```

CLI authority is granted with explicit allowlists:

```sh
axirune run program.axi --allow-read ./data
axirune run program.axi --allow-write ./out
axirune run program.axi --allow-net api.example.com
```

Filesystem adapters resolve canonical paths and reject escapes from allowed
roots. HTTP adapters restrict hosts, redirects, schemes, and response size.
Without a bound adapter, a tool call fails unless the host deliberately enables
deterministic mock tools.

## 11. Capability, permission, and sandbox

These are separate layers:

- A **capability** names the kind and resource of an effect.
- A **grant** selects authority made available to a deployment.
- A **permission** callback may allow or deny a requested capability at run
  time.
- A **sandbox** bounds resource consumption and host-adapter reach.

Source declarations cannot manufacture a host adapter. A file capability is
useless unless the deployment also binds `File.readText` with an allowed root.

The reference interpreter enforces capability checks, permission decisions, time and
value limits. The CLI enforces filesystem and network allowlists. Rich sandbox
directives inside a `sandbox` frame are retained in IR for manifests and future
hosts; Axirune does not claim OS-level isolation from source declarations alone.
Docker or another process boundary is recommended for hostile code.

## 12. Concurrency

`launch` is structured: it invokes a child frame and waits for its terminal
value. It never creates a detached background task.

`weave` starts named child branches concurrently and joins them according to a
settlement rule:

```text
all       return each value or a fault record
all_ok    fail when any branch fails
first_ok  return the first fulfilled branch
```

Children are bounded by the same launch, step, depth, timeout, output, and abort
budgets as their parent run. Values passed between scopes are immutable.

Pure task evaluation is deterministic. Concurrent adapter completion and
`first_ok` necessarily depend on host timing; programs that require replayable
results must avoid timing-sensitive settlement or record adapter receipts.

## 13. Memory and context — declarative preview

`memory` frames describe named event/state surfaces. `context` frames describe
the bounded view supplied to an inference or external component. Their
directives—lifetime, merge, retention, compaction, source, trust, and
budget—are parsed and emitted to IR.

The reference interpreter does not ship a durable memory database or automatic token
context compiler. Hosts may consume these declarations to implement one. Pure
tasks use explicit inputs and immutable values and therefore need neither
facility.

## 14. Prompt and agent — declarative preview

A `prompt` keeps instruction text, typed slots, attached data, expected output,
and budget in separate source clauses. An `agent` groups a prompt, model name,
capabilities, context/memory references, and budgets.

These frames are optional effect contracts. The reference interpreter does not
contact a model merely because an agent frame exists. Model execution requires
an explicitly bound tool/adapter and a granted model capability.

## 15. Workflow — declarative preview

A `workflow` is intended to describe named stages, data edges, recovery, and
compensation. The parser and compiler retain workflow frames and directives;
the current interpreter can enter a workflow frame and execute ordinary
instructions, but it does not yet schedule a complete `stage` graph.

Use tasks, calls, `launch`, and `weave` for executable 0.3 orchestration.

## 16. MCP — declarative preview

An `mcp` frame records protocol, transport, endpoint, pinning, imported names,
and capability requirements. It makes an MCP dependency inspectable in AST,
IR, manifests, documentation, and editor tooling.

The reference runtime does not include an automatic MCP client. A deployment binds
imported MCP methods as ordinary tools, applies capability and permission
checks, and owns transport authentication outside source code.

## 17. Toolchain contract

The shipped CLI commands are:

```text
axirune check <file>
axirune run <file>
axirune fmt <file> [--check]
axirune ast <file>
axirune ir <file>
axirune manifest <file>
axirune compile <file.axi> [--out <file.axc>]
axirune assemble <file.air.json> [--out <file.axc>]
axirune verify <file.axc>
axirune inspect <file.axc>
axirune decompile <file.axc> [--out <file.axi>]
axirune build <file>
axirune bench
```

The JavaScript API exposes `parseSource`, `formatSource`, `compileSource`, and
`runSource`, plus capsule construction, verification, inspection, and
decompilation APIs. The browser Playground and online IDE use the same parser,
compiler, builtin registry, and interpreter as the CLI.

`build` produces canonical source, checked IR, a derived authority manifest,
an Execution Capsule, and a checksum-bearing build record. Axirune does not
claim native-code, JVM, or WebAssembly compilation.

## 18. Execution Capsule contract

`.axc` is the artifact-first deployment form. It is not a source-less or
native-code format. A capsule has a fixed 60-byte big-endian frame followed by
canonical metadata and a bounded payload. The frame contains magic bytes,
capsule major/minor, flags, metadata/payload/signature lengths, and a SHA-256
digest over the framed metadata and payload.

The implemented capsule payload contains these semantic surfaces:

- canonical ordered Wire IR;
- a capability manifest derived from that IR;
- optional canonical UTF-8 source suitable for `decompile`; source compilation
  includes it, while direct checked-IR packaging may omit it.

Metadata provenance must distinguish `source-compile` from `direct-ir` and
must say whether a source section is embedded. `axirune assemble` validates a
checked `.air.json` artifact and creates the latter form with
`sourceEmbedded=false`. `verify`, `inspect`, and `run` must continue to work;
`decompile` must fail explicitly instead of reconstructing invented source.

Wire IR must encode insertion-ordered record entries, named arguments, and
budget maps as ordered pairs before canonical object-key ordering. Their order
must survive decoding. Source spans may be excluded from the semantic digest,
but executable arrays and ordered pairs may not be reordered.

Before execution, the verifier must reject malformed framing, non-canonical or
oversized data, mismatched content/section digests, unsupported capsule/IR/ABI
versions, structurally invalid IR, an inconsistent entry, a semantic digest
mismatch, an authority section that differs from a freshly derived manifest,
or an embedded source projection that recompiles to different semantics.

The authority manifest describes requested effects. It must not create host
authority. Filesystem roots, network hosts, tool bindings, MCP credentials, and
model credentials remain deployment inputs outside the capsule.

SHA-256 verifies integrity and content identity only. The current reference
toolchain does not implement publisher signatures or a trust store, even
though the fixed header reserves a signature length. A verifier must not report
publisher authentication for an unsigned v1 capsule.

Future WebAssembly or native sections may be optional backends bound to the
same semantic digest. They must not replace or bypass checked IR, ABI,
authority, permission, or sandbox verification. Neither backend is currently
implemented.
