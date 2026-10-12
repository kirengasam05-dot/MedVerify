// ─────────────────────────────────────────────────────────────────────────────
// PAGE: SignInPage  (MedVerify — Rwanda FDA)
//
// DESIGN:
// - Two-panel layout matching the Imbuto login (compact, no scroll on desktop).
// - PRIMARY COLOR: black (slate-900) — used on button, links, logo, gradient.
// - Secondary accents: emerald for success states, rose for errors.
//
// COMPACT:
// - Outer padding reduced (p-8/p-12 → p-6/p-8).
// - Center section padding reduced (py-8 → py-3).
// - Heading font reduced (32px → 24px).
// - Form spacing tightened (space-y-4 → space-y-3.5).
// - Input padding reduced (py-2.5 → py-2).
// - Right panel padding reduced (p-12 → p-8).
//
// REMOVED:
// - Preset role quick-login buttons
// - Verbose error banners
// - Dense footer with multiple links
// - Overpacked right-side mockup
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Send,
  X,
  Activity,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { submitAccessRequest } from '../api';

interface SignInPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  error: string;
}

// ── Brand color constants (black primary) ──
const BLACK_DEEP  = '#0B0B0F';   // primary black
const BLACK_SOFT  = '#1A1A1F';   // soft black
const BLACK_LIGHT = '#26262C';   // light black (for gradients)
const EMERALD     = '#10B981';   // success accent
const EMERALD_DK  = '#059669';

