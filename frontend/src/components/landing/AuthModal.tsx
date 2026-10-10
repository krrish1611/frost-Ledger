import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, Mail, ArrowRight, UserCheck, KeyRound, Terminal, AlertTriangle, CheckCircle2, Building, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (role: 'operator' | 'admin' | 'receiver' | 'auditor') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
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
    setErrorMessage(null);
    setInfoMessage(null);
  }, [initialMode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        // Sign up with user metadata (automatically triggers public.handle_new_user to insert into public.profiles)
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              company: company.trim() || 'FrostLedger Cold Chain Partner',
              role,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          // Auto-authenticated without email confirmation requirement
          setInfoMessage('Account created and verified! Redirecting to dashboard...');
          setTimeout(() => {
            onSuccess(role);
            onClose();
          }, 800);
        } else if (data.user) {
          // If email confirmation is enabled in Supabase
          setInfoMessage(
            'Account registered! If email confirmation is enabled in your Supabase project, check your inbox. You can also sign in directly if confirm email is turned off.'
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
            'operator';

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

  const handleGuestLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccess('operator');
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
            <div className="flex items-center justify-between pb-4 border-b hairline mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#18181c] border hairline flex items-center justify-center text-[var(--color-accent)] shadow-[0_0_10px_rgba(125,249,196,0.2)]">
                  <Shield size={16} />
                </div>
                <div>
                  <div className="font-display font-bold text-white text-base">
                    {mode === 'login' ? 'SUPABASE OPERATOR SIGN IN' : 'NEW OPERATOR REGISTRATION'}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    FROSTLEDGER SECURE AUTH &bull; SUPABASE POSTGRESQL
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

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0a0a0b] rounded border hairline mb-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`py-1.5 rounded text-center font-medium transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[var(--color-accent)] text-[#0a0a0b] font-bold shadow-[0_0_12px_rgba(125,249,196,0.3)]'
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
                className={`py-1.5 rounded text-center font-medium transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[var(--color-accent)] text-[#0a0a0b] font-bold shadow-[0_0_12px_rgba(125,249,196,0.3)]'
                    : 'text-[var(--color-muted)] hover:text-white'
                }`}
              >
                Create Account
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
                      OPERATOR FULL NAME
                    </label>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Sarah Connor"
                        className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                      LOGISTICS ENTERPRISE / COMPANY
                    </label>
                    <div className="relative">
                      <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="BioPharma Global Hub"
                        className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  SUPABASE AUTH EMAIL
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                    placeholder="operator@frostledger.org"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  SECURE PASSWORD
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                    ASSIGNED ROLE (SAVED TO PROFILES)
                  </label>
                  <div className="relative">
                    <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] uppercase cursor-pointer"
                    >
                      <option value="operator">Operator (Full IoT & AI Telemetry)</option>
                      <option value="receiver">Receiver (Arrival Verification)</option>
                      <option value="auditor">Auditor (ZK & Immutable Logs)</option>
                      <option value="admin">Admin (System Configuration)</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 py-2.5 rounded bg-[var(--color-accent)] text-[#0a0a0b] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#6febb5] transition-all shadow-[0_0_16px_rgba(125,249,196,0.35)] cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#0a0a0b] border-t-transparent rounded-full animate-spin" />
                    COMMUNICATING WITH SUPABASE...
                  </span>
                ) : (
                  <>
                    <span>
                      {mode === 'login'
                        ? 'AUTHENTICATE & ENTER CONSOLE'
                        : 'REGISTER & PERSIST IN SUPABASE'}
                    </span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Quick 1-Click Guest Bypass */}
            <div className="mt-4 pt-3.5 border-t hairline text-center">
              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full py-2 px-3 rounded border hairline hover:border-[var(--color-accent)]/50 bg-[#0c0c0e] hover:bg-[#141418] text-neutral-300 hover:text-[var(--color-accent)] text-[11px] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserCheck size={13} className="text-[var(--color-accent)]" />
                <span>Instant 1-Click Guest Demo (Bypass Auth)</span>
              </button>
            </div>

            <div className="mt-3.5 text-[10px] text-center text-[var(--color-muted)] flex items-center justify-center gap-1.5">
              <Terminal size={11} className="text-[var(--color-accent)]" />
              <span>PROJECT: kdarjiawiiqnfreijqzo &bull; RLS ENABLED</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
