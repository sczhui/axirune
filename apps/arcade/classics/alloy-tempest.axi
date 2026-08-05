space alloy_tempest

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.94 :right [call Number.add :left 1 :right [call Number.multiply :left stage :right 0.058] ] ]
  let enemy_speed = [call Number.min :left 296 :right [call Number.add :left 118 :right [call Number.multiply :left stage :right 10] ] ]
  let spawn_interval_ms = [call Number.max :left 340 :right [call Number.subtract :left 1090 :right [call Number.multiply :left stage :right 49] ] ]
  let reward = [call Number.add :left 125 :right [call Number.multiply :left streak :right 18] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «alloy-tempest» :stage stage :score score :tempo tempo :gravity 1420 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
