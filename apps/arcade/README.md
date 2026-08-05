# Axirune Arcade

Axirune Arcade demonstrates how ordinary Axirune programs can control a
real-time browser application without depending on a model. The `.axi` files
in this directory are compiled into Execution Capsules, independently
verified, checked for an empty authority manifest, and then reused at game
transitions.

The boundary is deliberate:

- Axirune computes validated difficulty, scoring, formation, and level
  contracts.
- Deterministic TypeScript engines execute fixed-step physics and collision
  detection.
- Canvas renders the resulting state and original project-owned artwork.
- Neither game receives file, network, tool, MCP, prompt, agent, or model
  authority.

Compile and inspect the same rule programs used by the website:

```bash
npm run build:toolchain
node dist-toolchain/src/cli/axirune.js compile apps/arcade/vector-siege.axi --out vector-siege.axc
node dist-toolchain/src/cli/axirune.js verify vector-siege.axc
node dist-toolchain/src/cli/axirune.js inspect vector-siege.axc
node dist-toolchain/src/cli/axirune.js run vector-siege.axc --input-json '{"wave":4,"destroyed":18,"combo":5}'

node dist-toolchain/src/cli/axirune.js compile apps/arcade/prism-break.axi --out prism-break.axc
node dist-toolchain/src/cli/axirune.js verify prism-break.axc
node dist-toolchain/src/cli/axirune.js run prism-break.axc --input-json '{"level":2,"cleared":28,"combo":4}'
```

Run the engine and capsule boundary tests with:

```bash
npm test -- tests/arcade tests/language/arcade-rules.test.ts
```
