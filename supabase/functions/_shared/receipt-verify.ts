import { runExternalProof } from './external-proof.ts'
import {
  ExtractedReceipt,
  clearlyNotKaspi,
  hasCompletedPaymentEvidence,
  isCompletedPaymentClass,
  isKaspiPayRequest,
  isUnreadableDocument,
  looksLikeKaspi,
  normalizeCurrency,
  normalizePhone,
} from './receipt-classify.ts'

export type CheckResult = {
  id: string
  passed: boolean
  requiredForAuto: boolean
  detail: string
  value?: unknown
}

export type VerifyDecision =
  | 'confirmed'
  | 'rejected'
  | 'manual_review'
  | 'payment_qr_or_invoice'
  | 'unreadable'

export type VerifyInput = {
  purchaseAmount: number
  purchaseCreatedAt: string
  expectedCurrency: string
  kaspiPhone: string | null
  kaspiLink: string | null
  sellerName: string | null
  productTitle: string | null
  extracted: ExtractedReceipt
  fingerprint: string
  duplicate: boolean
}

export type VerifyResult = {
  decision: VerifyDecision
  rejectionReason: string | null
  checks: CheckResult[]
  completeEnough: boolean
}

const AMOUNT_TOLERANCE = 1
const DATE_AFTER_HOURS = 6
const STALE_DAYS = 7

export function buildFingerprint(extracted: ExtractedReceipt, fileSha: string): string {
  if (isKaspiPayRequest(extracted) || extracted.documentClass === 'kaspi_pay_qr') {
    return `file:${fileSha}`
  }
  if (extracted.transactionId) return `txn:${extracted.transactionId.toLowerCase()}`
  if (extracted.qrPayloads[0] && !isKaspiPayUrlSafe(extracted.qrPayloads[0])) {
    return `qr:${extracted.qrPayloads[0].slice(0, 200)}`
  }
  return `file:${fileSha}`
}

function isKaspiPayUrlSafe(payload: string): boolean {
  try {
    const url = new URL(payload)
    return url.hostname.includes('kaspi.kz') && /\/pay/i.test(`${url.pathname}${url.search}`)
  } catch {
    return /kaspi\.kz\/[^\s]*pay/i.test(payload)
  }
}

export async function verifyReceipt(input: VerifyInput): Promise<VerifyResult> {
  const checks: CheckResult[] = []
  const extracted = input.extracted
  const amountSource = extracted.sources.amount

  if (input.duplicate) {
    checks.push({
      id: 'duplicate',
      passed: false,
      requiredForAuto: true,
      detail: 'duplicate_receipt',
    })
  } else {
    checks.push({
      id: 'duplicate',
      passed: true,
      requiredForAuto: true,
      detail: 'unique_fingerprint',
    })
  }

  if (extracted.amount == null) {
    checks.push({
      id: 'amount',
      passed: false,
      requiredForAuto: true,
      detail: 'amount_missing',
    })
  } else {
    const expected = Number(input.purchaseAmount)
    const delta = Math.abs(extracted.amount - expected)
    const match = delta <= AMOUNT_TOLERANCE
    checks.push({
      id: 'amount',
      passed: match,
      requiredForAuto: true,
      detail: match ? 'amount_match' : 'amount_mismatch',
      value: { detected: extracted.amount, expected, delta, source: amountSource },
    })
  }

  const normalizedCurrency = normalizeCurrency(extracted.currency)
  const currency = normalizedCurrency || 'KZT'
  const currencyOk = !normalizedCurrency || currency === input.expectedCurrency
  checks.push({
    id: 'currency',
    passed: currencyOk,
    requiredForAuto: true,
    detail: normalizedCurrency ? (currencyOk ? 'currency_match' : 'currency_mismatch') : 'currency_assumed_kzt',
    value: { detected: extracted.currency, normalized: currency, expected: input.expectedCurrency },
  })

  const identity = sellerIdentityCheck(input)
  checks.push(identity)

  const dateCheck = dateWindowCheck(extracted.paidAt, input.purchaseCreatedAt)
  dateCheck.requiredForAuto = false
  checks.push(dateCheck)

  const txnPresent = Boolean(extracted.transactionId)
  checks.push({
    id: 'transaction_id',
    passed: txnPresent,
    requiredForAuto: false,
    detail: txnPresent ? 'transaction_id_present' : 'transaction_id_missing',
    value: extracted.transactionId,
  })

  const completedClass = isCompletedPaymentClass(extracted.documentClass)
  const completedEvidence = hasCompletedPaymentEvidence(extracted) && looksLikeKaspi(extracted)
  const payQr = isKaspiPayRequest(extracted)
  const unreadable = isUnreadableDocument(extracted)
  const unrelated = clearlyNotKaspi(extracted)

  checks.push({
    id: 'document_class',
    passed: completedClass || completedEvidence,
    requiredForAuto: true,
    detail: extracted.documentClass,
    value: {
      receiptType: extracted.receiptType,
      payQr,
      completedEvidence,
      unreadable,
      unrelated,
    },
  })

  const fieldsComplete = extracted.amount != null && (completedClass || completedEvidence)
  checks.push({
    id: 'completeness',
    passed: fieldsComplete,
    requiredForAuto: false,
    detail: fieldsComplete ? 'credible_payment_evidence' : 'no_credible_payment_evidence',
    value: { sources: extracted.sources },
  })

  const external = await runExternalProof({
    purchaseAmount: Number(input.purchaseAmount),
    expectedCurrency: input.expectedCurrency,
    kaspiPhone: input.kaspiPhone,
    kaspiLink: input.kaspiLink,
    extracted: {
      amount: extracted.amount,
      currency: extracted.currency,
      transactionId: extracted.transactionId,
      qrPayloads: extracted.qrPayloads,
      paidAt: extracted.paidAt,
    },
  })
  checks.push({
    id: 'external_proof',
    passed: external?.verified === true,
    requiredForAuto: false,
    detail: external ? `adapter:${external.adapterId}` : 'no_official_provider_api',
    value: external,
  })

  const amountCheck = checks.find((c) => c.id === 'amount')
  const duplicateCheck = checks.find((c) => c.id === 'duplicate')
  const currencyCheck = checks.find((c) => c.id === 'currency')

  if (duplicateCheck && !duplicateCheck.passed) {
    return {
      decision: 'rejected',
      rejectionReason: 'duplicate_receipt',
      checks,
      completeEnough: false,
    }
  }

  if (payQr) {
    return {
      decision: 'payment_qr_or_invoice',
      rejectionReason: 'kaspi_qr_not_receipt',
      checks,
      completeEnough: false,
    }
  }

  if (unreadable) {
    return {
      decision: 'unreadable',
      rejectionReason: 'unreadable_receipt',
      checks,
      completeEnough: false,
    }
  }

  if (unrelated) {
    return {
      decision: 'rejected',
      rejectionReason: 'not_kaspi_receipt',
      checks,
      completeEnough: false,
    }
  }

  if (amountCheck && extracted.amount != null && !amountCheck.passed) {
    return {
      decision: 'rejected',
      rejectionReason: 'amount_mismatch',
      checks,
      completeEnough: false,
    }
  }

  if (currencyCheck && extracted.currency && !currencyCheck.passed) {
    return {
      decision: 'rejected',
      rejectionReason: 'currency_mismatch',
      checks,
      completeEnough: false,
    }
  }

  if (dateCheck.detail === 'receipt_too_old' || dateCheck.detail === 'receipt_in_future') {
    return {
      decision: 'rejected',
      rejectionReason: dateCheck.detail,
      checks,
      completeEnough: false,
    }
  }

  const amountOk = Boolean(amountCheck?.passed && extracted.amount != null)
  const identityOk = identity.passed
  const canAutoConfirm =
    amountOk &&
    currencyOk &&
    identityOk &&
    !payQr &&
    (completedClass || completedEvidence) &&
    looksLikeKaspi(extracted)

  if (canAutoConfirm) {
    return {
      decision: 'confirmed',
      rejectionReason: null,
      checks,
      completeEnough: true,
    }
  }

  return {
    decision: 'manual_review',
    rejectionReason: null,
    checks,
    completeEnough: fieldsComplete,
  }
}

