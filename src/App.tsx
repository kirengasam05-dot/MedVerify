import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { get, onValue, push, ref, set, update } from 'firebase/database'
import { db } from './firebase'
import { classify, actionFor, tone } from './classify'
import type { Scan, Product, Category, CaseStatus, CodeMatch } from './types'

const LOCATIONS = ['Kigali', 'Rubavu', 'Rusizi']
const CATS: Category[] = ['Genuine', 'Low Suspicion', 'Medium Suspicion', 'High Suspicion', 'Critical']
const codeLabel: Record<CodeMatch, string> = {
  valid_unused: 'Valid, unused', not_found: 'Not in registry', already_used: 'Flagged / already used', status_unknown: 'Registry status missing'
}
function productDetailFields(record: Record<string, unknown>) {
  const nested = record.product ?? record.details ?? record.medicine
  const fields = nested && typeof nested === 'object'
    ? { ...record, ...(nested as Record<string, unknown>) }
    : record
  return Object.entries(fields).filter(([field]) => !['product', 'details', 'medicine'].includes(field))
}
type IncomingScan = Partial<Scan> & { id: string; barcode?: string; timestamp?: unknown; [key: string]: unknown }
const productLookupKey = (scanId: string, barcode: string) => `${scanId}::${barcode}`
const scanBarcode = (scan: IncomingScan) => String(scan.barcode ?? scan.barcodeNumber ?? scan.barcode_number ?? scan.barcodeValue ?? scan.gtin ?? scan.code ?? '').trim()

