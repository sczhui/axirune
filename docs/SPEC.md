# Nexilume 0.1 language specification

Status: executable preview. This document defines the source, semantic, and
runtime contracts implemented by the reference TypeScript toolchain.

## Design axioms

1. **Intent is data.** Agent goals, prompts, context selection, and workflow
   policy are typed declarations.
2. **Authority is visible.** Effects require capabilities; runtime use requires
   permission; sandboxes enforce resource limits.
3. **Inspection is semantic.** AST, IR, capability manifests, and traces are
   stable public interfaces.
4. **Failure is ordinary.** Faults are values. Cancellation and denial have
   dedicated signals.
5. **Concurrency is bounded.** Every child belongs to a structured scope.
6. **State is historical.** Mutable shared heaps are replaced by immutable
   snapshots and typed event journals.
7. **Canonical beats clever.** One standard spelling, named arguments, explicit
   frame closers, and an idempotent formatter reduce ambiguous rewrites.

## Lexical model

Source is UTF-8. Newlines separate clauses but are not semantic block markers.
ASCII identifiers contain letters, digits, `_`, `.`, and `-`; public names are
case-sensitive. `«…»` is the canonical text literal. Ordinary quoted text is
accepted by the preview compiler and formatted to guillemets. `--` begins a
comment. Tabs are formatted to two spaces.

Top-level frames are opened by `shape`, `choice`, `fault`, `capability`,
`permission`, `tool`, `mcp`, `memory`, `context`, `prompt`, `sandbox`, `task`,
`agent`, or `workflow`. They
close with `/` plus their kind. A mismatched closer is an error even when the
names happen to match.

Expressions are prefix forms enclosed by square pairs:

```text
[verb target :argument value :argument value]
```

Arguments are always named. Collection constructors are prefix forms too.
The preview runtime additionally accepts simple identifiers and literals in
`let`, `emit`, and `yield` clauses.

## Declaration frames

### `shape`, `choice`, and `fault`

Shapes define product data; choices define exhaustive variants. Faults are serializable failure values and
must contain a stable code when exported from a package. Fields may carry trust,
secrecy, refinement, and version metadata.

### `capability`, `permission`, and `sandbox`

A capability binds an effect to a narrowed resource. It is a compile-time type
and a runtime unforgeable token. A permission rule is `allow`, `ask`, `deny`, or
a total decision expression. A sandbox limits filesystem mounts, network
destinations, processes, clocks, entropy, models, MCP servers, fuel, time,
memory, output, and child count. A grant cannot exceed its sandbox.

### `tool` and `mcp`

Tools declare named inputs, one output, typed faults, necessary capabilities,
permission mode, and optional idempotency. Every invocation returns a receipt
containing contract hash, normalized input hash, adapter identity, timing,
attempts, authorization decision, and output hash. Secrets are redacted before
trace serialization.

An MCP declaration pins protocol and transport. Imported methods are converted
to tool/resource/prompt declarations and their schemas become part of the lock
file.

### `memory` and `context`

Memory is a namespaced event journal. A merge law must be associative and is
tested by the compiler for built-in policies. Context policies compile selected
memory, resources, tool receipts, and user input into a token-bounded value with
provenance.

### `prompt`

Prompts have instruction segments, typed slots, data attachments, an expected
result form, and budgets. Data cannot become instruction text without an
explicit trust conversion.

### `task`, `agent`, and `workflow`

Tasks are pure unless their body names capabilities in `use`. Agents are
authority envelopes containing handlers, memory/context access, sandbox, model
profile, and budgets. Workflows are acyclic typed stage graphs with recovery
and compensation.

## Type and effect rules

The core kinds are `Value`, `Fault`, `Effect`, `Capability`, `Resource`,
`Context`, and `Agent`. Core value forms include `Unit`, `Bool`, `Int`,
`Decimal`, `Text`, `Bytes`, `Duration`, `List<T>`, `Map<K V>`, `Maybe<T>`,
`Outcome<T E>`, `Stream<T>`, `Secret<T>`, `Verified<T Evidence>`, and
`Lease<T>`.

Effects form a closed row attached to callable types. The compiler rejects an
invocation when the enclosing frame does not `use` a matching capability.
Trust and secrecy are monotone labels: code can increase trust only through a
validator, and can reduce secrecy only through an authorized declassifier.

## Runtime model

Reference execution is a fuel-limited IR interpreter. Values are immutable.
Memory writes append versioned events. Structured scopes own child tasks and
propagate cancellation downward. Tool and model adapters are host-supplied.
With the same source hash, inputs, scheduler seed, memory snapshot, and adapter
receipts, evaluation must produce the same semantic trace.

## Build products

Compiling `example.nxl` can emit:

- canonical AST JSON;
- checked Nexilume IR (`.air.json`);
- capability manifest JSON;
- runnable host module for adapters that pass the same manifest;
- source map and stable diagnostics.

The preview release implements the AST, IR, manifest, formatter, diagnostics,
interpreter, CLI, browser IDE, language server, and VS Code extension. The host
module emitter and durable adapters are intentionally behind explicit preview
contracts.
