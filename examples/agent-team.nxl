space agent_team

edition 1

memory field_notes
  shape List Text
  lifetime session
  merge append
  budget items 128
/memory

agent scout
  model balanced
  remember field_notes
  need web.read
  context budget tokens 12000
  budget tokens 4000
  budget tool_calls 8
  handle research
/agent

agent editor
  model precise
  context budget tokens 8000
  budget tokens 2200
  handle compose
/agent

workflow brief
  take topic Text
  stage collect ask scout.research topic topic
  stage write ask editor.compose notes collect after collect
  give Text from write
/workflow
