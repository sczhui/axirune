# Axirune benchmark

Generated: 2026-08-04T09:59:29.436Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.024 | 0.021 | 0.030 | 41787.677 |
| hello | 162 | compile | 0.025 | 0.020 | 0.062 | 39708.697 |
| hello | 162 | run | 0.043 | 0.030 | 0.121 | 23319.862 |
| hello | 162 | capsule-build | 0.315 | 0.287 | 0.579 | 3173.582 |
| hello | 162 | capsule-verify | 0.256 | 0.235 | 0.354 | 3907.248 |
| hello | 162 | capsule-run | 0.040 | 0.034 | 0.097 | 25295.110 |
| agent-graph | 2465 | parse | 0.159 | 0.135 | 0.302 | 6274.942 |
| agent-graph | 2465 | compile | 0.151 | 0.137 | 0.278 | 6607.077 |
| agent-graph | 2465 | run | 0.147 | 0.131 | 0.267 | 6786.182 |
| agent-graph | 2465 | capsule-build | 1.879 | 1.884 | 2.035 | 532.179 |
| agent-graph | 2465 | capsule-verify | 1.825 | 1.820 | 2.170 | 547.840 |
| agent-graph | 2465 | capsule-run | 0.341 | 0.320 | 0.460 | 2933.509 |
| invoice-calculation | 887 | parse | 0.064 | 0.064 | 0.066 | 15525.620 |
| invoice-calculation | 887 | compile | 0.110 | 0.092 | 0.143 | 9085.048 |
| invoice-calculation | 887 | run | 0.163 | 0.132 | 0.241 | 6129.693 |
| invoice-calculation | 887 | capsule-build | 0.777 | 0.722 | 1.315 | 1287.498 |
| invoice-calculation | 887 | capsule-verify | 0.618 | 0.588 | 0.742 | 1618.956 |
| invoice-calculation | 887 | capsule-run | 0.164 | 0.150 | 0.185 | 6098.591 |
| data-transform | 639 | parse | 0.024 | 0.023 | 0.029 | 41548.887 |
| data-transform | 639 | compile | 0.060 | 0.043 | 0.060 | 16541.074 |
| data-transform | 639 | run | 0.168 | 0.126 | 0.466 | 5947.560 |
| data-transform | 639 | capsule-build | 0.587 | 0.549 | 0.726 | 1704.456 |
| data-transform | 639 | capsule-verify | 0.515 | 0.499 | 0.608 | 1943.372 |
| data-transform | 639 | capsule-run | 0.145 | 0.133 | 0.165 | 6905.073 |
| recursive-factorial | 394 | parse | 0.013 | 0.013 | 0.016 | 74704.171 |
| recursive-factorial | 394 | compile | 0.043 | 0.025 | 0.042 | 23316.147 |
| recursive-factorial | 394 | run | 0.163 | 0.143 | 0.188 | 6144.394 |
| recursive-factorial | 394 | capsule-build | 0.358 | 0.338 | 0.613 | 2792.234 |
| recursive-factorial | 394 | capsule-verify | 0.326 | 0.318 | 0.417 | 3063.531 |
| recursive-factorial | 394 | capsule-run | 0.137 | 0.133 | 0.139 | 7288.566 |

_Every value above is measured in this run; the report contains no precomputed timings._
