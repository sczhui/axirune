# Changelog

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
