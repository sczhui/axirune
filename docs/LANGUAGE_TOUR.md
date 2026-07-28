# Nexilume language tour

Nexilume is a language for programs whose principal collaborators are people,
language models, tools, and other agents. Its source is a semantic ledger:
every declaration is an explicit frame, every effect names the authority it
needs, and every run can produce a replayable trace.

The design target is not fewer keystrokes. It is fewer hidden assumptions.

## 1. Source has stable semantic frames

```nexilume
task greet
  take name Text
  give Text
  yield [call Text.join
    :parts [list «Hello, » name «!»]
  ]
/task
```

Indentation is presentation only. `/task` closes a task, `/agent` closes an
agent, and so on. A parser can recover at the next frame boundary, while a
refactoring tool can move or replace whole frames without guessing where a
brace belongs. Calls use named arguments; Nexilume has no positional arguments.

## 2. Types carry evidence

Types describe shape, effects, trust, and ownership:

- `Text trust untrusted` cannot enter an instruction slot.
- `Verified<Claim>` records which validator produced the evidence.
- `Lease<Resource>` is affine: it can be transferred, but not copied.
- `Outcome<Value Fault>` makes failure part of the result.
- refinements such as `Port where 0 < self and self < 65536` are checked at
  constructors and tool boundaries.

There is no universal null and no implicit coercion. Exhaustiveness is checked
for forms and faults. Public definitions receive stable semantic IDs derived
from their space, kind, and name, so formatting does not invalidate references.

## 3. Effects require capabilities

```nexilume
capability weather.read
  effect network.read
  resource «https://weather.example/v1»
/capability
```

A capability is an unforgeable handle saying what an execution could do.
A permission is a policy decision saying whether it may do it now. A sandbox
is the resource boundary that enforces both. Compiling a package emits a
capability manifest that can be reviewed without reading implementation code.

The default authority set is empty. Ambient filesystem, network, environment,
clock, randomness, process, model, and MCP access do not exist.

## 4. Errors are values, cancellation is a signal

Nexilume has no hidden exception channel. A fallible operation returns an
`Outcome`. A caller must pass the fault onward or recover it. Recovery belongs
to the workflow, next to retry and compensation policy, rather than in a
far-away catch block.

Cancellation is not an error. It flows down a structured task tree and all
children must reach a terminal state before their parent closes.

## 5. Concurrency is a deterministic task tree

Agents and stages run in a structured constellation. Children cannot outlive
their parent. Shared mutable memory is absent; branches exchange immutable
values or append events to memory with a declared merge law. A logical clock,
fixed scheduler seed, and tool receipts make a run replayable.

Parallelism is bounded by an explicit lane budget. Races return a typed winner
and cancel the remaining branches. Timeouts, token limits, and tool-call limits
are part of a scope, not global runtime flags.

## 6. Memory and context are different

Program memory is a typed event journal with one of four lifetimes: `turn`,
`session`, `workflow`, or `durable`. Durable memory declares a schema version,
retention, merge law, compaction policy, and budget. Reads return snapshots;
writes append events.

Agent context is a compiled view. A context policy selects sources, establishes
trust, orders evidence, redacts secrets, accounts for tokens, and records every
omission. Context compilation produces a `Context<T>` plus a receipt. A prompt
cannot silently read all memory.

## 7. Prompts are typed programs

```nexilume
prompt triage
  slot ticket Ticket trust untrusted
  instruction «Classify the ticket.»
  attach ticket as data
  expect Decision
  budget tokens 600
/prompt
```

Instruction text and attached data are separate channels. Slots are typed and
trust-labelled. The expected result is a schema, not a parsing convention.
The compiler can diagnose a prompt-injection path, a missing source, or a token
budget that cannot fit the fixed instructions.

## 8. Tools and MCP are protocol boundaries

Tools declare input, output, faults, effects, permission mode, idempotency, and
receipts. The runtime validates both directions. Retries reuse an idempotency
key when the contract permits it.

MCP is native rather than a library convention. An MCP frame pins protocol and
transport, imports tools/resources/prompts, and narrows server authority.
Discovery produces unknown capabilities that cannot be invoked until they are
narrowed and granted.

## 9. Agents are authority envelopes

An agent combines handlers, a model profile, context policy, memory access,
budgets, and granted capabilities. It is not a mutable object and it is not a
thread. The compiler can answer: what can this agent read, which tools can it
call, what data can leave its sandbox, and what is the maximum cost of one
handler?

## 10. Workflows are typed, replayable graphs

A workflow names stages and dependencies. Each stage has inputs, outputs,
authority, retry policy, timeout, and optional compensation. The graph is
checked for cycles and missing data before execution. A run produces a trace
that the IDE can display as a timeline or export as canonical JSON.

## 11. The compiler is part of the language contract

`nexilume check` emits stable diagnostics with spans and machine-applicable edits.
`nexilume fmt` is idempotent. `nexilume ast`, `nexilume ir`, and `nexilume manifest` expose
the semantic model as JSON. `nexilume run` uses a fuel-limited interpreter and
mock adapters by default; real authority must be supplied explicitly.
