import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packageManifest = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8'),
)
const version = packageManifest.version
const extensionRoot = path.join(root, 'packages', 'vscode-extension')
const outputDir = path.join(root, 'public', 'downloads')
const outputFile = path.join(outputDir, `axirune-${version}.vsix`)

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
  }
  return current >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosTime(date = new Date('2026-01-01T00:00:00Z')) {
  const year = Math.max(1980, date.getUTCFullYear())
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1)
  const day = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  return { day, time }
}

function zip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const stamp = dosTime()

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll(path.sep, '/'))
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.day, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, name, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(stamp.time, 12)
    central.writeUInt16LE(stamp.day, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)
    offset += local.length + name.length + data.length
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, ...centralParts, end])
}

async function walk(directory, prefix) {
  const entries = []
  const names = await fs.readdir(directory, { withFileTypes: true })
  names.sort((left, right) => left.name.localeCompare(right.name))
  for (const item of names) {
    const absolute = path.join(directory, item.name)
    const relative = path.posix.join(prefix, item.name)
    if (item.isDirectory()) entries.push(...(await walk(absolute, relative)))
    else if (item.isFile()) entries.push({ name: relative, data: await fs.readFile(absolute) })
  }
  return entries
}

const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="cjs" ContentType="application/javascript" />
  <Default Extension="map" ContentType="application/json" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="ts" ContentType="text/plain" />
  <Default Extension="xml" ContentType="text/xml" />
  <Override PartName="/extension.vsixmanifest" ContentType="text/xml" />
</Types>`

const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="axirune-language" Version="${version}" Publisher="axirune" />
    <DisplayName>Axirune Language</DisplayName>
    <Description xml:space="preserve">Language support and bundled server for the deterministic Axirune programming language.</Description>
    <Tags>axirune,programming-language,interpreter,agent,ai,mcp,capability</Tags>
    <Categories>Programming Languages,Linters,Formatters</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.96.0" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[1.96.0,)" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>`

await fs.mkdir(outputDir, { recursive: true })
const extensionEntries = await walk(extensionRoot, 'extension')
const compiledEntries = [
  ...(await walk(path.join(root, 'dist-toolchain', 'src', 'language'), 'extension/server/src/language')),
  ...(await walk(path.join(root, 'dist-toolchain', 'src', 'lsp'), 'extension/server/src/lsp')),
]
const archive = zip([
  { name: '[Content_Types].xml', data: contentTypes },
  { name: 'extension.vsixmanifest', data: manifest },
  ...extensionEntries,
  ...compiledEntries,
])
await fs.writeFile(outputFile, archive)
console.log(`Packaged ${path.relative(root, outputFile)} (${archive.length} bytes)`)
