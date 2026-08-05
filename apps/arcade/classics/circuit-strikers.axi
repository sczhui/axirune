space circuit_strikers

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.8 :right [call Number.add :left 0.86 :right [call Number.multiply :left stage :right 0.052] ] ]
  let enemy_speed = [call Number.min :left 292 :right [call Number.add :left 124 :right [call Number.multiply :left stage :right 10] ] ]
  let spawn_interval_ms = [call Number.max :left 580 :right [call Number.subtract :left 1580 :right [call Number.multiply :left stage :right 64] ] ]
  let reward = [call Number.add :left 200 :right [call Number.multiply :left streak :right 26] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «circuit-strikers» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
