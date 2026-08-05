space prism_break

edition 2

task main
  take level Number
  take cleared Number
  take combo Number
  give Record
  let level_speed = [call Number.multiply :left level :right 18]
  let ball_speed = [call Number.min
    :left 520
    :right [call Number.add :left 300 :right level_speed]
  ]
  let paddle_shrink = [call Number.multiply :left level :right 3]
  let paddle_width = [call Number.max
    :left 88
    :right [call Number.subtract :left 148 :right paddle_shrink]
  ]
  let combo_value = [call Number.multiply :left combo :right 12]
  let brick_value = [call Number.add
    :left 80
    :right [call Number.add
      :left [call Number.multiply :left level :right 20]
      :right combo_value
    ]
  ]
  let armored_every = [call Number.max
    :left 3
    :right [call Number.subtract :left 8 :right level]
  ]
  let pulse = [call Core.if
    :when [call Number.greater :left combo :right 7]
    :then «overdrive»
    :else [call Core.if
      :when [call Number.greater :left combo :right 3]
      :then «charged»
      :else «nominal»
    ]
  ]
  let rules = [record
    :schema «axirune-arcade/prism-break/1»
    :level level
    :cleared cleared
    :ball_speed ball_speed
    :paddle_width paddle_width
    :brick_value brick_value
    :armored_every armored_every
    :pulse pulse
  ]
  emit [call Json.encode :value rules]
  yield rules
/task

launch main
