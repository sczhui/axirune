space bastion_treads

edition 2

task main
  take stage Number
  take score Number
  take streak Number
  give Record
  let tempo = [call Number.min :left 1.62 :right [call Number.add :left 0.84 :right [call Number.multiply :left stage :right 0.05] ] ]
  let enemy_speed = [call Number.min :left 164 :right [call Number.add :left 62 :right [call Number.multiply :left stage :right 7] ] ]
  let spawn_interval_ms = [call Number.max :left 690 :right [call Number.subtract :left 1860 :right [call Number.multiply :left stage :right 72] ] ]
  let reward = [call Number.add :left 150 :right [call Number.multiply :left streak :right 18] ]
  let phase = [call Core.if :when [call Number.greater :left stage :right 6] :then «surge» :else [call Core.if :when [call Number.greater :left stage :right 3] :then «charged» :else «calm» ] ]
  let rules = [record :schema «axirune-arcade/classic/1» :game «bastion-treads» :stage stage :score score :tempo tempo :gravity 0 :enemy_speed enemy_speed :spawn_interval_ms spawn_interval_ms :reward reward :phase phase]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
