# River Oath: The First Banner

River Oath is an original late-Han-inspired 2.5D lane brawler built as the
story flagship for Axirune 0.6. It is playable in a browser at
`/arcade/river-oath` and requires no model, API key, network service, ROM, or
external game runtime.

It is not a reproduction of *Knights of Valour* / 《三国战纪》. The names,
characters, silhouettes, weapons, encounters, levels, bosses, UI, visual
assets, story, and code were created for this repository. The project borrows
only broad genre ideas such as lane movement, crowd combat, combos, items, and
boss encounters.

## Campaign

| Act | Stage key | Encounters | Final enemy |
| --- | --- | --- | --- |
| 1 | `reedwater-causeway` | Causeway Vanguard, Lantern Crossfire, Reedwater Warden | Reedwater Warden |
| 2 | `cinder-foundry` | Furnace Line, Anvil Rush, Cinder Overseer | Cinder Overseer |
| 3 | `moonwake-harbor` | Moonwake Ambush, Tidewall Guard, Harbor Master | Harbor Master |
| 4 | `cloudbreak-beacon` | Beacon Ring, Skyfire Guard, Cloudbreak Oath | Cloudbreak Oath |

The campaign includes three hero profiles, eight regular enemy classes, four
dedicated boss classes, three item classes, route choices, boss phases, and a
bounded entity budget. A route choice is explicit UI state rather than a
hidden wall or copied secret-path convention.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move across / between lanes | Arrow keys or `WASD` | Direction pad |
| Light combo | `J` | `J` button |
| Heavy strike | `K` | `K` button |
| Launcher | `U` | `U` button |
| Guard | `I` | `I` button |
| Skill | `L` | `L` button |
| Dodge | Space | Dodge button |
| Pause | `P` or Escape | Pause button |

Audio is synthesized locally and begins muted. Reduced-motion preference
disables camera shake and minimizes atmospheric animation. Leaving the
viewport or hiding the page gates simulation and clears held input.

## What Axirune executes

[`apps/arcade/river-oath.axi`](../apps/arcade/river-oath.axi) is a real
Axirune program. At an encounter boundary the host supplies:

```text
stage / wave / defeated / combo
```

The verified program returns stage and wave identities, enemy speed, health,
damage, guard, count, spawn cadence, boss phase and values, reward, drop, and
difficulty. Its result is range-checked and mapped into the host's combat
rules only at the next wave boundary. Editing the source rebuilds and verifies
a new `.axc` capsule before that result can be queued.

The capsule authority manifest is empty. It requests no capability, tool,
permission, sandbox, filesystem, network, MCP, prompt, agent, or model access.

## What the browser host executes

Axirune does not pretend to be a GPU or per-frame physics VM. The TypeScript
host owns fixed-step simulation, collision, enemy AI, input, synthesized
audio, and Canvas rendering. The boundary is deliberate:

```text
.axi source
  → parser → checked IR → .axc → verifier → bounded encounter contract
  → deterministic 60 Hz host engine → Canvas and local audio presentation
```

The host engine uses xorshift32 seeded randomness, integer tick decisions,
serializable snapshots, explicit entity limits, and no wall-clock values in
gameplay decisions. Rendering order derives from the 2.5D lane coordinate.

## Visual assets

Five original ImageGen assets live under `public/arcade/river-oath/`: one key
art image and four empty gameplay environment plates. `ASSET-SOURCES.md`
records the prompt intent and originality constraints. `manifest.json`
records dimensions, byte sizes, and SHA-256 hashes. Characters, enemies,
weapons, shadows, attacks, particles, and HUD elements are drawn by the local
procedural Canvas renderer; no sprites or assets were extracted from another
game.

## Verification

The River Oath test suites cover:

- all 12 Axirune stage/wave addresses and zero-authority capsule verification;
- three hero profiles, 12 enemy kinds, items, branches, boss phases, and
  action semantics;
- 60 Hz time slicing, seeded replay, snapshot serialization and restoration;
- long-running finite/bounded state and maximum entity limits;
- rule validation and browser rule-to-engine mapping;
- desktop and 390 px mobile interaction, touch target size, Canvas aspect
  ratio, rule rebuild, pause/resume/restart, and console cleanliness.

Performance numbers on `/benchmarks` describe the release machine and input
script only. They are evidence of reproducibility, not a cross-language claim.
