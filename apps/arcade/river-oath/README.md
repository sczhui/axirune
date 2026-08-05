# River Oath rule capsule

`river-oath.axi` is the deterministic progression and encounter contract for
River Oath, an original mythic-river action game. Its four stage keys, three
waves per stage, enemy curves, boss phases, rewards, and item names were
created for Axirune and do not reproduce another game's maps, characters,
dialogue, audiovisual assets, or data.

The host supplies `stage`, `wave`, `defeated`, and `combo`. The program clamps
progression inputs to four stages and three waves per stage, then returns
`axirune-arcade/river-oath/1`, including:

- stage and wave identities plus a global campaign index;
- enemy speed, health, damage, guard, count, and spawn cadence;
- dormant, reedwater, cinder, moonwake, and cloudbreak boss states;
- score and renown rewards;
- drop kind, count, and bounded probability;
- gathering, tempered, and legend-bound difficulty labels.

The program uses only Axirune's pure arithmetic, boolean, record, and JSON
builtins. Its verified Execution Capsule requests no capabilities, tools,
permissions, sandbox, filesystem, network, MCP, prompt, agent, or model access.
The browser host remains responsible for fixed-step combat simulation,
collision detection, input, animation, audio, and rendering.
