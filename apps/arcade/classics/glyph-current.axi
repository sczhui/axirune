space glyph_current

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.66 :right [call Number.add :left 0.8 :right [call Number.multiply :left stage :right 0.05] ] ]
  let enemy_speed = [call Number.min :left 220 :right [call Number.add :left 76 :right [call Number.multiply :left stage :right 9] ] ]
  let spawn_interval_ms = [call Number.max :left 260 :right [call Number.subtract :left 1020 :right [call Number.multiply :left stage :right 44] ] ]
  let reward = [call Number.add :left 80 :right [call Number.multiply :left streak :right 28] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «glyph-current» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
