import jsQR from 'https://esm.sh/jsqr@1.4.0'
import jpeg from 'https://esm.sh/jpeg-js@0.4.4?target=deno'
import { decode as decodePng } from 'https://esm.sh/fast-png@6.2.0'
import {
  ExtractedReceipt,
  ReceiptType,
  applyTextAndQr,
  collectKaspiPayUrls,
  emptyExtracted,
  finalizeClassification,
  hasCompletedPaymentEvidence,
  isKaspiPayRequest,
  isKaspiPayUrl,
  looksLikeKaspi,
  normalizeCurrency,
  normalizePhone,
  parsePaidAt,
  readableText,
  isKzMobile,
} from './receipt-classify.ts'

export type { ExtractedReceipt, ReceiptType }
export {
  clearlyNotKaspi,
  collectKaspiPayUrls,
  isKaspiPayRequest,
  isKaspiPayUrl,
  looksLikeKaspi,
  normalizeCurrency,
  normalizePhone,
  readableText,
} from './receipt-classify.ts'

const MAX_TEXT = 20_000

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function parseReceipt(input: {
  bytes: Uint8Array
  mimeType: string
}): Promise<ExtractedReceipt> {
  const extracted = emptyExtracted(input.mimeType === 'application/pdf' ? 'pdf' : 'image')

  if (input.mimeType === 'application/pdf') {
    const pdf = await extractPdfContent(input.bytes)
    extracted.rawText = pdf.text
    extracted.qrPayloads = [...pdf.urls.filter(isKaspiPayUrl)]
    const rasters = [
      ...extractEmbeddedRasters(input.bytes),
      ...await extractPdfImageXObjects(input.bytes),
    ]
    for (const raster of rasters.slice(0, 6)) {
      for (const payload of decodeQrFromImage(raster.bytes, raster.mime)) {
        if (!extracted.qrPayloads.includes(payload)) extracted.qrPayloads.push(payload)
      }
    }
    if (!extracted.rawText && (pdf.foundKaspi || extracted.qrPayloads.length)) {
      extracted.rawText = pdf.foundKaspi ? 'kaspi.kz' : extracted.qrPayloads.join('\n')
    }
  } else if (input.mimeType.startsWith('image/')) {
    extracted.qrPayloads = decodeQrFromImage(input.bytes, input.mimeType)
    extracted.rawText = extracted.qrPayloads.join('\n')
  }

  if (extracted.qrPayloads.length) {
    extracted.rawText = [extracted.rawText, ...extracted.qrPayloads].filter(Boolean).join('\n')
  }

  applyTextAndQr(extracted)
  extracted.ai = await maybeAiExtract(input.bytes, input.mimeType, extracted)
  if (extracted.ai) mergeAi(extracted)
  applyTextAndQr(extracted)
  finalizeClassification(extracted)
  return extracted
}

async function extractPdfContent(bytes: Uint8Array): Promise<{ text: string; urls: string[]; foundKaspi: boolean }> {
  const latin = new TextDecoder('latin1').decode(bytes)
  const foundKaspi = /kaspi/i.test(latin)
  const chunks: string[] = []
  const urls = new Set<string>(collectKaspiPayUrls(latin))

  for (const inflated of await inflatePdfStreams(bytes, { skipFonts: true, skipImages: true })) {
    const inflatedLatin = new TextDecoder('latin1').decode(inflated)
    for (const url of collectKaspiPayUrls(inflatedLatin)) urls.add(url)
    chunks.push(...extractPdfLiteralStrings(inflatedLatin))
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(inflated)
    const readable = readableText(utf8)
    if (readable) chunks.push(readable)
    if (/kaspi/i.test(inflatedLatin) || /kaspi/i.test(utf8)) chunks.push('kaspi.kz')
  }

  const joined = chunks.join(' ').replace(/[^\S\n]+/g, ' ').trim()
  const text = readableText(joined) || (foundKaspi || urls.size ? 'kaspi.kz' : '')
  return { text: text.slice(0, MAX_TEXT), urls: [...urls], foundKaspi: foundKaspi || urls.size > 0 }
}

