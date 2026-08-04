import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createCapsule, verifyCapsule } from '../../src/language/index.js'
import {
  CapsuleLabPage,
  encodeCapsuleBase64,
  mutateCapsuleByte,
} from '../../src/ui/CapsuleLabPage.js'

const SOURCE = `space capsule_lab_ui

edition 2

task main
  give Text
  let message = «verified in the browser»
  emit message
  yield message
/task

launch main`

describe('Capsule Lab web experience', () => {
  it('renders the artifact lifecycle and primary browser actions in both locales', () => {
    const chinese = renderToStaticMarkup(<CapsuleLabPage locale="zh" />)
    const english = renderToStaticMarkup(<CapsuleLabPage locale="en" />)

    expect(chinese).toContain('AI 可以生成工件。运行时只相信证据。')
    expect(chinese).toContain('生成并验证')
    expect(chinese).toContain('篡改一字节')
    expect(english).toContain('BUILD &amp; VERIFY')
    expect(english).toContain('RUN VERIFIED IR')
    expect(english).toContain('DOWNLOAD .AXC')
  })

  it('encodes copied capsule bytes as lossless Base64', () => {
    const bytes = new Uint8Array([0x00, 0x41, 0x58, 0x43, 0xff, 0x10])
    const decoded = new Uint8Array(Buffer.from(encodeCapsuleBase64(bytes), 'base64'))

    expect(decoded).toEqual(bytes)
  })

  it('keeps the verified artifact intact while its one-byte clone is rejected', async () => {
    const capsule = await createCapsule({ source: SOURCE })
    const original = capsule.bytes.slice()
    const mutated = mutateCapsuleByte(capsule.bytes)
    const verification = await verifyCapsule(mutated)

    expect(capsule.bytes).toEqual(original)
    expect(mutated).not.toEqual(original)
    expect(verification).toEqual({
      ok: false,
      issues: [
        {
          code: 'E_CAPSULE_DIGEST',
          message: 'Capsule content digest does not match its framed content.',
        },
      ],
    })
  })
})
