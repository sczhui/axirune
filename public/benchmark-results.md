# Axirune benchmark

Generated: 2026-08-05T13:05:11.331Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.024 | 0.020 | 0.034 | 42497.974 |
| hello | 162 | compile | 0.025 | 0.020 | 0.061 | 39713.270 |
| hello | 162 | run | 0.043 | 0.031 | 0.124 | 23145.130 |
| hello | 162 | capsule-build | 0.352 | 0.293 | 0.751 | 2842.109 |
| hello | 162 | capsule-verify | 0.289 | 0.252 | 0.449 | 3462.288 |
| hello | 162 | capsule-run | 0.041 | 0.035 | 0.102 | 24117.365 |
| agent-graph | 2465 | parse | 0.179 | 0.140 | 0.335 | 5588.936 |
| agent-graph | 2465 | compile | 0.172 | 0.139 | 0.327 | 5814.421 |
| agent-graph | 2465 | run | 0.156 | 0.137 | 0.277 | 6402.166 |
| agent-graph | 2465 | capsule-build | 1.968 | 1.862 | 2.658 | 508.235 |
| agent-graph | 2465 | capsule-verify | 2.002 | 1.861 | 2.640 | 499.458 |
| agent-graph | 2465 | capsule-run | 0.367 | 0.336 | 0.599 | 2724.404 |
| invoice-calculation | 887 | parse | 0.068 | 0.068 | 0.068 | 14725.704 |
| invoice-calculation | 887 | compile | 0.097 | 0.093 | 0.110 | 10359.409 |
| invoice-calculation | 887 | run | 0.195 | 0.125 | 0.614 | 5134.970 |
| invoice-calculation | 887 | capsule-build | 0.710 | 0.663 | 1.051 | 1407.561 |
| invoice-calculation | 887 | capsule-verify | 0.684 | 0.595 | 1.029 | 1461.273 |
| invoice-calculation | 887 | capsule-run | 0.157 | 0.144 | 0.182 | 6354.136 |
| data-transform | 639 | parse | 0.023 | 0.022 | 0.024 | 44271.948 |
| data-transform | 639 | compile | 0.061 | 0.070 | 0.077 | 16267.516 |
| data-transform | 639 | run | 0.231 | 0.138 | 0.360 | 4321.367 |
| data-transform | 639 | capsule-build | 0.647 | 0.605 | 1.017 | 1545.220 |
| data-transform | 639 | capsule-verify | 0.605 | 0.544 | 1.015 | 1654.142 |
| data-transform | 639 | capsule-run | 0.164 | 0.142 | 0.208 | 6108.375 |
| recursive-factorial | 394 | parse | 0.013 | 0.012 | 0.013 | 79103.285 |
| recursive-factorial | 394 | compile | 0.024 | 0.024 | 0.030 | 40839.497 |
| recursive-factorial | 394 | run | 0.170 | 0.140 | 0.202 | 5889.568 |
| recursive-factorial | 394 | capsule-build | 0.370 | 0.351 | 0.459 | 2701.384 |
| recursive-factorial | 394 | capsule-verify | 0.361 | 0.331 | 0.494 | 2766.623 |
| recursive-factorial | 394 | capsule-run | 0.142 | 0.135 | 0.148 | 7061.590 |

_Every value above is measured in this run; the report contains no precomputed timings._
