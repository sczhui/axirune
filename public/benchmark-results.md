# Nexilume benchmark

Generated: 2026-07-28T03:46:39.079Z

Input checksum: `sha256:ac2be71f2b37d0e986e1b3743c363610bd55e16236bccb173f84bffcd6f55ac8`

Runtime: v22.23.1 · darwin/arm64 · Apple M4

Configuration: 30 measured samples after 5 warmups.

| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| hello | 153 | parse | 0.034 | 0.016 | 0.122 | 29769.199 |
| hello | 153 | compile | 0.023 | 0.016 | 0.067 | 43652.491 |
| hello | 153 | run | 0.039 | 0.022 | 0.084 | 25804.676 |
| agent-graph | 2455 | parse | 0.185 | 0.180 | 0.358 | 5400.865 |
| agent-graph | 2455 | compile | 0.135 | 0.117 | 0.220 | 7427.732 |
| agent-graph | 2455 | run | 0.142 | 0.111 | 0.354 | 7037.847 |

_Every value above is measured in this run; the report contains no precomputed timings._
