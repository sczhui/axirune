space vector_siege

edition 2

task main
  take wave Number
  take destroyed Number
  take combo Number
  give Record
  let wave_speed = [call Number.multiply :left wave :right 9]
  let enemy_speed = [call Number.min
    :left 210
    :right [call Number.add :left 72 :right wave_speed]
  ]
  let spawn_drop = [call Number.multiply :left wave :right 65]
  let spawn_interval_ms = [call Number.max
    :left 360
    :right [call Number.subtract :left 1050 :right spawn_drop]
  ]
  let enemy_health = [call Number.min
    :left 12
    :right [call Number.add
      :left 1
      :right [call Number.floor
        :value [call Number.divide :left wave :right 4]
      ]
    ]
  ]
  let wave_score = [call Number.multiply :left wave :right 15]
  let combo_score = [call Number.multiply :left combo :right 8]
  let score_per_hit = [call Number.add
    :left 90
    :right [call Number.add :left wave_score :right combo_score]
  ]
  let wingmen = [call Number.min
    :left 4
    :right [call Number.floor
      :value [call Number.divide :left wave :right 3]
    ]
  ]
  let threat = [call Core.if
    :when [call Number.greater :left wave :right 6]
    :then «critical»
    :else [call Core.if
      :when [call Number.greater :left wave :right 3]
      :then «elevated»
      :else «stable»
    ]
  ]
  let rules = [record
    :schema «axirune-arcade/vector-siege/1»
    :wave wave
    :destroyed destroyed
    :enemy_speed enemy_speed
    :spawn_interval_ms spawn_interval_ms
    :enemy_health enemy_health
    :score_per_hit score_per_hit
    :wingmen wingmen
    :threat threat
  ]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