function scanTimestamp(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') return 0
  const parsed = typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : Date.parse(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  // RTDB timestamps may be stored as Unix seconds or milliseconds.
  return parsed < 1_000_000_000_000 ? parsed * 1000 : parsed
}

function normalizeProductRecord(record: Record<string, unknown>): Product {
  const nested = record.product ?? record.details ?? record.medicine
  const data = nested && typeof nested === 'object' ? { ...record, ...(nested as Record<string, unknown>) } : record
  const piecesValue = data.piecesPerPack ?? data.pieces_per_pack ?? data.packSize ?? data.pack_size ?? data.unitsPerPack ?? data.units_per_pack ?? data.quantityPerPack ?? data.quantity_per_pack ?? data.quantity ?? data.pieces
  const piecesPerPack = piecesValue == null ? undefined : Number.parseInt(String(piecesValue), 10)
  const statusValue = String(data.status ?? data.registryStatus ?? data.registry_status ?? data.validityStatus ?? data.validity_status ?? data.validity ?? '').trim().toLowerCase()

  return {
    ...data,
    name: String(data.name ?? data.productName ?? data.product_name ?? data.medicineName ?? data.medicine_name ?? data.drugName ?? data.drug_name ?? 'Unknown product'),
    category: String(data.category ?? data.medicineType ?? data.medicine_type ?? data.medicineCategory ?? data.medicine_category ?? data.type ?? ''),
    manufacturer: String(data.manufacturer ?? data.manufacturerName ?? data.manufacturer_name ?? data.brand ?? data.company ?? ''),
    batch: String(data.batch ?? data.batchNumber ?? data.batch_number ?? ''),
    expiry: String(data.expiry ?? data.expiryDate ?? data.expiry_date ?? data.expirationDate ?? ''),
    piecesPerPack: piecesPerPack && piecesPerPack > 0 ? piecesPerPack : undefined,
    status: statusValue === 'flagged' || statusValue === 'invalid' || data.isValid === false || data.is_valid === false
      ? 'flagged'
      : statusValue === 'valid' || data.isValid === true || data.is_valid === true
        ? 'valid'
        : 'unknown'
  } as Product
}

function productBarcode(record: Product & { id: string }) {
  const data = record as unknown as Record<string, unknown>
  const nested = data.product ?? data.details ?? data.medicine
  const fields = nested && typeof nested === 'object' ? { ...data, ...(nested as Record<string, unknown>) } : data
  return String(fields.barcode ?? fields.barcodeNumber ?? fields.barcode_number ?? fields.barcodeValue ?? fields.gtin ?? fields.gtinNumber ?? fields.code ?? '').trim()
}

async function getProductRecordByBarcode(barcode: string): Promise<Record<string, unknown> | null> {
  const direct = await get(ref(db, `products/${barcode}`))
  const directValue = direct.val()
  if (direct.exists() && directValue && typeof directValue === 'object') {
    return directValue as Record<string, unknown>
  }

  let records: unknown
  try {
    const allProducts = await get(ref(db, 'products'))
    records = allProducts.val() ?? {}
  } catch {
    return null
  }
  const match = Object.entries(records as Record<string, Record<string, unknown>>).find(([key, record]) => {
    const nested = record?.product ?? record?.details ?? record?.medicine
    const fields = nested && typeof nested === 'object' ? { ...record, ...(nested as Record<string, unknown>) } : record
    return key === barcode || [fields?.barcode, fields?.barcodeNumber, fields?.barcode_number, fields?.barcodeValue, fields?.gtin, fields?.gtinNumber, fields?.code]
      .some(value => value != null && String(value).trim() === barcode)
  })
  return match?.[1] ?? null
}

const Badge = ({ c }: { c: Category }) => (
  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${tone[c]}`}>{c}</span>
)

export default function App() {
  const [tab, setTab] = useState<'dash' | 'scan' | 'registry'>('dash')
  const [rawScans, setRawScans] = useState<IncomingScan[]>([])
  const [products, setProducts] = useState<(Product & { id: string })[]>([])
  const [scansLoaded, setScansLoaded] = useState(false)
  const [productLookups, setProductLookups] = useState<Record<string, Record<string, unknown> | null>>({})
  const productLookupsStarted = useRef(new Set<string>())
  const [error, setError] = useState('')

  useEffect(() => {
    const u1 = onValue(
      ref(db, 'scans'),
      snapshot => {
        const records = snapshot.val() ?? {}
        const fields = records && typeof records === 'object' ? records as Record<string, unknown> : {}
        const isSingleRecord = ['barcode', 'barcodeNumber', 'barcode_number', 'barcodeValue', 'gtin', 'code']
          .some(key => key in fields)
        const entries = isSingleRecord
          ? [['latest', records] as [string, unknown]]
          : Object.entries(fields)
        const latest = entries
          .map(([id, value]) => {
            const scan: IncomingScan = value && typeof value === 'object'
              ? value as IncomingScan
              : { id, barcode: String(value ?? '') }
            const barcode = scan.barcode ?? scan.barcodeNumber ?? scan.barcode_number ?? scan.barcodeValue ?? scan.gtin ?? scan.code
              ?? (/^\d{8,14}$/.test(id) ? id : undefined)
            return { ...scan, id, barcode: barcode == null ? undefined : String(barcode).trim() }
          })
          .sort((a, b) => scanTimestamp(b.timestamp ?? b.createdAt) - scanTimestamp(a.timestamp ?? a.createdAt))
          .slice(0, 300)
        setRawScans(latest)
        setScansLoaded(true)
      },
      e => setError(e.message)
    )
    return () => u1()
  }, [])

  useEffect(() => {
    if (tab !== 'registry') return
    return onValue(ref(db, 'products'),
      snapshot => {
        const records = snapshot.val() ?? {}
        setProducts(Object.entries(records as Record<string, Product>)
          .map(([id, product]) => ({ id, ...product })))
      },
      e => setError(e.message))
  }, [tab])

  useEffect(() => {
    if (!scansLoaded) return
    const pending = rawScans.filter(scan => {
      const barcode = scanBarcode(scan)
      return barcode && !productLookupsStarted.current.has(productLookupKey(scan.id, barcode))
    })
    if (pending.length === 0) return
    pending.forEach(scan => {
      const barcode = scanBarcode(scan)
      productLookupsStarted.current.add(productLookupKey(scan.id, barcode))
    })
    void Promise.all(pending.map(async scan => {
      const barcode = scanBarcode(scan)
      const key = productLookupKey(scan.id, barcode)
      try {
        return [key, await getProductRecordByBarcode(barcode)] as const
      } catch (lookupError) {
        setError(lookupError instanceof Error ? lookupError.message : 'Could not verify a scanned barcode against the product database.')
        return [key, null] as const
      }
    })).then(entries => setProductLookups(current => ({ ...current, ...Object.fromEntries(entries) })))
  }, [rawScans, scansLoaded])

  const scans = useMemo<Scan[]>(() => {
    if (!scansLoaded) return []
    return rawScans.flatMap(scan => {
    const barcode = scanBarcode(scan)
    const lookupKey = productLookupKey(scan.id, barcode)
    if (!barcode || !Object.prototype.hasOwnProperty.call(productLookups, lookupKey)) return []
    const matchedProduct = barcode
      ? products.find(product => product.id === barcode || productBarcode(product) === barcode)
      : undefined
    const productRecord = productLookups[lookupKey] ?? (matchedProduct
      ? Object.fromEntries(Object.entries(matchedProduct).filter(([key]) => key !== 'id'))
      : scan.productDetails)
    const product = productRecord ? normalizeProductRecord(productRecord) : undefined
    const codeMatch: CodeMatch = !product
      ? 'not_found'
      : product.status === 'flagged'
        ? 'already_used'
        : product.status === 'valid'
          ? 'valid_unused'
          : 'status_unknown'
    const sensorValue = scan.similarity ?? scan.sensorSimilarity ?? scan.sensor_similarity ?? scan.sensor
    const hasSimilarity = sensorValue != null && sensorValue !== '' && Number.isFinite(Number(sensorValue))
    const similarity = hasSimilarity ? Number(sensorValue) : undefined
    const category: Category = hasSimilarity
      ? classify(codeMatch, similarity!)
      : codeMatch === 'valid_unused'
        ? 'Low Suspicion'
        : codeMatch === 'already_used'
          ? 'High Suspicion'
          : 'Medium Suspicion'

    return [{
      ...scan,
      id: scan.id,
      barcode,
      productName: product?.name && product.name !== 'Unknown product' ? product.name : scan.productName ?? 'Unknown product',
      codeMatch,
      similarity,
      category,
      location: scan.location ?? 'Unknown',
      device: scan.device ?? 'Unknown',
      caseStatus: scan.caseStatus ?? (category === 'Genuine' ? 'closed' : 'open'),
      createdAt: scanTimestamp(scan.timestamp ?? scan.createdAt),
      medicineType: product?.category || scan.medicineType || String(scan.type ?? ''),
      manufacturer: product?.manufacturer ?? scan.manufacturer ?? '',
      batch: product?.batch ?? scan.batch ?? '',
      expiry: product?.expiry ?? scan.expiry ?? '',
      piecesPerPack: product?.piecesPerPack ?? scan.piecesPerPack,
      registryStatus: product?.status ?? 'not_found',
      productDetails: productRecord ?? scan.productDetails
    }]
    })
  }, [rawScans, products, productLookups, scansLoaded])

  const tabs = [['dash', 'Dashboard'], ['scan', 'Scan medicine'], ['registry', 'Registry']] as const

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-ink text-white md:w-60 md:min-h-screen p-5 flex md:block items-center gap-6">
        <div className="md:mb-8">
          <div className="text-lg font-bold tracking-tight">MedVerify</div>
          <div className="text-xs text-white/60">Rwanda FDA · point-of-sale check</div>
        </div>
        <nav className="flex md:flex-col gap-1">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-left rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${tab === k ? 'bg-white text-ink font-semibold' : 'text-white/80 hover:bg-white/10'}`}>
              {l}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-5 md:p-8 max-w-6xl">
        {error && <div className="mb-4 rounded border border-alert bg-alert/10 p-3 text-sm text-alert">
          Firebase error: {error}. Check your .env keys and Realtime Database rules.</div>}
        {tab === 'dash' && <Dashboard scans={scans} loading={!scansLoaded || scans.length < rawScans.filter(scan => scanBarcode(scan)).length} />}
        {tab === 'scan' && <ScanPage onDone={() => setTab('dash')} />}
        {tab === 'registry' && <Registry products={products} />}
      </main>
    </div>
  )
}

