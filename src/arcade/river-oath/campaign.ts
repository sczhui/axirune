import type { RiverOathCampaign } from "./types.js";

/**
 * An original late-Han-inspired campaign. Names, spaces, encounters, and visual
 * motifs are deliberately unique to River Oath and do not reproduce an existing game.
 */
export const RIVER_OATH_CAMPAIGN: RiverOathCampaign = deepFreeze({
  schema: "axirune-arcade/river-oath-campaign/1",
  id: "river-oath-first-banner",
  title: "River Oath: The First Banner",
  stages: [
    {
      id: "reedwater-causeway",
      scene: {
        id: "scene-reedwater-causeway",
        title: "Reedwater Causeway",
        subtitle: "Mist along the braided-water road",
        timeOfDay: "dawn",
        weather: "mist",
        palette: ["#162b32", "#315a5b", "#b6a56b", "#dce7d5"],
        arena: { minX: 72, maxX: 1208, minLane: 286, maxLane: 614 },
        layers: [
          { id: "distant-ridges", depth: 0.08, motif: "ink-wash ridges", parallax: 0.12, tint: "#233c42" },
          { id: "willow-bank", depth: 0.35, motif: "wind-bent willows", parallax: 0.32, tint: "#547263" },
          { id: "ferry-deck", depth: 0.72, motif: "rain-dark timber", parallax: 0.68, tint: "#8c7454" },
        ],
        setPieces: ["braided-rope ferry", "bronze river lanterns", "reed banners"],
      },
      waves: [
        {
          id: "causeway-vanguard",
          intro: "Footsteps stir the morning reeds",
          boss: false,
          spawns: [
            { kind: "river-raider", count: 3, side: "right", lane: 396, spacing: 68 },
            { kind: "reed-spearman", count: 1, side: "right", lane: 500, spacing: 64 },
          ],
        },
        {
          id: "lantern-crossfire",
          intro: "Arrows cross the ferry ropes",
          boss: false,
          spawns: [
            { kind: "hill-archer", count: 2, side: "split", lane: 326, spacing: 90 },
            { kind: "rope-hooker", count: 2, side: "split", lane: 518, spacing: 76 },
          ],
        },
        {
          id: "reedwater-warden",
          intro: "The bronze keeper bars the crossing",
          boss: true,
          spawns: [{ kind: "reedwater-warden", count: 1, side: "right", lane: 442, spacing: 0 }],
        },
      ],
      branches: [
        { id: "forge-road", label: "Follow the cinder road", nextStageId: "cinder-foundry", routeTag: "mountain" },
        { id: "harbor-road", label: "Take the moonlit barges", nextStageId: "moonwake-harbor", routeTag: "river" },
      ],
    },
    {
      id: "cinder-foundry",
      scene: {
        id: "scene-cinder-foundry",
        title: "Cinder Foundry",
        subtitle: "Hammer-song beneath the red mountain",
        timeOfDay: "day",
        weather: "clear",
        palette: ["#2b2425", "#733d31", "#d09254", "#f3d8a2"],
        arena: { minX: 62, maxX: 1218, minLane: 276, maxLane: 606 },
        layers: [
          { id: "kiln-cliffs", depth: 0.1, motif: "smoke-cut furnace walls", parallax: 0.1, tint: "#713f36" },
          { id: "wheel-gallery", depth: 0.4, motif: "mountain water wheels", parallax: 0.35, tint: "#9b6844" },
          { id: "casting-deck", depth: 0.8, motif: "bronze-scored stone", parallax: 0.75, tint: "#c59b68" },
        ],
        setPieces: ["water-wheel gallery", "bronze crucibles", "counterweight hammer"],
      },
      waves: [
        {
          id: "furnace-line",
          intro: "A vanguard descends from the mileposts",
          boss: false,
          spawns: [
            { kind: "lacquer-guard", count: 2, side: "right", lane: 388, spacing: 82 },
            { kind: "river-raider", count: 2, side: "left", lane: 520, spacing: 56 },
          ],
        },
        {
          id: "anvil-rush",
          intro: "High-road bows answer the war drums",
          boss: false,
          spawns: [
            { kind: "ember-alchemist", count: 2, side: "split", lane: 310, spacing: 92 },
            { kind: "iron-breaker", count: 2, side: "right", lane: 474, spacing: 78 },
          ],
        },
        {
          id: "cinder-overseer",
          intro: "The sentinel lowers a crescent glaive",
          boss: true,
          spawns: [{ kind: "cinder-overseer", count: 1, side: "right", lane: 430, spacing: 0 }],
        },
      ],
      branches: [
        { id: "quench-route", label: "Open the water gate", nextStageId: "moonwake-harbor", routeTag: "quench" },
      ],
    },
    {
      id: "moonwake-harbor",
      scene: {
        id: "scene-moonwake-harbor",
        title: "Moonwake Harbor",
        subtitle: "Lanterns cross the rain-black tide",
        timeOfDay: "dusk",
        weather: "rain",
        palette: ["#17222e", "#35485f", "#bd774d", "#f0c57a"],
        arena: { minX: 78, maxX: 1202, minLane: 292, maxLane: 622 },
        layers: [
          { id: "moon-fleet", depth: 0.09, motif: "layered blank-sail ships", parallax: 0.08, tint: "#26384b" },
          { id: "harbor-cranes", depth: 0.38, motif: "rope cranes and watchtowers", parallax: 0.3, tint: "#76515a" },
          { id: "rain-quay", depth: 0.78, motif: "lantern-lit wet stone", parallax: 0.72, tint: "#516075" },
        ],
        setPieces: ["blank-sail river fleet", "cargo winch", "mooring lanterns"],
      },
      waves: [
        {
          id: "moonwake-ambush",
          intro: "Shutters open on both sides",
          boss: false,
          spawns: [
            { kind: "rope-hooker", count: 3, side: "split", lane: 438, spacing: 70 },
            { kind: "hill-archer", count: 2, side: "split", lane: 318, spacing: 72 },
          ],
        },
        {
          id: "tidewall-guard",
          intro: "Armoured guards enter beneath the lanterns",
          boss: false,
          spawns: [
            { kind: "banner-caller", count: 2, side: "split", lane: 476, spacing: 84 },
            { kind: "lacquer-guard", count: 3, side: "right", lane: 352, spacing: 62 },
          ],
        },
        {
          id: "harbor-master",
          intro: "The market master breaks the rain curtain",
          boss: true,
          spawns: [{ kind: "harbor-master", count: 1, side: "left", lane: 456, spacing: 0 }],
        },
      ],
      branches: [
        { id: "beacon-ascent", label: "Climb toward the storm beacon", nextStageId: "cloudbreak-beacon", routeTag: "ascent" },
      ],
    },
    {
      id: "cloudbreak-beacon",
      scene: {
        id: "scene-cloudbreak-beacon",
        title: "Cloudbreak Beacon",
        subtitle: "The first banner reaches the storm observatory",
        timeOfDay: "night",
        weather: "embers",
        palette: ["#111528", "#2b3157", "#9a5138", "#f0b763"],
        arena: { minX: 66, maxX: 1214, minLane: 280, maxLane: 612 },
        layers: [
          { id: "star-vault", depth: 0.06, motif: "constellation vault", parallax: 0.04, tint: "#1d2549" },
          { id: "signal-towers", depth: 0.32, motif: "burning signal towers", parallax: 0.26, tint: "#713b3a" },
          { id: "observatory-court", depth: 0.78, motif: "inlaid bronze astrolabe", parallax: 0.7, tint: "#5f5770" },
        ],
        setPieces: ["armillary sphere", "constellation floor", "floating ember banners"],
      },
      waves: [
        {
          id: "beacon-ring",
          intro: "The outer ring closes around the banner",
          boss: false,
          spawns: [
            { kind: "reed-spearman", count: 3, side: "split", lane: 344, spacing: 68 },
            { kind: "iron-breaker", count: 2, side: "split", lane: 512, spacing: 84 },
          ],
        },
        {
          id: "skyfire-guard",
          intro: "The observatory guard takes formation",
          boss: false,
          spawns: [
            { kind: "ember-alchemist", count: 2, side: "split", lane: 306, spacing: 84 },
            { kind: "banner-caller", count: 2, side: "right", lane: 492, spacing: 72 },
          ],
        },
        {
          id: "cloudbreak-oath",
          intro: "Two rival oaths meet beneath the stars",
          boss: true,
          spawns: [{ kind: "cloudbreak-oath", count: 1, side: "right", lane: 438, spacing: 0 }],
        },
      ],
    },
  ],
});

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
