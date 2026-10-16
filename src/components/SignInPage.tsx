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
import { submitAccessRequest, type UserRole } from '../api';

interface SignInPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onRegister?: (data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    department: string;
  }) => Promise<void>;
  error: string;
}

// ── Brand color constants (black primary) ──
const BLACK_DEEP  = '#0B0B0F';   // primary black
const BLACK_SOFT  = '#1A1A1F';   // soft black
const BLACK_LIGHT = '#26262C';   // light black (for gradients)
const EMERALD     = '#10B981';   // success accent
const EMERALD_DK  = '#059669';

export const SignInPage: React.FC<SignInPageProps> = ({ onSignIn, onRegister, error }) => {
  // Mode toggle: 'signin' | 'register'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('admin');
  const [regDepartment, setRegDepartment] = useState('Rwanda FDA Central Surveillance');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Request Access modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqRole, setReqRole] = useState<UserRole>('field_officer');
  const [reqDepartment, setReqDepartment] = useState('Kigali Central Surveillance');
  const [reqReason, setReqReason] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqSuccess, setReqSuccess] = useState('');
  const [reqError, setReqError] = useState('');

  const handleSignInSubmit = async (event: React.FormEvent) => {
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

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setResetMessage('');

    if (!regName.trim() || !regEmail.trim()) {
      setFormError('Full name and official email are required.');
      setBusy(false);
      return;
    }

    if (regPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      setBusy(false);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      setBusy(false);
      return;
    }

    try {
      if (onRegister) {
        await onRegister({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          role: regRole,
          department: regDepartment.trim(),
        });
      } else {
        await onSignIn(regEmail.trim(), regPassword);
      }
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/email-already-in-use') {
        setFormError('This email is already registered. Please switch to Sign In or reset password.');
      } else if (code === 'auth/weak-password') {
        setFormError('The password is too weak. Please use numbers and special characters.');
      } else {
        setFormError(err?.message || 'Could not create account. Please verify your details.');
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

        {/* ── Top: Logo & Mode Tabs ── */}
        <div className="px-6 lg:px-8 pt-5 pb-2 lg:pt-6 lg:pb-3 flex-shrink-0 flex items-center justify-between">
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
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setFormError('');
              }}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                authMode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setFormError('');
              }}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                authMode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* ── Center: Form ── */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-8 py-3">
          <div className="w-full max-w-[420px]">

            {/* Heading */}
            <div className="mb-4">
              <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">
                {authMode === 'signin' ? 'Welcome Back' : 'Create Staff Account'}
              </h1>
              <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                {authMode === 'signin'
                  ? 'Enter your credentials to access the surveillance gateway.'
                  : 'Register your official account with full Rwanda FDA system privileges.'}
              </p>
            </div>

            {/* Error banner */}
            {(formError || error) && (
              <div
                role="alert"
                className="mb-3.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11.5px] flex items-start gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Reset success banner */}
            {resetMessage && (
              <div
                role="status"
                className="mb-3.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11.5px] flex items-start gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <span>{resetMessage}</span>
              </div>
            )}

            {/* ── SIGN IN FORM ── */}
            {authMode === 'signin' ? (
              <form onSubmit={handleSignInSubmit} className="space-y-3.5">
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
                      placeholder="admin@example.gov.rw"
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
                      className="text-[11.5px] font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[13px] text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1 hover:shadow-md cursor-pointer"
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

                {/* Switch to Register link */}
                <p className="text-center text-[12px] text-slate-500 mt-4">
                  New staff member?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setFormError('');
                    }}
                    className="font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Create an account here
                  </button>
                </p>
              </form>
            ) : (
              /* ── CREATE ACCOUNT FORM ── */
              <form onSubmit={handleRegisterSubmit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                {/* Full Name */}
                <div>
                  <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Josue K."
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
                  />
                </div>

                {/* Official Email */}
                <div>
                  <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@example.gov.rw"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
                  />
                </div>

                {/* Role selection */}
                <div>
                  <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                    Account Role & Privileges *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        key: 'admin' as UserRole,
                        title: 'Administrator',
                        desc: 'Full access to ALL 8 modules',
                        color: 'border-indigo-300 bg-indigo-50/50 text-indigo-900'
                      },
                      {
                        key: 'manager' as UserRole,
                        title: 'Manager',
                        desc: 'Oversee cases, users & reports',
                        color: 'border-purple-300 bg-purple-50/50 text-purple-900'
                      },
                      {
                        key: 'ict_staff' as UserRole,
                        title: 'ICT Systems',
                        desc: 'Registry & hardware integration',
                        color: 'border-blue-300 bg-blue-50/50 text-blue-900'
                      },
                      {
                        key: 'field_officer' as UserRole,
                        title: 'Field Officer',
                        desc: 'Inspection & camera scans',
                        color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                      }
                    ].map((item) => {
                      const isSel = regRole === item.key;
                      return (
                        <div
                          key={item.key}
                          onClick={() => setRegRole(item.key)}
                          className={`p-2 rounded-xl border-2 cursor-pointer transition text-left ${
                            isSel
                              ? 'border-slate-900 bg-slate-50 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-900">{item.title}</span>
                            {isSel && <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                          </div>
                          <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                    Department / Post
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="e.g. Rwanda FDA Central Surveillance"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['Kigali Central', 'Rubavu Post', 'Rusizi Post', 'ICT Systems'].map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setRegDepartment(dept)}
                        className="text-[9.5px] text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition"
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                      Password *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Min 6 chars"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-medium text-slate-700 mb-1">
                      Confirm *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Confirm"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition font-mono"
                    />
                  </div>
                </div>

                {/* Show password check */}
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRegPassword}
                      onChange={(e) => setShowRegPassword(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Show password</span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-[13px] text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2 hover:shadow-md cursor-pointer"
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
                      <span>Create Account & Sign In</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <p className="text-center text-[11.5px] text-slate-500 mt-2">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setFormError('');
                    }}
                    className="font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}

            {/* Request access shortcut */}
            <p className="text-center text-[11.5px] text-slate-400 mt-4">
              Need special approval?{' '}
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(true)}
                className="font-medium text-slate-600 hover:text-slate-900 transition underline cursor-pointer"
              >
                Request Access Dossier
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

          {/* Showcase Image */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center mt-6">
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/40 backdrop-blur-md">
              <img
                src="/medver.jpeg"
                alt="MedVerify Verification System"
                className="w-full h-auto max-h-[360px] object-cover rounded-2xl transition-transform duration-500 hover:scale-[1.02]"
              />
            </div>

            {/* Compliance pill */}
            <div className="flex justify-center pt-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[10px] text-slate-200 shadow-sm">
                <ShieldCheck size={11} className="text-emerald-400" />
                <span>Compliant with Rwanda FDA medical regulations</span>
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
                  <option value="admin">System Admin — Full access to manage all system activity</option>
                  <option value="manager">Manager — Case decisions & surveillance oversight</option>
                  <option value="ict_staff">ICT Staff — Registry & systems maintenance</option>
                  <option value="field_officer">Field Officer — Barcode & camera scans</option>
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