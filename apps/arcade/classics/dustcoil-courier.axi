space dustcoil_courier

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.78 :right [call Number.add :left 0.86 :right [call Number.multiply :left stage :right 0.056] ] ]
  let enemy_speed = [call Number.min :left 390 :right [call Number.add :left 174 :right [call Number.multiply :left stage :right 13] ] ]
  let spawn_interval_ms = [call Number.max :left 640 :right [call Number.subtract :left 1720 :right [call Number.multiply :left stage :right 68] ] ]
  let reward = [call Number.add :left 130 :right [call Number.multiply :left streak :right 15] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «dustcoil-courier» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
