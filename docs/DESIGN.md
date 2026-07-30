# Why Axirune exists

Axirune is a **deterministic general-purpose language** with a deliberately
separate layer for external effects and optional AI.

Its first question is not “which model should run this?” It is “what value does
this program compute?” A model key is never required to parse, compile, or
execute ordinary Axirune programs.

The name joins **axiom** and **rune**. An axiom makes a rule explicit; a rune is
a compact symbol made to be read, preserved, and transformed. The name captures
the language’s goal: make intent axiomatic and bound every effect.

## Language philosophy

Axirune is optimized for programs that people and LLMs will repeatedly read,
change, verify, and repair:

- semantic frames close with their own kind, giving parsers strong recovery
  anchors;
- calls use named arguments, so adding a parameter does not shift every call;
- user tasks are ordinary typed callables and may recurse;
- values are immutable and there is no ambient mutable heap;
- control flow is expressed through lazy, typed operations rather than hidden
  jumps;
- failure is represented by `Outcome`, not a second invisible exception
  channel;
- pure computation and host effects have different semantics;
- the formatter emits one canonical spelling;
- AST, IR, manifests, diagnostics, and traces are machine-readable contracts.

The syntax is not a thin variation of braces, indentation blocks, bytecode
classes, or object method dispatch. Frames, prefix expressions, guillemet text,
and named clauses are chosen to keep structure locally obvious.

## Four semantic planes

### 1. Deterministic values

`shape` defines record data. `task` defines a callable transformation.
`Number`, `Bool`, `Text`, `List`, `Record`, `Json`, and `Outcome` are pure
builtins. A task can call another task—or itself—with named arguments.

The interpreter resolves a value from source plus input. Pure evaluation does
not consult network state, a model, a clock, or an adapter.

### 2. Explicit results

`Outcome<Value Fault>` makes expected failure an ordinary return value.
`Core.if` chooses one lazy branch. Recursion and list processing are visible in
the task call graph and bounded by interpreter fuel.

`List.map`, `List.filter`, and `List.fold` do not capture hidden closures.
`:using «task-name»` names the callback task explicitly, keeping the call graph
serializable.

### 3. Bounded effects

Filesystem, process, network, tools, and MCP are effects. `capability` describes
what may be named, `permission` decides whether it may run now, and `sandbox`
limits what the host can actually reach.

A pure invoice or factorial program has no authority. Adding a file reader
changes the manifest in a reviewable way.

### 4. Optional cognition

`prompt`, `context`, `memory`, and `agent` are available for programs that
benefit from model inference. They are not prerequisites for tasks, data,
errors, I/O, or workflows.

Model output is a value with an explicit trust boundary. A model adapter uses
the same capability and sandbox machinery as every other effect. It receives no
special path to tools, files, or network.

## Determinism

For a pure program, the same checked IR and input produce the same value,
emissions, and semantic trace. Evaluation order is defined. `Core.if` evaluates
only the selected branch. List transforms visit elements in list order.

External adapters can observe changing systems. Their receipts and trace events
make that nondeterminism explicit rather than silently contaminating the core
language.

## Built for LLM-authored maintenance

Axirune welcomes LLM-generated code without making an LLM part of runtime:

- explicit frame closers reduce structural ambiguity;
- named call arguments survive signature evolution;
- task callbacks are names, not opaque closures;
- public declarations have stable semantic names;
- declaration order is non-semantic unless a dependency says otherwise;
- pure builtins form a small documented registry;
- effect and authority diffs can be reviewed separately from value logic;
- canonical formatting removes stylistic search space.

The result is intentionally explicit. Axirune optimizes for the lifetime cost
of understanding and safely changing software, not for minimizing keystrokes.
