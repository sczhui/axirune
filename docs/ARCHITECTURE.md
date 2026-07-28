# Reference implementation architecture

The reference implementation is written in strict TypeScript so the exact same
front end and interpreter can run in Node.js and a browser.

```text
source (.nxl)
  → recoverable parser
  → semantic frames + diagnostics
  → effect / authority analysis
  → checked Nexilume IR
  → fuel-limited runtime
  → output + semantic trace + capability manifest
```

`src/language` owns source contracts, AST, formatting, compilation, manifest
generation, and execution. `src/cli` exposes those contracts for automation.
`src/lsp` speaks JSON-RPC over stdio without depending on editor APIs.
`packages/vscode-extension` launches the bundled language server and contributes
the grammar, snippets, commands, and language configuration. The React site
imports the same language package for the Playground and IDE.

The production website is a static Vite build served by unprivileged Nginx.
There is no application backend, account system, telemetry collector, or
remote code evaluator. Docker starts with a read-only root filesystem, drops
Linux capabilities, and exposes only its internal port to the existing reverse
proxy network.
