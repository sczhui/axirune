space moonthread_ronin

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.86 :right [call Number.add :left 0.98 :right [call Number.multiply :left stage :right 0.052] ] ]
  let enemy_speed = [call Number.min :left 270 :right [call Number.add :left 112 :right [call Number.multiply :left stage :right 9] ] ]
  let spawn_interval_ms = [call Number.max :left 480 :right [call Number.subtract :left 1320 :right [call Number.multiply :left stage :right 55] ] ]
  let reward = [call Number.add :left 145 :right [call Number.multiply :left streak :right 22] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «moonthread-ronin» :stage stage :score score :tempo tempo :gravity 1540 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
