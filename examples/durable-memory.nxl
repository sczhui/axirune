space durable_memory

edition 1

shape Finding
  field source Text
  field claim Text
  field confidence Decimal
/shape

memory research_journal
  shape List Finding
  lifetime durable
  merge append
  retention days 30
  compact prompt summarize_old_findings
  budget items 5000
/memory

prompt summarize_old_findings
  slot findings List Finding trust verified
  instruction «Preserve sources and disagreements. Never invent consensus.»
  expect List Finding
/prompt

task main
  give Text
  emit «Durable memory is an explicit, versioned event journal.»
  yield «memory:research_journal»
/task

launch main