function extractPdfLiteralStrings(latin: string): string[] {
  const chunks: string[] = []
  for (const m of latin.matchAll(/\((?:\\.|[^\\)]){2,}\)/g)) {
    const inner = m[0]
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\([()\\])/g, '$1')
    if (readableText(inner) || /kaspi|каспи|₸|\d/.test(inner)) chunks.push(inner)
  }
  for (const m of latin.matchAll(/\[((?:[^\]]|\n){0,400})\]\s*TJ/g)) {
    for (const s of m[1].matchAll(/\((?:\\.|[^\\)])+\)/g)) {
      chunks.push(s[0].slice(1, -1))
    }
  }
  for (const m of latin.matchAll(/\/URI\s*\((?:\\.|[^\\)])+\)/g)) {
    chunks.push(m[0])
  }
  return chunks
}

async function inflatePdfStreams(
  bytes: Uint8Array,
  opts: { skipFonts?: boolean; skipImages?: boolean } = {},
): Promise<Uint8Array[]> {
  const latin = new TextDecoder('latin1').decode(bytes)
  const out: Uint8Array[] = []
  const re = /stream\r?\n/g
  let match: RegExpExecArray | null
  while ((match = re.exec(latin)) && out.length < 24) {
    const dict = streamDictBefore(latin, match.index)
    if (opts.skipFonts && /\/FontFile|\/Length1\b/i.test(dict)) continue
    if (opts.skipImages && /\/Subtype\s*\/Image\b|\/Image\b/.test(dict) && /\/Width\b/.test(dict)) continue
    const start = match.index + match[0].length
    const endMarker = latin.indexOf('endstream', start)
    if (endMarker < 0) continue
    let data = bytes.slice(start, endMarker)
    while (data.length && (data[data.length - 1] === 10 || data[data.length - 1] === 13)) {
      data = data.subarray(0, data.length - 1)
    }
    if (data.length < 16 || data.length > 2_000_000) continue
    const inflated = await inflateZlib(data)
    if (inflated && inflated.byteLength > 0 && inflated.byteLength < 4_000_000) out.push(inflated)
  }
  return out
}

function streamDictBefore(latin: string, streamIndex: number): string {
  const start = latin.lastIndexOf('<<', streamIndex)
  if (start < 0 || streamIndex - start > 8000) return ''
  return latin.slice(start, streamIndex)
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array | null> {
  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(format)
      const stream = new Blob([data]).stream().pipeThrough(ds)
      const buf = await new Response(stream).arrayBuffer()
      return new Uint8Array(buf)
    } catch {
      /* try next format */
    }
  }
  return null
}

type RgbaImage = { width: number; height: number; data: Uint8ClampedArray }

function decodeRaster(bytes: Uint8Array, mimeType: string): RgbaImage | null {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    const raw = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 12 })
    return {
      width: raw.width,
      height: raw.height,
      data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength),
    }
  }
  if (mimeType === 'image/png') {
    const png = decodePng(bytes)
    return { width: png.width, height: png.height, data: pngToRgba(png) }
  }
  return null
}

function pngToRgba(png: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }): Uint8ClampedArray {
  const { width, height, data } = png
  const pixels = width * height
  if (data.length >= pixels * 4) {
    return new Uint8ClampedArray(data.buffer, data.byteOffset, pixels * 4)
  }
  const channels = Math.max(1, Math.round(data.length / pixels))
  const out = new Uint8ClampedArray(pixels * 4)
  for (let i = 0; i < pixels; i++) {
    if (channels === 1) {
      const v = data[i]
      out[i * 4] = v
      out[i * 4 + 1] = v
      out[i * 4 + 2] = v
      out[i * 4 + 3] = 255
    } else {
      out[i * 4] = data[i * channels]
      out[i * 4 + 1] = data[i * channels + 1] ?? data[i * channels]
      out[i * 4 + 2] = data[i * channels + 2] ?? data[i * channels]
      out[i * 4 + 3] = 255
    }
  }
  return out
}

