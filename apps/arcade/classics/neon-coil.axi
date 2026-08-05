space neon_coil

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 2.25 :right [call Number.add :left 0.88 :right [call Number.multiply :left stage :right 0.08] ] ]
  let enemy_speed = [call Number.min :left 230 :right [call Number.add :left 96 :right [call Number.multiply :left stage :right 8] ] ]
  let spawn_interval_ms = [call Number.max :left 260 :right [call Number.subtract :left 980 :right [call Number.multiply :left stage :right 42] ] ]
  let reward = [call Number.add :left 70 :right [call Number.multiply :left streak :right 16] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «neon-coil» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
