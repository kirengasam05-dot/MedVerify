// ─────────────────────────────────────────────────────────────────────────────
// PAGE: ReportsPage  (LIGHT MODE ONLY)
//
// PURPOSE:
// Manager & Executive compliance reports with regional breakdowns, KPI cards,
// audit sign-off, and CSV export of flagged incidents.
//
// LIGHT MODE ENFORCED: no `dark:` classes.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Download,
  Printer,
  FileText,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import type { Scan } from '../types';
import type { CurrentUser } from '../api';

interface ReportsPageProps {
  scans: Scan[];
  currentUser: CurrentUser;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ scans, currentUser }) => {
  const [selectedPeriod] = useState<'all' | 'today' | 'month'>('all');

  const total = scans.length;
  const flagged = scans.filter((s) => s.category !== 'Genuine');
  const critical = scans.filter((s) => s.category === 'Critical');
  const genuine = scans.filter((s) => s.category === 'Genuine');

  const genuineRate = total > 0 ? Math.round((genuine.length / total) * 100) : 100;
  const counterfeitRate = total > 0 ? Math.round((flagged.length / total) * 100) : 0;

  const locations = ['Kigali', 'Rubavu', 'Rusizi'];
  const locationStats = locations.map((loc) => {
    const locScans = scans.filter((s) => s.location === loc);
    const locFlagged = locScans.filter((s) => s.category !== 'Genuine');
    return {
      name: loc,
      total: locScans.length,
      flagged: locFlagged.length,
      rate: locScans.length > 0 ? Math.round((locFlagged.length / locScans.length) * 100) : 0,
    };
  });

  const handleExportCSV = () => {
    const headers = [
      'Scan ID', 'Timestamp', 'Barcode', 'Medicine Name', 'Sensor Similarity (%)',
      'Registry Check', 'Risk Category', 'Location', 'Case Status', 'Priority', 'Device',
    ];
    const rows = scans.map((s) => [
      `"${s.id}"`,
      `"${new Date(s.createdAt).toISOString()}"`,
      `"${s.barcode}"`,
      `"${s.productName.replace(/"/g, '""')}"`,
      s.similarity ?? 0,
      `"${s.codeMatch}"`,
      `"${s.category}"`,
      `"${s.location}"`,
      `"${s.caseStatus}"`,
      `"${s.priority || 'normal'}"`,
      `"${s.device || 'edge-scanner'}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rwanda_FDA_Surveillance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
              Manager & Executive Suite
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Rwanda FDA Compliance</span>
          </div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight mt-2">
            Surveillance & Compliance Reports
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
            Official pharmaceutical point-of-sale verification data, regional breakdowns, and audit exports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider">Total Scans</span>
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-[26px] font-bold text-slate-900 font-mono leading-none mt-1">{total}</div>
          <div className="text-[10.5px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>100% telemetry synced</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider">Authenticity Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-[26px] font-bold text-emerald-600 font-mono leading-none mt-1">{genuineRate}%</div>
          <div className="text-[10.5px] text-slate-400 mt-1.5">{genuine.length} approved batches</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider">Counterfeit Intercept</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-[26px] font-bold text-rose-600 font-mono leading-none mt-1">{counterfeitRate}%</div>
          <div className="text-[10.5px] text-rose-500 font-medium mt-1.5">
            {flagged.length} batches flagged
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider">Critical Priority</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-[26px] font-bold text-amber-600 font-mono leading-none mt-1">{critical.length}</div>
          <div className="text-[10.5px] text-amber-600 font-medium mt-1.5">
            Requires immediate dispatch
          </div>
        </div>
      </div>

      {/* ── REGIONAL + SIGN-OFF ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">Regional Point-of-Sale Breakdown</h2>
              <p className="text-[11px] text-slate-500">Distribution across border posts & cities</p>
            </div>
            <span className="text-[10.5px] font-mono text-slate-400">Rwanda FDA Regions</span>
          </div>

          <div className="space-y-3">
            {locationStats.map((loc) => (
              <div key={loc.name} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[12.5px] font-semibold text-slate-900">{loc.name}</span>
                  </div>
                  <div className="text-[11px] font-mono">
                    <span className="text-slate-600">{loc.total} total</span>
                    <span className="mx-1.5 text-slate-300">|</span>
                    <span className="text-rose-600 font-semibold">
                      {loc.flagged} flagged ({loc.rate}%)
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${100 - loc.rate}%` }} />
                  <div className="bg-rose-500 transition-all" style={{ width: `${loc.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit sign-off */}
        <div className="p-5 rounded-xl bg-[#0F1B22] text-white flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-teal-400 mb-3">
              <Building2 className="w-4 h-4" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider">Rwanda FDA Audit Log</span>
            </div>
            <h3 className="text-[14px] font-semibold">Surveillance Report Sign-Off</h3>
            <p className="text-[11.5px] text-slate-300 mt-2 leading-relaxed">
              Certified by the automated verification pipeline combining NIR spectrometry similarity with the official central pharmaceutical registry.
            </p>

            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Auditing officer</span>
                <span className="text-white font-medium">{currentUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role authority</span>
                <span className="text-teal-400 font-semibold">{currentUser.roleLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Generated</span>
                <span className="font-mono text-white">{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/10 text-center">
            <span className="text-[10.5px] text-white/50 font-mono">Hash: RW-FDA-VER-2026-X89</span>
          </div>
        </div>
      </div>

      {/* ── FLAGGED TABLE ── */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h3 className="text-[13px] font-semibold text-slate-900">Quarantined & Flagged Batches</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{flagged.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-slate-500 bg-slate-50 border-b border-slate-100">
              <tr>
                {['Timestamp', 'Barcode', 'Medicine', 'Sensor', 'Risk', 'Location', 'Status', 'Priority'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flagged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No flagged counterfeit incidents found.
                  </td>
                </tr>
              ) : (
                flagged.slice(0, 10).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString()}{' '}
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-800 text-[11.5px]">{s.barcode}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{s.productName}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-rose-600 text-[11.5px]">
                      {s.similarity != null ? `${s.similarity}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full font-semibold text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{s.location}</td>
                    <td className="px-4 py-2.5 font-medium capitalize text-slate-700 text-[11.5px]">
                      {s.caseStatus.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        s.priority === 'urgent'
                          ? 'bg-rose-600 text-white'
                          : s.priority === 'high'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {s.priority || 'normal'}
                      </span>
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

export default ReportsPage;