function Dashboard({ scans, loading }: { scans: Scan[]; loading: boolean }) {
  const [filter, setFilter] = useState<'all' | 'flagged'>('all')
  const [loc, setLoc] = useState('All')
  const flagged = scans.filter(s => s.category !== 'Genuine')
  const counts = useMemo(() => CATS.map(c => scans.filter(s => s.category === c).length), [scans])
  const max = Math.max(1, ...counts)
  const rows = (filter === 'flagged' ? flagged : scans).filter(s => loc === 'All' || s.location === loc)

  const setCase = (id: string, caseStatus: CaseStatus) => update(ref(db, `scans/${id}`), { caseStatus })

  return (
    <div>
      <h1 className="text-2xl font-bold">Verification results</h1>
      <p className="text-sm text-ink/60 mb-6">Live from every scanner. Suspicious results need an officer's confirmation before any action.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Scanned', scans.length, ''],
          ['Genuine', scans.length - flagged.length, 'text-genuine'],
          ['Suspicious', flagged.filter(s => s.category !== 'Critical').length, 'text-amber'],
          ['Critical', scans.filter(s => s.category === 'Critical').length, 'text-alert']
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg bg-white border border-ink/10 p-4">
            <div className={`text-3xl font-bold ${c}`}>{v}</div>
            <div className="text-sm text-ink/60">{l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 mb-6">
        <section className="rounded-lg bg-white border border-ink/10 p-4">
          <h2 className="font-semibold mb-3">Results by category</h2>
          {CATS.map((c, i) => (
            <div key={c} className="flex items-center gap-3 mb-2 text-sm">
              <span className="w-32 shrink-0">{c}</span>
              <div className="flex-1 h-3 bg-ink/5 rounded">
                <div className={`h-3 rounded ${c === 'Genuine' ? 'bg-genuine' : c === 'Critical' || c === 'High Suspicion' ? 'bg-alert' : 'bg-amber'}`}
                  style={{ width: `${(counts[i] / max) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-mono">{counts[i]}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-lg bg-white border border-ink/10">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-ink/10">
          <h2 className="font-semibold mr-auto">Scan records</h2>
          <select aria-label="Show" value={filter} onChange={e => setFilter(e.target.value as 'all' | 'flagged')}
            className="rounded border border-ink/20 px-2 py-1 text-sm">
            <option value="flagged">Flagged only</option><option value="all">All scans</option>
          </select>
          <select aria-label="Location" value={loc} onChange={e => setLoc(e.target.value)}
            className="rounded border border-ink/20 px-2 py-1 text-sm">
            {['All', ...LOCATIONS].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>{['Time', 'Barcode', 'Product', 'Medicine type', 'Pieces / pack', 'Validity', 'Code check', 'Sensor', 'Result', 'Location', 'Case'].map(h =>
                <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-ink/50">
                {loading ? 'Checking scan barcodes against the product database…' : 'No records yet. Use “Scan medicine” to add one.'}</td></tr>}
              {rows.map(s => (
                <tr key={s.id} className="border-t border-ink/5 align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 font-mono">{s.barcode}</td>
                  <td className="px-4 py-2">
                    <div>{s.productName}</div>
                    {(s.manufacturer || s.batch || s.expiry) && <div className="mt-1 text-xs text-ink/50">
                      {[s.manufacturer, s.batch && `Batch ${s.batch}`, s.expiry && `Expires ${s.expiry}`].filter(Boolean).join(' · ')}
                    </div>}
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-teal">Full barcode details</summary>
                      <h3 className="mt-2 mb-1 font-semibold">Scan record</h3>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {[
                          ['Barcode', s.barcode], ['Scan ID', s.id],
                          ['Scanned at', s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'],
                          ['Location', s.location], ['Scanner device', s.device],
                          ['Sensor similarity', s.similarity == null ? '—' : `${s.similarity}%`],
                          ['Registry match', codeLabel[s.codeMatch]], ['Verification result', s.category],
                          ['Case status', s.caseStatus]
                        ].map(([field, value]) => (
                          <Fragment key={field}>
                            <dt className="text-ink/60">{field}</dt>
                            <dd className="break-words">{value || '—'}</dd>
                          </Fragment>
                        ))}
                      </dl>
                      {s.productDetails ? <>
                        <h3 className="mt-3 mb-1 font-semibold">Complete registry record</h3>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {productDetailFields(s.productDetails).map(([field, value]) => (
                            <Fragment key={field}>
                              <dt className="text-ink/60">{field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</dt>
                              <dd className="break-words">{value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      </> : <p className="mt-2 text-ink/60">No registry product record was found for this barcode.</p>}
                    </details>
                  </td>
                  <td className="px-4 py-2">{s.medicineType || '—'}</td>
                  <td className="px-4 py-2">{s.piecesPerPack ? `${s.piecesPerPack} pieces` : '—'}</td>
                  <td className="px-4 py-2">{s.registryStatus === 'valid' ? 'Valid' : s.registryStatus === 'flagged' ? 'Flagged' : s.registryStatus === 'not_found' ? 'Not registered' : s.registryStatus === 'unknown' ? 'Status missing' : '—'}</td>
                  <td className="px-4 py-2">{codeLabel[s.codeMatch]}</td>
                  <td className="px-4 py-2 font-mono">{s.similarity == null ? '—' : `${s.similarity}%`}</td>
                  <td className="px-4 py-2"><Badge c={s.category} /><div className="text-xs text-ink/50 mt-1">{actionFor[s.category]}</div></td>
                  <td className="px-4 py-2">{s.location}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {s.caseStatus === 'open' ? (
                      <div className="flex gap-1">
                        <button onClick={() => setCase(s.id, 'confirmed')} className="rounded bg-alert text-white px-2 py-1 text-xs">Confirm</button>
                        <button onClick={() => setCase(s.id, 'not_confirmed')} className="rounded border border-ink/30 px-2 py-1 text-xs">Not confirmed</button>
                      </div>
                    ) : <span className="text-ink/60">{s.caseStatus === 'closed' ? 'No case' : s.caseStatus === 'confirmed' ? 'Confirmed counterfeit' : 'Cleared'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ScanPage({ onDone }: { onDone: () => void }) {
  const [barcode, setBarcode] = useState('')
  const [similarity, setSimilarity] = useState(95)
  const [location, setLocation] = useState('Kigali')
  const [result, setResult] = useState<{
    barcode: string
    product: Product | null
    codeMatch: CodeMatch
    cat: Category
    similarity: number
  } | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraMessage, setCameraMessage] = useState('')
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraControlsRef = useRef<{ stop: () => void } | null>(null)
  const cameraTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannerKeyTimesRef = useRef<number[]>([])
  const scannerSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => barcodeInputRef.current?.focus(), [result])
  useEffect(() => () => {
    cameraControlsRef.current?.stop()
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera access requires a supported browser and a secure page (HTTPS or localhost).')
      return
    }
    setCameraMessage('Requesting camera access…')
    setCameraActive(true)
    let barcodeDetected = false
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const videoElement = cameraVideoRef.current
      if (!videoElement) throw new Error('Could not initialize the camera preview. Try again.')
      const streamRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library')
      ])
      const hints = new Map<any, any>([
        [DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX
        ]],
        [DecodeHintType.TRY_HARDER, true]
      ])
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 })
      const stream = await streamRequest
      cameraStreamRef.current = stream
      videoElement.srcObject = stream
      await videoElement.play()
      setCameraMessage('Camera ready. Center the barcode in the preview and hold still.')
      cameraTipTimerRef.current = setTimeout(() => {
        setCameraMessage('Still searching. Move the barcode closer, keep it inside the guide, improve lighting, and hold steady.')
      }, 6000)
      const controls = await reader.decodeFromStream(stream, videoElement, result => {
        if (!result) return
        const value = result.getText().trim()
        if (!value) return
        barcodeDetected = true
        if (cameraTipTimerRef.current) clearTimeout(cameraTipTimerRef.current)
        setBarcode(value)
        setCameraActive(false)
        setCameraMessage(`Barcode ${value} detected. Checking it against the registry…`)
        cameraControlsRef.current?.stop()
        void verifyBarcode(value)
      })
      if (barcodeDetected) controls.stop()
      else cameraControlsRef.current = controls
    } catch (cameraError) {
      cameraControlsRef.current?.stop()
      cameraStreamRef.current?.getTracks().forEach(track => track.stop())
      if (cameraTipTimerRef.current) clearTimeout(cameraTipTimerRef.current)
      cameraTipTimerRef.current = null
      cameraStreamRef.current = null
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
      setCameraActive(false)
      const errorName = cameraError instanceof Error ? cameraError.name : ''
      setCameraMessage(errorName === 'NotAllowedError' || errorName === 'SecurityError'
        ? 'Camera permission was denied. Allow camera access for this site in your browser and Windows camera privacy settings, then try again.'
        : errorName === 'NotFoundError' || errorName === 'OverconstrainedError'
          ? 'No camera is available to the browser. Connect or enable a webcam, then try again.'
          : errorName === 'NotReadableError'
            ? 'The camera is busy or blocked by another app. Close other camera apps and try again.'
            : cameraError instanceof Error ? cameraError.message : 'Could not start the camera.')
    }
  }

  function stopCamera() {
    cameraControlsRef.current?.stop()
    cameraControlsRef.current = null
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    cameraStreamRef.current = null
    if (cameraTipTimerRef.current) clearTimeout(cameraTipTimerRef.current)
    cameraTipTimerRef.current = null
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraActive(false)
    setCameraMessage('Camera stopped.')
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (scannerSubmitTimerRef.current) clearTimeout(scannerSubmitTimerRef.current)
      scannerKeyTimesRef.current = []
      return
    }
    if (e.key.length !== 1) return

    const now = performance.now()
    const times = scannerKeyTimesRef.current
    if (times.length && now - times[times.length - 1] > 80) times.length = 0
    times.push(now)
    if (now - times[0] > 600) {
      times.length = 0
      times.push(now)
      return
    }
    if (times.length < 8) return

    if (scannerSubmitTimerRef.current) clearTimeout(scannerSubmitTimerRef.current)
    scannerSubmitTimerRef.current = setTimeout(() => {
      const value = barcodeInputRef.current?.value.trim() ?? ''
      if (value.length >= 8) barcodeInputRef.current?.form?.requestSubmit()
      scannerKeyTimesRef.current = []
      scannerSubmitTimerRef.current = null
    }, 180)
  }

  async function verifyBarcode(value: string) {
    const code = value.trim()
    if (!code) return
    setBusy(true)
    setSubmitError('')
    try {
      const productRecord = await getProductRecordByBarcode(code)
      const p = productRecord ? normalizeProductRecord(productRecord) : null
      const codeMatch: CodeMatch = !p ? 'not_found' : p.status === 'flagged' ? 'already_used' : p.status === 'valid' ? 'valid_unused' : 'status_unknown'
      const category = classify(codeMatch, similarity)
      await push(ref(db, 'scans'), {
        barcode: code, productName: p?.name ?? 'Unknown product', codeMatch, similarity, category,
        medicineType: p?.category ?? '', manufacturer: p?.manufacturer ?? '', batch: p?.batch ?? '',
        expiry: p?.expiry ?? '', piecesPerPack: p?.piecesPerPack ?? 0, registryStatus: p?.status ?? 'not_found',
        ...(productRecord ? { productDetails: productRecord } : {}),
        location, device: 'web-scanner', createdAt: Date.now(),
        caseStatus: category === 'Genuine' ? 'closed' : 'open'
      })
      setResult({ barcode: code, product: p, codeMatch, cat: category, similarity })
      setBarcode('')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not verify this medicine. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await verifyBarcode(barcode)
  }

  const hasProductDetails = result?.product && Object.entries(result.product).some(([field, value]) =>
    !['barcode', 'barcodeNumber', 'gtin', 'code', 'status', 'registryStatus', 'isValid'].includes(field) &&
    value != null && value !== '' && !(field === 'name' && value === 'Unknown product')
  )

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Scan medicine</h1>
      <p className="text-sm text-ink/60 mb-6">Use a USB or Bluetooth scanner in the barcode box, or type the code. Rapid scanner input is looked up automatically; you can also press Enter or Verify medicine.</p>
      <section className="mb-4 rounded-lg border border-ink/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={cameraActive ? stopCamera : startCamera}
            className="rounded bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-ink/90">
            {cameraActive ? 'Stop camera' : 'Open camera'}
          </button>
          <span className="text-sm text-ink/60">Point the camera at a barcode. It will be checked and saved automatically when detected.</span>
        </div>
        {cameraActive && <div className="relative mt-3 overflow-hidden rounded border border-ink/15 bg-black">
          <video ref={cameraVideoRef} autoPlay muted playsInline
            className="aspect-video min-h-64 w-full object-contain" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
        </div>}
        {cameraMessage && <p role="status" className="mt-3 text-sm text-ink/70">{cameraMessage}</p>}
      </section>
      <form onSubmit={submit} className="rounded-lg bg-white border border-ink/10 p-5 space-y-4">
        <label className="block text-sm font-medium">Barcode
          <input ref={barcodeInputRef} required value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={handleBarcodeKeyDown} placeholder="Scan or type barcode"
            className="mt-1 w-full rounded border border-ink/30 px-3 py-2 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-teal" />
        </label>
        <label className="block text-sm font-medium">Sensor similarity: <span className="font-mono">{similarity}%</span>
          <input type="range" min={0} max={100} value={similarity} onChange={e => setSimilarity(+e.target.value)} className="w-full accent-teal" />
          <span className="text-xs text-ink/50 font-normal">Sent by the chemical/optical sensor. Set it by hand until the ESP32 is connected.</span>
        </label>
        <label className="block text-sm font-medium">Location
          <select value={location} onChange={e => setLocation(e.target.value)} className="mt-1 w-full rounded border border-ink/30 px-3 py-2">
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </label>
        <button disabled={busy} className="rounded bg-teal text-white px-4 py-2 font-medium disabled:opacity-50">
          {busy ? 'Checking…' : 'Verify medicine'}
        </button>
      </form>
      {submitError && <p role="alert" className="mt-3 rounded border border-alert bg-alert/10 p-3 text-sm text-alert">
        Verification failed: {submitError}
        {submitError.toLowerCase().includes('permission') && ' Check that Realtime Database rules allow read access to /products and write access to /scans.'}
      </p>}
      {result && (
        <div className="mt-4 rounded-lg bg-white border border-ink/10 p-5">
          <h2 className="font-semibold">{result.product?.name ?? 'Unregistered product'}</h2>
          <div className="my-2"><Badge c={result.cat} /></div>
          <p className="text-sm">{actionFor[result.cat]}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink/60">Barcode</dt><dd className="font-mono">{result.barcode}</dd>
            <dt className="text-ink/60">Registry match</dt><dd>{codeLabel[result.codeMatch]}</dd>
            <dt className="text-ink/60">Sensor similarity</dt><dd>{result.similarity}%</dd>
            {result.product && Object.entries(result.product).map(([field, value]) => (
              <Fragment key={field}>
                <dt className="text-ink/60">{field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</dt>
                <dd className="break-words">{value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
              </Fragment>
            ))}
          </dl>
          {!result.product && <p className="mt-3 text-sm text-ink/60">No product details are registered for this barcode. The scan was recorded for review.</p>}
          {result.product && !hasProductDetails && <p className="mt-3 text-sm text-ink/60">A database record matched this barcode, but it has no product details. Add the medicine name, type, manufacturer, expiry, and pieces per pack in Registry.</p>}
          <button onClick={onDone} className="mt-3 text-sm text-teal underline">View on dashboard</button>
        </div>
      )}
    </div>
  )
}

function Registry({ products }: { products: (Product & { id: string })[] }) {
  const [f, setF] = useState({ id: '', name: '', category: 'Antimalarial', manufacturer: '', expiry: '', piecesPerPack: '' })
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.id || !f.name) return
    const { id, piecesPerPack, ...rest } = f
    await set(ref(db, `products/${id.trim()}`), {
      ...rest,
      ...(piecesPerPack ? { piecesPerPack: Number(piecesPerPack) } : {}),
      status: 'valid'
    })
    setF({ ...f, id: '', name: '', piecesPerPack: '' })
  }
  const toggle = (p: Product & { id: string }) =>
    update(ref(db, `products/${p.id}`), { status: p.status === 'valid' ? 'flagged' : 'valid' })
  const seed = async () => {
    const demo: [string, string, string, string][] = [
      ['6001234500011', 'Coartem 20/120mg', 'Antimalarial', 'Novartis'],
      ['6001234500028', 'Amoxicillin 500mg', 'Antibiotic', 'Cipla'],
      ['6001234500035', 'Artesunate 60mg', 'Antimalarial', 'Fosun Pharma'],
      ['6001234500042', 'Albendazole 400mg', 'Anthelmintic', 'GSK']
    ]
    for (const [id, name, category, manufacturer] of demo)
      await set(ref(db, `products/${id}`), { name, category, manufacturer, expiry: '2028-06-30', status: 'valid' })
    const samples: [string, CodeMatch, number, string][] = [
      ['6001234500011', 'valid_unused', 97, 'Kigali'], ['6001234500028', 'valid_unused', 72, 'Rubavu'],
      ['9999999999991', 'not_found', 91, 'Rusizi'], ['9999999999992', 'not_found', 31, 'Rubavu']
    ]
    for (const [barcode, codeMatch, similarity, location] of samples) {
      const category = classify(codeMatch, similarity)
      await push(ref(db, 'scans'), {
        barcode, codeMatch, similarity, category, location, device: 'seed', createdAt: Date.now(),
        productName: products.find(p => p.id === barcode)?.name ?? (codeMatch === 'not_found' ? 'Unknown product' : 'Seeded product'),
        caseStatus: category === 'Genuine' ? 'closed' : 'open'
      })
    }
  }
  const inp = 'rounded border border-ink/30 px-2 py-1.5 text-sm'
  return (
    <div>
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-bold mr-auto">Verified-products registry</h1>
        <button onClick={seed} className="rounded border border-ink/30 px-3 py-1.5 text-sm">Load demo data</button>
      </div>
      <form onSubmit={add} className="rounded-lg bg-white border border-ink/10 p-4 mb-4 grid sm:grid-cols-3 gap-2">
        <input className={inp} placeholder="Barcode" value={f.id} onChange={e => setF({ ...f, id: e.target.value })} />
        <input className={inp} placeholder="Product name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <select className={inp} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
          {['Antimalarial', 'Antibiotic', 'Anthelmintic', 'Other'].map(c => <option key={c}>{c}</option>)}
        </select>
        <input className={inp} placeholder="Manufacturer" value={f.manufacturer} onChange={e => setF({ ...f, manufacturer: e.target.value })} />
        <input className={inp} type="date" value={f.expiry} onChange={e => setF({ ...f, expiry: e.target.value })} />
        <input className={inp} type="number" min="1" step="1" placeholder="Pieces per pack (e.g. 10)" value={f.piecesPerPack} onChange={e => setF({ ...f, piecesPerPack: e.target.value })} />
        <button className="rounded bg-teal text-white px-3 py-1.5 text-sm sm:col-span-3">Add to registry</button>
      </form>
      <div className="rounded-lg bg-white border border-ink/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60"><tr>{['Barcode', 'Product', 'Type', 'Manufacturer', 'Expiry', 'Pieces / pack', 'Status'].map(h =>
            <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/50">Registry is empty. Add a product or load demo data.</td></tr>}
            {products.map(p => (
              <tr key={p.id} className="border-t border-ink/5">
                <td className="px-4 py-2 font-mono">{p.id}</td><td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.category}</td><td className="px-4 py-2">{p.manufacturer}</td>
                <td className="px-4 py-2">{p.expiry}</td>
                <td className="px-4 py-2">{p.piecesPerPack ? `${p.piecesPerPack} pieces` : '—'}</td>
                <td className="px-4 py-2">
                  <button onClick={() => toggle(p)} className={p.status === 'valid' ? 'text-genuine' : p.status === 'flagged' ? 'text-alert font-medium' : 'text-ink/60'}>
                    {p.status === 'valid' ? 'Valid' : p.status === 'flagged' ? 'Flagged' : 'Set valid'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
