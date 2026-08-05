space sunwake_corsairs

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.9 :right [call Number.add :left 0.96 :right [call Number.multiply :left stage :right 0.06] ] ]
  let enemy_speed = [call Number.min :left 286 :right [call Number.add :left 108 :right [call Number.multiply :left stage :right 10] ] ]
  let spawn_interval_ms = [call Number.max :left 380 :right [call Number.subtract :left 1180 :right [call Number.multiply :left stage :right 52] ] ]
  let reward = [call Number.add :left 110 :right [call Number.multiply :left streak :right 16] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «sunwake-corsairs» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
