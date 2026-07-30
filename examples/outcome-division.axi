space outcome_division

edition 2

task safe_divide
  take numerator Number
  take denominator Number
  give Outcome
  let is_zero = [call Number.equal :left denominator :right 0]
  yield [call Core.if :when is_zero :then [call Outcome.fail :fault [record :code «DIVIDE_BY_ZERO» :message «The denominator must not be zero.»]] :else [call Outcome.ok :value [call Number.divide :left numerator :right denominator]]]
/task

task main
  give Text
  let result = [call safe_divide :numerator 42 :denominator 0]
  let encoded = [call Json.encode :value result]
  emit encoded
  yield encoded
/task

launch main
