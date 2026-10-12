// ─────────────────────────────────────────────────────────────────────────────
// PAGE: InvestigationsPage  (LIGHT MODE ONLY)
//
// LIGHT MODE ENFORCED:
// - All `dark:` classes removed. Cards render white regardless of app theme.
// - Text is dark slate, borders are light, backgrounds are white/slate-50.
// - If you later want dark mode, re-add `dark:` variants.
//
// PURPOSE:
// Field Officer module for logging post-market pharmacy & clinic inspections.
//   - View list of past investigations (dossiers)
//   - Filter by location + search by facility, batch, ID, or officer
//   - Open a modal to log a new inspection
//
// STYLING:
// - Teal primary (#0D9488) for CTAs
// - White cards, slate borders, dark text
// - Rose / amber / emerald semantic states
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Search,
  UserCheck,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  fetchInvestigations,
  createInvestigation,
  type CurrentUser,
  type InvestigationRecord
} from '../api';

// ── TYPES ──
type Verdict =
  | 'Seized & Quarantined'
  | 'Routine Inspection Passed'
  | 'Under Lab Review'
  | 'Warning Notice Issued';

// ── VERDICT BADGE STYLES (LIGHT ONLY) ──
const VERDICT_STYLES: Record<string, string> = {
  'Seized & Quarantined':
    'bg-rose-50 text-rose-700 border-rose-200',
  'Routine Inspection Passed':
    'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Under Lab Review':
    'bg-amber-50 text-amber-700 border-amber-200',
  'Warning Notice Issued':
    'bg-orange-50 text-orange-700 border-orange-200',
};

// ── PROPS ──
interface InvestigationsPageProps {
  currentUser: CurrentUser;
}

