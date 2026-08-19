import {
  applyTextAndQr,
  classifyDocument,
  detectCurrency,
  emptyExtracted,
  finalizeClassification,
  isKaspiPayRequest,
  isKaspiPayUrl,
  looksLikeKaspi,
  normalizeCurrency,
  parseAmount,
  parseQrPayload,
} from './receipt-classify.ts'
import { buildFingerprint, verifyReceipt } from './receipt-verify.ts'

function baseVerify(overrides: Record<string, unknown> = {}) {
  const extracted = emptyExtracted()
  Object.assign(extracted, overrides)
  return {
    purchaseAmount: 500,
    purchaseCreatedAt: new Date().toISOString(),
    expectedCurrency: 'KZT',
    kaspiPhone: '7776925372',
    kaspiLink: 'https://kaspi.kz/pay/Shop',
    sellerName: 'Shop',
    productTitle: 'Course',
    extracted,
    fingerprint: 'file:abc',
    duplicate: false,
  }
}

Deno.test('normalizes ₸ тг тенге to KZT', () => {
  for (const value of ['₸', 'тг', 'ТГ', 'тенге', 'теңге', 'KZT', ' tenge ']) {
    if (normalizeCurrency(value) !== 'KZT') {
      throw new Error(`${value} should be KZT, got ${normalizeCurrency(value)}`)
    }
  }
})

Deno.test('detectCurrency ignores binary $ garbage', () => {
  const garbage = 'Ü™êé$®®ª®÷ kaspi'
  if (detectCurrency(garbage) === 'USD') throw new Error('garbage $ must not be USD')
  if (detectCurrency('Итого 500 ₸') !== 'KZT') throw new Error('₸ should be KZT')
  if (parseAmount('Сумма перевода 1 500 ₸') !== 1500) throw new Error('amount parse failed')
})

Deno.test('kaspi.kz/pay URL is a payment request even with amount and path id', () => {
  const url = 'https://kaspi.kz/pay/MyShop?amount=500'
  if (!isKaspiPayUrl(url)) throw new Error('should detect pay url')
  const parsed = parseQrPayload(url)
  if (!parsed.isPayRequest) throw new Error('pay request flag')
  if (parsed.transactionId) throw new Error(`pay URL must not yield txn, got ${parsed.transactionId}`)
  if (parsed.amount !== 500) throw new Error(`expected amount 500, got ${parsed.amount}`)
  if (parsed.receiptType !== 'kaspi_pay_qr') throw new Error(parsed.receiptType)
})

Deno.test('pay QR extracted document never auto-confirms', async () => {
  const extracted = emptyExtracted('pdf')
  extracted.qrPayloads = ['https://kaspi.kz/pay/MyShop?amount=500']
  extracted.rawText = 'https://kaspi.kz/pay/MyShop?amount=500'
  extracted.amount = 500
  extracted.currency = 'KZT'
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  if (!looksLikeKaspi(extracted)) throw new Error('pay QR is still Kaspi')
  if (!isKaspiPayRequest(extracted)) throw new Error('must be pay request')
  if (classifyDocument(extracted) !== 'kaspi_pay_qr') throw new Error(extracted.documentClass)
  if (extracted.transactionId) throw new Error('txn must be cleared')
  const fp = buildFingerprint(extracted, 'sha-pay')
  if (!fp.startsWith('file:')) throw new Error(`fingerprint should be file hash, got ${fp}`)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: fp }))
  if (result.decision !== 'payment_qr_or_invoice') throw new Error(result.decision)
  if (result.rejectionReason !== 'kaspi_qr_not_receipt') throw new Error(String(result.rejectionReason))
})

Deno.test('completed Kaspi transfer with matching amount confirms without txn/date', async () => {
  const extracted = emptyExtracted('image')
  extracted.rawText = 'Kaspi Gold\nПеревод выполнен\nКому: Shop\nСумма перевода 500 ₸'
  extracted.amount = 500
  extracted.currency = 'KZT'
  extracted.sources.amount = 'ocr'
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  if (extracted.documentClass !== 'kaspi_transfer') throw new Error(extracted.documentClass)
  const result = await verifyReceipt(baseVerify({
    ...extracted,
    fingerprint: 'file:transfer',
  }))
  if (result.decision !== 'confirmed') throw new Error(result.decision)
})

Deno.test('fiscal Kaspi receipt can auto-confirm', async () => {
  const extracted = emptyExtracted('pdf')
  extracted.rawText = 'Kaspi.kz фискальный чек ФП 1234567890 Итого 500 ₸ oofd.kz'
  extracted.amount = 500
  extracted.currency = 'KZT'
  extracted.transactionId = '1234567890'
  extracted.sources.amount = 'text'
  extracted.sources.transactionId = 'text'
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  if (extracted.documentClass !== 'kaspi_fiscal') throw new Error(extracted.documentClass)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'txn:1234567890' }))
  if (result.decision !== 'confirmed') throw new Error(result.decision)
})

