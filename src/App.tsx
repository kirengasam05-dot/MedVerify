import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection, doc, getDoc, onSnapshot, orderBy, limit, query, setDoc, addDoc, updateDoc
} from 'firebase/firestore'
import { db } from './firebase'
import { classify, actionFor, tone } from './classify'
import type { Scan, Product, Category, CaseStatus, CodeMatch } from './types'

const LOCATIONS = ['Kigali', 'Rubavu', 'Rusizi']
const CATS: Category[] = ['Genuine', 'Low Suspicion', 'Medium Suspicion', 'High Suspicion', 'Critical']
const codeLabel: Record<CodeMatch, string> = {
  valid_unused: 'Valid, unused', not_found: 'Not in registry', already_used: 'Flagged / already used'
}

const Badge = ({ c }: { c: Category }) => (
  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${tone[c]}`}>{c}</span>
)

export default function App() {
  const [tab, setTab] = useState<'dash' | 'scan' | 'registry'>('dash')
  const [scans, setScans] = useState<Scan[]>([])
  const [products, setProducts] = useState<(Product & { id: string })[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'scans'), orderBy('createdAt', 'desc'), limit(300)),
      s => setScans(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Scan, 'id'>) }))),
      e => setError(e.message)
    )
    const u2 = onSnapshot(collection(db, 'products'),
      s => setProducts(s.docs.map(d => ({ id: d.id, ...(d.data() as Product) }))),
      e => setError(e.message))
    return () => { u1(); u2() }
  }, [])

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
          Firebase error: {error}. Check your .env keys and Firestore rules.</div>}
        {tab === 'dash' && <Dashboard scans={scans} />}
        {tab === 'scan' && <ScanPage onDone={() => setTab('dash')} />}
        {tab === 'registry' && <Registry products={products} />}
      </main>
    </div>
  )
}

function Dashboard({ scans }: { scans: Scan[] }) {
  const [filter, setFilter] = useState<'all' | 'flagged'>('flagged')
  const [loc, setLoc] = useState('All')
  const flagged = scans.filter(s => s.category !== 'Genuine')
  const counts = useMemo(() => CATS.map(c => scans.filter(s => s.category === c).length), [scans])
  const max = Math.max(1, ...counts)
  const rows = (filter === 'flagged' ? flagged : scans).filter(s => loc === 'All' || s.location === loc)

  const setCase = (id: string, caseStatus: CaseStatus) => updateDoc(doc(db, 'scans', id), { caseStatus })

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
              <tr>{['Time', 'Barcode', 'Product', 'Code check', 'Sensor', 'Result', 'Location', 'Case'].map(h =>
                <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                No records yet. Use “Scan medicine” to add one.</td></tr>}
              {rows.map(s => (
                <tr key={s.id} className="border-t border-ink/5 align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono">{s.barcode}</td>
                  <td className="px-4 py-2">{s.productName}</td>
                  <td className="px-4 py-2">{codeLabel[s.codeMatch]}</td>
                  <td className="px-4 py-2 font-mono">{s.similarity}%</td>
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
  const [result, setResult] = useState<{ name: string; cat: Category } | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [result])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const code = barcode.trim()
    if (!code) return
    setBusy(true)
    const snap = await getDoc(doc(db, 'products', code))
    const p = snap.exists() ? (snap.data() as Product) : null
    const codeMatch: CodeMatch = !p ? 'not_found' : p.status === 'flagged' ? 'already_used' : 'valid_unused'
    const category = classify(codeMatch, similarity)
    await addDoc(collection(db, 'scans'), {
      barcode: code, productName: p?.name ?? 'Unknown product', codeMatch, similarity, category,
      location, device: 'web-scanner', createdAt: Date.now(),
      caseStatus: category === 'Genuine' ? 'closed' : 'open'
    })
    setResult({ name: p?.name ?? 'Unknown product', cat: category })
    setBarcode(''); setBusy(false)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Scan medicine</h1>
      <p className="text-sm text-ink/60 mb-6">Click the barcode box and scan the pack. USB and Bluetooth scanners type the code and press Enter for you.</p>
      <form onSubmit={submit} className="rounded-lg bg-white border border-ink/10 p-5 space-y-4">
        <label className="block text-sm font-medium">Barcode
          <input ref={ref} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or type barcode"
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
        <button disabled={busy} className="rounded bg-teal text-white px-4 py-2 font-medium disabled:opacity-50">Verify medicine</button>
      </form>
      {result && (
        <div className="mt-4 rounded-lg bg-white border border-ink/10 p-5">
          <div className="text-sm text-ink/60">{result.name}</div>
          <div className="my-2"><Badge c={result.cat} /></div>
          <div className="text-sm">{actionFor[result.cat]}</div>
          <button onClick={onDone} className="mt-3 text-sm text-teal underline">View on dashboard</button>
        </div>
      )}
    </div>
  )
}

function Registry({ products }: { products: (Product & { id: string })[] }) {
  const [f, setF] = useState({ id: '', name: '', category: 'Antimalarial', manufacturer: '', batch: '', expiry: '' })
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.id || !f.name) return
    const { id, ...rest } = f
    await setDoc(doc(db, 'products', id.trim()), { ...rest, status: 'valid' })
    setF({ ...f, id: '', name: '', batch: '' })
  }
  const toggle = (p: Product & { id: string }) =>
    updateDoc(doc(db, 'products', p.id), { status: p.status === 'valid' ? 'flagged' : 'valid' })
  const seed = async () => {
    const demo: [string, string, string, string][] = [
      ['6001234500011', 'Coartem 20/120mg', 'Antimalarial', 'Novartis'],
      ['6001234500028', 'Amoxicillin 500mg', 'Antibiotic', 'Cipla'],
      ['6001234500035', 'Artesunate 60mg', 'Antimalarial', 'Fosun Pharma'],
      ['6001234500042', 'Albendazole 400mg', 'Anthelmintic', 'GSK']
    ]
    for (const [id, name, category, manufacturer] of demo)
      await setDoc(doc(db, 'products', id), { name, category, manufacturer, batch: 'B-2026-01', expiry: '2028-06-30', status: 'valid' })
    const samples: [string, CodeMatch, number, string][] = [
      ['6001234500011', 'valid_unused', 97, 'Kigali'], ['6001234500028', 'valid_unused', 72, 'Rubavu'],
      ['9999999999991', 'not_found', 91, 'Rusizi'], ['9999999999992', 'not_found', 31, 'Rubavu']
    ]
    for (const [barcode, codeMatch, similarity, location] of samples) {
      const category = classify(codeMatch, similarity)
      await addDoc(collection(db, 'scans'), {
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
        <input className={inp} placeholder="Batch" value={f.batch} onChange={e => setF({ ...f, batch: e.target.value })} />
        <input className={inp} type="date" value={f.expiry} onChange={e => setF({ ...f, expiry: e.target.value })} />
        <button className="rounded bg-teal text-white px-3 py-1.5 text-sm sm:col-span-3">Add to registry</button>
      </form>
      <div className="rounded-lg bg-white border border-ink/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60"><tr>{['Barcode', 'Product', 'Type', 'Manufacturer', 'Batch', 'Expiry', 'Status'].map(h =>
            <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/50">Registry is empty. Add a product or load demo data.</td></tr>}
            {products.map(p => (
              <tr key={p.id} className="border-t border-ink/5">
                <td className="px-4 py-2 font-mono">{p.id}</td><td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.category}</td><td className="px-4 py-2">{p.manufacturer}</td>
                <td className="px-4 py-2">{p.batch}</td><td className="px-4 py-2">{p.expiry}</td>
                <td className="px-4 py-2">
                  <button onClick={() => toggle(p)} className={p.status === 'valid' ? 'text-genuine' : 'text-alert font-medium'}>
                    {p.status === 'valid' ? 'Valid' : 'Flagged'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