// ── COMPONENT ──
export const InvestigationsPage: React.FC<InvestigationsPageProps> = ({ currentUser }) => {
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLoc, setFilterLoc] = useState('All');

  const [form, setForm] = useState({
    facilityName: '',
    location: 'Kigali',
    medicineBatch: '',
    findings: '',
    verdict: 'Seized & Quarantined' as Verdict,
  });

  // ── LOAD DATA FROM API ──
  const loadInvestigations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvestigations();
      setInvestigations(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load investigations from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvestigations();
  }, []);

  // ── HANDLERS ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facilityName.trim() || !form.medicineBatch.trim()) return;

    setSubmitting(true);
    try {
      const created = await createInvestigation({
        facilityName: form.facilityName.trim(),
        location: form.location,
        officer: currentUser.name || currentUser.email,
        medicineBatch: form.medicineBatch.trim(),
        findings: form.findings.trim() || 'Field verification conducted.',
        verdict: form.verdict,
      });

      setInvestigations((prev) => [created, ...prev]);
      setShowAddModal(false);
      setForm({
        facilityName: '',
        location: 'Kigali',
        medicineBatch: '',
        findings: '',
        verdict: 'Seized & Quarantined',
      });
    } catch (err: any) {
      alert(err?.message || 'Could not save field investigation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── FILTER ──
  const filtered = investigations.filter((inv) => {
    if (filterLoc !== 'All' && inv.location !== filterLoc) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        inv.facilityName.toLowerCase().includes(q) ||
        inv.medicineBatch.toLowerCase().includes(q) ||
        inv.officer.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCount = investigations.length;
  const seizedCount = investigations.filter((i) => i.verdict === 'Seized & Quarantined').length;
  const labCount = investigations.filter((i) => i.verdict === 'Under Lab Review').length;
  const passedCount = investigations.filter((i) => i.verdict === 'Routine Inspection Passed').length;

  // ── RENDER ──
  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
              Field Officer Module
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Rwanda FDA Inspection
            </span>
          </div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight mt-2">
            Post-Market Field Investigations
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
            Log pharmacy & clinic inspections, record seized suspect batches, and attach field evidence dossiers.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Log Field Investigation</span>
        </button>
      </div>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[12px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void loadInvestigations()}
            className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── METRICS ROW (with skeleton if loading) ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-12 bg-slate-200 rounded" />
              <div className="h-2.5 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Inspections
            </p>
            <p className="text-[26px] font-bold text-slate-900 font-mono mt-1 leading-none">
              {totalCount}
            </p>
            <p className="text-[10.5px] text-slate-500 mt-1.5">
              Across all districts
            </p>
          </div>

          {/* Seizures */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <p className="text-[10.5px] font-semibold text-rose-500 uppercase tracking-wider">
              Seizures Executed
            </p>
            <p className="text-[26px] font-bold text-rose-600 font-mono mt-1 leading-none">
              {seizedCount}
            </p>
            <p className="text-[10.5px] text-rose-500 font-medium mt-1.5">
              Quarantined from distribution
            </p>
          </div>

          {/* Under review */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <p className="text-[10.5px] font-semibold text-amber-500 uppercase tracking-wider">
              Under Lab Review
            </p>
            <p className="text-[26px] font-bold text-amber-600 font-mono mt-1 leading-none">
              {labCount}
            </p>
            <p className="text-[10.5px] text-amber-600 font-medium mt-1.5">
              Sent for chromatography
            </p>
          </div>

          {/* Passed */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <p className="text-[10.5px] font-semibold text-emerald-600 uppercase tracking-wider">
              Passed Inspections
            </p>
            <p className="text-[26px] font-bold text-emerald-600 font-mono mt-1 leading-none">
              {passedCount}
            </p>
            <p className="text-[10.5px] text-emerald-600 font-medium mt-1.5">
              Full compliance confirmed
            </p>
          </div>
        </div>
      )}

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search facility, batch, ID, or officer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[12.5px] rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
          />
        </div>

        {/* Location filter */}
        <select
          aria-label="Filter location"
          value={filterLoc}
          onChange={(e) => setFilterLoc(e.target.value)}
          className="px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
        >
          <option value="All">All Locations</option>
          <option value="Kigali">Kigali</option>
          <option value="Rubavu">Rubavu</option>
          <option value="Rusizi">Rusizi</option>
        </select>

        {/* Filtered count / refresh button */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => void loadInvestigations()}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
            title="Refresh from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-[11px] text-slate-400">
            <strong className="text-slate-600">{filtered.length}</strong> of {investigations.length} records
          </span>
        </div>
      </div>

      {/* ── DOSSIERS LIST (with skeleton if loading) ── */}
      <div className="space-y-3">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="h-5 w-28 bg-slate-200 rounded-full" />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                </div>
                <div className="h-10 bg-slate-50 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[12.5px] font-medium text-slate-500">
              No investigations match your criteria
            </p>
          </div>
        )}

        {filtered.map((inv) => (
          <div
            key={inv.id}
            className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition"
          >
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  {inv.id}
                </span>
                <span className="text-[13px] font-semibold text-slate-900">
                  {inv.facilityName}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <MapPin className="w-3 h-3 text-teal-600" />
                  <span>{inv.location}</span>
                </span>
              </div>

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${VERDICT_STYLES[inv.verdict]}`}
              >
                {inv.verdict}
              </span>
            </div>

            {/* Details grid */}
            <div className="grid sm:grid-cols-3 gap-3 text-[11.5px] mb-3">
              <div>
                <p className="text-[10.5px] text-slate-400 uppercase tracking-wider mb-0.5">
                  Suspected batch
                </p>
                <p className="font-medium text-slate-800">
                  {inv.medicineBatch}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] text-slate-400 uppercase tracking-wider mb-0.5">
                  Inspecting officer
                </p>
                <p className="font-medium text-slate-800 inline-flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-teal-600" />
                  <span>{inv.officer}</span>
                </p>
              </div>
              <div>
                <p className="text-[10.5px] text-slate-400 uppercase tracking-wider mb-0.5">
                  Inspection date
                </p>
                <p className="font-medium font-mono text-slate-800">
                  {inv.date}
                </p>
              </div>
            </div>

            {/* Findings callout */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11.5px] text-slate-600 leading-relaxed">
              <strong className="text-slate-900">
                Findings & evidence:
              </strong>{' '}
              {inv.findings}
            </div>
          </div>
        ))}
      </div>

      {/* ── ADD INVESTIGATION MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 animate-in zoom-in-95 duration-200">

            {/* Modal header */}
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-slate-900">
                    Log new field inspection
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Record a new on-site investigation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="space-y-4">

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Facility / pharmacy name
                </label>
                <input
                  required
                  placeholder="e.g. Kigali Central Pharmacy, Nyarugenge"
                  value={form.facilityName}
                  onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                    District / post
                  </label>
                  <select
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
                  >
                    <option>Kigali</option>
                    <option>Rubavu</option>
                    <option>Rusizi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                    Inspection verdict
                  </label>
                  <select
                    value={form.verdict}
                    onChange={(e) => setForm({ ...form, verdict: e.target.value as Verdict })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
                  >
                    <option>Seized & Quarantined</option>
                    <option>Under Lab Review</option>
                    <option>Routine Inspection Passed</option>
                    <option>Warning Notice Issued</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Suspected medicine & batch number
                </label>
                <input
                  required
                  placeholder="e.g. Artesunate 60mg (Batch B-901)"
                  value={form.medicineBatch}
                  onChange={(e) => setForm({ ...form, medicineBatch: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Field findings & evidence notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Details of physical check, NIR spectrometry match, barcode validity, and number of impounded units…"
                  value={form.findings}
                  onChange={(e) => setForm({ ...form, findings: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shadow-sm transition"
                >
                  Save dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigationsPage;