# Axirune benchmark

Generated: 2026-07-30T07:51:36.837Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.029 | 0.016 | 0.105 | 33992.601 |
| hello | 162 | compile | 0.023 | 0.019 | 0.058 | 43878.509 |
| hello | 162 | run | 0.040 | 0.027 | 0.093 | 25122.977 |
| agent-graph | 2465 | parse | 0.175 | 0.172 | 0.319 | 5705.954 |
| agent-graph | 2465 | compile | 0.165 | 0.142 | 0.288 | 6060.807 |
| agent-graph | 2465 | run | 0.150 | 0.128 | 0.275 | 6664.139 |
| invoice-calculation | 887 | parse | 0.069 | 0.063 | 0.077 | 14388.779 |
| invoice-calculation | 887 | compile | 0.090 | 0.084 | 0.105 | 11069.257 |
| invoice-calculation | 887 | run | 0.159 | 0.138 | 0.434 | 6294.530 |
| data-transform | 639 | parse | 0.025 | 0.024 | 0.027 | 40554.132 |
| data-transform | 639 | compile | 0.041 | 0.040 | 0.044 | 24194.387 |
| data-transform | 639 | run | 0.138 | 0.108 | 0.385 | 7261.718 |
| recursive-factorial | 394 | parse | 0.027 | 0.017 | 0.034 | 37078.831 |
| recursive-factorial | 394 | compile | 0.027 | 0.026 | 0.030 | 36578.050 |
| recursive-factorial | 394 | run | 0.190 | 0.148 | 0.593 | 5255.318 |

_Every value above is measured in this run; the report contains no precomputed timings._