function downscale(image: RgbaImage, maxSide: number): RgbaImage {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
  if (scale >= 1) return image
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, Math.floor(y / scale))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.floor(x / scale))
      const si = (sy * image.width + sx) * 4
      const di = (y * width + x) * 4
      data[di] = image.data[si]
      data[di + 1] = image.data[si + 1]
      data[di + 2] = image.data[si + 2]
      data[di + 3] = image.data[si + 3]
    }
  }
  return { width, height, data }
}

function decodeQrFromImage(bytes: Uint8Array, mimeType: string): string[] {
  try {
    const raster = decodeRaster(bytes, mimeType)
    if (!raster) return []
    const found = new Set<string>()
    for (const side of [1200, 800]) {
      const scaled = downscale(raster, side)
      const code = jsQR(scaled.data, scaled.width, scaled.height, { inversionAttempts: 'attemptBoth' })
      if (code?.data) found.add(code.data)
    }
    return [...found]
  } catch (err) {
    console.error('qr decode failed', err)
    return []
  }
}

function mergeAi(extracted: ExtractedReceipt) {
  const ai = extracted.ai as Record<string, unknown>
  const source: 'ocr' | 'ai' = ai._source === 'openai' ? 'ocr' : 'ai'
  const aiClass = typeof ai.documentClass === 'string' ? ai.documentClass : ''
  if (aiClass === 'kaspi_pay_qr') {
    ai.isKaspiPayQr = true
    if (ai.isKaspiReceipt !== true) ai.isKaspiReceipt = false
  }
  if (aiClass === 'kaspi_transfer' || aiClass === 'kaspi_payment' || aiClass === 'kaspi_fiscal') {
    ai.isKaspiReceipt = true
    ai.isKaspiPayQr = false
  }
  if (aiClass === 'unreadable') ai.unreadable = true
  const amount = coerceAmount(ai.amount) ?? coerceAmount(ai.total) ?? coerceAmount(ai.sum)
  if (extracted.amount == null && amount != null) {
    extracted.amount = amount
    extracted.sources.amount = source
  }
  if (!extracted.currency && typeof ai.currency === 'string') {
    extracted.currency = normalizeCurrency(ai.currency)
  }
  const txn =
    typeof ai.transactionId === 'string'
      ? ai.transactionId.trim()
      : typeof ai.operationId === 'string'
        ? ai.operationId.trim()
        : ''
  const payQr = ai.isKaspiPayQr === true || isKaspiPayRequest(extracted)
  if (!extracted.transactionId && txn && !payQr) {
    extracted.transactionId = txn
    extracted.sources.transactionId = source
  }
  if (!extracted.paidAt && typeof ai.paidAt === 'string' && !payQr) {
    extracted.paidAt = parsePaidAt(ai.paidAt) ||
      (Number.isFinite(Date.parse(ai.paidAt)) ? new Date(ai.paidAt).toISOString() : null)
    if (extracted.paidAt) extracted.sources.paidAt = source
  }
  if (Array.isArray(ai.phones)) {
    for (const phone of ai.phones) {
      if (typeof phone === 'string') {
        const n = normalizePhone(phone)
        if (isKzMobile(n)) extracted.phones.push(n)
      }
    }
    extracted.phones = [...new Set(extracted.phones.filter(isKzMobile))]
  }
  if (Array.isArray(ai.names)) {
    for (const name of ai.names) {
      if (typeof name === 'string' && name.trim()) extracted.names.push(name.trim())
    }
  }
  if (typeof ai.rawText === 'string' && ai.rawText.trim()) {
    const cleaned = readableText(ai.rawText)
    if (cleaned) {
      extracted.rawText = [extracted.rawText, cleaned].filter(Boolean).join('\n').slice(0, MAX_TEXT)
    }
  }
}

function coerceAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100_000_000) {
    return Math.round(value * 100) / 100
  }
  if (typeof value === 'string') {
    const n = Number(value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''))
    if (Number.isFinite(n) && n > 0 && n < 100_000_000) return Math.round(n * 100) / 100
  }
  return null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function shouldRunAi(current: ExtractedReceipt, mimeType: string): boolean {
  if (isKaspiPayRequest(current) && (current.qrPayloads.some(isKaspiPayUrl) || collectKaspiPayUrls(current.rawText).length)) {
    return false
  }
  if (hasCompletedPaymentEvidence(current) && current.amount != null && looksLikeKaspi(current)) {
    return false
  }
  if (mimeType.startsWith('image/')) return true
  if (!readableText(current.rawText) && !current.qrPayloads.length) return true
  if (current.amount == null) return true
  return true
}

