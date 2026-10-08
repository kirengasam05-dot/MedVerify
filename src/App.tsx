import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchScans,
  fetchProducts,
  submitScan,
  submitImageScan,
  updateScanCase,
  addProduct,
  toggleProductStatus,
  seedDemoData,
  checkHealth
} from './api'
import { classify, actionFor, tone } from './classify'
import type { Scan, Product, Category, CaseStatus, CodeMatch } from './types'
import BarcodeScanner from './components/BarcodeScanner'
import BarcodeModal from './components/BarcodeModal'

const LOCATIONS = ['Kigali', 'Rubavu', 'Rusizi']
const CATS: Category[] = ['Genuine', 'Low Suspicion', 'Medium Suspicion', 'High Suspicion', 'Critical']
const codeLabel: Partial<Record<CodeMatch, string>> = {
  valid_unused: 'Valid, unused',
  not_found: 'Not in registry',
  already_used: 'Flagged / already used'
}

const Badge = ({ c }: { c: Category }) => (
  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${tone[c]}`}>{c}</span>
)

function barcodeDetails(scan: Scan) {
  const scanRecord = scan as Scan & { productDetails?: Record<string, unknown> }
  const productDetails = scanRecord.productDetails
  const values = productDetails && typeof productDetails === 'object'
    ? { ...scanRecord, ...productDetails }
    : scanRecord
  return Object.entries(values).filter(([field]) => field !== 'productDetails')
}

function displayField(field: string) {
  return field.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, value => value.toUpperCase())
}

function displayValue(value: unknown) {
  if (value == null || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export default function App() {
  const [tab, setTab] = useState<'dash' | 'scan' | 'registry'>('dash')
  const [scans, setScans] = useState<Scan[]>([])
  const [products, setProducts] = useState<(Product & { id: string })[]>([])
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [error, setError] = useState('')

  // Load data from Backend Gateway API
  const refreshData = async () => {
    try {
      const isUp = await checkHealth()
      setApiOnline(isUp)
      if (isUp) {
        const [scansData, prodsData] = await Promise.all([fetchScans(), fetchProducts()])
        setScans(scansData)
        setProducts(prodsData)
        setError('')
      } else {
        setError('Backend API is offline. Start it in MedVer_backend: python api.py')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend API')
    }
  }

  useEffect(() => {
    refreshData()
    // Auto-refresh every 3 seconds to catch live scans from hardware or other terminals
    const timer = setInterval(refreshData, 3000)
    return () => clearInterval(timer)
  }, [])

  const tabs = [
    ['dash', 'Dashboard'],
    ['scan', 'Scan medicine'],
    ['registry', 'Registry']
  ] as const

  return (
    <div className="min-h-screen md:flex bg-slate-50 text-ink">
      <aside className="bg-ink text-white md:w-64 md:min-h-screen p-5 flex md:block items-center gap-6 shrink-0">
        <div className="md:mb-8">
          <div className="text-xl font-bold tracking-tight">MedVerify</div>
          <div className="text-xs text-white/60">Rwanda FDA · Point-of-Sale Check</div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                apiOnline ? 'bg-emerald-400' : apiOnline === false ? 'bg-rose-500' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs text-white/70">
              {apiOnline ? 'Backend Gateway: Online' : 'Backend Gateway: Offline'}
            </span>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 w-full">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`text-left rounded px-3 py-2 text-sm font-medium transition focus:outline-none ${
                tab === k ? 'bg-white text-ink font-semibold shadow-sm' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {l}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-5 md:p-8 max-w-6xl">
        {error && (
          <div className="mb-4 rounded-lg border border-alert/30 bg-alert/10 p-3 text-sm text-alert flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={refreshData}
              className="text-xs font-semibold underline hover:opacity-80 ml-3"
            >
              Retry
            </button>
          </div>
        )}

        {tab === 'dash' && <Dashboard scans={scans} onStatusChange={refreshData} />}
        {tab === 'scan' && (
          <ScanPage
            onDone={() => {
              refreshData()
              setTab('dash')
            }}
          />
        )}
        {tab === 'registry' && <Registry products={products} onChange={refreshData} />}
      </main>
    </div>
  )
}

