// ─────────────────────────────────────────────────────────────────────────────
// PAGE: CasesPage  (LIGHT MODE ONLY)
//
// PURPOSE:
// Manager case supervision page. Renders a table of suspicious scans
// (counterfeit candidates) with the ability to:
//   - Filter by case status + priority
//   - Search by barcode, product, or location
//   - Update case priority inline
//   - Confirm or clear each case
//
// LIGHT MODE ENFORCED:
// - All `dark:` classes removed.
// - White cards, slate borders, dark text everywhere.
//
// STYLING:
// - Teal primary for actions
// - Rose for confirmed counterfeits, amber for review, emerald for cleared
// - Compact typography (text-[10.5px] → text-[13px])
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import type { Scan, CaseStatus } from '../types';
import { updateScanCase, type CurrentUser } from '../api';

// ── PROPS ──
interface CasesPageProps {
  scans: Scan[];
  currentUser: CurrentUser;
  onCaseUpdated: () => Promise<void>;
}

// ── COMPONENT ──
export const CasesPage: React.FC<CasesPageProps> = ({
  scans,
  currentUser,
  onCaseUpdated,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'confirmed' | 'not_confirmed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── FILTERED CASES ──
  const filteredCases = useMemo(() => {
    return scans.filter((s) => {
      if (statusFilter !== 'all' && s.caseStatus !== statusFilter) return false;
      if (priorityFilter !== 'all' && (s.priority || 'normal') !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchBarcode = s.barcode.toLowerCase().includes(q);
        const matchProduct = s.productName.toLowerCase().includes(q);
        const matchLoc = s.location.toLowerCase().includes(q);
        if (!matchBarcode && !matchProduct && !matchLoc) return false;
      }
      return true;
    });
  }, [scans, statusFilter, priorityFilter, search]);

  // ── COUNTS ──
  const urgentCount = scans.filter((s) => s.priority === 'urgent').length;
  const highCount = scans.filter((s) => s.priority === 'high').length;
  const openCasesCount = scans.filter((s) => s.caseStatus === 'open').length;
  const confirmedCount = scans.filter((s) => s.caseStatus === 'confirmed').length;

  // ── HANDLERS ──
  const handleSetPriority = async (id: string, priority: string) => {
    setUpdatingId(id);
    try {
      await updateScanCase(id, { priority });
      await onCaseUpdated();
    } catch (err: any) {
      alert(err?.message || 'Failed to update case priority');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSetStatus = async (id: string, caseStatus: CaseStatus) => {
    setUpdatingId(id);
    try {
      await updateScanCase(id, { caseStatus });
      await onCaseUpdated();
    } catch (err: any) {
      alert(err?.message || 'Failed to update case status');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── RENDER ──
  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              Manager Case Supervision
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Rwanda FDA Enforcement
            </span>
          </div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight mt-2">
            Counterfeit Case Overseeing & Priorities
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
            Supervise open suspicious cases, designate incident priority, and coordinate quarantine actions.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11.5px] font-semibold shrink-0">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{openCasesCount} open cases requiring action</span>
        </div>
      </div>

      {/* ── METRICS ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
            Open Cases
          </p>
          <p className="text-[26px] font-bold text-slate-900 font-mono mt-1 leading-none">
            {openCasesCount}
          </p>
          <p className="text-[10.5px] text-slate-500 mt-1.5">
            Pending regulatory verdict
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <p className="text-[10.5px] font-semibold text-rose-500 uppercase tracking-wider">
            Urgent Priorities
          </p>
          <p className="text-[26px] font-bold text-rose-600 font-mono mt-1 leading-none">
            {urgentCount}
          </p>
          <p className="text-[10.5px] text-rose-500 font-medium mt-1.5">
            Immediate site intervention
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <p className="text-[10.5px] font-semibold text-amber-500 uppercase tracking-wider">
            High Priority
          </p>
          <p className="text-[26px] font-bold text-amber-600 font-mono mt-1 leading-none">
            {highCount}
          </p>
          <p className="text-[10.5px] text-amber-600 font-medium mt-1.5">
            Escalated for lab verification
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <p className="text-[10.5px] font-semibold text-emerald-600 uppercase tracking-wider">
            Confirmed Counterfeits
          </p>
          <p className="text-[26px] font-bold text-emerald-600 font-mono mt-1 leading-none">
            {confirmedCount}
          </p>
          <p className="text-[10.5px] text-emerald-600 font-medium mt-1.5">
            Quarantined for disposal
          </p>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search barcode, medicine, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[12.5px] rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
            />
          </div>

          <select
            aria-label="Filter case status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
          >
            <option value="all">All Case Statuses</option>
            <option value="open">Open Cases Only</option>
            <option value="confirmed">Confirmed Counterfeit</option>
            <option value="not_confirmed">Cleared Cases</option>
          </select>

          <select
            aria-label="Filter case priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {(statusFilter !== 'all' || priorityFilter !== 'all' || search) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setPriorityFilter('all');
                setSearch('');
              }}
              className="px-3 py-2 text-[12px] rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 transition"
            >
              Clear filters
            </button>
          )}

          <span className="text-[11px] text-slate-400 ml-auto">
            <strong className="text-slate-600">{filteredCases.length}</strong> of {scans.length} records
          </span>
        </div>
      </div>

      {/* ── CASES TABLE ── */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-900">
            Case Supervision Records
          </h2>
          <span className="text-[11px] text-slate-400">
            Manager role permissions active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-slate-500 bg-slate-50 border-b border-slate-100 font-semibold">
              <tr>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Logged Date</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Barcode</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Medicine</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Spectrometry</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Risk</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Point of Sale</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Set Priority</th>
                <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider">Supervision Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No cases match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c, idx) => (
                  <tr key={c.id ? `${c.id}-${idx}` : `case-${idx}`} className="hover:bg-slate-50/70 transition">
                    
                    {/* Date */}
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}{' '}
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Barcode */}
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 text-[11.5px]">
                      {c.barcode}
                    </td>

                    {/* Medicine */}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.productName}
                    </td>

                    {/* Spectrometry */}
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className={(c.similarity ?? 0) < 85 ? 'text-rose-600' : 'text-emerald-600'}>
                        {c.similarity != null ? `${c.similarity}%` : '—'}
                      </span>
                    </td>

                    {/* Risk category badge */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold text-[10px] border ${
                        c.category === 'Genuine'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : c.category === 'Critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {c.category}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {c.location}
                    </td>

                    {/* Priority dropdown */}
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Set priority for ${c.barcode}`}
                        disabled={updatingId === c.id}
                        value={c.priority || 'normal'}
                        onChange={(e) => void handleSetPriority(c.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase font-mono border focus:outline-none transition cursor-pointer ${
                          c.priority === 'urgent'
                            ? 'bg-rose-600 text-white border-rose-700'
                            : c.priority === 'high'
                            ? 'bg-amber-500 text-white border-amber-600'
                            : c.priority === 'low'
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : 'bg-teal-50 text-teal-700 border-teal-200'
                        }`}
                      >
                        <option value="low" className="bg-white text-slate-900">Low</option>
                        <option value="normal" className="bg-white text-slate-900">Normal</option>
                        <option value="high" className="bg-white text-slate-900">High</option>
                        <option value="urgent" className="bg-white text-slate-900">Urgent</option>
                      </select>
                    </td>

                    {/* Status actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={updatingId === c.id}
                          onClick={() => void handleSetStatus(c.id, 'confirmed')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            c.caseStatus === 'confirmed'
                              ? 'bg-rose-600 text-white'
                              : 'border border-rose-300 text-rose-600 hover:bg-rose-50'
                          }`}
                          title="Confirm as counterfeit and quarantine"
                        >
                          {c.caseStatus === 'confirmed' ? (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              <span>Quarantined</span>
                            </>
                          ) : (
                            'Confirm'
                          )}
                        </button>

                        <button
                          disabled={updatingId === c.id}
                          onClick={() => void handleSetStatus(c.id, 'not_confirmed')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            c.caseStatus === 'not_confirmed'
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                          title="Clear case as genuine"
                        >
                          {c.caseStatus === 'not_confirmed' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Cleared</span>
                            </>
                          ) : (
                            'Clear'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CasesPage;