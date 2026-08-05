space river_oath

edition 2

task bound_progress
  take value Number
  take lower Number
  take upper Number
  give Number
  let integral = [call Number.floor :value value]
  let above_lower = [call Number.max :left lower :right integral]
  yield [call Number.min :left upper :right above_lower]
/task

task stage_identity
  take stage Number
  give Text
  yield [call Core.if
    :when [call Number.equal :left stage :right 1]
    :then «reedwater-causeway»
    :else [call Core.if
      :when [call Number.equal :left stage :right 2]
      :then «cinder-foundry»
      :else [call Core.if
        :when [call Number.equal :left stage :right 3]
        :then «moonwake-harbor»
        :else «cloudbreak-beacon»
      ]
    ]
  ]
/task

task wave_identity
  take stage Number
  take wave Number
  give Text
  yield [call Core.if
    :when [call Number.equal :left stage :right 1]
    :then [call Core.if
      :when [call Number.equal :left wave :right 1]
      :then «causeway-vanguard»
      :else [call Core.if
        :when [call Number.equal :left wave :right 2]
        :then «lantern-crossfire»
        :else «reedwater-warden»
      ]
    ]
    :else [call Core.if
      :when [call Number.equal :left stage :right 2]
      :then [call Core.if
        :when [call Number.equal :left wave :right 1]
        :then «furnace-line»
        :else [call Core.if
          :when [call Number.equal :left wave :right 2]
          :then «anvil-rush»
          :else «cinder-overseer»
        ]
      ]
      :else [call Core.if
        :when [call Number.equal :left stage :right 3]
        :then [call Core.if
          :when [call Number.equal :left wave :right 1]
          :then «moonwake-ambush»
          :else [call Core.if
            :when [call Number.equal :left wave :right 2]
            :then «tidewall-guard»
            :else «harbor-master»
          ]
        ]
        :else [call Core.if
          :when [call Number.equal :left wave :right 1]
          :then «beacon-ring»
          :else [call Core.if
            :when [call Number.equal :left wave :right 2]
            :then «skyfire-guard»
            :else «cloudbreak-oath»
          ]
        ]
      ]
    ]
  ]
/task

task boss_phase_for
  take stage Number
  take wave Number
  give Text
  let boss_wave = [call Number.greaterOrEqual :left wave :right 3]
  yield [call Core.if
    :when [call Bool.not :value boss_wave]
    :then «dormant»
    :else [call Core.if
      :when [call Number.equal :left stage :right 4]
      :then «cloudbreak-oath»
      :else [call Core.if
        :when [call Number.equal :left stage :right 3]
        :then «moonwake-veil»
        :else [call Core.if
          :when [call Number.equal :left stage :right 2]
          :then «cinder-fury»
          :else «reedwater-keeper»
        ]
      ]
    ]
  ]
/task

task drop_for
  take stage Number
  take wave Number
  take combo Number
  give Text
  let boss_wave = [call Number.greaterOrEqual :left wave :right 3]
  let final_stage = [call Number.equal :left stage :right 4]
  let final_boss = [call Bool.and :left boss_wave :right final_stage]
  yield [call Core.if
    :when final_boss
    :then «cloudbreak-signet»
    :else [call Core.if
      :when boss_wave
      :then «river-jade»
      :else [call Core.if
        :when [call Number.greaterOrEqual :left combo :right 8]
        :then «swift-brocade»
        :else [call Core.if
          :when [call Number.greaterOrEqual :left wave :right 2]
          :then «lantern-charm»
          :else «field-tonic»
        ]
      ]
    ]
  ]
/task

task difficulty_for
  take stage Number
  take wave Number
  give Text
  let final_stage = [call Number.greaterOrEqual :left stage :right 4]
  let late_stage = [call Number.greaterOrEqual :left stage :right 3]
  let boss_wave = [call Number.greaterOrEqual :left wave :right 3]
  let legend_bound = [call Bool.or
    :left final_stage
    :right [call Bool.and :left late_stage :right boss_wave]
  ]
  let middle_stage = [call Number.greaterOrEqual :left stage :right 2]
  let middle_wave = [call Number.greaterOrEqual :left wave :right 2]
  let tempered = [call Bool.or :left middle_stage :right middle_wave]
  yield [call Core.if
    :when legend_bound
    :then «legend-bound»
    :else [call Core.if
      :when tempered
      :then «tempered»
      :else «gathering»
    ]
  ]
