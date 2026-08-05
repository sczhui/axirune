space prism_stack

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 2.2 :right [call Number.add :left 0.72 :right [call Number.multiply :left stage :right 0.09] ] ]
  let enemy_speed = [call Number.min :left 260 :right [call Number.add :left 80 :right [call Number.multiply :left stage :right 11] ] ]
  let spawn_interval_ms = [call Number.max :left 140 :right [call Number.subtract :left 880 :right [call Number.multiply :left stage :right 45] ] ]
  let reward = [call Number.add :left 90 :right [call Number.multiply :left streak :right 25] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «prism-stack» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
