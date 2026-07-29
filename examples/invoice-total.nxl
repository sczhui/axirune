space invoice_total

edition 2

shape Line
  field sku Text
  field quantity Number
  field unit_price Number
/shape

task line_total
  take line Line
  give Number
  let quantity = [call Record.get :record line :key «quantity»]
  let unit_price = [call Record.get :record line :key «unit_price»]
  yield [call Number.multiply :left quantity :right unit_price]
/task

task add_line
  take accumulator Number
  take item Line
  take index Number
  give Number
  let amount = [call line_total :line item]
  yield [call Number.add :left accumulator :right amount]
/task

task main
  give Text
  let lines = [list [record :sku «paper» :quantity 2 :unit_price 12.5] [record :sku «ink» :quantity 3 :unit_price 8] [record :sku «binder» :quantity 1 :unit_price 16]]
  let subtotal = [call List.fold :list lines :using «add_line» :initial 0]
  let invoice = [record :currency «USD» :line_count [call List.length :list lines] :subtotal subtotal]
  let encoded = [call Json.encode :value invoice]
  emit encoded
  yield encoded
/task

launch main
