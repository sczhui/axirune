import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const cli = path.join(root, 'dist-toolchain', 'src', 'cli', 'nexilume.js')
const examples = readdirSync(path.join(root, 'examples'))
  .filter((name) => name.endsWith('.nxl'))
  .sort()

let failures = 0
for (const example of examples) {
  const file = path.join('examples', example)
  const result = spawnSync(process.execPath, [cli, 'check', file], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) failures += 1
}

if (failures > 0) {
  console.error(`${failures} example(s) failed validation.`)
  process.exit(1)
}
console.log(`${examples.length} Nexilume examples validated.`)
