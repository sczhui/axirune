# Nexilume for Visual Studio Code

This extension bundles the Nexilume language server and contributes syntax
highlighting, snippets, diagnostics, frame-aware folding, formatting, and
capability-manifest commands for `.nxl` files.

Nexilume is also a deterministic general-purpose task language. Start with the
`program` snippet for a complete pure program, `task` for a reusable function,
or `calltask` for a task expression call. None of these require an LLM, an
agent, or network access.

Run the current file with the local toolchain:

```sh
nexilume run application.nxl
nexilume run application.nxl --input-json '{"name":"Ada"}'
```

Host effects are denied by default. Grant only the roots and exact hosts a
program needs:

```sh
nexilume run files.nxl --allow-read ./data --allow-write ./output
nexilume run fetch.nxl --allow-net api.example.com
```

The corresponding host calls are `File.readText(:path)`,
`File.writeText(:path :text)`, `File.exists(:path)`, `File.list(:path)`, and
`Http.get(:url)`. Their stable capabilities are `host.fs.read`,
`host.fs.write`, and `host.net.fetch`. Filesystem paths are checked after
symlink resolution. HTTP redirects are re-authorized one hop at a time.

The bundled language server provides diagnostics, completion, hover,
definitions, document symbols, and canonical formatting over stdio. The
extension never downloads or invokes a remote language server.