function sellerIdentityCheck(input: VerifyInput): CheckResult {
  const expectedPhone = input.kaspiPhone ? normalizePhone(input.kaspiPhone) : ''
  const phones = input.extracted.phones
  if (expectedPhone) {
    const match = phones.some((p) => p === expectedPhone || p.endsWith(expectedPhone) || expectedPhone.endsWith(p))
    if (match) {
      return { id: 'seller_identity', passed: true, requiredForAuto: true, detail: 'seller_phone_match' }
    }
    if (!phones.length) {
      return {
        id: 'seller_identity',
        passed: true,
        requiredForAuto: false,
        detail: 'seller_phone_unscanned',
        value: { expectedPhone, phones },
      }
    }
    return {
      id: 'seller_identity',
      passed: false,
      requiredForAuto: true,
      detail: 'seller_phone_not_found',
      value: { expectedPhone, phones },
    }
  }

  const seller = (input.sellerName || '').trim().toLowerCase()
  if (seller && input.extracted.names.some((n) => n.toLowerCase().includes(seller) || seller.includes(n.toLowerCase()))) {
    return { id: 'seller_identity', passed: true, requiredForAuto: false, detail: 'seller_name_match' }
  }

  return {
    id: 'seller_identity',
    passed: true,
    requiredForAuto: false,
    detail: 'seller_identity_unavailable',
  }
}

function dateWindowCheck(paidAt: string | null, purchaseCreatedAt: string): CheckResult {
  if (!paidAt) {
    return { id: 'payment_time', passed: false, requiredForAuto: false, detail: 'date_missing' }
  }
  const paid = new Date(paidAt).getTime()
  const created = new Date(purchaseCreatedAt).getTime()
  const now = Date.now()
  if (Number.isNaN(paid)) {
    return { id: 'payment_time', passed: false, requiredForAuto: false, detail: 'date_unparsed' }
  }
  if (paid > now + DATE_AFTER_HOURS * 3600_000) {
    return { id: 'payment_time', passed: false, requiredForAuto: true, detail: 'receipt_in_future', value: paidAt }
  }
  if (paid < created - STALE_DAYS * 86400_000) {
    return { id: 'payment_time', passed: false, requiredForAuto: true, detail: 'receipt_too_old', value: paidAt }
  }
  return {
    id: 'payment_time',
    passed: true,
    requiredForAuto: false,
    detail: 'date_reasonable',
    value: paidAt,
  }
}
