space harbor_brawl

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.74 :right [call Number.add :left 0.9 :right [call Number.multiply :left stage :right 0.05] ] ]
  let enemy_speed = [call Number.min :left 248 :right [call Number.add :left 94 :right [call Number.multiply :left stage :right 9] ] ]
  let spawn_interval_ms = [call Number.max :left 520 :right [call Number.subtract :left 1480 :right [call Number.multiply :left stage :right 61] ] ]
  let reward = [call Number.add :left 140 :right [call Number.multiply :left streak :right 23] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «harbor-brawl» :stage stage :score score :tempo tempo :gravity 920 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