async function maybeAiExtract(
  bytes: Uint8Array,
  mimeType: string,
  current: ExtractedReceipt,
): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    console.warn('OPENAI_API_KEY missing — screenshot receipts cannot be OCR-parsed')
    return null
  }
  if (!shouldRunAi(current, mimeType)) return null

  try {
    const content: unknown[] = [{
      type: 'text',
      text: [
        'Classify this document. A Kaspi QR/payment PDF can be a payment REQUEST created BEFORE payment.',
        'A transfer receipt / e-receipt is evidence of a COMPLETED payment.',
        'If you receive a PDF, read the visible page. Ignore PDF source tokens like endstream, endobj, /FlateDecode, /Length.',
        'documentClass must be one of: kaspi_transfer, kaspi_payment, kaspi_fiscal, kaspi_pay_qr, unrelated, unreadable.',
        'kaspi_pay_qr = Kaspi pay QR, invoice, or payment request. It IS Kaspi, but is NOT proof of payment.',
        'kaspi_transfer / kaspi_payment / kaspi_fiscal = completed payment evidence.',
        'amount must be a JSON number in tenge (e.g. 500). ₸, тг, тенге, теңге, KZT all mean KZT.',
        'Compare numbers only; do not treat ₸ as a missing amount.',
        'Never invent transactionId. kaspi.kz/pay/... path IDs are NOT transaction IDs.',
        'isKaspiPayQr=true only for pre-payment QR/invoice. isKaspiReceipt=true only after payment.',
        'If you cannot read the visible receipt: documentClass=unreadable. Do not mark unreadable PDFs as unrelated.',
        'Never invent fields.',
      ].join(' '),
    }]

    const images = await imagesForVision(bytes, mimeType)
    for (const image of images.slice(0, 3)) {
      content.push({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } })
    }
    if (mimeType === 'application/pdf' && bytes.byteLength <= 4_000_000) {
      content.push({
        type: 'file',
        file: {
          filename: 'receipt.pdf',
          file_data: `data:application/pdf;base64,${bytesToBase64(bytes)}`,
        },
      })
    }
    const cleanText = readableText(current.rawText)
    if (cleanText) content.push({ type: 'text', text: `Extracted text:\n${cleanText.slice(0, 4000)}` })
    if (current.qrPayloads.length) {
      content.push({ type: 'text', text: `QR/URL payloads:\n${current.qrPayloads.slice(0, 5).join('\n')}` })
    }
    const hasPdf = mimeType === 'application/pdf'
    if (!images.length && !cleanText && !current.qrPayloads.length && !hasPdf) {
      console.warn('receipt vision skipped: unsupported image', mimeType, bytes.byteLength)
      return { error: 'no_parseable_content', documentClass: 'unreadable', unreadable: true }
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract JSON: documentClass (kaspi_transfer|kaspi_payment|kaspi_fiscal|kaspi_pay_qr|unrelated|unreadable), isKaspiReceipt (boolean), isKaspiPayQr (boolean), amount (number|null), currency (KZT/USD/EUR/RUB|null), transactionId (string|null), paidAt (ISO or dd.mm.yyyy HH:mm|null), phones (string[]), names (string[]), rawText (visible text only). If the PDF cannot be read, documentClass=unreadable, not unrelated. Kaspi pay QR PDFs are Kaspi documents. ₸/тг/тенге = KZT. Never invent a transaction id or amount.',
          },
          { role: 'user', content },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('openai vision failed', res.status, errText)
      if (res.status === 400 && mimeType === 'application/pdf') {
        return await maybeAiExtractImagesOnly(apiKey, bytes, mimeType, current)
      }
      return { error: `openai ${res.status}` }
    }
    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return null
    return { ...JSON.parse(raw), _source: 'openai' }
  } catch (err) {
    console.error('ai extract failed', err)
    return { error: 'ai_extract_failed' }
  }
}