/task

task main
  take stage Number
  take wave Number
  take defeated Number
  take combo Number
  give Record

  let stage_index = [call bound_progress :value stage :lower 1 :upper 4]
  let wave_index = [call bound_progress :value wave :lower 1 :upper 3]
  let defeated_index = [call bound_progress
    :value defeated
    :lower 0
    :upper 9999
  ]
  let combo_index = [call bound_progress :value combo :lower 0 :upper 30]

  let stage_key = [call stage_identity :stage stage_index]
  let wave_key = [call wave_identity :stage stage_index :wave wave_index]
  let stage_offset = [call Number.multiply
    :left [call Number.subtract :left stage_index :right 1]
    :right 3
  ]
  let campaign_index = [call Number.add :left stage_offset :right wave_index]

  let stage_speed = [call Number.multiply :left stage_index :right 15]
  let wave_speed = [call Number.multiply :left wave_index :right 12]
  let enemy_speed = [call Number.min
    :left 260
    :right [call Number.add
      :left 96
      :right [call Number.add :left stage_speed :right wave_speed]
    ]
  ]
  let stage_health = [call Number.multiply :left stage_index :right 25]
  let wave_health = [call Number.multiply :left wave_index :right 20]
  let enemy_health = [call Number.min
    :left 360
    :right [call Number.add
      :left 44
      :right [call Number.add :left stage_health :right wave_health]
    ]
  ]
  let stage_damage = [call Number.multiply :left stage_index :right 4]
  let wave_damage = [call Number.multiply :left wave_index :right 3]
  let enemy_damage = [call Number.min
    :left 72
    :right [call Number.add
      :left 7
      :right [call Number.add :left stage_damage :right wave_damage]
    ]
  ]
  let stage_guard = [call Number.multiply :left stage_index :right 3]
  let wave_guard = [call Number.multiply :left wave_index :right 2]
  let enemy_guard = [call Number.add
    :left 5
    :right [call Number.add :left stage_guard :right wave_guard]
  ]

  let stage_spawn_pressure = [call Number.multiply :left stage_index :right 95]
  let wave_spawn_pressure = [call Number.multiply :left wave_index :right 120]
  let spawn_pressure = [call Number.add
    :left stage_spawn_pressure
    :right wave_spawn_pressure
  ]
  let spawn_interval_ms = [call Number.max
    :left 520
    :right [call Number.subtract :left 1450 :right spawn_pressure]
  ]
  let reinforcement_count = [call Number.min
    :left 4
    :right [call Number.floor
      :value [call Number.divide :left defeated_index :right 6]
    ]
  ]
  let progression_count = [call Number.add :left stage_index :right wave_index]
  let enemy_count = [call Number.min
    :left 18
    :right [call Number.add
      :left 2
      :right [call Number.add :left progression_count :right reinforcement_count]
    ]
  ]

  let boss_active = [call Number.greaterOrEqual :left wave_index :right 3]
  let boss_phase = [call boss_phase_for :stage stage_index :wave wave_index]
  let boss_stage_health = [call Number.multiply :left stage_index :right 340]
  let boss_progress_health = [call Number.multiply
    :left [call Number.floor
      :value [call Number.divide :left defeated_index :right 5]
    ]
    :right 20
  ]
  let boss_health_scale = [call Number.add
    :left boss_stage_health
    :right boss_progress_health
  ]
  let boss_health = [call Core.if
    :when boss_active
    :then [call Number.add :left 780 :right boss_health_scale]
    :else 0
  ]
  let boss_stage_damage = [call Number.multiply :left stage_index :right 8]
  let boss_combo_damage = [call Number.multiply
    :left [call Number.floor
      :value [call Number.divide :left combo_index :right 5]
    ]
    :right 2
  ]
  let boss_damage_scale = [call Number.add
    :left boss_stage_damage
    :right boss_combo_damage
  ]
  let boss_damage = [call Core.if
    :when boss_active
    :then [call Number.add :left 24 :right boss_damage_scale]
    :else 0
  ]
  let boss_guard = [call Core.if
    :when boss_active
    :then [call Number.add
      :left 16
      :right [call Number.multiply :left stage_index :right 7]
    ]
    :else 0
  ]

  let boss_reward = [call Core.if
    :when boss_active
    :then [call Number.add
      :left 400
      :right [call Number.multiply :left stage_index :right 80]
    ]
    :else 0
  ]
  let stage_reward = [call Number.multiply :left stage_index :right 110]
  let wave_reward = [call Number.multiply :left wave_index :right 75]
  let combo_reward = [call Number.multiply :left combo_index :right 22]
  let defeat_reward = [call Number.multiply :left defeated_index :right 4]
  let progress_reward = [call Number.add :left stage_reward :right wave_reward]
  let action_reward = [call Number.add :left combo_reward :right defeat_reward]
  let reward_score = [call Number.add
    :left 180
    :right [call Number.add
      :left [call Number.add :left progress_reward :right action_reward]
      :right boss_reward
    ]
  ]
  let stage_renown = [call Number.multiply :left stage_index :right 7]
  let wave_renown = [call Number.multiply :left wave_index :right 5]
  let defeat_renown = [call Number.floor
    :value [call Number.divide :left defeated_index :right 4]
  ]
  let boss_renown = [call Core.if :when boss_active :then 18 :else 0]
  let progress_renown = [call Number.add :left stage_renown :right wave_renown]
  let action_renown = [call Number.add :left combo_index :right defeat_renown]
  let earned_renown = [call Number.add :left action_renown :right boss_renown]
  let reward_renown = [call Number.add
    :left 4
    :right [call Number.add :left progress_renown :right earned_renown]
  ]

  let drop_kind = [call drop_for
    :stage stage_index
    :wave wave_index
    :combo combo_index
  ]
  let boss_drop_bonus = [call Number.floor
    :value [call Number.divide :left stage_index :right 2]
  ]
  let drop_count = [call Core.if
    :when boss_active
    :then [call Number.add :left 2 :right boss_drop_bonus]
    :else [call Core.if
      :when [call Number.greaterOrEqual :left combo_index :right 8]
      :then 2
      :else 1
    ]
  ]
  let stage_drop_rate = [call Number.multiply :left stage_index :right 6]
  let wave_drop_rate = [call Number.multiply :left wave_index :right 7]
  let combo_drop_rate = [call Number.multiply :left combo_index :right 2]
  let progress_drop_rate = [call Number.add
    :left stage_drop_rate
    :right wave_drop_rate
  ]
  let drop_rate_percent = [call Number.min
    :left 95
    :right [call Number.add
      :left 16
      :right [call Number.add :left progress_drop_rate :right combo_drop_rate]
    ]
  ]
  let difficulty = [call difficulty_for :stage stage_index :wave wave_index]

  let rules = [record
    :schema «axirune-arcade/river-oath/1»
    :game «river-oath»
    :stage stage_index
    :stage_key stage_key
    :wave wave_index
    :wave_key wave_key
    :campaign_index campaign_index
    :defeated defeated_index
    :enemy_speed enemy_speed
    :enemy_health enemy_health
    :enemy_damage enemy_damage
    :enemy_guard enemy_guard
    :spawn_interval_ms spawn_interval_ms
    :enemy_count enemy_count
    :boss_active boss_active
    :boss_phase boss_phase
    :boss_health boss_health
    :boss_damage boss_damage
    :boss_guard boss_guard
    :reward_score reward_score
    :reward_renown reward_renown
    :drop_kind drop_kind
    :drop_count drop_count
    :drop_rate_percent drop_rate_percent
    :difficulty difficulty
  ]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
