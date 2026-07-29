# Nexilume benchmark

Generated: 2026-07-29T04:43:51.971Z

Input checksum: `sha256:78bfa3fa5d49175b35cdd717bdaf606b4f5879058aeccc11d3d711462a068aed`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 163 | parse | 0.031 | 0.017 | 0.106 | 32398.878 |
| hello | 163 | compile | 0.021 | 0.019 | 0.052 | 47328.018 |
| hello | 163 | run | 0.083 | 0.041 | 0.256 | 12013.623 |
| agent-graph | 2465 | parse | 0.183 | 0.169 | 0.394 | 5450.131 |
| agent-graph | 2465 | compile | 0.167 | 0.143 | 0.336 | 5990.912 |
| agent-graph | 2465 | run | 0.152 | 0.123 | 0.294 | 6589.245 |
| invoice-calculation | 887 | parse | 0.072 | 0.064 | 0.080 | 13903.655 |
| invoice-calculation | 887 | compile | 0.091 | 0.086 | 0.106 | 11027.737 |
| invoice-calculation | 887 | run | 0.208 | 0.155 | 0.457 | 4811.744 |
| data-transform | 639 | parse | 0.024 | 0.023 | 0.028 | 41462.751 |
| data-transform | 639 | compile | 0.042 | 0.042 | 0.048 | 23649.179 |
| data-transform | 639 | run | 0.142 | 0.109 | 0.341 | 7042.389 |
| recursive-factorial | 394 | parse | 0.028 | 0.017 | 0.033 | 36045.129 |
| recursive-factorial | 394 | compile | 0.026 | 0.026 | 0.029 | 38720.019 |
| recursive-factorial | 394 | run | 0.231 | 0.162 | 0.638 | 4330.879 |

_Every value above is measured in this run; the report contains no precomputed timings._
