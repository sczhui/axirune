# Axirune benchmark

Generated: 2026-08-05T16:52:27.979Z

Input checksum: `sha256:deeb2552825c799f5913ea346de33d14abebc0f4bb3ae7c131b8f768ffffa37c`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 162 | parse | 0.024 | 0.019 | 0.060 | 41424.334 |
| hello | 162 | compile | 0.026 | 0.018 | 0.091 | 37735.991 |
| hello | 162 | run | 0.040 | 0.029 | 0.103 | 25074.031 |
| hello | 162 | capsule-build | 0.312 | 0.298 | 0.521 | 3206.328 |
| hello | 162 | capsule-verify | 0.283 | 0.248 | 0.494 | 3535.183 |
| hello | 162 | capsule-run | 0.045 | 0.032 | 0.152 | 22334.590 |
| agent-graph | 2465 | parse | 0.168 | 0.118 | 0.461 | 5940.840 |
| agent-graph | 2465 | compile | 0.142 | 0.127 | 0.253 | 7020.963 |
| agent-graph | 2465 | run | 0.132 | 0.120 | 0.244 | 7589.574 |
| agent-graph | 2465 | capsule-build | 1.912 | 1.842 | 2.525 | 523.016 |
| agent-graph | 2465 | capsule-verify | 1.859 | 1.801 | 2.356 | 537.811 |
| agent-graph | 2465 | capsule-run | 0.319 | 0.301 | 0.401 | 3134.522 |
| invoice-calculation | 887 | parse | 0.071 | 0.062 | 0.121 | 14032.928 |
| invoice-calculation | 887 | compile | 0.085 | 0.084 | 0.093 | 11730.008 |
| invoice-calculation | 887 | run | 0.142 | 0.112 | 0.198 | 7047.564 |
| invoice-calculation | 887 | capsule-build | 0.697 | 0.652 | 0.934 | 1434.063 |
| invoice-calculation | 887 | capsule-verify | 0.619 | 0.577 | 0.832 | 1614.810 |
| invoice-calculation | 887 | capsule-run | 0.144 | 0.131 | 0.157 | 6957.059 |
| data-transform | 639 | parse | 0.021 | 0.021 | 0.021 | 48507.897 |
| data-transform | 639 | compile | 0.086 | 0.038 | 0.154 | 11647.658 |
| data-transform | 639 | run | 0.109 | 0.104 | 0.148 | 9204.106 |
| data-transform | 639 | capsule-build | 0.599 | 0.552 | 0.856 | 1670.042 |
| data-transform | 639 | capsule-verify | 0.523 | 0.495 | 0.688 | 1912.076 |
| data-transform | 639 | capsule-run | 0.163 | 0.132 | 0.373 | 6137.950 |
| recursive-factorial | 394 | parse | 0.012 | 0.011 | 0.015 | 85816.039 |
| recursive-factorial | 394 | compile | 0.041 | 0.022 | 0.036 | 24158.655 |
| recursive-factorial | 394 | run | 0.154 | 0.130 | 0.206 | 6503.591 |
| recursive-factorial | 394 | capsule-build | 0.385 | 0.348 | 0.680 | 2599.381 |
| recursive-factorial | 394 | capsule-verify | 0.335 | 0.325 | 0.400 | 2982.119 |
| recursive-factorial | 394 | capsule-run | 0.129 | 0.121 | 0.148 | 7755.359 |

_Every value above is measured in this run; the report contains no precomputed timings._
