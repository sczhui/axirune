# Nexilume 0.2 security and authority model

Security starts with a distinction: deterministic computation is not an
external effect.

`Number`, `Bool`, `Text`, `List`, `Record`, `Json`, `Outcome`, user task calls,
and recursive evaluation execute inside the interpreter. They cannot read a
file, contact a service, inspect the environment, invoke MCP, or call a model.
A pure program therefore needs no capability and produces an empty authority
manifest.

## Three gates for effects

When a program intentionally reaches outside the interpreter, Nexilume
separates three questions:

1. **Capability:** can this execution name the operation and resource?
2. **Permission:** may this principal perform it in the current situation?
3. **Sandbox:** can the host enforce the promised resource boundary?

All three must agree before an adapter begins. The compiler derives a
capability manifest from source. The host narrows that manifest to concrete
handlers and allowlists. The runtime permission callback allows or denies a
request. Source permission directives remain available to manifests and custom
hosts. The adapter boundary is the final enforcement plane.

The same rule covers local I/O and AI:

```text
pure arithmetic / lists / JSON     no capability
filesystem read                    filesystem capability
network tool                       network capability
MCP import or invocation           MCP/resource capability
prompt/model invocation            model capability
```

AI is not privileged. A model adapter cannot invoke a tool on its own or add a
capability to the running program.

## Interpreter limits

The reference runtime bounds:

- executed steps and recursive frame depth;
- launches and tool calls;
- wall-clock execution time;
- output bytes and trace events;
- value depth and collection item count.

Recursion consumes the same bounded execution resources as any other task
call. `Core.if` evaluates only the selected branch, so an unselected recursive
or effectful branch does not run.

## Browser runtime

The browser runtime has no ambient filesystem, process, network, MCP, or model
authority. Deterministic examples run entirely in checked IR. Optional-effect
examples use labelled deterministic adapters unless a host explicitly supplies
another binding.

Source text is not evaluated as JavaScript. It passes through the Nexilume
parser, semantic compiler, versioned IR, and interpreter.

## Data and trace safety

Tool input and output are normalized before entering runtime values. Trace
events record calls, decisions, task frames, emissions, and outcomes. Hosts are
responsible for redacting secret adapter data before serialization; capability
manifests never contain secret values.

Prompt instructions and attached data remain distinct in optional AI programs.
Context, memory, and model access do not exist unless the source declares them
and the host supplies the corresponding capabilities.

## Host responsibility

The reference implementation is a language preview, not a replacement for
operating-system isolation. A host that binds filesystem, process, network,
MCP, or model adapters must map declared sandboxes to enforceable platform
controls and must reject authority broader than the compiled manifest.
