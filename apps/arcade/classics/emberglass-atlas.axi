space emberglass_atlas

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.58 :right [call Number.add :left 0.82 :right [call Number.multiply :left stage :right 0.045] ] ]
  let enemy_speed = [call Number.min :left 218 :right [call Number.add :left 78 :right [call Number.multiply :left stage :right 8] ] ]
  let spawn_interval_ms = [call Number.max :left 760 :right [call Number.subtract :left 2060 :right [call Number.multiply :left stage :right 76] ] ]
  let reward = [call Number.add :left 135 :right [call Number.multiply :left streak :right 20] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «emberglass-atlas» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
