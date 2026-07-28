# Why Nexilume exists

A Nexilume program is a **typed intent graph**, wrapped in an **authority
envelope**, executed as a **replayable event log**.

It is not a replacement for Java, Rust, Python, or the systems already written
in them. Those systems expose HTTP, MCP, stdio, or WASM Component contracts.
Nexilume coordinates intent, evidence, inference, authority, and durable work
around those contracts.

## Four semantic planes

### Value

`shape`, `choice`, and `task` describe deterministic data and computation.
Values are immutable; resources are affine leases. No address, pointer, hidden
global, inheritance tree, unchecked cast, universal null, or operator overload
is part of the model.

### Epistemic

`Observed`, `Claim`, `Verified`, `prompt`, `context`, and `memory` describe what
is known and why. Schema-valid input is not automatically true. Tool results
are observed, model results are claims, and only deterministic validators can
mint verified evidence.

### Effect

`tool`, `mcp`, `capability`, `permission`, and `sandbox` define all contact with
the outside world. A model never executes a tool. It proposes a typed intent;
the runtime checks schema, trust, capability, sandbox, and permission in that
order before an adapter may run.

### Time

`weave`, `agent`, and `workflow` describe bounded concurrency, inference loops,
and durable graphs. Children belong to a structured scope. Workflows checkpoint
effects, carry stable stage IDs, and express compensation without claiming that
arbitrary remote systems can provide magical exactly-once execution.

## Built for model-authored maintenance

- explicit frame closers are strong parser recovery anchors;
- named call arguments do not shift when a field is inserted;
- public declarations, branches, and workflow stages have stable names;
- declaration order is non-semantic unless an edge says otherwise;
- the formatter emits one canonical spelling;
- AST, IR, privilege manifest, and trace are stable JSON surfaces;
- authority diffs can be reviewed separately from ordinary code diffs;
- no macros, implicit imports, ambient context, or overload resolution hide the
  meaning a refactoring model must preserve.

The result is intentionally more explicit than a scripting language. Nexilume
optimizes for the cost of understanding, verifying, repairing, and safely
changing a program over its lifetime.
