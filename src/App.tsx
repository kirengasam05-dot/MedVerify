import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import {
  fetchScans,
  fetchProducts,
  submitScan,
  submitImageScan,
  updateScanCase,
  addProduct,
  toggleProductStatus,
  seedDemoData,
  checkHealth,
  fetchCurrentUser,
  registerUser
} from './api'
import type { CurrentUser, UserRole } from './api'
import { auth } from './firebase'
import { classify, actionFor, tone } from './classify'
import type { Scan, Product, Category, CaseStatus, CodeMatch } from './types'
import SignInPage from './components/SignInPage'
import Sidebar, { type TabKey } from './components/Sidebar'
import Navbar from './components/Navbar'

// Lazy-load heavier modules to keep initial bundle ultra-fast
const BarcodeScanner = lazy(() => import('./components/BarcodeScanner'))
const BarcodeModal = lazy(() => import('./components/BarcodeModal'))
const ReportsPage = lazy(() => import('./components/ReportsPage'))
const CasesPage = lazy(() => import('./components/CasesPage'))
const InvestigationsPage = lazy(() => import('./components/InvestigationsPage'))
const IntegrationPage = lazy(() => import('./components/IntegrationPage'))
const UserManagementPage = lazy(() => import('./components/UserManagementPage'))
import {
  Search,
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Camera,
  Cpu,
  ArrowRight,
  QrCode,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'

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

// Rwanda FDA Target Population Roles & RBAC Configuration
const ROLE_CONFIG: Record<
  UserRole,
  { allowed: TabKey[]; defaultTab: TabKey; title: string; tasks: string }
> = {
  admin: {
    allowed: ['dash', 'scan', 'investigations', 'registry', 'integration', 'cases', 'users', 'reports'],
    defaultTab: 'dash',
    title: 'System Administrator',
    tasks: 'Master administrator with full privileges to manage all activity in the entire system'
  },
  field_officer: {
    allowed: ['dash', 'scan', 'investigations'],
    defaultTab: 'dash',
    title: 'Post-market surveillance & inspection officer',
    tasks: 'Scan, review alerts, conduct field investigation'
  },
  ict_staff: {
    allowed: ['registry', 'integration'],
    defaultTab: 'registry',
    title: 'ICT & regulatory-systems staff',
    tasks: 'Maintain the product registry and integration'
  },
  manager: {
    allowed: ['dash', 'cases', 'users', 'reports'],
    defaultTab: 'dash',
    title: 'Manager, supervisor, or administrator',
    tasks: 'Set priorities, oversee cases, manage staff & reports'
  }
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('dash')
  const [scans, setScans] = useState<Scan[]>([])
  const [products, setProducts] = useState<(Product & { id: string })[]>([])
  const [health, setHealth] = useState<Awaited<ReturnType<typeof checkHealth>> | null>(null)
  const [error, setError] = useState('')

  // AUTH STATE: Live Firebase Authentication with Rwanda FDA RBAC
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')

  // Layout UI states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')

  // Switch role dynamically to test Rwanda FDA target population views
  const handleSwitchRole = (newRole: UserRole) => {
    const config = ROLE_CONFIG[newRole]
    setCurrentUser((prev) => {
      if (!prev) return null
      return {
        ...prev,
        role: newRole,
        roleLabel: config.title
      }
    })
    setTab(config.defaultTab)
  }

  // RBAC Tab Protection: Automatically reroute if active tab is unauthorized for current role
  useEffect(() => {
    if (!currentUser) return
    const config = ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.manager
    if (!config.allowed.includes(tab)) {
      setTab(config.defaultTab)
    }
  }, [currentUser?.role, tab])

  // Prevent overlapping concurrent API requests
  const isRefreshingRef = useRef(false)

  // Load data from Backend Gateway API with in-flight concurrency lock
  const refreshData = async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      const status = await checkHealth()
      setHealth(status)
      if (status.status === 'online') {
        if (status.firebase && !status.firebase.connected) {
          console.warn('[Firebase] Database not connected:', status.firebase.error || 'Configure Firebase credentials/rules.')
        } else if (status.firebase?.connected && !status.firebase.authenticated) {
          console.info('[Firebase] Connected via unauthenticated REST access.')
        }
        const [scansRes, prodsRes] = await Promise.allSettled([fetchScans(), fetchProducts()])
        if (scansRes.status === 'fulfilled') setScans(scansRes.value)
        if (prodsRes.status === 'fulfilled') setProducts(prodsRes.value)
        setError('')
      } else {
        setError('Backend API is offline. Start it in MedVer_backend: python main.py')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend API')
    } finally {
      isRefreshingRef.current = false
    }
  }

  // --- LIVE AUTH LISTENER (Strict Backend Role & Session Validation) ---
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setAuthError('')
      if (!user) {
        setCurrentUser(null)
        setAuthReady(true)
        return
      }
      try {
        const token = await user.getIdToken()
        try {
          const profile = await fetchCurrentUser(token)
          setCurrentUser(profile)
          setAuthError('')
        } catch (fetchErr: any) {
          // If authenticated in Firebase but MedVerify profile needs onboarding
          console.info('[Auth] Onboarding user role in backend database...')
          const userEmail = (user.email || '').toLowerCase()
          const autoRole: UserRole = userEmail.includes('admin') ? 'admin' : 'manager'
          await registerUser({
            name: user.displayName || userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/^./, (s) => s.toUpperCase()),
            email: userEmail,
            role: autoRole,
            department: 'Rwanda FDA Central Surveillance'
          })
          const profile = await fetchCurrentUser(token)
          setCurrentUser(profile)
          setAuthError('')
        }
      } catch (err: any) {
        console.warn('[Auth] Backend session verification notice:', err)
        setAuthError(
          err?.message ||
            'Your session could not be verified by the MedVerify backend.'
        )
      } finally {
        setAuthReady(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!currentUser) return
    void refreshData()

    // Smart polling: Poll every 12 seconds only when tab is visible
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refreshData()
      }
    }, 12000)

    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [currentUser])

  const handleSignIn = async (email: string, password: string) => {
    setAuthError('')
    console.log('[Auth] Attempting sign-in for:', email.trim())
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    console.log('[Auth] Firebase sign-in successful. Token retrieved.')
    const token = await cred.user.getIdToken()
    console.log('[Auth] Verifying role permissions with backend /api/me...')
    try {
      const profile = await fetchCurrentUser(token)
      console.log('[Auth] Verification complete, role assigned:', profile.role)
      setCurrentUser(profile)
    } catch (err: any) {
      console.info('[Auth] Role not yet attached; auto-registering profile...')
      const userEmail = email.trim().toLowerCase()
      const roleToAssign: UserRole = userEmail.includes('admin') ? 'admin' : 'manager'
      await registerUser({
        name: userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/^./, (s) => s.toUpperCase()),
        email: userEmail,
        role: roleToAssign,
        department: 'Rwanda FDA Central Surveillance'
      })
      const profile = await fetchCurrentUser(token)
      setCurrentUser(profile)
    }
  }

  const handleRegister = async (data: {
    name: string
    email: string
    password: string
    role: UserRole
    department: string
  }) => {
    setAuthError('')
    console.log('[Auth] Creating account for:', data.email.trim(), 'with role:', data.role)
    const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password)
    console.log('[Auth] Firebase account created.')
    const token = await cred.user.getIdToken()
    console.log('[Auth] Registering role in backend...')
    await registerUser({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role: data.role,
      department: data.department.trim()
    })
    const profile = await fetchCurrentUser(token)
    console.log('[Auth] Registration complete. Assigned role:', profile.role)
    setCurrentUser(profile)
  }

  // --- AUTH GUARD & SIGN IN PAGE ---
  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0B0F] text-white p-4 relative overflow-hidden select-none">
        {/* Ambient glows matching brand palette */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-teal/15 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
          {/* Logo badge with orbiting spinner ring */}
          <div className="relative mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-2xl"
              style={{ backgroundColor: '#0F5C6E' }}
            >
              MV
            </div>
            {/* Spinning orbital border */}
            <div className="absolute -inset-2 rounded-3xl border-2 border-teal/20 border-t-teal animate-spin" />
          </div>

          <h1 className="text-xl font-bold text-white tracking-tight">
            MedVerify
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Rwanda FDA · National Medicine Verification
          </p>

          {/* Minimalist animated progress bar */}
          <div className="w-48 mt-6">
            <div className="h-1 w-full bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full animate-pulse w-3/4"
                style={{ backgroundColor: '#0F5C6E' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 text-[11px] font-mono text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Verifying Rwanda FDA credentials…</span>
          </div>
        </div>

        {/* Security badge at bottom */}
        <div className="absolute bottom-6 text-[10px] font-mono tracking-wider text-slate-600 uppercase">
          Rwanda FDA · Post-Market Surveillance System
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <SignInPage onSignIn={handleSignIn} onRegister={handleRegister} error={authError} />
  }

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      {/* Clean Fixed Left Sidebar */}
      <Sidebar
        activeTab={tab}
        onSelectTab={(selectedTab) => setTab(selectedTab)}
        currentUser={currentUser}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        totalScansCount={scans.length}
        flaggedCount={scans.filter((s) => s.category !== 'Genuine').length}
        productsCount={products.length}
      />

      {/* Main Content Area: Offset by sidebar width on desktop (md:pl-64) */}
      <div className="md:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top Navbar: Starts precisely where sidebar ends */}
        <Navbar
          currentUser={currentUser}
          onSwitchRole={handleSwitchRole}
          onSignOut={() => void signOut(auth)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          health={health}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          scans={scans}
          products={products}
        />

        {/* Tab content view */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
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

          {/* RBAC Access Guard if tab is unauthorized for active role */}
          {!(ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.manager).allowed.includes(tab) ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber/10 text-amber flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6 text-amber" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Access Restricted by RBAC</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                This module is restricted under Rwanda FDA security policy. Your current account ({currentUser.email}) has the{' '}
                <span className="font-semibold text-slate-700">{currentUser.roleLabel || currentUser.role}</span> role.
              </p>
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                <strong>Assigned Scope:</strong> {(ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.manager).tasks}
              </div>
              <button
                onClick={() => setTab((ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.manager).defaultTab)}
                className="mt-5 px-4 py-2 bg-teal text-white rounded-lg text-xs font-semibold hover:opacity-90 transition shadow-xs"
              >
                Go to {(ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.manager).defaultTab.toUpperCase()} Workspace
              </button>
            </div>
          ) : (
            <>
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 rounded-full border-2 border-teal border-t-transparent animate-spin" />
              </div>
            }>
              {tab === 'dash' && (
                <Dashboard
                  scans={scans}
                  role={currentUser.role}
                  onStatusChange={refreshData}
                  externalSearch={globalSearch}
                />
              )}
              {tab === 'scan' && (
                <ScanPage
                  onDone={() => {
                    refreshData()
                    setTab('dash')
                  }}
                />
              )}
              {tab === 'investigations' && (
                <InvestigationsPage currentUser={currentUser} />
              )}
              {tab === 'registry' && (
                <Registry
                  products={products}
                  onChange={refreshData}
                  externalSearch={globalSearch}
                />
              )}
              {tab === 'integration' && (
                <IntegrationPage
                  health={health}
                  onRefreshHealth={refreshData}
                  productsCount={products.length}
                  scansCount={scans.length}
                />
              )}
              {tab === 'cases' && (
                <CasesPage
                  scans={scans}
                  currentUser={currentUser}
                  onCaseUpdated={refreshData}
                />
              )}
              {tab === 'users' && (
                <UserManagementPage
                  currentUser={currentUser}
                />
              )}
              {tab === 'reports' && (
                <ReportsPage
                  scans={scans}
                  currentUser={currentUser}
                />
              )}
            </Suspense>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Dashboard({
  scans,
  role,
  onStatusChange,
  externalSearch = ''
}: {
  scans: Scan[]
  role: CurrentUser['role']
  onStatusChange: () => Promise<void>
  externalSearch?: string
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

      const activeSearch = (externalSearch || search).trim().toLowerCase()
      if (activeSearch) {
        const matchBarcode = s.barcode.toLowerCase().includes(activeSearch)
        const matchProduct = s.productName.toLowerCase().includes(activeSearch)
        const matchLoc = s.location.toLowerCase().includes(activeSearch)
        if (!matchBarcode && !matchProduct && !matchLoc) return false
      }

      return true
    })
  }, [scans, filter, catFilter, loc, search, externalSearch])

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
      await updateScanCase(id, { caseStatus })
      onStatusChange()
    } catch (e: any) {
      alert(e?.message || 'Could not update status')
    }
  }

  const setPriority = async (id: string, priority: string) => {
    try {
      await updateScanCase(id, { priority })
      await onStatusChange()
    } catch (e: any) {
      alert(e?.message || 'Could not update case priority')
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
              <Search className="absolute left-2.5 top-2 text-ink/40 w-3.5 h-3.5 pointer-events-none" />
              {search && (
                <button
                  onClick={() => handleFilterChange(setSearch, '')}
                  className="absolute right-2.5 top-1.5 text-ink/40 hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
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
              {paginatedRows.map((s, idx) => (
                <tr key={s.id ? `${s.id}-${idx}` : `scan-${idx}`} className="border-t border-ink/5 hover:bg-slate-50/50 transition">
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
                    {s.caseStatus === 'open' && (role === 'field_officer' || role === 'admin') ? (
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
                        {s.caseStatus === 'closed' ? (
                          'No case'
                        ) : s.caseStatus === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 text-alert">
                            <AlertTriangle className="w-3.5 h-3.5" /> Confirmed Counterfeit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-genuine">
                            <CheckCircle className="w-3.5 h-3.5" /> Cleared
                          </span>
                        )}
                      </span>
                    )}
                    {(role === 'manager' || role === 'admin') && s.caseStatus !== 'closed' && (
                      <select
                        aria-label={`Priority for ${s.barcode}`}
                        className="mt-2 block rounded border border-ink/20 bg-white px-2 py-1 text-xs"
                        value={s.priority || 'normal'}
                        onChange={(event) => void setPriority(s.id, event.target.value)}
                      >
                        {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                      </select>
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
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              {/* Previous Chevron */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 rounded-lg border border-ink/20 bg-white flex items-center gap-1 text-xs font-medium text-ink hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
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
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border border-ink/20 bg-white flex items-center justify-center text-xs font-bold text-ink hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
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
  const [result, setResult] = useState<{
    barcode: string
    name: string
    cat: Category
    registered: boolean
  } | null>(null)
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
      setResult({
        barcode: rec.barcode || code,
        name: rec.productName,
        cat: rec.category,
        registered: rec.codeMatch !== 'not_found'
      })
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
      setResult({
        barcode: rec.barcode || trimmed,
        name: rec.productName,
        cat: rec.category,
        registered: rec.codeMatch !== 'not_found'
      })
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
        setResult({
          barcode: res.barcode || res.record.barcode,
          name: res.record.productName,
          cat: res.record.category,
          registered: res.record.codeMatch !== 'not_found'
        })
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
          className={`rounded-lg px-3 py-2 text-sm font-medium transition inline-flex items-center gap-1.5 ${
            showScanner
              ? 'bg-ink text-white'
              : 'border border-ink/20 bg-white hover:bg-slate-50 text-ink'
          }`}
        >
          <Camera className="w-4 h-4" />
          {showScanner ? 'Hide Camera' : 'Open Camera Scanner'}
        </button>
      </div>

      {showScanner && (
        <div className="mb-5">
          <Suspense fallback={
            <div className="rounded-xl border border-ink/10 bg-white p-6 text-center text-xs text-ink/50">
              Loading camera scanner...
            </div>
          }>
            <BarcodeScanner
              onDetected={onBarcodeScanned}
              onImageCaptured={onImageCaptured}
              onClose={() => setShowScanner(false)}
            />
          </Suspense>
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
            <span className="text-xs font-mono text-ink/50 flex items-center gap-1">
              Synced to LCD <Cpu className="w-3.5 h-3.5 text-teal" />
            </span>
          </div>
          <div className="text-xl font-bold text-ink mt-1">{result.name}</div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-ink/60">Barcode read:</span>
            <span className="font-mono font-semibold text-ink">{result.barcode}</span>
          </div>
          <p className={`mt-2 text-sm ${result.registered ? 'text-genuine' : 'text-alert'}`}>
            {result.registered
              ? 'This barcode matched a product in the registry.'
              : 'Barcode scanned successfully, but it is not in the product registry. Add this barcode and medicine details in the Registry tab.'}
          </p>
          <div className="my-2.5">
            <Badge c={result.cat} />
          </div>
          <div className="text-sm font-medium text-ink/80">
            <strong>Recommended Action:</strong> {actionFor[result.cat]}
          </div>
          <div className="mt-3 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-ink/60">
            <span>Stage: {result.cat === 'Genuine' ? 'Released for Sale' : 'Quarantined / Flagged for Review'}</span>
            <button onClick={onDone} className="text-sm font-medium text-teal underline hover:opacity-80 inline-flex items-center gap-1">
              View on Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Registry({
  products,
  onChange,
  externalSearch = ''
}: {
  products: (Product & { id: string })[]
  onChange: () => Promise<void>
  externalSearch?: string
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
  const [submitMessage, setSubmitMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.id.trim() || !f.name.trim()) {
      setSubmitMessage({ kind: 'error', text: 'Barcode and product name are required.' })
      return
    }
    setBusy(true)
    setSubmitMessage(null)
    try {
      await addProduct({
        id: f.id.trim(),
        name: f.name.trim(),
        category: f.category,
        manufacturer: f.manufacturer || 'General',
        batch: f.batch || 'B-01',
        expiry: f.expiry || '2028-12-31'
      })
      await onChange()
      setF({ id: '', name: '', category: 'Antimalarial', manufacturer: '', batch: '', expiry: '' })
      setSubmitMessage({ kind: 'success', text: 'Product added to the official registry.' })
    } catch (err: any) {
      setSubmitMessage({ kind: 'error', text: err?.message || 'Could not add product.' })
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
      alert(`Verified: ${rec.productName} -> ${rec.category} (Synced to LCD)`)
      onChange()
    } catch (e: any) {
      alert(e?.message || 'Verification failed')
    }
  }

  const [regSearch, setRegSearch] = useState('')
  const [regPage, setRegPage] = useState(1)
  const REG_PAGE_SIZE = 6

  const filteredProducts = useMemo(() => {
    const q = (externalSearch || regSearch).trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes(q))
    )
  }, [products, regSearch, externalSearch])

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
          type="submit"
          disabled={busy}
          className="rounded-lg bg-teal text-white py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 sm:col-span-3"
        >
          {busy ? 'Adding...' : 'Add to Official Registry'}
        </button>
      </form>
      {submitMessage && (
        <p role="status" className={`-mt-4 mb-6 text-sm ${submitMessage.kind === 'success' ? 'text-genuine' : 'text-alert'}`}>
          {submitMessage.text}
        </p>
      )}

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
            <Search className="absolute left-2.5 top-2 text-ink/40 w-3.5 h-3.5 pointer-events-none" />
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
                    <QrCode className="w-3.5 h-3.5" /> Barcode & QR
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
                className="h-7 px-2.5 rounded border border-ink/20 bg-white text-ink hover:bg-slate-100 disabled:opacity-40 transition font-medium inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <span className="px-2 font-medium text-ink">
                Page {regCurrentPage} of {regTotalPages}
              </span>
              <button
                onClick={() => setRegPage((p) => Math.min(regTotalPages, p + 1))}
                disabled={regCurrentPage === regTotalPages}
                className="h-7 px-2.5 rounded border border-ink/20 bg-white text-ink hover:bg-slate-100 disabled:opacity-40 transition font-medium inline-flex items-center gap-1"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barcode & QR Modal with Download & Screen Scanning */}
      {selectedProduct && (
        <Suspense fallback={null}>
          <BarcodeModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onTestScan={handleTestScan}
          />
        </Suspense>
      )}
    </div>
  )
}
