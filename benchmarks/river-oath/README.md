# River Oath deterministic benchmark

This release benchmark exercises the compiled River Oath engine rather than a
browser mock or an AI model. It dynamically imports the engine and Axirune
`LANGUAGE_VERSION` from `dist-toolchain`.

## Release profile

- Schema: `axirune-benchmark/river-oath/1`
- Fixed simulation rate: 60 Hz
- Heroes: Willow Duelist, Astral Lancer, and Iron Tactician
- Fixed workload: 12,000 measured ticks per hero, 36,000 total
- Warmup: 600 unmeasured ticks per hero
- Determinism: a direct run is compared with an identical replay restored from
  a JSON checkpoint halfway through the input script
- Safety: every inspected snapshot must contain only finite numbers; the player,
  enemies, pickups, and effects must remain inside the active arena
- Entity ceilings: 1 player, 24 enemies, 8 pickups, 192 effects, 225 live
  objects in total

Each hero has a stable seed, input script identifier, movement/attack cadence,
and route preference. Timing covers the primary fixed-tick run, including its
snapshot validation. Warmup and the verification replay are excluded from the
reported elapsed time.

## Run

```sh
npm run bench:river-oath -- \
  --steps 12000 \
  --out public/river-oath-benchmark-results.json
```

`--steps` is the measured tick count **per hero**. Values below 12,000 are useful
for local smoke tests, but their reports deliberately set
`coverage.minimumCoverageMet` and top-level `passed` to `false` because they do
not satisfy the 36,000-tick release floor.

Throughput is environment-specific. Release acceptance depends on coverage,
matching SHA-256 replay digests, byte-stable serialization, finite/bounded state,
and entity limits—not on a machine-specific minimum tick rate.
