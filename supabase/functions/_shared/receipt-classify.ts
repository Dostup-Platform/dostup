export type ReceiptType =
  | 'kaspi_transfer'
  | 'kaspi_payment'
  | 'kaspi_pay_qr'
  | 'fiscal'
  | 'unrelated'
  | 'unreadable'
  | 'pdf'
  | 'image'
  | 'unknown'

export type DocumentClass =
  | 'kaspi_transfer'
  | 'kaspi_payment'
  | 'kaspi_fiscal'
  | 'kaspi_pay_qr'
  | 'unrelated'
  | 'unreadable'

export type ExtractedReceipt = {
  amount: number | null
  currency: string | null
  transactionId: string | null
  paidAt: string | null
  phones: string[]
  names: string[]
  qrPayloads: string[]
  rawText: string
  receiptType: ReceiptType
  documentClass: DocumentClass
  sources: {
    amount: 'qr' | 'text' | 'ocr' | 'ai' | null
    transactionId: 'qr' | 'text' | 'ocr' | 'ai' | null
    paidAt: 'qr' | 'text' | 'ocr' | 'ai' | null
  }
  ai: Record<string, unknown> | null
}

const COMPLETED_RE =
  /номер\s+перевода|номер\s+операции|перевод\s+выполнен|перевод\s+успеш|переведено|перевели|успешно\s+оплач|оплата\s+прошла|операция\s+выполнен|электронн(?:ый|ого)\s+чек|чек\s+по\s+операции|kaspi gold|каспи голд|аударым\s+(?:орындалды|сәтті)|төлем\s+өтті|төлем\s+сәтті|paid successfully|payment successful|e-?receipt|фискальн|оofd|\bфп\b/i

const INVOICE_RE =
  /выставлен\s+сч[её]т|сч[её]т\s+на\s+оплату|оплатите\s+по\s+qr|отсканируйте\s+qr|төлем\s+qr|төлемге\s+qr|payment request|invoice for payment|qr\s+для\s+оплаты/i

export function emptyExtracted(receiptType: ReceiptType = 'unknown'): ExtractedReceipt {
  return {
    amount: null,
    currency: null,
    transactionId: null,
    paidAt: null,
    phones: [],
    names: [],
    qrPayloads: [],
    rawText: '',
    receiptType,
    documentClass: 'unreadable',
    sources: { amount: null, transactionId: null, paidAt: null },
    ai: null,
  }
}

export function normalizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.trim()
  const compact = raw.toUpperCase().replace(/\s+/g, '')
  if (
    compact === 'KZT' ||
    compact === '₸' ||
    compact === 'ТГ' ||
    compact === 'ТЕНГЕ' ||
    compact === 'TEҢГЕ' ||
    compact === 'TENGE' ||
    compact === 'TEÑGE' ||
    compact === 'KZT₸' ||
    compact === 'KZTТГ' ||
    /тенге|теңге|₸/i.test(raw) ||
    compact === 'ТГ.' ||
    compact === 'TG'
  ) {
    return 'KZT'
  }
  if (compact === 'USD' || compact === '$') return 'USD'
  if (compact === 'EUR' || compact === '€') return 'EUR'
  if (compact === 'RUB' || compact === '₽' || compact === 'RUR' || /руб/i.test(raw)) return 'RUB'
  return null
}

export function detectCurrency(text: string): string | null {
  const readable = readableText(text)
  if (!readable) return null
  if (/₸|\bKZT\b|\bтг\b|\bтг\.|\bтенге\b|\bтеңге\b/i.test(readable)) return 'KZT'
  if (/\bUSD\b/.test(readable) || /(?:^|[^\w])\$\s*\d/.test(readable) || /\d[\s.,]*\$/.test(readable)) {
    return 'USD'
  }
  if (/\bEUR\b|€/.test(readable)) return 'EUR'
  if (/\bRUB\b|₽|\bруб/i.test(readable)) return 'RUB'
  return null
}

export function normalizeAmount(raw: string): number | null {
  const compact = raw.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(compact)) return null
  const n = Number(compact)
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return null
  return Math.round(n * 100) / 100
}

