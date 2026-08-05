# Axirune benchmark

Generated: 2026-08-05T15:38:25.151Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.023 | 0.020 | 0.035 | 43612.638 |
| hello | 162 | compile | 0.026 | 0.020 | 0.066 | 38295.835 |
| hello | 162 | run | 0.041 | 0.030 | 0.109 | 24358.103 |
| hello | 162 | capsule-build | 0.307 | 0.297 | 0.474 | 3257.728 |
| hello | 162 | capsule-verify | 0.261 | 0.246 | 0.375 | 3827.690 |
| hello | 162 | capsule-run | 0.039 | 0.034 | 0.099 | 25352.934 |
| agent-graph | 2465 | parse | 0.156 | 0.133 | 0.309 | 6421.520 |
| agent-graph | 2465 | compile | 0.168 | 0.142 | 0.293 | 5968.760 |
| agent-graph | 2465 | run | 0.168 | 0.140 | 0.351 | 5959.182 |
| agent-graph | 2465 | capsule-build | 1.949 | 1.867 | 2.260 | 513.209 |
| agent-graph | 2465 | capsule-verify | 1.889 | 1.853 | 2.150 | 529.502 |
| agent-graph | 2465 | capsule-run | 0.352 | 0.320 | 0.498 | 2839.419 |
| invoice-calculation | 887 | parse | 0.066 | 0.066 | 0.067 | 15109.247 |
| invoice-calculation | 887 | compile | 0.103 | 0.090 | 0.249 | 9689.262 |
| invoice-calculation | 887 | run | 0.159 | 0.128 | 0.224 | 6274.456 |
| invoice-calculation | 887 | capsule-build | 0.703 | 0.661 | 0.866 | 1423.006 |
| invoice-calculation | 887 | capsule-verify | 0.611 | 0.599 | 0.754 | 1635.672 |
| invoice-calculation | 887 | capsule-run | 0.147 | 0.139 | 0.158 | 6819.023 |
| data-transform | 639 | parse | 0.022 | 0.022 | 0.022 | 46097.820 |
| data-transform | 639 | compile | 0.073 | 0.039 | 0.096 | 13605.942 |
| data-transform | 639 | run | 0.199 | 0.144 | 0.434 | 5027.651 |
| data-transform | 639 | capsule-build | 0.631 | 0.592 | 0.874 | 1584.594 |
| data-transform | 639 | capsule-verify | 0.554 | 0.519 | 0.727 | 1804.652 |
| data-transform | 639 | capsule-run | 0.174 | 0.141 | 0.356 | 5737.093 |
| recursive-factorial | 394 | parse | 0.013 | 0.012 | 0.014 | 79866.889 |
| recursive-factorial | 394 | compile | 0.047 | 0.024 | 0.035 | 21491.311 |
| recursive-factorial | 394 | run | 0.168 | 0.141 | 0.209 | 5967.829 |
| recursive-factorial | 394 | capsule-build | 0.401 | 0.363 | 0.777 | 2492.696 |
| recursive-factorial | 394 | capsule-verify | 0.354 | 0.332 | 0.446 | 2823.109 |
| recursive-factorial | 394 | capsule-run | 0.144 | 0.134 | 0.173 | 6921.677 |

_Every value above is measured in this run; the report contains no precomputed timings._
