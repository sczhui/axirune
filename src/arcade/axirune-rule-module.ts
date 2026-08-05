import {
  createCapsule,
  runProgram,
  type Diagnostic,
  type IRProgram,
  type RuntimeValue,
  verifyCapsule,
} from '../language'

export type ArcadeRuleResult = {
  value: RuntimeValue
  emissions: RuntimeValue[]
  traceLength: number
}

export type AxiruneRuleModule = {
  readonly space: string
  readonly ir: IRProgram
  readonly contentId: string
  readonly semanticDigest: string
  readonly capsuleBytes: number
  run(input: Readonly<Record<string, RuntimeValue>>): Promise<ArcadeRuleResult>
}

export class ArcadeRuleError extends Error {
  readonly diagnostics: readonly Diagnostic[]

  constructor(message: string, diagnostics: readonly Diagnostic[] = []) {
    super(message)
    this.name = 'ArcadeRuleError'
    this.diagnostics = diagnostics
  }
}

/**
 * Compile an Axirune arcade ruleset once, then execute only its checked IR.
 * Games receive no host capabilities, tools, network, storage, MCP, or model.
 */
export async function createAxiruneRuleModule(source: string): Promise<AxiruneRuleModule> {
  let build
  try {
    build = await createCapsule({ source, sourceName: 'arcade-rules.axi' })
  } catch (error) {
    throw new ArcadeRuleError(
      error instanceof Error ? error.message : 'Arcade rules failed to compile.',
    )
  }
  const verified = await verifyCapsule(build.bytes)
  if (!verified.ok) {
    throw new ArcadeRuleError(
      `Arcade rules produced an invalid capsule: ${verified.issues.map((issue) => issue.code).join(', ')}.`,
    )
  }

  const manifest = verified.manifest
  if (
    manifest.capabilities.length > 0 ||
    manifest.tools.length > 0 ||
    manifest.permissions.length > 0 ||
    manifest.sandboxes.length > 0
  ) {
    throw new ArcadeRuleError('Arcade rules must be pure and request no capabilities.')
  }

  const ir = verified.ir
  return {
    space: ir.space,
    ir,
    contentId: verified.contentId,
    semanticDigest: verified.semanticDigest,
    capsuleBytes: build.bytes.byteLength,
    async run(input) {
      const result = await runProgram(ir, {
        input,
        capabilities: [],
        tools: {},
        mockTools: false,
        sandbox: {
          maxSteps: 12_000,
          maxToolCalls: 0,
          maxLaunches: 4,
          maxFrameDepth: 12,
          maxOutputBytes: 32_768,
          maxTraceEvents: 256,
          maxValueDepth: 12,
          maxCollectionItems: 1_024,
          timeoutMs: 32,
        },
      })

      if (result.status !== 'completed' || result.diagnostics.length > 0) {
        throw new ArcadeRuleError(
          `Arcade rules stopped with status ${result.status}.`,
          result.diagnostics,
        )
      }

      return {
        value: result.value,
        emissions: [...result.emissions],
        traceLength: result.trace.length,
      }
    },
  }
}
