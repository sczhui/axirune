# Changelog

## 0.3.1 — AxiLedger

- Ships AxiLedger, a browser application whose validation, aggregation,
  budgeting, and category totals execute from checked Axirune source.
- Adds pure `Text.equal` and `Number.isInteger` builtins for deterministic
  application validation.
- Adds explicit browser input execution with no model, network, tool, MCP, or
  external capability authority.
- Includes an interactive showcase, semantic audit trace, source and report
  inspectors, CLI acceptance tests, and 1,000/10,000-record runtime checks.

## 0.3.0 — Axirune

- Renames the language from **Nexilume** to **Axirune**, from *axiom* + *rune*:
  explicit rules expressed in symbols designed to be read, checked, and
  transformed.
- Moves the command to `axirune`, source files to `.axi`, packages and editor
  tooling to the `axirune` namespace, and the public site to
  `https://axirune.velhu.com/`.
- Preserves the deterministic general-purpose core and keeps AI, Agent, MCP,
  Prompt, Context, and Memory as optional capability-gated effects.

## 0.2.0 — Deterministic Core

- Makes `task` a deterministic, named-argument function callable from expressions.
- Adds recursion, lazy conditional evaluation, arithmetic, comparison, Boolean,
  text, list, record, JSON, and structured outcome operations.
- Adds deterministic collection transforms and folds over user-defined tasks.
- Runs ordinary programs without a model, prompt, agent, MCP server, or tool
  adapter.
- Adds explicitly authorized filesystem and HTTP host adapters to the CLI.
- Repositions prompts, models, agents, and MCP as optional effectful libraries
  above the general-purpose language core.
- Adds general application examples, conformance tests, LSP assistance, and
  measured non-AI benchmarks.

## 0.1.0 — Agent Language Preview

- Introduced explicit authority, sandboxes, prompts, context, memory, tools,
  agents, workflows, a checked IR, interpreter, CLI, LSP, VS Code extension,
  browser IDE, documentation, and Docker deployment.