async function maybeAiExtractImagesOnly(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  current: ExtractedReceipt,
): Promise<Record<string, unknown> | null> {
  const images = await imagesForVision(bytes, mimeType)
  const cleanText = readableText(current.rawText)
  if (!images.length && !cleanText && !current.qrPayloads.length) {
    return { error: 'pdf_unreadable', documentClass: 'unreadable', unreadable: true }
  }
  const content: unknown[] = [{
    type: 'text',
    text: 'Read the visible receipt images. Ignore PDF source code. Return the same JSON schema.',
  }]
  for (const image of images.slice(0, 3)) {
    content.push({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } })
  }
  if (cleanText) content.push({ type: 'text', text: `Extracted text:\n${cleanText.slice(0, 4000)}` })
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract JSON: documentClass, isKaspiReceipt, isKaspiPayQr, amount, currency, transactionId, paidAt, phones, names, rawText. If unreadable, documentClass=unreadable, not unrelated.',
          },
          { role: 'user', content },
        ],
      }),
    })
    if (!res.ok) {
      console.error('openai vision retry failed', res.status, await res.text().catch(() => ''))
      return { error: `openai ${res.status}`, documentClass: 'unreadable', unreadable: true }
    }
    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return { error: 'empty_ai', documentClass: 'unreadable', unreadable: true }
    return { ...JSON.parse(raw), _source: 'openai' }
  } catch (err) {
    console.error('ai extract retry failed', err)
    return { error: 'ai_extract_failed', documentClass: 'unreadable', unreadable: true }
  }
}

async function imagesForVision(bytes: Uint8Array, mimeType: string): Promise<{ mime: string; base64: string }[]> {
  if (mimeType.startsWith('image/')) {
    const one = await imageForVision(bytes, mimeType)
    return one ? [one] : []
  }
  if (mimeType !== 'application/pdf') return []
  const out: { mime: string; base64: string }[] = []
  const rasters = [
    ...extractEmbeddedRasters(bytes),
    ...await extractPdfImageXObjects(bytes),
  ].sort((a, b) => b.bytes.byteLength - a.bytes.byteLength)
  const seen = new Set<string>()
  for (const raster of rasters.slice(0, 6)) {
    const key = `${raster.mime}:${raster.bytes.byteLength}:${raster.bytes[10] ?? 0}`
    if (seen.has(key)) continue
    seen.add(key)
    const one = await imageForVision(raster.bytes, raster.mime)
    if (one) out.push(one)
    if (out.length >= 3) break
  }
  return out
}

