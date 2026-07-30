space factorial

edition 2

task factorial
  take n Number
  give Number
  let at_base = [call Number.lessOrEqual :left n :right 1]
  yield [call Core.if :when at_base :then 1 :else [call Number.multiply :left n :right [call factorial :n [call Number.subtract :left n :right 1]]]]
/task

task main
  give Number
  let result = [call factorial :n 6]
  emit result
  yield result
/task

launch main
