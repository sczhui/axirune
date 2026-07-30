space sandbox_denial

edition 1

capability shell.run
  effect process.spawn
/capability

tool shell
  take command Text trust untrusted
  give Text
  need shell.run
  permission ask
/tool

sandbox preview
  process deny
  filesystem read «/workspace/examples»
  network deny
  limit fuel 20000
/sandbox

task main
  give Text
  use shell
  within sandbox preview
  let result = [call shell :command «rm -rf /»]
  yield result
/task

launch main
