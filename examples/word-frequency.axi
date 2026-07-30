space word_frequency

edition 2

capability host.fs.read
  effect filesystem.read
  resource «./input.txt»
/capability

tool File.readText
  take path Text
  give Text
  need host.fs.read
  permission ask
/tool

sandbox cli_files
  filesystem read «./input.txt»
  network deny
  process deny
/sandbox

grant host.fs.read to main

task count_word
  take accumulator Record
  take item Text
  take index Number
  give Record
  let exists = [call Record.has :record accumulator :key item]
  let previous = [call Core.if :when exists :then [call Record.get :record accumulator :key item] :else 0]
  let next = [call Number.add :left previous :right 1]
  yield [call Record.put :record accumulator :key item :value next]
/task

task main
  give Text
  use File.readText
  within sandbox cli_files
  let source = [call File.readText :path «./input.txt»]
  let normalized = [call Text.trim :text [call Text.lower :text source]]
  let words = [call Text.split :text normalized :separator « »]
  let counts = [call List.fold :list words :using «count_word» :initial [record]]
  let encoded = [call Json.encode :value counts]
  emit encoded
  yield encoded
/task

launch main
