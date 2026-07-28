space workflow_recovery

edition 1

fault SearchUnavailable
  field service Text
  field retry_after Duration
/fault

workflow investigate
  take question Text
  stage search ask researcher.search query question
  recover search on SearchUnavailable retry attempts 2 backoff exponential
  stage verify ask critic.verify evidence search after search
  stage answer ask writer.answer evidence verify after verify
  compensate verify ask researcher.forget trace search
  give Report from answer
/workflow
