import { promises as fs } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const packageManifest = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8'),
)
const version = packageManifest.version
const outputDir = path.join(root, 'public', 'downloads')
const packageFile = path.join(outputDir, `nexilume-language-${version}.tgz`)
const sourceFile = path.join(outputDir, `nexilume-source-${version}.tar.gz`)
const currentArtifacts = new Set([
  path.basename(packageFile),
  path.basename(sourceFile),
  `nexilume-${version}.vsix`,
])
const releaseArtifact =
  /^nexilume-(?:language-\d+\.\d+\.\d+\.tgz|source-\d+\.\d+\.\d+\.tar\.gz|\d+\.\d+\.\d+\.vsix)$/u

await fs.mkdir(outputDir, { recursive: true })
for (const fileName of await fs.readdir(outputDir)) {
  if (releaseArtifact.test(fileName) && !currentArtifacts.has(fileName)) {
    await fs.rm(path.join(outputDir, fileName), { force: true })
  }
}
await fs.rm(packageFile, { force: true })
await fs.rm(sourceFile, { force: true })

const packed = spawnSync(
  'npm',
  ['pack', '--ignore-scripts', '--pack-destination', outputDir],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: path.join(root, '.npm-cache') },
  },
)
if (packed.status !== 0) process.exit(packed.status ?? 1)

const sourceEntries = [
  '.dockerignore',
  '.gitignore',
  '.oxlintrc.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'tsconfig.toolchain.json',
  'vite.config.ts',
  'index.html',
  'nexilume.pack',
  'nexilume.lock',
  'src',
  'tests',
  'benchmarks',
  'docs',
  'examples',
  'packages',
  'scripts',
  'public/favicon.svg',
  'public/og.png',
  'public/benchmark-results.json',
  'public/benchmark-results.md',
  'Dockerfile',
  'docker-compose.yml',
  'nginx.conf',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
]

const available = []
for (const entry of sourceEntries) {
  try {
    await fs.access(path.join(root, entry))
    available.push(entry)
  } catch {
    // Optional generated or not-yet-created paths are skipped.
  }
}

const tarArguments = [
  ...(process.platform === 'darwin' ? ['--no-xattrs'] : []),
  '-czf',
  sourceFile,
  ...available,
]
const archived = spawnSync('tar', tarArguments, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, COPYFILE_DISABLE: '1' },
})
if (archived.status !== 0) process.exit(archived.status ?? 1)
console.log(`Staged ${path.relative(root, sourceFile)}`)
