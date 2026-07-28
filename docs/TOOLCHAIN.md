# Toolchain

The preview toolchain is deliberately inspectable:

```text
nexilume check examples/hello.nxl
nexilume run examples/hello.nxl
nexilume fmt examples/hello.nxl --write
nexilume ast examples/hello.nxl
nexilume ir examples/hello.nxl
nexilume manifest examples/tool-receipt.nxl
nexilume build examples/hello.nxl --out build/
nexilume bench
```

Diagnostics can be requested as canonical JSON for agent loops. Formatting is
idempotent. AST, IR, manifest, and trace outputs include schema versions. The
language server implements initialization, incremental text synchronization,
diagnostics, completion, hover, definition, document symbols, formatting, and
shutdown. The VS Code extension bundles that server; it does not download or
execute a remote binary.

The online IDE is local-first. Source is retained in browser storage, compilation
and execution happen in the page, and sharing uses an explicit URL fragment.
The demo adapters are deterministic and have no external authority.
