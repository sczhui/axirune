# Axirune Classic Worlds

This directory contains eighteen independent rule programs for the Classic
Worlds collection. Together with `vector-siege.axi` and `prism-break.axi`, the
Arcade exposes twenty original games inspired by the direct controls and clear
feedback of early home-console design.

These are not ROM ports or audiovisual reproductions. Names, characters,
worlds, maps, timing curves, source, rendering, UI, and generated artwork are
project-owned originals. No extracted sprite, tile map, audio, reverse-
engineered code, or third-party game data is used.

Each program accepts the current `stage`, `score`, and `streak`, then emits a
bounded `axirune-arcade/classic/1` rule contract. The browser host compiles the
source into an Execution Capsule, verifies its integrity and empty authority
manifest, and executes only the checked IR. The contract controls observable
tempo, gravity, opponent speed, spawn cadence, rewards, and phase transitions.

The high-frequency engine remains deterministic host code: fixed steps,
explicit input frames, seeded random state, and serializable snapshots. This
boundary lets every game run without a model, network, MCP server, filesystem,
prompt, agent, or tool call while keeping its balancing logic editable in
Axirune.
