# Classic Worlds benchmark

`scripts/benchmark-classics.mjs` measures the 18 games implemented by the
shared deterministic Classic Worlds engine. Vector Siege and Prism Bastion use
their dedicated engines and appear as an explicit, separate tier so the report
still accounts for all 20 Arcade games without mixing unlike implementations.

The CLI imports JavaScript from `dist-toolchain`. The normal toolchain build now
includes the required engine modules:

```sh
npm run build:toolchain
```

Then print a compact JSON report to stdout:

```sh
node scripts/benchmark-classics.mjs
```

Use `--steps`, `--warmup`, and `--seed` to select bounded benchmark inputs,
`--pretty` for indented JSON, and `--out <path>` to publish the same JSON to a
file. The benchmark always uses the documented fixed
input script and reports deterministic replay digests, final summaries,
throughput, and observed entity peaks for every shared-engine game.
