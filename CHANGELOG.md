# Changelog

## 0.6.0-alpha.1 — River Oath

- Adds River Oath: The First Banner, an original late-Han-inspired 2.5D lane
  brawler with three distinct heroes, four acts, twelve encounters, eight
  regular enemy classes, four dedicated bosses, items, routes, guard, dodge,
  launcher, combo, skill, and boss-phase systems.
- Adds a real `river-oath.axi` program whose 4×3 encounter contract compiles
  into a deterministic, zero-authority `.axc` capsule and changes bounded
  combat parameters only at explicit wave boundaries.
- Adds a dedicated 60 Hz seeded engine, serializable snapshots, replay tests,
  7,200-frame boundary tests, 2.5D lane sorting, procedural character rigs,
  high-DPR Canvas presentation, keyboard/touch controls, reduced-motion
  handling, optional synthesized audio, and an editable source laboratory.
- Adds five original project-owned visual assets with hashes and source notes,
  a direct `/arcade/river-oath` route, a dedicated benchmark report, and
  responsive desktop/mobile presentation. No ROM, extracted asset, protected
  game character, copied map, model call, or network runtime is included.

## 0.5.0-alpha.1 — Arcade Collection

- Expands Axirune Arcade from two flagships to 20 playable original browser
  worlds across eight deterministic engine families, without ROMs, extracted
  assets, protected characters, copied maps, external models, or network calls.
- Adds 18 independent `.axi` Classic World rule programs alongside Vector
  Siege and Prism Bastion; every source compiles into a unique verified `.axc`
  capsule and must request zero capabilities, tools, permissions, or sandboxes.
- Adds a shared fixed-step state engine, high-DPR procedural Canvas renderer,
  keyboard, pointer, and touch controls, stage transitions, seeded replay,
  snapshots, bounded entities, responsive gallery, and editable rule studio.
- Adds a 20-entry catalog, dedicated collection guide, long-replay boundary
  tests, a 108,000-step determinism benchmark, downloadable benchmark JSON,
  and an evidence-backed benchmark page while keeping the Axirune/host runtime
  boundary explicit.

## 0.4.0-alpha.3 — Arcade route hardening

- Handles `/arcade` and `/arcade/` as exact SPA document routes while keeping
  original artwork under `/arcade/*`, preventing Nginx from leaking its
  internal `:8080` directory redirect through a reverse proxy.
- Republishes the compiler, language server, VS Code extension, Docker source,
  browser build, and release benchmark under one consistent version.

## 0.4.0-alpha.2 — Axirune Arcade

- Adds two polished, original browser games: the 60 Hz vertical shooter Vector
  Siege and the 120 Hz prismatic breaker Prism Bastion, with keyboard, pointer,
  and touch controls plus desktop and mobile layouts.
- Compiles each game's editable Axirune rules to an `.axc` Execution Capsule,
  verifies it independently, rejects every requested capability, tool,
  permission, or sandbox, and executes only the verified checked IR.
- Adds seeded deterministic engines, serializable snapshots, collision and
  scoring tests, wave and level contracts, original project-owned key art, and
  an Arcade route linked from the site navigation and home page.
- Keeps the boundary honest: Axirune computes validated game-rule contracts;
  host TypeScript executes the real-time fixed-step simulation and Canvas
  rendering. No model, prompt, MCP server, ROM, or external game asset is used.

## 0.4.0-alpha.1 — Verifiable Execution Capsules

- Adds artifact-first `.axc` Execution Capsules without making source an
  opaque or disposable black box. Every capsule contains checked ordered Wire
  IR and a derived authority manifest; source compilation also embeds a
  canonical source projection.
- Adds fixed 60-byte binary framing, canonical encoding, SHA-256 content and
  section integrity checks, semantic identity, and pinned IR, runtime, and
  deterministic-kernel ABIs.
- Adds an independent fail-closed verifier plus `compile`, source-free
  checked-IR `assemble`, `verify`, `inspect`, `decompile`, and direct capsule
  `run` commands; `build` now includes a capsule beside its inspectable source
  and JSON artifacts.
- Keeps deployment authority outside the artifact. A capability manifest is a
  request, not a grant, and filesystem/network access still requires explicit
  host allowlists.
- Does not claim publisher authentication, signing, WebAssembly, or native
  compilation. SHA-256 identifies intact content; future Wasm/native code may
  be attached only as an optional backend to verified IR.

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
