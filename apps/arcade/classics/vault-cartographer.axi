space vault_cartographer

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.42 :right [call Number.add :left 0.7 :right [call Number.multiply :left stage :right 0.04] ] ]
  let enemy_speed = [call Number.min :left 160 :right [call Number.add :left 54 :right [call Number.multiply :left stage :right 6] ] ]
  let spawn_interval_ms = [call Number.max :left 820 :right [call Number.subtract :left 2280 :right [call Number.multiply :left stage :right 82] ] ]
  let reward = [call Number.add :left 175 :right [call Number.multiply :left streak :right 30] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «vault-cartographer» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
