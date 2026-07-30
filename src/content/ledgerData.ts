export type LedgerKind = 'income' | 'expense'

export type LedgerTransaction = {
  id: string
  date: string
  description: string
  kind: LedgerKind
  category: string
  amountCents: number
  note: string
}

export type LedgerCategory = {
  value: string
  zh: string
  en: string
}

export const ledgerCategories: LedgerCategory[] = [
  { value: 'Income', zh: '收入', en: 'Income' },
  { value: 'Housing', zh: '住房', en: 'Housing' },
  { value: 'Food', zh: '餐饮', en: 'Food' },
  { value: 'Transport', zh: '交通', en: 'Transport' },
  { value: 'Software', zh: '软件服务', en: 'Software' },
  { value: 'Learning', zh: '学习', en: 'Learning' },
  { value: 'Health', zh: '健康', en: 'Health' },
  { value: 'Other', zh: '其他', en: 'Other' },
]

const SAMPLE_TRANSACTIONS: LedgerTransaction[] = [
  {
    id: 'txn-202607-001',
    date: '2026-07-01',
    description: 'Product design retainer',
    kind: 'income',
    category: 'Income',
    amountCents: 485_000,
    note: 'July client retainer',
  },
  {
    id: 'txn-202607-002',
    date: '2026-07-02',
    description: 'Studio rent',
    kind: 'expense',
    category: 'Housing',
    amountCents: 128_000,
    note: 'Monthly workspace',
  },
  {
    id: 'txn-202607-003',
    date: '2026-07-05',
    description: 'Cloud compute',
    kind: 'expense',
    category: 'Software',
    amountCents: 28_900,
    note: 'Production services',
  },
  {
    id: 'txn-202607-004',
    date: '2026-07-09',
    description: 'Team lunch',
    kind: 'expense',
    category: 'Food',
    amountCents: 18_460,
    note: 'Three people',
  },
  {
    id: 'txn-202607-005',
    date: '2026-07-14',
    description: 'Train and metro',
    kind: 'expense',
    category: 'Transport',
    amountCents: 8_750,
    note: 'Client workshop',
  },
  {
    id: 'txn-202607-006',
    date: '2026-07-18',
    description: 'Systems design course',
    kind: 'expense',
    category: 'Learning',
    amountCents: 34_900,
    note: 'Annual learning budget',
  },
  {
    id: 'txn-202607-007',
    date: '2026-07-23',
    description: 'Design system license',
    kind: 'expense',
    category: 'Software',
    amountCents: 12_000,
    note: 'Team plan',
  },
  {
    id: 'txn-202607-008',
    date: '2026-07-28',
    description: 'Dental check-up',
    kind: 'expense',
    category: 'Health',
    amountCents: 21_500,
    note: 'Routine care',
  },
]

export const DEFAULT_LEDGER_BUDGET_CENTS = 280_000

export function createSampleTransactions(): LedgerTransaction[] {
  return SAMPLE_TRANSACTIONS.map((transaction) => ({ ...transaction }))
}

export function categoryLabel(category: string, locale: 'zh' | 'en'): string {
  const match = ledgerCategories.find((entry) => entry.value === category)
  return match?.[locale] ?? category
}
