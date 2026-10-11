import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Shield,
  Lock,
  Mail,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Building,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup';
  initialPortal?: 'operator' | 'admin';
  onClose: () => void;
  onSuccess: (role: 'operator' | 'admin' | 'receiver' | 'auditor') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  initialPortal = 'operator',
  onClose,
  onSuccess,
}) => {
  const [portal, setPortal] = useState<'operator' | 'admin'>(initialPortal);
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState<'operator' | 'admin' | 'receiver' | 'auditor'>('operator');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setPortal(initialPortal);
    if (initialPortal === 'admin') {
      setRole('admin');
    } else {
      setRole('operator');
    }
    setErrorMessage(null);
    setInfoMessage(null);
  }, [initialMode, initialPortal, isOpen]);

  const handlePortalSwitch = (target: 'operator' | 'admin') => {
    setPortal(target);
    setRole(target === 'admin' ? 'admin' : 'operator');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const assignedRole = portal === 'admin' ? 'admin' : role;
        // Sign up with user metadata
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              company: company.trim() || (portal === 'admin' ? 'FrostLedger Central Compliance' : 'FrostLedger Cold Chain Partner'),
              role: assignedRole,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          setInfoMessage('Account created and verified! Redirecting to dashboard...');
          setTimeout(() => {
            onSuccess(assignedRole);
            onClose();
          }, 800);
        } else if (data.user) {
          setInfoMessage(
            'Account registered! If email confirmation is enabled in your Supabase project, check your inbox. You can also sign in directly.'
          );
          setMode('login');
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          // Attempt to fetch role from public.profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

          const resolvedRole =
            (profile?.role as 'operator' | 'admin' | 'receiver' | 'auditor') ||
            (data.user.user_metadata?.role as 'operator' | 'admin' | 'receiver' | 'auditor') ||
            (portal === 'admin' ? 'admin' : 'operator');

          if (portal === 'admin' && resolvedRole !== 'admin') {
            // Give clear guidance if operator attempts admin portal
            setErrorMessage('Access denied: This account does not possess administrator credentials. Please use the Operator Portal.');
            return;
          }

          onSuccess(resolvedRole);
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      setErrorMessage(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = (targetRole: 'operator' | 'admin') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccess(targetRole);
      onClose();
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            className="fixed inset-0 bg-[#0a0a0b]/85 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            className="relative w-full max-w-md rounded-xl border hairline bg-[#111113] p-6 shadow-2xl z-10 glow-accent overflow-hidden font-mono max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b hairline mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded border hairline flex items-center justify-center ${
                    portal === 'admin'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'bg-[#18181c] text-[var(--color-accent)] shadow-[0_0_10px_rgba(125,249,196,0.2)]'
                  }`}
                >
                  <Shield size={16} />
                </div>
                <div>
                  <div className="font-display font-bold text-white text-base">
                    {portal === 'admin' ? 'ADMIN & COMPLIANCE PORTAL' : 'FIELD OPERATOR PORTAL'}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {portal === 'admin' ? 'ELEVATED GOVERNANCE & USER MONITORING' : 'COLD CHAIN TELEMETRY & ALERT REMEDIATION'}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-[#1a1a1e] text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Portal Switcher (User vs Admin) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0a0a0b] rounded-lg border hairline mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => handlePortalSwitch('operator')}
                className={`py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  portal === 'operator'
                    ? 'bg-[var(--color-accent)] text-[#0a0a0b] shadow-[0_0_12px_rgba(125,249,196,0.25)]'
                    : 'text-[var(--color-muted)] hover:text-white'
                }`}
              >
                <User size={13} />
                <span>Operator / Field</span>
              </button>
              <button
                type="button"
                onClick={() => handlePortalSwitch('admin')}
                className={`py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  portal === 'admin'
                    ? 'bg-amber-400 text-[#0a0a0b] shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                    : 'text-[var(--color-muted)] hover:text-white'
                }`}
              >
                <Shield size={13} />
                <span>Admin Governance</span>
              </button>
            </div>

            {/* Mode Switcher Tabs (Sign In vs Create Account) */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0a0a0b]/60 rounded border hairline mb-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`py-1 rounded text-center font-medium transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#222228] text-white font-bold'
                    : 'text-[var(--color-muted)] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                }}
                className={`py-1 rounded text-center font-medium transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#222228] text-white font-bold'
                    : 'text-[var(--color-muted)] hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Notification Banner */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Info Notification Banner */}
            {infoMessage && (
              <div className="mb-4 p-3 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/40 text-[var(--color-accent)] text-xs flex items-start gap-2.5">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                <div className="leading-relaxed">{infoMessage}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                      FULL NAME
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={portal === 'admin' ? 'Dr. Sarah Connor' : 'John Doe'}
                        className="w-full bg-[#0a0a0b] border hairline rounded px-3 py-2 pl-9 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        required
                      />
                      <User size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                      ORGANIZATION / COMPANY
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Pfizer Supply Chain Hub"
                        className="w-full bg-[#0a0a0b] border hairline rounded px-3 py-2 pl-9 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                      />
                      <Building size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
                    </div>
                  </div>

                  {portal === 'operator' && (
                    <div>
                      <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                        FIELD ROLE ASSIGNMENT
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="w-full bg-[#0a0a0b] border hairline rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                      >
                        <option value="operator">Cold Chain Operator</option>
                        <option value="receiver">Dock Arrival Receiver</option>
                        <option value="auditor">Compliance Auditor</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  {portal === 'admin' ? 'ADMINISTRATOR EMAIL' : 'OPERATOR EMAIL'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={portal === 'admin' ? 'admin@frostledger.io' : 'operator@frostledger.io'}
                    className="w-full bg-[#0a0a0b] border hairline rounded px-3 py-2 pl-9 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                    required
                  />
                  <Mail size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#0a0a0b] border hairline rounded px-3 py-2 pl-9 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                    required
                    minLength={6}
                  />
                  <Lock size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg mt-4 ${
                  portal === 'admin'
                    ? 'bg-amber-400 text-[#0a0a0b] hover:bg-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
                    : 'bg-[var(--color-accent)] text-[#0a0a0b] hover:bg-[#6febb5] shadow-[0_0_16px_rgba(125,249,196,0.3)]'
                }`}
              >
                {isLoading ? (
                  <span>Authenticating with Supabase...</span>
                ) : (
                  <>
                    <span>{mode === 'login' ? `Sign In as ${portal.toUpperCase()}` : `Register as ${portal.toUpperCase()}`}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo 1-Click Access Section */}
            <div className="mt-5 pt-4 border-t hairline space-y-2">
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider block text-center">
                Fast Evaluator 1-Click Sandbox Access
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('operator')}
                  className="py-2 px-2.5 rounded border border-[var(--color-accent)]/30 hover:border-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/15 text-[11px] font-mono text-[var(--color-accent)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <User size={12} />
                  <span>Demo Operator</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('admin')}
                  className="py-2 px-2.5 rounded border border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/15 text-[11px] font-mono text-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Shield size={12} />
                  <span>Demo Admin</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
