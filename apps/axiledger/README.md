# AxiLedger

AxiLedger is a deterministic ledger report written entirely in Axirune. The
program accepts a list of transactions and a budget in integer cents, validates
the input, aggregates income and expenses, and returns a stable report record.
It uses no model, network, tool, capability, or ambient host state.

Each transaction must contain:

- `id`: text
- `description`: text
- `kind`: either `income` or `expense`
- `category`: text
- `amount_cents`: a positive safe integer

Invalid transactions are counted but never included in financial totals.
Expense categories are accumulated as an immutable record.

Run the sample from the repository root:

```sh
npm run build:toolchain
node dist-toolchain/src/cli/axirune.js run apps/axiledger/main.axi \
  --input-json "$(tr -d '\n' < apps/axiledger/sample-input.json)"
```

The task yields the report record and emits its canonical JSON encoding. The
expected record is stored in `expected-output.json`.
