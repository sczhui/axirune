# Axirune benchmark

Generated: 2026-07-30T13:01:12.511Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.033 | 0.018 | 0.119 | 30416.925 |
| hello | 162 | compile | 0.025 | 0.021 | 0.064 | 40442.658 |
| hello | 162 | run | 0.042 | 0.031 | 0.106 | 23735.830 |
| agent-graph | 2465 | parse | 0.192 | 0.191 | 0.391 | 5200.846 |
| agent-graph | 2465 | compile | 0.174 | 0.155 | 0.294 | 5740.984 |
| agent-graph | 2465 | run | 0.161 | 0.143 | 0.292 | 6227.135 |
| invoice-calculation | 887 | parse | 0.078 | 0.071 | 0.078 | 12867.490 |
| invoice-calculation | 887 | compile | 0.097 | 0.092 | 0.116 | 10273.976 |
| invoice-calculation | 887 | run | 0.186 | 0.144 | 0.432 | 5377.389 |
| data-transform | 639 | parse | 0.026 | 0.026 | 0.028 | 38269.406 |
| data-transform | 639 | compile | 0.045 | 0.043 | 0.052 | 22406.185 |
| data-transform | 639 | run | 0.145 | 0.114 | 0.354 | 6877.054 |
| recursive-factorial | 394 | parse | 0.029 | 0.018 | 0.047 | 34407.024 |
| recursive-factorial | 394 | compile | 0.027 | 0.027 | 0.027 | 37595.917 |
| recursive-factorial | 394 | run | 0.204 | 0.159 | 0.652 | 4909.885 |

_Every value above is measured in this run; the report contains no precomputed timings._
