# Axirune for Visual Studio Code

This extension bundles the Axirune language server and contributes syntax
highlighting, snippets, diagnostics, frame-aware folding, formatting, and
capability-manifest commands for `.axi` files. Legacy `.nxl` files remain
recognized during the 0.3 migration release.

Axirune is also a deterministic general-purpose task language. Start with the
`program` snippet for a complete pure program, `task` for a reusable function,
or `calltask` for a task expression call. None of these require an LLM, an
agent, or network access.

Run the current file with the local toolchain:

```sh
axirune run application.axi
axirune run application.axi --input-json '{"name":"Ada"}'
```

Host effects are denied by default. Grant only the roots and exact hosts a
program needs:

```sh
axirune run files.axi --allow-read ./data --allow-write ./output
axirune run fetch.axi --allow-net api.example.com
```

The corresponding host calls are `File.readText(:path)`,
`File.writeText(:path :text)`, `File.exists(:path)`, `File.list(:path)`, and
`Http.get(:url)`. Their stable capabilities are `host.fs.read`,
`host.fs.write`, and `host.net.fetch`. Filesystem paths are checked after
symlink resolution. HTTP redirects are re-authorized one hop at a time.

The bundled language server provides diagnostics, completion, hover,
definitions, document symbols, and canonical formatting over stdio. The
extension never downloads or invokes a remote language server.
