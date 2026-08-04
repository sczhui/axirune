# Axirune Language

Axirune defines a programming model in which human-readable source and machine-consumable artifacts are equivalent views of checked program semantics.

## Language

**Source Projection**:
A human- and LLM-readable `.axi` representation of a program. It is an editable projection, not the sole authority for execution.
_Avoid_: Source of truth, prompt

**Checked Program**:
A program whose types, references, effects, and authority requirements have passed Axirune semantic validation.
_Avoid_: Generated code, unchecked IR

**Execution Capsule**:
A portable `.axc` artifact that carries a Checked Program together with its authority declaration, identity, and provenance.
_Avoid_: Opaque binary, native executable

**Capsule Verifier**:
The mandatory gate that establishes whether an Execution Capsule is structurally valid, internally consistent, and safe to hand to the runtime.
_Avoid_: Compiler, antivirus

**Authority Manifest**:
The complete declaration of capabilities, tools, sandboxes, and permissions required by a Checked Program.
_Avoid_: Runtime policy, credentials

**Semantic Digest**:
A content-derived identity for the execution semantics and Authority Manifest of a Checked Program.
_Avoid_: Signature, trust proof

**Provenance Claim**:
The non-secret, content-bound statement of how an Execution Capsule was produced, including whether its Checked Program came from Axirune source or direct artifact generation. It does not establish producer identity unless accompanied by a separately verified attestation.
_Avoid_: Signature, prompt transcript, credentials

**Direct Artifact Generation**:
An authoring path where an Agent emits an Execution Capsule without first emitting a Source Projection; the result has no execution privilege until verified.
_Avoid_: Direct machine code, trusted AI output
