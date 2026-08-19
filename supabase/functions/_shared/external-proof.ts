/**
 * Modular hook for official payment-provider verification.
 * Kaspi does not expose a public verification API in this project.
 * Register an adapter here if/when a signed official source exists.
 */

export type ExternalProofContext = {
  purchaseAmount: number
  expectedCurrency: string
  kaspiPhone: string | null
  kaspiLink: string | null
  extracted: {
    amount: number | null
    currency: string | null
    transactionId: string | null
    qrPayloads: string[]
    paidAt: string | null
  }
}

export type ExternalProofResult = {
  adapterId: string
  verified: boolean
  details: Record<string, unknown>
}

export type ExternalProofAdapter = {
  id: string
  verify: (ctx: ExternalProofContext) => Promise<ExternalProofResult | null>
}

export const externalProofAdapters: ExternalProofAdapter[] = []

export async function runExternalProof(
  ctx: ExternalProofContext,
): Promise<ExternalProofResult | null> {
  for (const adapter of externalProofAdapters) {
    try {
      const result = await adapter.verify(ctx)
      if (result) return result
    } catch (err) {
      console.error('external proof adapter failed', adapter.id, err)
    }
  }
  return null
}
