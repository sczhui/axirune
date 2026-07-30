space axiledger

edition 2

task mark_invalid
  take accumulator Record
  give Record
  let previous = [call Record.get :record accumulator :key «invalid_count»]
  let next = [call Number.add :left previous :right 1]
  yield [call Record.put :record accumulator :key «invalid_count» :value next]
/task

task add_expense_category
  take accumulator Record
  take transaction Record
  give Record
  let categories = [call Record.get :record accumulator :key «categories»]
  let category = [call Record.get :record transaction :key «category»]
  let amount_cents = [call Record.get :record transaction :key «amount_cents»]
  let exists = [call Record.has :record categories :key category]
  let previous = [call Core.if
    :when exists
    :then [call Record.get :record categories :key category]
    :else 0
  ]
  let next = [call Number.add :left previous :right amount_cents]
  let updated = [call Record.put :record categories :key category :value next]
  yield [call Record.put :record accumulator :key «categories» :value updated]
/task

task add_valid
  take accumulator Record
  take transaction Record
  give Record
  let amount_cents = [call Record.get :record transaction :key «amount_cents»]
  let kind = [call Record.get :record transaction :key «kind»]
  let is_income = [call Text.equal :left kind :right «income»]
  let income_cents = [call Record.get :record accumulator :key «income_cents»]
  let expense_cents = [call Record.get :record accumulator :key «expense_cents»]
  let valid_count = [call Record.get :record accumulator :key «valid_count»]
  let next_income = [call Core.if
    :when is_income
    :then [call Number.add :left income_cents :right amount_cents]
    :else income_cents
  ]
  let next_expense = [call Core.if
    :when is_income
    :then expense_cents
    :else [call Number.add :left expense_cents :right amount_cents]
  ]
  let with_income = [call Record.put :record accumulator :key «income_cents» :value next_income]
  let with_expense = [call Record.put :record with_income :key «expense_cents» :value next_expense]
  let with_count = [call Record.put
    :record with_expense
    :key «valid_count»
    :value [call Number.add :left valid_count :right 1]
  ]
  yield [call Core.if
    :when is_income
    :then with_count
    :else [call add_expense_category
      :accumulator with_count
      :transaction transaction
    ]
  ]
/task

task validate_complete
  take accumulator Record
  take transaction Record
  give Record
  let id = [call Record.get :record transaction :key «id»]
  let description = [call Record.get :record transaction :key «description»]
  let kind = [call Record.get :record transaction :key «kind»]
  let category = [call Record.get :record transaction :key «category»]
  let amount_cents = [call Record.get :record transaction :key «amount_cents»]
  let id_is_text = [call Text.equal
    :left [call Core.type :value id]
    :right «Text»
  ]
  let description_is_text = [call Text.equal
    :left [call Core.type :value description]
    :right «Text»
  ]
  let kind_is_text = [call Text.equal
    :left [call Core.type :value kind]
    :right «Text»
  ]
  let category_is_text = [call Text.equal
    :left [call Core.type :value category]
    :right «Text»
  ]
  let amount_is_number = [call Text.equal
    :left [call Core.type :value amount_cents]
    :right «Number»
  ]
  let amount_is_integer = [call Bool.and
    :left amount_is_number
    :right [call Number.isInteger :value amount_cents]
  ]
  let amount_is_positive = [call Bool.and
    :left amount_is_integer
    :right [call Number.greater :left amount_cents :right 0]
  ]
  let kind_is_allowed = [call Bool.and
    :left kind_is_text
    :right [call Bool.or
      :left [call Text.equal :left kind :right «income»]
      :right [call Text.equal :left kind :right «expense»]
    ]
  ]
  let text_fields_are_valid = [call Bool.and
    :left id_is_text
    :right [call Bool.and
      :left description_is_text
      :right category_is_text
    ]
  ]
  let transaction_is_valid = [call Bool.and
    :left text_fields_are_valid
    :right [call Bool.and
      :left kind_is_allowed
      :right amount_is_positive
    ]
  ]
  yield [call Core.if
    :when transaction_is_valid
    :then [call add_valid
      :accumulator accumulator
      :transaction transaction
    ]
    :else [call mark_invalid :accumulator accumulator]
  ]
/task

task fold_transaction
  take accumulator Record
  take item Any
  take index Number
  give Record
  let item_is_record = [call Text.equal
    :left [call Core.type :value item]
    :right «Record»
  ]
  let fields_present = [call Bool.and
    :left item_is_record
    :right [call Bool.and
      :left [call Record.has :record item :key «id»]
      :right [call Bool.and
        :left [call Record.has :record item :key «description»]
        :right [call Bool.and
          :left [call Record.has :record item :key «kind»]
          :right [call Bool.and
            :left [call Record.has :record item :key «category»]
            :right [call Record.has :record item :key «amount_cents»]
          ]
        ]
      ]
    ]
  ]
  yield [call Core.if
    :when fields_present
    :then [call validate_complete
      :accumulator accumulator
      :transaction item
    ]
    :else [call mark_invalid :accumulator accumulator]
  ]
/task

task main
  take transactions List
  take budget_cents Number
  give Record
  let initial = [record :income_cents 0 :expense_cents 0 :valid_count 0 :invalid_count 0 :categories [record]]
  let totals = [call List.fold :list transactions :using «fold_transaction» :initial initial]
  let income_cents = [call Record.get :record totals :key «income_cents»]
  let expense_cents = [call Record.get :record totals :key «expense_cents»]
  let report = [record
    :schema «axirune-ledger-report/1»
    :currency «USD»
    :transaction_count [call List.length :list transactions]
    :valid_count [call Record.get :record totals :key «valid_count»]
    :invalid_count [call Record.get :record totals :key «invalid_count»]
    :income_cents income_cents
    :expense_cents expense_cents
    :net_cents [call Number.subtract :left income_cents :right expense_cents]
    :budget_cents budget_cents
    :remaining_cents [call Number.subtract :left budget_cents :right expense_cents]
    :over_budget [call Number.greater :left expense_cents :right budget_cents]
    :categories [call Record.get :record totals :key «categories»]
  ]
  emit [call Json.encode :value report]
  yield report
/task

launch main