async function imageForVision(bytes: Uint8Array, mimeType: string): Promise<{ mime: string; base64: string } | null> {
  if (!mimeType.startsWith('image/')) return null
  if (bytes.byteLength <= 700_000 && (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/gif')) {
    return { mime: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType, base64: bytesToBase64(bytes) }
  }

  const raster = decodeRaster(bytes, mimeType === 'image/jpg' ? 'image/jpeg' : mimeType)
  if (!raster) {
    if (bytes.byteLength <= 1_500_000) return { mime: mimeType, base64: bytesToBase64(bytes) }
    return null
  }

  for (const side of [1280, 960, 720]) {
    for (const quality of [70, 55, 40]) {
      const scaled = downscale(raster, side)
      try {
        const encoded = jpeg.encode({ data: scaled.data, width: scaled.width, height: scaled.height }, quality)
        const data: Uint8Array = encoded.data instanceof Uint8Array ? encoded.data : new Uint8Array(encoded.data)
        if (data.byteLength <= 700_000) {
          return { mime: 'image/jpeg', base64: bytesToBase64(data) }
        }
      } catch (err) {
        console.error('jpeg encode failed', err)
      }
    }
  }
  return null
}

function extractEmbeddedRasters(bytes: Uint8Array): { mime: string; bytes: Uint8Array }[] {
  const found: { mime: string; bytes: Uint8Array }[] = []
  for (const jpegBytes of extractEmbeddedJpegs(bytes)) found.push({ mime: 'image/jpeg', bytes: jpegBytes })
  for (const png of extractEmbeddedPngs(bytes)) found.push({ mime: 'image/png', bytes: png })
  return found.sort((a, b) => b.bytes.byteLength - a.bytes.byteLength)
}

async function extractPdfImageXObjects(bytes: Uint8Array): Promise<{ mime: string; bytes: Uint8Array }[]> {
  const latin = new TextDecoder('latin1').decode(bytes)
  const out: { mime: string; bytes: Uint8Array }[] = []
  const re = /stream\r?\n/g
  let match: RegExpExecArray | null
  while ((match = re.exec(latin)) && out.length < 8) {
    const dict = streamDictBefore(latin, match.index)
    if (!/\/Subtype\s*\/Image\b/.test(dict) && !(/\/Width\b/.test(dict) && /\/Height\b/.test(dict) && /\/ColorSpace\b/.test(dict))) {
      continue
    }
    const start = match.index + match[0].length
    const endMarker = latin.indexOf('endstream', start)
    if (endMarker < 0) continue
    let data = bytes.slice(start, endMarker)
    while (data.length && (data[data.length - 1] === 10 || data[data.length - 1] === 13)) {
      data = data.subarray(0, data.length - 1)
    }
    if (data.length < 32) continue
    if (/\/DCTDecode\b/.test(dict) || (data[0] === 0xff && data[1] === 0xd8)) {
      out.push({ mime: 'image/jpeg', bytes: data })
      continue
    }
    if (!/\/FlateDecode\b/.test(dict)) continue
    const inflated = await inflateZlib(data)
    if (!inflated) continue
    const width = Number(dict.match(/\/Width\s+(\d+)/)?.[1] || 0)
    const height = Number(dict.match(/\/Height\s+(\d+)/)?.[1] || 0)
    const bpc = Number(dict.match(/\/BitsPerComponent\s+(\d+)/)?.[1] || 8)
    if (!width || !height || bpc !== 8 || width > 4000 || height > 8000) continue
    const jpegBytes = rawPdfImageToJpeg(width, height, inflated, /\/DeviceGray\b/.test(dict) ? 1 : 3)
    if (jpegBytes) out.push({ mime: 'image/jpeg', bytes: jpegBytes })
  }
  return out
}

function rawPdfImageToJpeg(width: number, height: number, data: Uint8Array, channels: number): Uint8Array | null {
  const pixels = width * height
  if (data.byteLength < pixels * channels) return null
  const rgba = new Uint8ClampedArray(pixels * 4)
  for (let i = 0; i < pixels; i++) {
    if (channels === 1) {
      const v = data[i]
      rgba[i * 4] = v
      rgba[i * 4 + 1] = v
      rgba[i * 4 + 2] = v
      rgba[i * 4 + 3] = 255
    } else {
      rgba[i * 4] = data[i * channels]
      rgba[i * 4 + 1] = data[i * channels + 1]
      rgba[i * 4 + 2] = data[i * channels + 2]
      rgba[i * 4 + 3] = 255
    }
  }
  try {
    const encoded = jpeg.encode({ data: rgba, width, height }, 70)
    return encoded.data instanceof Uint8Array ? encoded.data : new Uint8Array(encoded.data)
  } catch {
    return null
  }
}

function extractEmbeddedJpegs(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      for (let j = i + 3; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9 && j - i > 2000) {
          out.push(bytes.slice(i, j + 2))
          i = j + 1
          break
        }
      }
    }
  }
  return out
}

function extractEmbeddedPngs(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i <= bytes.length - 24; i++) {
    if (!sig.every((b, k) => bytes[i + k] === b)) continue
    for (let j = i + 8; j < bytes.length - 7; j++) {
      if (bytes[j] === 0x49 && bytes[j + 1] === 0x45 && bytes[j + 2] === 0x4e && bytes[j + 3] === 0x44) {
        out.push(bytes.slice(i, j + 8))
        i = j + 7
        break
      }
    }
  }
  return out
}
