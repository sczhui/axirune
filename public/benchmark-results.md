# Axirune benchmark

Generated: 2026-08-05T13:36:25.709Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.021 | 0.019 | 0.032 | 46595.789 |
| hello | 162 | compile | 0.025 | 0.018 | 0.060 | 40737.733 |
| hello | 162 | run | 0.041 | 0.028 | 0.116 | 24581.842 |
| hello | 162 | capsule-build | 0.312 | 0.296 | 0.392 | 3207.570 |
| hello | 162 | capsule-verify | 0.275 | 0.256 | 0.387 | 3639.010 |
| hello | 162 | capsule-run | 0.042 | 0.032 | 0.108 | 23760.043 |
| agent-graph | 2465 | parse | 0.136 | 0.121 | 0.259 | 7357.372 |
| agent-graph | 2465 | compile | 0.172 | 0.133 | 0.340 | 5823.028 |
| agent-graph | 2465 | run | 0.150 | 0.126 | 0.306 | 6684.802 |
| agent-graph | 2465 | capsule-build | 1.877 | 1.778 | 2.611 | 532.881 |
| agent-graph | 2465 | capsule-verify | 1.794 | 1.792 | 2.080 | 557.519 |
| agent-graph | 2465 | capsule-run | 0.345 | 0.311 | 0.557 | 2898.329 |
| invoice-calculation | 887 | parse | 0.062 | 0.062 | 0.063 | 16050.660 |
| invoice-calculation | 887 | compile | 0.085 | 0.085 | 0.090 | 11732.104 |
| invoice-calculation | 887 | run | 0.140 | 0.131 | 0.184 | 7125.532 |
| invoice-calculation | 887 | capsule-build | 0.657 | 0.636 | 0.815 | 1522.012 |
| invoice-calculation | 887 | capsule-verify | 0.632 | 0.583 | 0.855 | 1582.995 |
| invoice-calculation | 887 | capsule-run | 0.155 | 0.139 | 0.203 | 6436.442 |
| data-transform | 639 | parse | 0.022 | 0.022 | 0.022 | 45842.400 |
| data-transform | 639 | compile | 0.087 | 0.048 | 0.189 | 11505.278 |
| data-transform | 639 | run | 0.157 | 0.136 | 0.334 | 6353.517 |
| data-transform | 639 | capsule-build | 0.579 | 0.531 | 0.991 | 1727.443 |
| data-transform | 639 | capsule-verify | 0.527 | 0.501 | 0.728 | 1897.578 |
| data-transform | 639 | capsule-run | 0.145 | 0.128 | 0.173 | 6876.195 |
| recursive-factorial | 394 | parse | 0.012 | 0.011 | 0.013 | 86809.323 |
| recursive-factorial | 394 | compile | 0.037 | 0.022 | 0.031 | 26978.442 |
| recursive-factorial | 394 | run | 0.215 | 0.148 | 0.687 | 4644.380 |
| recursive-factorial | 394 | capsule-build | 0.368 | 0.343 | 0.521 | 2720.915 |
| recursive-factorial | 394 | capsule-verify | 0.358 | 0.321 | 0.497 | 2793.134 |
| recursive-factorial | 394 | capsule-run | 0.136 | 0.133 | 0.139 | 7369.796 |

_Every value above is measured in this run; the report contains no precomputed timings._