export function parseAmount(text: string): number | null {
  const found: number[] = []
  const labeled =
    /(?:итого|сумма(?:\s+перевода)?|перевели|перевод(?:ено)?|төлем|сома|amount|total|к\s+оплате)[:\s]*([\d\s]{1,14}(?:[.,]\d{1,2})?)\s*(?:₸|тг|kzt|тенге|теңге)?/gi
  for (const m of text.matchAll(labeled)) {
    const n = normalizeAmount(m[1])
    if (n != null) found.push(n)
  }
  if (found.length) return found[0]
  for (const m of text.matchAll(/(?:₸|тг)\s*([\d\s]{1,14}(?:[.,]\d{1,2})?)/gi)) {
    const n = normalizeAmount(m[1])
    if (n != null) found.push(n)
  }
  for (const m of text.matchAll(/([\d\s]{1,14}(?:[.,]\d{1,2})?)\s*(?:₸|тг\.?|kzt|тенге|теңге)\b/gi)) {
    const n = normalizeAmount(m[1])
    if (n != null) found.push(n)
  }
  if (!found.length) return null
  return found.sort((a, b) => b - a)[0]
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) return digits.slice(1)
  if (digits.length === 10) return digits
  return digits
}

export function isKaspiPayUrl(payload: string): boolean {
  const trimmed = payload.trim()
  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    const pathQuery = `${url.pathname}${url.search}`.toLowerCase()
    if (host === 'kaspi.kz' || host.endsWith('.kaspi.kz')) {
      return /\/pay(\/|$|\?)/.test(pathQuery) || pathQuery.includes('pay/')
    }
    return false
  } catch {
    return /kaspi\.kz\/[^\s"'<>]*pay/i.test(trimmed)
  }
}