function Dashboard({
  scans,
  onStatusChange
}: {
  scans: Scan[]
  onStatusChange: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'flagged' | 'genuine' | 'open'>('flagged')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [loc, setLoc] = useState<string>('All')
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)

  const PAGE_SIZE = 6

  const flagged = scans.filter((s) => s.category !== 'Genuine')
  const counts = useMemo(() => CATS.map((c) => scans.filter((s) => s.category === c).length), [scans])
  const max = Math.max(1, ...counts)

  // Filtered rows
  const filteredRows = useMemo(() => {
    return scans.filter((s) => {
      if (filter === 'flagged' && s.category === 'Genuine') return false
      if (filter === 'genuine' && s.category !== 'Genuine') return false
      if (filter === 'open' && s.caseStatus !== 'open') return false

      if (catFilter !== 'All' && s.category !== catFilter) return false
      if (loc !== 'All' && s.location !== loc) return false

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchBarcode = s.barcode.toLowerCase().includes(q)
        const matchProduct = s.productName.toLowerCase().includes(q)
        if (!matchBarcode && !matchProduct) return false
      }

      return true
    })
  }, [scans, filter, catFilter, loc, search])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredRows.length)
  const paginatedRows = filteredRows.slice(startIndex, endIndex)

  // Reset to page 1 whenever filters change
  const handleFilterChange = (setter: (v: any) => void, val: any) => {
    setter(val)
    setPage(1)
  }

  const setCase = async (id: string, caseStatus: CaseStatus) => {
    try {
      await updateScanCase(id, caseStatus)
      onStatusChange()
    } catch (e: any) {
      alert(e?.message || 'Could not update status')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Verification Results</h1>
      <p className="text-sm text-ink/60 mb-6">
        Live data synced from the Python Backend Gateway, Edge Scanners, and ESP32.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Total Scanned', scans.length, 'text-ink'],
          ['Genuine', scans.length - flagged.length, 'text-genuine'],
          ['Suspicious', flagged.filter((s) => s.category !== 'Critical').length, 'text-amber'],
          ['Critical', scans.filter((s) => s.category === 'Critical').length, 'text-alert']
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl bg-white border border-ink/10 p-4 shadow-sm">
            <div className={`text-3xl font-bold ${c}`}>{v}</div>
            <div className="text-xs text-ink/60 mt-1 uppercase tracking-wider">{l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 mb-6">
        <section className="rounded-xl bg-white border border-ink/10 p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Results by Category</h2>
          {CATS.map((c, i) => (
            <div key={c} className="flex items-center gap-3 mb-2 text-sm">
              <span className="w-36 shrink-0">{c}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${
                    c === 'Genuine'
                      ? 'bg-genuine'
                      : c === 'Critical' || c === 'High Suspicion'
                      ? 'bg-alert'
                      : 'bg-amber'
                  }`}
                  style={{ width: `${(counts[i] / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono font-medium">{counts[i]}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-xl bg-white border border-ink/10 shadow-sm overflow-hidden">
        {/* Multi-Filter Header */}
        <div className="p-4 border-b border-ink/10 bg-slate-50/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-ink text-base">
              Scan Records ({filteredRows.length})
            </h2>
            <div className="text-xs text-ink/60">
              Showing 6 items per page
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search barcode or product..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                className="w-full rounded-lg border border-ink/20 pl-8 pr-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal"
              />
              <span className="absolute left-2.5 top-2 text-ink/40 text-xs">🔍</span>
              {search && (
                <button
                  onClick={() => handleFilterChange(setSearch, '')}
                  className="absolute right-2.5 top-1.5 text-ink/40 hover:text-ink text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              aria-label="Status Filter"
              value={filter}
              onChange={(e) => handleFilterChange(setFilter, e.target.value)}
              className="rounded-lg border border-ink/20 px-2.5 py-1.5 text-xs bg-white font-medium text-ink/80 focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="flagged">Flagged only</option>
              <option value="all">All scans</option>
              <option value="genuine">Genuine only</option>
              <option value="open">Open cases only</option>
            </select>

            {/* Category Filter */}
            <select
              aria-label="Category Filter"
              value={catFilter}
              onChange={(e) => handleFilterChange(setCatFilter, e.target.value)}
              className="rounded-lg border border-ink/20 px-2.5 py-1.5 text-xs bg-white font-medium text-ink/80 focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="All">All Categories</option>
              {CATS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Location Filter */}
            <select
              aria-label="Location Filter"
              value={loc}
              onChange={(e) => handleFilterChange(setLoc, e.target.value)}
              className="rounded-lg border border-ink/20 px-2.5 py-1.5 text-xs bg-white font-medium text-ink/80 focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value="All">All Locations</option>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            {/* Reset Filters Shortcut */}
            {(filter !== 'all' || catFilter !== 'All' || loc !== 'All' || search) && (
              <button
                onClick={() => {
                  setFilter('all')
                  setCatFilter('All')
                  setLoc('All')
                  setSearch('')
                  setPage(1)
                }}
                className="rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1.5 text-xs font-semibold transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60 bg-slate-50 border-b border-ink/10">
              <tr>
                {['Time', 'Barcode', 'Product', 'Code Check', 'Sensor', 'Result', 'Location', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink/50">
                    No scan records match your filter criteria.
                  </td>
                </tr>
              )}
              {paginatedRows.map((s) => (
                <tr key={s.id} className="border-t border-ink/5 hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-ink/60">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium">{s.barcode}</td>
                  <td className="px-4 py-3 font-medium">
                    <div>{s.productName}</div>
                    <details className="mt-1 text-xs font-normal">
                      <summary className="cursor-pointer text-teal">Full barcode details</summary>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                        {barcodeDetails(s).map(([field, value]) => (
                          <div key={field} className="contents">
                            <dt className="text-ink/60">{displayField(field)}</dt>
                            <dd className="break-words">{displayValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </td>
                  <td className="px-4 py-3 text-xs">{codeLabel[s.codeMatch] || s.codeMatch}</td>
                  <td className="px-4 py-3 font-mono">{s.similarity}%</td>
                  <td className="px-4 py-3">
                    <Badge c={s.category} />
                    <div className="text-[11px] text-ink/50 mt-1">{actionFor[s.category]}</div>
                  </td>
                  <td className="px-4 py-3">{s.location}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.caseStatus === 'open' ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setCase(s.id, 'confirmed')}
                          className="rounded bg-alert text-white px-2 py-1 text-xs hover:opacity-90 transition shadow-xs"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setCase(s.id, 'not_confirmed')}
                          className="rounded border border-ink/30 px-2 py-1 text-xs hover:bg-ink/5 transition"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink/60 font-medium">
                        {s.caseStatus === 'closed'
                          ? 'No case'
                          : s.caseStatus === 'confirmed'
                          ? '⚠️ Confirmed Counterfeit'
                          : '✅ Cleared'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination & Counting Footer */}
        {filteredRows.length > 0 && (
          <div className="p-4 border-t border-ink/10 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            {/* Record Counter Info */}
            <div className="text-xs text-ink/60 font-medium">
              Showing <span className="font-semibold text-ink">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-ink">{endIndex}</span> of{' '}
              <span className="font-semibold text-ink">{filteredRows.length}</span> records
              <span className="ml-2 text-ink/40">·</span>
              <span className="ml-2">Page <strong className="text-ink">{currentPage}</strong> of <strong className="text-ink">{totalPages}</strong></span>
            </div>

            {/* Chevron Controls & Page Jumps */}
            <div className="flex items-center gap-1.5">
              {/* First Page */}
              <button
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border border-ink/20 bg-white flex items-center justify-center text-xs font-bold text-ink hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                title="First Page"
              >
                «
              </button>

              {/* Previous Chevron */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 rounded-lg border border-ink/20 bg-white flex items-center gap-1 text-xs font-medium text-ink hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                title="Previous Page"
              >
                <span className="text-sm">‹</span> Prev
              </button>

              {/* Visible Page Numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === totalPages ||
                    (p >= currentPage - 1 && p <= currentPage + 1)
                  )
                })
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1
                  return (
                    <div key={p} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-1 text-xs text-ink/40">…</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
                          currentPage === p
                            ? 'bg-teal text-white shadow-xs'
                            : 'border border-ink/20 bg-white text-ink hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  )
                })}

              {/* Next Chevron */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2.5 rounded-lg border border-ink/20 bg-white flex items-center gap-1 text-xs font-medium text-ink hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                title="Next Page"
              >
                Next <span className="text-sm">›</span>
              </button>

              {/* Last Page */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border border-ink/20 bg-white flex items-center justify-center text-xs font-bold text-ink hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function ScanPage({ onDone }: { onDone: () => void }) {
  const [barcode, setBarcode] = useState('')
  const [similarity, setSimilarity] = useState(95)
  const [location, setLocation] = useState('Kigali')
  const [showScanner, setShowScanner] = useState(false)
  const [result, setResult] = useState<{ name: string; cat: Category } | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [result, showScanner])

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const code = barcode.trim()
    if (!code) return
    setBusy(true)

    try {
      const rec = await submitScan({
        barcode: code,
        similarity,
        location,
        device: 'web-browser'
      })
      setResult({ name: rec.productName, cat: rec.category })
      setBarcode('')
    } catch (e: any) {
      alert(e?.message || 'Verification submission failed')
    } finally {
      setBusy(false)
    }
  }

  const onBarcodeScanned = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setBarcode(trimmed)
    setShowScanner(false)
    setBusy(true)

    try {
      const rec = await submitScan({
        barcode: trimmed,
        similarity,
        location,
        device: 'camera-scanner'
      })
      setResult({ name: rec.productName, cat: rec.category })
      setBarcode('')
    } catch (e: any) {
      alert(e?.message || 'Verification submission failed')
    } finally {
      setBusy(false)
    }
  }

  const onImageCaptured = async (imageDataBase64: string) => {
    setBusy(true)
    setShowScanner(false)
    try {
      const res = await submitImageScan(imageDataBase64, similarity, location)
      if (res.found && res.record) {
        setResult({ name: res.record.productName, cat: res.record.category })
      } else {
        alert(res.error || 'No barcode detected in the photo. Please align closer and try again.')
        setShowScanner(true)
      }
    } catch (err: any) {
      alert(err?.message || 'Could not process captured image')
      setShowScanner(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Scan Medicine</h1>
          <p className="text-sm text-ink/60">
            Use your device camera or type the barcode number manually.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowScanner((s) => !s)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            showScanner
              ? 'bg-ink text-white'
              : 'border border-ink/20 bg-white hover:bg-slate-50 text-ink'
          }`}
        >
          {showScanner ? 'Hide Camera' : '📷 Open Camera Scanner'}
        </button>
      </div>

      {showScanner && (
        <div className="mb-5">
          <BarcodeScanner
            onDetected={onBarcodeScanned}
            onImageCaptured={onImageCaptured}
            onClose={() => setShowScanner(false)}
          />
        </div>
      )}

      {busy && (
        <div className="mb-4 rounded-xl border border-teal/30 bg-teal/5 p-4 flex items-center gap-3 animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          <span className="text-sm font-medium text-teal">
            Verifying drug with Backend Gateway & syncing Arduino LCD...
          </span>
        </div>
      )}

      <form onSubmit={handleVerify} className="rounded-xl bg-white border border-ink/10 p-5 space-y-4 shadow-sm">
        <label className="block text-sm font-medium">
          Barcode / Medicine Identifier
          <input
            ref={ref}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 6001234500011"
            className="mt-1 w-full rounded-lg border border-ink/30 px-3 py-2 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </label>

        <label className="block text-sm font-medium">
          Spectrometry / Sensor Similarity: <span className="font-mono font-bold text-teal">{similarity}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={similarity}
            onChange={(e) => setSimilarity(+e.target.value)}
            className="w-full accent-teal mt-1"
          />
          <span className="text-xs text-ink/50 font-normal">
            Chemical sensor match rate. High (≥85%), Moderate (60–84%), Low (&lt;60%).
          </span>
        </label>

        <label className="block text-sm font-medium">
          Point of Sale Location
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/30 px-3 py-2 bg-white"
          >
            {LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>

        <button
          disabled={busy || !barcode.trim()}
          className="w-full rounded-lg bg-teal text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? 'Verifying with Backend...' : 'Verify Medicine'}
        </button>
      </form>

      {result && (
        <div
          className={`mt-5 rounded-xl border p-5 shadow-sm transition-all ${
            result.cat === 'Genuine'
              ? 'bg-emerald-50/60 border-emerald-300'
              : result.cat === 'Critical'
              ? 'bg-rose-50 border-rose-400'
              : 'bg-amber-50/70 border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/60">
              Authentication Verdict
            </span>
            <span className="text-xs font-mono text-ink/50">Synced to LCD 📟</span>
          </div>
          <div className="text-xl font-bold text-ink mt-1">{result.name}</div>
          <div className="my-2.5">
            <Badge c={result.cat} />
          </div>
          <div className="text-sm font-medium text-ink/80">
            <strong>Recommended Action:</strong> {actionFor[result.cat]}
          </div>
          <div className="mt-3 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-ink/60">
            <span>Stage: {result.cat === 'Genuine' ? 'Released for Sale' : 'Quarantined / Flagged for Review'}</span>
            <button onClick={onDone} className="text-sm font-medium text-teal underline hover:opacity-80">
              View on Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Registry({
  products,
  onChange
}: {
  products: (Product & { id: string })[]
  onChange: () => void
}) {
  const [f, setF] = useState({
    id: '',
    name: '',
    category: 'Antimalarial',
    manufacturer: '',
    batch: '',
    expiry: ''
  })
  const [busy, setBusy] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.id || !f.name) return
    setBusy(true)
    try {
      await addProduct({
        id: f.id.trim(),
        name: f.name.trim(),
        category: f.category,
        manufacturer: f.manufacturer || 'General',
        batch: f.batch || 'B-01',
        expiry: f.expiry || '2028-12-31'
      })
      setF({ id: '', name: '', category: 'Antimalarial', manufacturer: '', batch: '', expiry: '' })
      onChange()
    } catch (err: any) {
      alert(err?.message || 'Could not add product')
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (pid: string) => {
    try {
      await toggleProductStatus(pid)
      onChange()
    } catch (err: any) {
      alert(err?.message || 'Could not toggle status')
    }
  }

  const handleSeed = async () => {
    try {
      await seedDemoData()
      onChange()
    } catch (err: any) {
      alert(err?.message || 'Failed to seed demo data')
    }
  }

  const [selectedProduct, setSelectedProduct] = useState<(Product & { id: string }) | null>(null)

  const handleTestScan = async (code: string) => {
    try {
      const rec = await submitScan({
        barcode: code,
        similarity: 95,
        location: 'Kigali',
        device: 'registry-direct'
      })
      alert(`✅ Verified: ${rec.productName} -> ${rec.category} (Synced to LCD!)`)
      onChange()
    } catch (e: any) {
      alert(e?.message || 'Verification failed')
    }
  }

  const [regSearch, setRegSearch] = useState('')
  const [regPage, setRegPage] = useState(1)
  const REG_PAGE_SIZE = 6

  const filteredProducts = useMemo(() => {
    if (!regSearch.trim()) return products
    const q = regSearch.trim().toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    )
  }, [products, regSearch])

  const regTotalPages = Math.max(1, Math.ceil(filteredProducts.length / REG_PAGE_SIZE))
  const regCurrentPage = Math.min(Math.max(1, regPage), regTotalPages)
  const regStart = (regCurrentPage - 1) * REG_PAGE_SIZE
  const regEnd = Math.min(regStart + REG_PAGE_SIZE, filteredProducts.length)
  const paginatedProducts = filteredProducts.slice(regStart, regEnd)

  const inp = 'rounded-lg border border-ink/30 px-3 py-2 text-sm bg-white'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Verified-Products Registry</h1>
          <p className="text-sm text-ink/60">Rwanda FDA approved pharmaceuticals database</p>
        </div>
        <button
          onClick={handleSeed}
          className="rounded-lg border border-ink/20 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-medium text-ink shadow-sm"
        >
          Load Demo Products
        </button>
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-xl bg-white border border-ink/10 p-5 mb-6 grid sm:grid-cols-3 gap-3 shadow-sm"
      >
        <input
          className={inp}
          placeholder="Barcode (e.g. 6001234500011)"
          value={f.id}
          onChange={(e) => setF({ ...f, id: e.target.value })}
          required
        />
        <input
          className={inp}
          placeholder="Product Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
        />
        <select
          className={inp}
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          {['Antimalarial', 'Antibiotic', 'Anthelmintic', 'Analgesic', 'Other'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          className={inp}
          placeholder="Manufacturer (e.g. Novartis)"
          value={f.manufacturer}
          onChange={(e) => setF({ ...f, manufacturer: e.target.value })}
        />
        <input
          className={inp}
          placeholder="Batch Number"
          value={f.batch}
          onChange={(e) => setF({ ...f, batch: e.target.value })}
        />
        <input
          className={inp}
          type="date"
          value={f.expiry}
          onChange={(e) => setF({ ...f, expiry: e.target.value })}
        />
        <button
          disabled={busy}
          className="rounded-lg bg-teal text-white py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 sm:col-span-3"
        >
          {busy ? 'Adding...' : 'Add to Official Registry'}
        </button>
      </form>

      <div className="rounded-xl bg-white border border-ink/10 shadow-sm overflow-hidden">
        {/* Registry Filter Bar */}
        <div className="p-4 border-b border-ink/10 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold text-ink text-sm">
            Registered Medicines ({filteredProducts.length})
          </div>
          <div className="relative min-w-[200px] max-w-xs">
            <input
              type="text"
              placeholder="Search registry..."
              value={regSearch}
              onChange={(e) => {
                setRegSearch(e.target.value)
                setRegPage(1)
              }}
              className="w-full rounded-lg border border-ink/20 pl-8 pr-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <span className="absolute left-2.5 top-2 text-ink/40 text-xs">🔍</span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-ink/60 bg-slate-50 border-b border-ink/10">
            <tr>
              {['Barcode', 'Product', 'Category', 'Manufacturer', 'Batch', 'Expiry', 'Barcode / QR', 'Status Action'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                  No products found. Add a product above or click “Load Demo Products”.
                </td>
              </tr>
            )}
            {paginatedProducts.map((p) => (
              <tr key={p.id} className="border-t border-ink/5 hover:bg-slate-50/50 transition">
                <td className="px-4 py-3 font-mono font-medium">{p.id}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3">{p.manufacturer}</td>
                <td className="px-4 py-3">{p.batch}</td>
                <td className="px-4 py-3">{p.expiry}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedProduct(p)}
                    className="rounded-lg border border-teal/40 bg-teal/5 text-teal hover:bg-teal/15 px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 transition"
                    title="View and download scannable barcode label"
                  >
                    🏷️ Barcode & QR
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(p.id)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      p.status === 'valid'
                        ? 'bg-genuine/10 text-genuine border-genuine/40 hover:bg-genuine/20'
                        : 'bg-alert/10 text-alert border-alert/40 hover:bg-alert/20'
                    }`}
                  >
                    {p.status === 'valid' ? 'Valid (Click to Flag)' : 'Flagged (Click to Clear)'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Registry Pagination Footer */}
        {filteredProducts.length > 0 && (
          <div className="p-3.5 border-t border-ink/10 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-ink/60 font-medium">
              Showing <span className="font-semibold text-ink">{regStart + 1}</span> to{' '}
              <span className="font-semibold text-ink">{regEnd}</span> of{' '}
              <span className="font-semibold text-ink">{filteredProducts.length}</span> products
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRegPage((p) => Math.max(1, p - 1))}
                disabled={regCurrentPage === 1}
                className="h-7 px-2.5 rounded border border-ink/20 bg-white text-ink hover:bg-slate-100 disabled:opacity-40 transition font-medium"
              >
                ‹ Prev
              </button>
              <span className="px-2 font-medium text-ink">
                Page {regCurrentPage} of {regTotalPages}
              </span>
              <button
                onClick={() => setRegPage((p) => Math.min(regTotalPages, p + 1))}
                disabled={regCurrentPage === regTotalPages}
                className="h-7 px-2.5 rounded border border-ink/20 bg-white text-ink hover:bg-slate-100 disabled:opacity-40 transition font-medium"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barcode & QR Modal with Download & Screen Scanning */}
      {selectedProduct && (
        <BarcodeModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onTestScan={handleTestScan}
        />
      )}
    </div>
  )
}