export const SignInPage: React.FC<SignInPageProps> = ({ onSignIn, error }) => {
  const [email, setEmail] = useState('manager@example.gov.rw');
  const [password, setPassword] = useState('manager123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // Request Access modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqRole, setReqRole] = useState<'field_officer' | 'ict_staff' | 'manager'>('field_officer');
  const [reqDepartment, setReqDepartment] = useState('Kigali Central Surveillance');
  const [reqReason, setReqReason] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqSuccess, setReqSuccess] = useState('');
  const [reqError, setReqError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setResetMessage('');
    try {
      await onSignIn(email.trim(), password);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setFormError('Email or password was not accepted.');
      } else if (code === 'auth/too-many-requests') {
        setFormError('Too many failed attempts. Please wait a moment.');
      } else {
        setFormError(err?.message || 'Sign-in failed. Please check your credentials.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setFormError('Please enter your email first to receive the reset link.');
      return;
    }
    setBusy(true);
    setFormError('');
    setResetMessage('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage(`Reset link sent to ${email.trim()}. Please check your inbox.`);
    } catch (err: any) {
      setFormError(err?.message || 'Could not send the password reset email.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqEmail.trim()) {
      setReqError('Email is required.');
      return;
    }
    setReqBusy(true);
    setReqError('');
    setReqSuccess('');
    try {
      const res = await submitAccessRequest({
        email: reqEmail.trim(),
        name: reqName.trim(),
        role: reqRole,
        department: reqDepartment,
        reason: reqReason.trim(),
      });
      setReqSuccess(res.message || 'Access request submitted successfully.');
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setReqSuccess('');
      }, 2500);
    } catch (err: any) {
      setReqError(err?.message || 'Failed to submit request. Please try again.');
    } finally {
      setReqBusy(false);
    }
  };

  // Shared input class — black focus ring
  const inputClass =
    'w-full pl-9 py-2 rounded-lg bg-white border border-slate-200 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10';

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden bg-slate-50 flex font-sans">

      {/* ═══════════════════════════════════════════════════════════════
          LEFT PANEL — Form
          ═══════════════════════════════════════════════════════════════ */}
      <section className="flex-1 flex flex-col bg-white lg:overflow-y-auto">

        {/* ── Top: Logo ── */}
        <div className="px-6 lg:px-8 pt-5 pb-3 lg:pt-6 lg:pb-4 flex-shrink-0">
          <div className="inline-flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] text-white"
              style={{ backgroundColor: BLACK_DEEP }}
            >
              MV
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-slate-900">
              MedVerify
            </span>
            <span
              className="px-1.5 py-0.5 text-[9.5px] font-semibold rounded uppercase tracking-wider border"
              style={{
                color: BLACK_SOFT,
                borderColor: '#E2E8F0',
                backgroundColor: '#F8FAFC',
              }}
            >
              Rwanda FDA
            </span>
          </div>
        </div>

        {/* ── Center: Form ── */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-8 py-3">
          <div className="w-full max-w-[380px]">

            {/* Heading */}
            <div className="mb-5">
              <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
                Enter your authorized credentials to access the surveillance gateway.
              </p>
            </div>

            {/* Error banner */}
            {(formError || error) && (
              <div
                role="alert"
                className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11.5px] flex items-start gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Reset success banner */}
            {resetMessage && (
              <div
                role="status"
                className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11.5px] flex items-start gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <span>{resetMessage}</span>
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="space-y-3.5">

              {/* Quick Demo Credentials (RBAC Roles) */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
                  <span>Select demo account</span>
                  <span className="text-[9.5px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-mono border border-teal-200/60">RBAC</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Field Officer', em: 'officer@example.gov.rw', pw: 'officer123' },
                    { label: 'ICT Staff', em: 'ict@example.gov.rw', pw: 'ict123' },
                    { label: 'Manager', em: 'manager@example.gov.rw', pw: 'manager123' }
                  ].map((p) => {
                    const isSelected = email === p.em
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setEmail(p.em)
                          setPassword(p.pw)
                        }}
                        className={`px-2 py-1.5 rounded-lg text-center text-[10.5px] font-medium border transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">
                  Official email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.gov.rw"
                    className={`${inputClass} pr-3`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    className="text-[11.5px] font-medium text-slate-600 hover:text-slate-900 transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 focus:ring-slate-900/20 cursor-pointer"
                    style={{ accentColor: BLACK_DEEP }}
                  />
                  <span className="text-[12px] text-slate-600">Remember this device</span>
                </label>
              </div>

              {/* Submit button — black */}
              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[13px] text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1 hover:shadow-md"
                style={{ backgroundColor: BLACK_DEEP }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BLACK_SOFT)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BLACK_DEEP)}
              >
                {busy ? (
                  <span
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#FFFFFF40', borderTopColor: '#FFFFFF' }}
                  />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Request access */}
            <p className="text-center text-[12px] text-slate-500 mt-5">
              Don't have access yet?{' '}
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(true)}
                className="font-semibold transition hover:opacity-80"
                style={{ color: BLACK_SOFT }}
              >
                Request Access
              </button>
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 lg:px-8 py-3 lg:py-4 flex items-center justify-between text-[11px] text-slate-400 flex-shrink-0">
          <span>© 2026 Rwanda FDA · MedVerify</span>
          <span className="hover:text-slate-600 transition cursor-pointer">
            Security Policy
          </span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT PANEL — Black gradient with mockup
          ═══════════════════════════════════════════════════════════════ */}
      <section className="hidden lg:flex flex-1 p-3 bg-slate-50">
        <div
          className="w-full rounded-3xl relative overflow-hidden p-8 flex flex-col"
          style={{
            background: `linear-gradient(135deg, ${BLACK_DEEP} 0%, ${BLACK_SOFT} 50%, ${BLACK_LIGHT} 100%)`,
          }}
        >
          {/* Subtle glows */}
          <div
            className="absolute top-0 right-0 w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none"
            style={{ backgroundColor: `${EMERALD}12` }}
          />
          <div
            className="absolute bottom-0 left-0 w-[300px] h-[300px] blur-[80px] rounded-full pointer-events-none"
            style={{ backgroundColor: '#FFFFFF08' }}
          />

          {/* Headline */}
          <div className="relative z-10 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-[10.5px] text-slate-300 font-medium mb-4">
              <Building2 size={11} className="text-emerald-400" />
              <span>Rwanda FDA Post-Market Surveillance</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-[26px] font-semibold text-white tracking-tight leading-tight">
              Effortlessly inspect, track and verify medical products.
            </h2>
            <p className="text-[12.5px] text-slate-400 mt-2 leading-relaxed">
              Official gateway connecting hospital pharmacies, border field inspectors, and central laboratories in real-time.
            </p>
          </div>

          {/* Mockup */}
          <div className="relative z-10 flex-1 flex items-center justify-center mt-6">
            <div className="w-full max-w-md space-y-2.5">

              {/* Top row — metrics */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-3.5 shadow-xl">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    <FileCheck2 size={10} className="text-emerald-600" />
                    <span>Verified today</span>
                  </div>
                  <p className="text-[20px] font-bold text-slate-900 tracking-tight mt-1.5 font-mono">
                    1,248
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                    ↑ 14.2% verified
                  </p>
                </div>

                <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-3.5 shadow-xl">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    <Activity size={10} className="text-emerald-600" />
                    <span>Accuracy index</span>
                  </div>
                  <p className="text-[20px] font-bold text-slate-900 tracking-tight mt-1.5 font-mono">
                    98.5%
                  </p>
                  <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                    Certified batch
                  </p>
                </div>
              </div>

              {/* Verification card */}
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-3.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: BLACK_DEEP }}
                    >
                      <FileCheck2 size={16} />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-slate-900">
                        Coartem 20/120mg
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Batch B-2026-01 · Novartis
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                    Genuine · Valid
                  </span>
                </div>
              </div>

              {/* Scan activity bar */}
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-3.5 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold text-slate-700">
                    Edge scanners activity
                  </span>
                  <span className="text-[9.5px] text-slate-400">Last 7 days</span>
                </div>
                <div className="flex items-end justify-between gap-2 h-14">
                  {[35, 55, 40, 70, 48, 82, 62].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(to top, ${BLACK_SOFT}, ${BLACK_LIGHT})`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] text-slate-400 font-mono">
                  <span>Mon</span><span>Tue</span><span>Wed</span>
                  <span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>

              {/* BNR-style pill */}
              <div className="flex justify-center pt-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[10px] text-slate-200">
                  <ShieldCheck size={11} className="text-emerald-400" />
                  <span>Compliant with Rwanda FDA medical regulations</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          REQUEST ACCESS MODAL
          ═══════════════════════════════════════════════════════════════ */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-scaleUp max-h-[90vh] overflow-y-auto">

            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: BLACK_DEEP }}
              >
                <Send size={16} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">
                  Request role access
                </h3>
                <p className="text-[11.5px] text-slate-500">
                  Submit a request to the Rwanda FDA system admin.
                </p>
              </div>
            </div>

            {/* Error / Success banners */}
            {reqError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11.5px] flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{reqError}</span>
              </div>
            )}
            {reqSuccess && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11.5px] flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{reqSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRequestSubmit} className="space-y-3">

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  placeholder="e.g., Marie Claire Uwase"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Official email
                </label>
                <input
                  type="email"
                  required
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  placeholder="officer@example.gov.rw"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Required role
                </label>
                <select
                  value={reqRole}
                  onChange={(e) => setReqRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition bg-white"
                >
                  <option value="field_officer">Field Officer — Barcode & camera scans</option>
                  <option value="ict_staff">ICT Staff — Registry & maintenance</option>
                  <option value="manager">Manager — Case decisions & surveillance</option>
                </select>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Station / Department
                </label>
                <input
                  type="text"
                  value={reqDepartment}
                  onChange={(e) => setReqDepartment(e.target.value)}
                  placeholder="e.g., Kigali Central or Rubavu Border"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                  Reason for access
                </label>
                <textarea
                  rows={2}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="e.g., Field inspection of pharmaceutical imports"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reqBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:shadow-md"
                  style={{ backgroundColor: BLACK_DEEP }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BLACK_SOFT)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BLACK_DEEP)}
                >
                  <Send size={13} />
                  <span>{reqBusy ? 'Submitting…' : 'Submit request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default SignInPage;