export function collectKaspiPayUrls(text: string): string[] {
  const out: string[] = []
  const re = /https?:\/\/[^\s"'<>\\]+/gi
  for (const m of text.matchAll(re)) {
    const cleaned = m[0].replace(/[.,;)\]]+$/, '')
    if (isKaspiPayUrl(cleaned)) out.push(cleaned)
  }
  if (!out.length && /kaspi\.kz\/[^\s"'<>]*pay/i.test(text)) {
    const loose = text.match(/kaspi\.kz\/[^\s"'<>\\]+/i)
    if (loose) out.push(`https://${loose[0].replace(/[.,;)\]]+$/, '')}`)
  }
  return [...new Set(out)]
}

export function isPdfSyntaxNoise(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/endstream|endobj|startxref|\bxref\b|\btrailer\b|\bstream\b/i.test(t)) return true
  if (
    /\/(?:FlateDecode|Length1?|Filter|Type|Subtype|FontDescriptor|BitsPerComponent|FontFile|MediaBox|Resources|ProcSet|ExtGState|ColorSpace|DecodeParms)\b/
      .test(t)
  ) {
    return true
  }
  if (/^\d+\s+\d+\s+obj\b/.test(t)) return true
  if (
    /^[0-9\s\[\]<>./]+$/.test(t) &&
    !/\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(t) &&
    !/\d+[.,]\d{2}/.test(t)
  ) {
    return true
  }
  return false
}

export function readableText(value: string | null | undefined): string {
  if (!value) return ''
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const kept: string[] = []
  for (const line of lines) {
    if (isPdfSyntaxNoise(line)) continue
    if (isMostlyReadable(line) || /kaspi|каспи|₸|\bkzt\b|тенге|теңге/i.test(line)) {
      kept.push(line)
    }
  }
  return kept.join('\n').slice(0, 20_000)
}

export function isMostlyReadable(text: string): boolean {
  if (!text || text.length < 3) return false
  const letters = (text.match(/[A-Za-zА-Яа-яЁёІіҢңҒғҮүҰұҚқӨөҺһ]/g) || []).length
  const digits = (text.match(/\d/g) || []).length
  const printable = (text.match(/[\x20-\x7EА-Яа-яЁёІіҢңҒғҮүҰұҚқӨөҺһ₸№«»—–]/g) || []).length
  if (printable / text.length < 0.55) return false
  return letters + digits >= 6
}

export function looksLikeKaspi(extracted: ExtractedReceipt): boolean {
  const ai = extracted.ai || {}
  const aiClass = typeof ai.documentClass === 'string' ? ai.documentClass : ''
  if (ai.isKaspiReceipt === true || ai.isKaspi === true || ai.isKaspiPayQr === true) return true
  if (aiClass.startsWith('kaspi_')) return true
  if (
    extracted.receiptType === 'kaspi_transfer' ||
    extracted.receiptType === 'kaspi_payment' ||
    extracted.receiptType === 'kaspi_pay_qr' ||
    extracted.receiptType === 'fiscal'
  ) {
    return true
  }
  if (
    extracted.documentClass === 'kaspi_transfer' ||
    extracted.documentClass === 'kaspi_payment' ||
    extracted.documentClass === 'kaspi_fiscal' ||
    extracted.documentClass === 'kaspi_pay_qr'
  ) {
    return true
  }
  const blob = classificationBlob(extracted)
  return /kaspi|каспи|номер\s+перевода|kaspi gold|kaspi\.kz/.test(blob)
}

export function isKaspiPayRequest(extracted: ExtractedReceipt): boolean {
  const blob = classificationBlob(extracted)
  const hasPayUrl = extracted.qrPayloads.some(isKaspiPayUrl) || collectKaspiPayUrls(blob).length > 0
  if (hasPayUrl && !COMPLETED_RE.test(blob)) return true
  if (COMPLETED_RE.test(blob) || extracted.documentClass === 'kaspi_fiscal' || extracted.receiptType === 'fiscal') {
    return false
  }
  if (extracted.documentClass === 'kaspi_pay_qr' || extracted.receiptType === 'kaspi_pay_qr') return true
  const ai = extracted.ai || {}
  const aiClass = typeof ai.documentClass === 'string' ? ai.documentClass : ''
  if (ai.isKaspiPayQr === true || aiClass === 'kaspi_pay_qr') return true
  return INVOICE_RE.test(blob) && /kaspi|каспи/.test(blob)
}

export function hasCompletedPaymentEvidence(extracted: ExtractedReceipt): boolean {
  if (isKaspiPayRequest(extracted)) return false
  const ai = extracted.ai || {}
  if (ai.isKaspiReceipt === true && ai.isKaspiPayQr !== true) return true
  const blob = classificationBlob(extracted)
  if (COMPLETED_RE.test(blob)) return true
  if (extracted.receiptType === 'fiscal' || extracted.documentClass === 'kaspi_fiscal') return true
  if (extracted.receiptType === 'kaspi_transfer' || extracted.documentClass === 'kaspi_transfer') return true
  if (extracted.transactionId && looksLikeKaspi(extracted) && !extracted.qrPayloads.some(isKaspiPayUrl)) {
    return true
  }
  return false
}

export function clearlyNotKaspi(extracted: ExtractedReceipt): boolean {
  if (looksLikeKaspi(extracted) || isKaspiPayRequest(extracted)) return false
  const ai = extracted.ai || {}
  const aiClass = typeof ai.documentClass === 'string' ? ai.documentClass : ''
  if (aiClass === 'unreadable' || ai.unreadable === true) return false
  if (!hasHumanReceiptText(extracted)) return false
  if (aiClass === 'unrelated') return true
  if (ai.isKaspiReceipt === false && ai.isKaspiPayQr === false) {
    return !/kaspi|каспи/i.test(classificationBlob(extracted))
  }
  return !/kaspi|каспи/i.test(classificationBlob(extracted))
}

export function isUnreadableDocument(extracted: ExtractedReceipt): boolean {
  if (looksLikeKaspi(extracted) || isKaspiPayRequest(extracted) || clearlyNotKaspi(extracted)) return false
  if (extracted.qrPayloads.length || extracted.amount != null || extracted.transactionId) return false
  const ai = extracted.ai || {}
  if (typeof ai.error === 'string' && ai.error) return true
  if (ai.documentClass === 'unreadable' || ai.unreadable === true) return true
  return !hasHumanReceiptText(extracted)
}

export function hasReadableSubstance(extracted: ExtractedReceipt): boolean {
  return hasHumanReceiptText(extracted)
}

export function hasHumanReceiptText(extracted: ExtractedReceipt): boolean {
  const text = readableText(extracted.rawText)
  const aiText = typeof extracted.ai?.rawText === 'string' ? readableText(extracted.ai.rawText) : ''
  return (
    extracted.amount != null ||
    Boolean(extracted.transactionId) ||
    extracted.qrPayloads.length > 0 ||
    extracted.names.length > 0 ||
    text.length > 40 ||
    aiText.length > 40
  )
}

export function classifyDocument(extracted: ExtractedReceipt): DocumentClass {
  if (isKaspiPayRequest(extracted) && !hasCompletedPaymentEvidence(extracted)) return 'kaspi_pay_qr'
  const blob = classificationBlob(extracted)
  if (/oofd|фискал|\bфп\b/i.test(blob) && (looksLikeKaspi(extracted) || /kaspi|каспи/i.test(blob))) {
    return 'kaspi_fiscal'
  }
  if (hasCompletedPaymentEvidence(extracted) && looksLikeKaspi(extracted)) {
    if (/перевод|аударым|kaspi gold|номер\s+перевода/i.test(blob)) return 'kaspi_transfer'
    return 'kaspi_payment'
  }
  if (looksLikeKaspi(extracted)) {
    if (isKaspiPayRequest(extracted)) return 'kaspi_pay_qr'
    if (extracted.amount != null || extracted.transactionId) return 'kaspi_payment'
    return 'unreadable'
  }
  if (clearlyNotKaspi(extracted)) return 'unrelated'
  return 'unreadable'
}

export function documentClassToReceiptType(doc: DocumentClass, fallback: ReceiptType): ReceiptType {
  switch (doc) {
    case 'kaspi_transfer':
      return 'kaspi_transfer'
    case 'kaspi_payment':
      return 'kaspi_payment'
    case 'kaspi_fiscal':
      return 'fiscal'
    case 'kaspi_pay_qr':
      return 'kaspi_pay_qr'
    case 'unrelated':
      return 'unrelated'
    case 'unreadable':
      return 'unreadable'
    default:
      return fallback
  }
}

export function isCompletedPaymentClass(doc: DocumentClass): boolean {
  return doc === 'kaspi_transfer' || doc === 'kaspi_payment' || doc === 'kaspi_fiscal'
}

export function classificationBlob(extracted: ExtractedReceipt): string {
  const ai = extracted.ai || {}
  return [
    readableText(extracted.rawText),
    extracted.qrPayloads.join('\n'),
    typeof ai.rawText === 'string' ? readableText(ai.rawText) : '',
    typeof ai.provider === 'string' ? ai.provider : '',
    typeof ai.documentClass === 'string' ? ai.documentClass : '',
  ].join('\n').toLowerCase()
}

export function parseQrPayload(payload: string): {
  amount: number | null
  currency: string | null
  transactionId: string | null
  paidAt: string | null
  receiptType: ReceiptType
  isPayRequest: boolean
} {
  const result = {
    amount: null as number | null,
    currency: null as string | null,
    transactionId: null as string | null,
    paidAt: null as string | null,
    receiptType: 'unknown' as ReceiptType,
    isPayRequest: false,
  }
  const payRequest = isKaspiPayUrl(payload)
  result.isPayRequest = payRequest
  const lower = payload.toLowerCase()
  if (lower.includes('oofd') || lower.includes('fiscal')) result.receiptType = 'fiscal'
  else if (payRequest) result.receiptType = 'kaspi_pay_qr'
  else if (lower.includes('kaspi')) result.receiptType = 'kaspi_payment'

  try {
    const url = new URL(payload)
    const params = url.searchParams
    const amountRaw = params.get('amount') || params.get('sum') || params.get('s') || params.get('a')
    if (amountRaw) result.amount = normalizeAmount(amountRaw.replace(/[^\d.,]/g, ''))
    if (!payRequest) {
      result.transactionId =
        params.get('t') || params.get('fp') || params.get('i') || params.get('ticket') || params.get('id')
      const ts = params.get('time') || params.get('date') || params.get('dt')
      if (ts) {
        result.paidAt = parsePaidAt(ts) || (Number.isFinite(Date.parse(ts)) ? new Date(ts).toISOString() : null)
      }
      const pathId = url.pathname.split('/').filter(Boolean).pop()
      if (
        !result.transactionId &&
        pathId &&
        /[0-9A-Za-z-]{8,}/.test(pathId) &&
        !/^(pay|ticket|receipt|check)$/i.test(pathId)
      ) {
        result.transactionId = pathId
      }
    }
    if (/kzt|тенге|теңге/i.test(url.search) || url.hostname.includes('kaspi') || url.hostname.includes('oofd')) {
      result.currency = 'KZT'
    }
  } catch {
    if (!payRequest) {
      const amount = payload.match(/(?:s|sum|amount)[=:](\d+(?:[.,]\d{1,2})?)/i)
      if (amount) result.amount = normalizeAmount(amount[1])
      const id = payload.match(/(?:fp|t|id)[=:]([0-9A-Za-z-]{6,32})/i)
      if (id) result.transactionId = id[1]
    } else {
      const amount = payload.match(/(?:amount|sum|s)[=:](\d+(?:[.,]\d{1,2})?)/i)
      if (amount) result.amount = normalizeAmount(amount[1])
    }
  }

  if (/₸|kzt|тг|тенге/i.test(payload)) result.currency = result.currency || 'KZT'
  return result
}

export function parseTransactionId(text: string): string | null {
  const patterns = [
    /номер\s+операции[:\s]*([0-9]{6,24})/i,
    /номер\s+перевода[:\s]*([0-9]{6,24})/i,
    /код\s+операции[:\s]*([0-9A-Z-]{6,32})/i,
    /id\s+операции[:\s]*([0-9]{6,24})/i,
    /operation(?:\s+id|\s+number)?[:\s]*([0-9]{6,24})/i,
    /фискальный\s+признак[:\s]*([0-9]{6,24})/i,
    /\bфп[:\s]*([0-9]{6,24})/i,
    /операция\s+№\s*([0-9]{6,24})/i,
    /перевод\s+№\s*([0-9]{6,24})/i,
    /аудар(?:ым)?\s*(?:нөмірі|номері)?[:\s]*([0-9]{6,24})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

const MONTHS: Record<string, number> = {
  январ: 1, феврал: 2, март: 3, апрел: 4, мая: 5, май: 5, июн: 6, июл: 7,
  август: 8, сентябр: 9, октябр: 10, ноябр: 11, декабр: 12,
  қаңтар: 1, ақпан: 2, наурыз: 3, сәуір: 4, мамыр: 5, маусым: 6, шілде: 7,
  тамыз: 8, қыркүйек: 9, қазан: 10, қараша: 11, желтоқсан: 12,
}

export function parsePaidAt(text: string): string | null {
  const numeric = text.match(/(\d{2}[./]\d{2}[./]\d{4})(?:[T,\s]+(\d{2}:\d{2}(?::\d{2})?))?/)
  if (numeric) {
    const [dd, mm, yyyy] = numeric[1].split(/[./]/).map(Number)
    return toAlmatyIso(yyyy, mm, dd, numeric[2])
  }

  const named = text.match(
    /(\d{1,2})\s+([A-Za-zА-Яа-яЁёІіҢңҒғҮүҰұҚқӨөҺһ]{3,12})[а-яё]*\.?\s+(\d{4})(?:[T,\s]+г?\.?,?\s*(\d{2}:\d{2}(?::\d{2})?))?/i,
  )
  if (named) {
    const monthKey = Object.keys(MONTHS).find((k) => named[2].toLowerCase().startsWith(k))
    if (monthKey) return toAlmatyIso(Number(named[3]), MONTHS[monthKey], Number(named[1]), named[4])
  }
  return null
}

function toAlmatyIso(yyyy: number, mm: number, dd: number, time?: string | null): string | null {
  if (!yyyy || !mm || !dd) return null
  const clock = time || '00:00:00'
  const [hh, min, ss] = `${clock}${clock.length === 5 ? ':00' : ''}`.split(':').map(Number)
  const iso = new Date(Date.UTC(yyyy, mm - 1, dd, (hh || 0) - 5, min || 0, ss || 0))
  if (Number.isNaN(iso.getTime())) return null
  return iso.toISOString()
}

export function isKzMobile(value: string): boolean {
  const n = normalizePhone(value)
  return n.length === 10 && n.startsWith('7')
}

export function parsePhones(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:\+?7|8)[\s()-]*(\d{3})[\s()-]*(\d{3})[\s()-]*(\d{2})[\s()-]*(\d{2})/g)) {
    const n = normalizePhone(`7${m[1]}${m[2]}${m[3]}${m[4]}`)
    if (isKzMobile(n)) out.add(n)
  }
  return [...out]
}

