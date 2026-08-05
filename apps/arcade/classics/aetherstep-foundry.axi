space aetherstep_foundry

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.72 :right [call Number.add :left 0.92 :right [call Number.multiply :left stage :right 0.055] ] ]
  let enemy_speed = [call Number.min :left 238 :right [call Number.add :left 92 :right [call Number.multiply :left stage :right 8] ] ]
  let spawn_interval_ms = [call Number.max :left 520 :right [call Number.subtract :left 1420 :right [call Number.multiply :left stage :right 58] ] ]
  let reward = [call Number.add :left 120 :right [call Number.multiply :left streak :right 14] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «aetherstep-foundry» :stage stage :score score :tempo tempo :gravity 1680 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
