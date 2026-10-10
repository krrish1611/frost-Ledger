import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, Mail, ArrowRight, UserCheck, KeyRound, Terminal } from 'lucide-react';

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
  const [email, setEmail] = useState('operator@frostledger.internal');
  const [password, setPassword] = useState('••••••••••••');
  const [role, setRole] = useState<'operator' | 'admin' | 'receiver' | 'auditor'>('operator');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccess(role);
      onClose();
    }, 600);
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
            className="relative w-full max-w-md rounded-xl border hairline bg-[#111113] p-6 shadow-2xl z-10 glow-accent overflow-hidden font-mono"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b hairline mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#18181c] border hairline flex items-center justify-center text-[var(--color-accent)]">
                  <Shield size={16} />
                </div>
                <div>
                  <div className="font-display font-bold text-white text-base">
                    {mode === 'login' ? 'TERMINAL SIGN IN' : 'CREATE CREDENTIALS'}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    FROSTLEDGER SECURE AUTH V3.1
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

            {/* Mode Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0a0a0b] rounded border hairline mb-5 text-xs">
              <button
                type="button"
                onClick={() => setMode('login')}
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
                onClick={() => setMode('signup')}
                className={`py-1.5 rounded text-center font-medium transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[var(--color-accent)] text-[#0a0a0b] font-bold shadow-[0_0_12px_rgba(125,249,196,0.3)]'
                    : 'text-[var(--color-muted)] hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  MACHINE IDENTITY / OPERATOR EMAIL
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                    placeholder="operator@frostledger.internal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  ED25519 PASSPHRASE / TOKEN
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                  TARGET PERMISSION ROLE
                </label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-[#0a0a0b] border hairline rounded pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] uppercase"
                  >
                    <option value="operator">Operator (Full IoT & AI Telemetry)</option>
                    <option value="receiver">Receiver (Arrival Verification)</option>
                    <option value="auditor">Auditor (ZK & Immutable Logs)</option>
                    <option value="admin">Admin (System Configuration)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 rounded bg-[var(--color-accent)] text-[#0a0a0b] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#6febb5] transition-all shadow-[0_0_16px_rgba(125,249,196,0.35)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-[#0a0a0b] border-t-transparent rounded-full animate-spin" />
                    AUTHENTICATING...
                  </span>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'AUTHORIZE & ENTER CONSOLE' : 'REGISTER & ANCHOR NODE'}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Quick 1-Click Guest Bypass */}
            <div className="mt-5 pt-4 border-t hairline text-center">
              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full py-2 px-3 rounded border hairline hover:border-[var(--color-accent)]/50 bg-[#0c0c0e] hover:bg-[#141418] text-neutral-300 hover:text-[var(--color-accent)] text-[11px] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserCheck size={13} className="text-[var(--color-accent)]" />
                <span>Instant 1-Click Guest Demo (Bypass Auth)</span>
              </button>
            </div>

            <div className="mt-4 text-[10px] text-center text-[var(--color-muted)] flex items-center justify-center gap-1.5">
              <Terminal size={11} className="text-[var(--color-accent)]" />
              <span>TLS 1.3 · POLYGON AMOY COMPATIBLE</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