export function parseNames(text: string): string[] {
  const out: string[] = []
  const re =
    /(?:кому|получатель|от кого|отправитель|кімге)[:\s]+([A-Za-zА-Яа-яЁёІіҢңҒғҮүҰұҚқӨөҺһ'’\- ]{3,80})/gi
  for (const m of text.matchAll(re)) {
    const name = m[1].replace(/\s+/g, ' ').trim()
    if (name) out.push(name)
  }
  return out
}

export function applyTextAndQr(extracted: ExtractedReceipt) {
  for (const payload of extracted.qrPayloads) {
    const q = parseQrPayload(payload)
    if (q.isPayRequest) {
      if (q.amount != null && extracted.amount == null) {
        extracted.amount = q.amount
        extracted.sources.amount = 'qr'
      }
      if (q.currency && !extracted.currency) extracted.currency = q.currency
      continue
    }
    if (q.amount != null && extracted.amount == null) {
      extracted.amount = q.amount
      extracted.sources.amount = 'qr'
    }
    if (q.currency && !extracted.currency) extracted.currency = q.currency
    if (q.transactionId && !extracted.transactionId) {
      extracted.transactionId = q.transactionId
      extracted.sources.transactionId = 'qr'
    }
    if (q.paidAt && !extracted.paidAt) {
      extracted.paidAt = q.paidAt
      extracted.sources.paidAt = 'qr'
    }
  }

  const text = readableText(extracted.rawText) || extracted.rawText
  if (!extracted.currency) extracted.currency = detectCurrency(text)
  const textAmount = parseAmount(text)
  if (textAmount != null && extracted.sources.amount !== 'qr' && extracted.sources.amount !== 'ocr') {
    extracted.amount = textAmount
    extracted.sources.amount = 'text'
  }
  if (!isKaspiPayRequest(extracted)) {
    const txn = parseTransactionId(text)
    if (txn && extracted.sources.transactionId !== 'qr' && extracted.sources.transactionId !== 'ocr') {
      extracted.transactionId = txn
      extracted.sources.transactionId = 'text'
    }
    const paidAt = parsePaidAt(text)
    if (paidAt && extracted.sources.paidAt !== 'qr' && extracted.sources.paidAt !== 'ocr') {
      extracted.paidAt = paidAt
      extracted.sources.paidAt = 'text'
    }
  }
  extracted.phones = parsePhones(text)
  extracted.names = parseNames(text)
  extracted.documentClass = classifyDocument(extracted)
  extracted.receiptType = documentClassToReceiptType(extracted.documentClass, extracted.receiptType)
}

export function finalizeClassification(extracted: ExtractedReceipt) {
  extracted.rawText = readableText(extracted.rawText) || extracted.rawText
  extracted.currency = normalizeCurrency(extracted.currency)
  if (looksLikeKaspi(extracted) && !extracted.currency) extracted.currency = 'KZT'
  if (looksLikeKaspi(extracted) && extracted.currency && extracted.currency !== 'KZT') {
    const blob = classificationBlob(extracted)
    const hasForeign = /(?:^|[^\d])(?:\$|usd|€|eur|₽|руб)/i.test(blob) && !/₸|kzt|тг|тенге|теңге/.test(blob)
    if (!hasForeign) extracted.currency = 'KZT'
  }
  extracted.documentClass = classifyDocument(extracted)
  extracted.receiptType = documentClassToReceiptType(extracted.documentClass, extracted.receiptType)
  if (isKaspiPayRequest(extracted)) {
    extracted.documentClass = 'kaspi_pay_qr'
    extracted.receiptType = 'kaspi_pay_qr'
    extracted.transactionId = null
    extracted.sources.transactionId = null
    extracted.paidAt = null
    extracted.sources.paidAt = null
  }
}
