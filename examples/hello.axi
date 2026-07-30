space hello

edition 2

task greet
  take name Text
  give Text
  yield [call Text.join :parts [list «Hello, » name «!»]]
/task

task main
  give Text
  let message = [call greet :name «Axirune»]
  emit message
  yield message
/task

launch main
