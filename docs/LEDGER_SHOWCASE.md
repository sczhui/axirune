# AxiLedger Showcase

AxiLedger is the first application showcase implemented in Axirune itself. It
is deliberately a normal, deterministic business program rather than an AI
workflow: Axirune source validates transactions, folds them into ledger totals,
groups expenses by category, emits JSON, and returns a typed report record.

Open the browser version at `/showcase/ledger`. The page supplies form data as
ordinary runtime input and renders the result returned by the Axirune
interpreter.

## What this proves

The checked-in application exercises a complete application path:

1. [`apps/axiledger/main.axi`](../apps/axiledger/main.axi) is parsed and compiled
   to checked Axirune IR.
2. The browser or CLI supplies `transactions` and `budget_cents`.
3. Pure Axirune tasks validate and aggregate every transaction.
4. The interpreter returns a report and an auditable deterministic trace.
5. The web showcase renders the report without reimplementing ledger rules in
   TypeScript.

The compiled capability manifest contains no capabilities, permissions, tools,
MCP servers, prompts, agents, or sandboxes. The web host runs it with an empty
capability set, no tool bindings, mock tools disabled, and a zero tool-call
budget. A model, network connection, API key, filesystem, clock, and random
source are not part of execution.

## Input contract

`main` accepts the following root input:

| Field | Type | Rule |
| --- | --- | --- |
| `transactions` | `List` | Each item is validated independently. |
| `budget_cents` | `Number` | Expense budget expressed in integer cents. |

Each valid transaction contains:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | `Text` | Required. |
| `description` | `Text` | Required. |
| `kind` | `Text` | Exactly `income` or `expense`. |
| `category` | `Text` | Required; used to group valid expenses. |
| `amount_cents` | `Number` | A positive safe integer. |

Missing fields, wrong types, unsupported kinds, fractional cents, zero, and
negative amounts increase `invalid_count` and never affect financial totals.

The repository includes
[`sample-input.json`](../apps/axiledger/sample-input.json), which intentionally
mixes valid and invalid transactions.

## Output contract

The returned value is a record with schema `axirune-ledger-report/1`:

| Field | Meaning |
| --- | --- |
| `currency` | Fixed to `USD` for this showcase. |
| `transaction_count` | Number of supplied list items. |
| `valid_count`, `invalid_count` | Validation result counts. |
| `income_cents`, `expense_cents` | Totals from valid transactions. |
| `net_cents` | Income minus expense. |
| `budget_cents`, `remaining_cents`, `over_budget` | Budget status. |
| `categories` | Record mapping each category to valid expense cents. |

Income does not appear in `categories`. The program also emits the canonical
JSON encoding of the same report. See
[`expected-output.json`](../apps/axiledger/expected-output.json) for the exact
checked-in sample result.

## Run locally

From the repository root:

```sh
npm run build:toolchain
node dist-toolchain/src/cli/axirune.js run apps/axiledger/main.axi \
  --input-json "$(node -p "JSON.stringify(require('./apps/axiledger/sample-input.json'))")" \
  --json
```

No `--allow-read`, `--allow-write`, or `--allow-net` flag is required because
the program requests no external authority.

## Independent acceptance tests

The toolchain acceptance suite checks the source artifact, compiler
diagnostics, empty capability manifest, exact sample output, repeat-run
determinism, canonical emission, and absence of tool/model/MCP activity. It
also runs 1,000 generated transactions on every test run:

```sh
npm test -- tests/toolchain/ledger-showcase.test.ts
```

The 10,000-transaction stress case is opt-in:

```sh
AXIRUNE_LEDGER_STRESS=1 npm test -- tests/toolchain/ledger-showcase.test.ts
```

The stress test verifies completion and every resulting total instead of using
a fragile wall-clock threshold. Runtime duration depends on the host and can be
reported separately as benchmark evidence.

## Scope

AxiLedger is an executable language showcase, not a production accounting
product. It intentionally keeps currency fixed, holds data in memory, and does
not persist records. Adding storage or network APIs would require explicit
Axirune capabilities and deployment permissions, making that authority visible
before execution.