Deno.test('unrelated document is rejected as not Kaspi, not as pay QR', async () => {
  const extracted = emptyExtracted('image')
  extracted.rawText = 'Visa statement\nPayment completed\nTotal USD 12.00\nAccount ending 4411 extra readable text here'
  extracted.amount = 12
  extracted.currency = 'USD'
  extracted.ai = { isKaspiReceipt: false, isKaspiPayQr: false }
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'file:visa' }))
  if (result.decision !== 'rejected') throw new Error(result.decision)
  if (result.rejectionReason !== 'not_kaspi_receipt') throw new Error(String(result.rejectionReason))
})

Deno.test('unreadable document asks for a clearer image', async () => {
  const extracted = emptyExtracted('image')
  extracted.rawText = ''
  extracted.ai = { error: 'no_parseable_content', unreadable: true, documentClass: 'unreadable' }
  finalizeClassification(extracted)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'file:blur' }))
  if (result.decision !== 'unreadable') throw new Error(result.decision)
})

Deno.test('PDF syntax garbage is unreadable, not "not a Kaspi receipt"', async () => {
  const extracted = emptyExtracted('pdf')
  extracted.rawText = 'endstream endobj 11 0 obj <</Length1 18896/Filter /FlateDecode/Length 740>> stream'
  extracted.ai = {
    used: true,
    source: 'openai',
    rawText: 'endstream endobj 11 0 obj <</Length1 18896/Filter /FlateDecode/Length 740>> stream',
    isKaspiPayQr: false,
    documentClass: 'unreadable',
    isKaspiReceipt: false,
  }
  extracted.phones = []
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  if (extracted.documentClass !== 'unreadable') throw new Error(extracted.documentClass)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'file:pdf-junk' }))
  if (result.decision !== 'unreadable') throw new Error(result.decision)
  if (result.rejectionReason === 'not_kaspi_receipt') {
    throw new Error('PDF parse failure must not be classified as not Kaspi')
  }
})

Deno.test('amount mismatch rejects with amount check and does not grant access', async () => {
  const extracted = emptyExtracted('image')
  extracted.rawText = 'Kaspi Gold Перевод выполнен Сумма перевода 100 ₸'
  extracted.amount = 100
  extracted.currency = 'KZT'
  extracted.sources.amount = 'text'
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'file:mismatch' }))
  if (result.decision !== 'rejected') throw new Error(result.decision)
  if (result.rejectionReason !== 'amount_mismatch') throw new Error(String(result.rejectionReason))
  const amount = result.checks.find((c) => c.id === 'amount')
  if (!amount || amount.passed) throw new Error('amount check should fail')
})

Deno.test('duplicate confirmed fingerprint is rejected', async () => {
  const extracted = emptyExtracted('image')
  extracted.rawText = 'Kaspi Gold Перевод выполнен Сумма перевода 500 ₸'
  extracted.amount = 500
  extracted.currency = 'KZT'
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  const result = await verifyReceipt({
    ...baseVerify({ ...extracted, fingerprint: 'txn:reuse' }),
    duplicate: true,
  })
  if (result.decision !== 'rejected' || result.rejectionReason !== 'duplicate_receipt') {
    throw new Error(`${result.decision} ${result.rejectionReason}`)
  }
})

Deno.test('uncertain completed-looking Kaspi without amount goes to manual review', async () => {
  const extracted = emptyExtracted('image')
  extracted.rawText = 'Kaspi Gold Перевод выполнен'
  extracted.currency = 'KZT'
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'file:uncertain' }))
  if (result.decision !== 'manual_review') throw new Error(result.decision)
})

Deno.test('AI cannot override a kaspi.kz/pay URL into a completed receipt', async () => {
  const extracted = emptyExtracted('pdf')
  extracted.qrPayloads = ['https://kaspi.kz/pay/Teacher']
  extracted.rawText = 'https://kaspi.kz/pay/Teacher'
  extracted.amount = 500
  extracted.currency = 'KZT'
  extracted.ai = { isKaspiReceipt: true, isKaspiPayQr: false, documentClass: 'kaspi_payment', amount: 500 }
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  if (!isKaspiPayRequest(extracted)) throw new Error('pay URL must win over AI receipt flag')
  const result = await verifyReceipt(baseVerify({ ...extracted, fingerprint: 'file:ai-override' }))
  if (result.decision !== 'payment_qr_or_invoice') throw new Error(result.decision)
})
