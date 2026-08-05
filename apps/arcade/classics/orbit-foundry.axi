space orbit_foundry

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.88 :right [call Number.add :left 0.96 :right [call Number.multiply :left stage :right 0.05] ] ]
  let enemy_speed = [call Number.min :left 420 :right [call Number.add :left 250 :right [call Number.multiply :left stage :right 9] ] ]
  let spawn_interval_ms = [call Number.max :left 420 :right [call Number.subtract :left 1280 :right [call Number.multiply :left stage :right 50] ] ]
  let reward = [call Number.add :left 95 :right [call Number.multiply :left streak :right 24] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «orbit-foundry» :stage stage :score score :tempo tempo :gravity 460 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
