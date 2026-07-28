# Security and authority model

Nexilume separates three questions that conventional runtimes often collapse:

1. **Capability:** can this value name an operation?
2. **Permission:** may this principal perform it in this situation?
3. **Sandbox:** can the host enforce the promised boundary?

All three must agree before an effect begins. The compiler produces a
capability manifest from source. The host narrows that manifest to concrete
handles. The permission engine records allow, ask, or deny. The sandbox is the
last enforcement plane. A receipt records the decision without exposing secret
values.

The browser runtime ships with no network, filesystem, process, arbitrary MCP,
or model capability. Demonstrations use deterministic mock tools. Source is
interpreted as checked IR; generated JavaScript is never evaluated in the page.
Fuel, wall time, trace size, output size, and child count are bounded.

Prompt instructions and untrusted attachments remain separate. Context
compilation tracks provenance, secrecy, trust, token accounting, and omissions.
Tool input and output are schema-checked. Trace exporters redact secret values
and keep hashes for correlation.

This preview is a language research implementation, not a security boundary for
hostile native extensions. Hosts remain responsible for OS/container isolation
and for mapping declared sandboxes to enforceable primitives.
