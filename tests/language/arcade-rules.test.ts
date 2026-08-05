import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createAxiruneRuleModule } from '../../src/arcade/axirune-rule-module'

function source(name: string): string {
  return readFileSync(new URL(`../../apps/arcade/${name}.axi`, import.meta.url), 'utf8')
}

describe('Axirune arcade rule modules', () => {
  it('compiles Vector Siege once and evaluates a deterministic wave contract', async () => {
    const rules = await createAxiruneRuleModule(source('vector-siege'))
    const first = await rules.run({ wave: 5, destroyed: 17, combo: 4 })
    const second = await rules.run({ wave: 5, destroyed: 17, combo: 4 })

    expect(rules.space).toBe('vector_siege')
    expect(rules.contentId).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(rules.capsuleBytes).toBeGreaterThan(1_000)
    expect(first.value).toEqual(second.value)
    expect(first.value).toMatchObject({
      schema: 'axirune-arcade/vector-siege/1',
      enemy_speed: 117,
      spawn_interval_ms: 725,
      enemy_health: 2,
      score_per_hit: 197,
      wingmen: 1,
      threat: 'elevated',
    })
  })

  it('keeps the default Vector Siege contract valid through wave 99', async () => {
    const rules = await createAxiruneRuleModule(source('vector-siege'))
    const result = await rules.run({ wave: 99, destroyed: 999, combo: 40 })

    expect(result.value).toMatchObject({
      schema: 'axirune-arcade/vector-siege/1',
      wave: 99,
      enemy_health: 12,
      threat: 'critical',
    })
  })

  it('compiles Prism Break and returns a bounded level contract', async () => {
    const rules = await createAxiruneRuleModule(source('prism-break'))
    const result = await rules.run({ level: 4, cleared: 30, combo: 8 })

    expect(rules.space).toBe('prism_break')
    expect(result.value).toMatchObject({
      schema: 'axirune-arcade/prism-break/1',
      ball_speed: 372,
      paddle_width: 136,
      brick_value: 256,
      armored_every: 4,
      pulse: 'overdrive',
    })
  })

  it('rejects rule programs that request authority', async () => {
    await expect(
      createAxiruneRuleModule(`space unsafe
edition 2
task main
  give Text
  yield [call File.readText :path «secret.txt»]
/task
launch main`),
    ).rejects.toThrow('Arcade rules must be pure')
  })
})
