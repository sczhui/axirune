space chromaline_circuit

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 2.1 :right [call Number.add :left 0.9 :right [call Number.multiply :left stage :right 0.07] ] ]
  let enemy_speed = [call Number.min :left 480 :right [call Number.add :left 220 :right [call Number.multiply :left stage :right 16] ] ]
  let spawn_interval_ms = [call Number.max :left 520 :right [call Number.subtract :left 1500 :right [call Number.multiply :left stage :right 62] ] ]
  let reward = [call Number.add :left 100 :right [call Number.multiply :left streak :right 12] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «chromaline-circuit» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
