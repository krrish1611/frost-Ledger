import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, LogIn, UserCheck } from 'lucide-react';
import { ScrollProgress } from './ScrollProgress';
import { AmbientBackground } from './AmbientBackground';
import { AsciiReveal } from './AsciiReveal';
import { ParticleText } from './ParticleText';
import { AnnotatedText } from './AnnotatedText';
import { TraceStatusCard } from './TraceStatusCard';
import { VelocityScroll } from './VelocityScroll';
import { FeatureDeepDive } from './FeatureDeepDive';
import { SpiralGallery } from './SpiralGallery';
import { ClosingNotes } from './ClosingNotes';
import { FooterQuote } from './FooterQuote';
import { AuthModal } from './AuthModal';
import { ThemeToggle } from '../ThemeToggle';
import { useTheme } from '../../context/ThemeContext';

interface LandingViewProps {
  onEnterDashboard: (role?: 'operator' | 'admin' | 'receiver' | 'auditor') => void;
  currentUser?: { email?: string; id?: string } | null;
  onSignOut?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterDashboard,
  currentUser,
  onSignOut,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authPortal, setAuthPortal] = useState<'operator' | 'admin'>('operator');

  const openAuth = (mode: 'login' | 'signup' = 'login', portal: 'operator' | 'admin' = 'operator') => {
    setAuthMode(mode);
    setAuthPortal(portal);
    setAuthOpen(true);
  };

  const handleAuthSuccess = (role: 'operator' | 'admin' | 'receiver' | 'auditor') => {
    onEnterDashboard(role);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className="relative min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] selection:bg-[var(--color-accent)] selection:text-[#0a0a0b]"
      style={{ overflowX: 'clip' }}
    >
      {/* 1. Global Fixed 2px Spring Scroll Meter */}
      <ScrollProgress />

      {/* 2. Global Downscaled Sine Wave Plasma & Dot-Matrix Backdrop */}
      <AmbientBackground />

      {/* 3. Top Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b hairline bg-[var(--color-bg)]/80 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded border hairline bg-[var(--color-panel-elevated)] dark:bg-[#131316] flex items-center justify-center dot-matrix shadow-[0_0_12px_rgba(3,53,0,0.2)] dark:shadow-[0_0_12px_rgba(125,249,196,0.2)]"
              style={{ color: isLight ? '#033500' : 'var(--color-accent)' }}
            >
              <Shield size={17} />
            </div>
            <div className="flex items-center">
              <div
                className="font-display font-black text-base tracking-tight flex items-center gap-2"
                style={{ color: isLight ? '#033500' : 'var(--color-accent)' }}
              >
                <span>FROSTLEDGER</span>
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{
                    backgroundColor: isLight ? '#033500' : 'var(--color-accent)',
                    boxShadow: isLight ? '0 0 8px #033500' : '0 0 8px var(--color-accent)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-4 font-mono text-xs text-[var(--color-muted)]">
            <button
              onClick={() => scrollToSection('features')}
              className="px-2.5 py-1 rounded-md hover:text-[#033500] dark:hover:text-white transition-all cursor-pointer"
            >
              Diagnostics
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="px-2.5 py-1 rounded-md hover:text-[#033500] dark:hover:text-white transition-all cursor-pointer"
            >
              Architecture
            </button>
            <button
              onClick={() => scrollToSection('guarantees')}
              className="px-2.5 py-1 rounded-md hover:text-[#033500] dark:hover:text-white transition-all cursor-pointer"
            >
              Standards
            </button>
          </nav>

          {/* Action CTAs: Theme Toggle, Login, Sign In & Dashboard Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Light / Dark Mode Toggle */}
            <ThemeToggle />
            {currentUser ? (
              <>
                <div className="px-3 py-1.5 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-xs font-mono text-[var(--color-accent)] flex items-center gap-1.5">
                  <UserCheck size={13} />
                  <span className="max-w-[140px] truncate" title={currentUser.email}>
                    {currentUser.email}
                  </span>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="px-2.5 py-1.5 rounded border hairline hover:border-red-500/50 text-xs font-mono text-neutral-400 hover:text-red-400 bg-[#111113] hover:bg-[#18181c] transition-all cursor-pointer"
                    title="Sign Out"
                  >
                    Logout
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Operator Login Button */}
                <button
                  onClick={() => openAuth('login', 'operator')}
                  className="px-3 py-1.5 rounded border hairline hover:border-[var(--color-accent)] text-xs font-mono text-neutral-300 hover:text-white bg-[#111113] hover:bg-[#18181c] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Sign in as Cold Chain Operator or Field Receiver"
                >
                  <LogIn size={13} className="text-[var(--color-accent)]" />
                  <span>Operator Login</span>
                </button>

                {/* Admin Portal Button */}
                <button
                  onClick={() => openAuth('login', 'admin')}
                  className="px-3 py-1.5 rounded border border-amber-500/40 hover:border-amber-400 text-xs font-mono text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Sign in with Administrator Governance Privileges"
                >
                  <Shield size={13} className="text-amber-400" />
                  <span>Admin Portal</span>
                </button>
              </>
            )}

            {/* Launch Dashboard Primary Button */}
            <button
              onClick={() => onEnterDashboard('operator')}
              style={isLight ? { color: '#ffffff' } : undefined}
              className={`px-3.5 py-1.5 rounded font-bold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_14px_rgba(125,249,196,0.35)] transition-all cursor-pointer ${
                isLight
                  ? 'bg-[#033500] !text-white force-white hover:bg-[#022400]'
                  : 'bg-[var(--color-accent)] text-[#0a0a0b] hover:bg-[#6febb5]'
              }`}
            >
              <span className={isLight ? '!text-white force-white' : ''}>Console</span>
              <ArrowRight size={13} className={isLight ? '!text-white force-white' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* 4. HERO SECTION */}
      <section className="relative min-h-[calc(100vh-64px)] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-16 overflow-hidden">
        {/* Full-screen Monospace AsciiReveal Interactive Background */}
        <div className="absolute inset-0 opacity-65 dark:opacity-40 pointer-events-none">
          <AsciiReveal cellSize={18} interactiveRadius={180} />
        </div>

        {/* Foreground Hero Content Container */}
        <div className="relative z-10 w-full max-w-[1280px] mx-auto text-center space-y-8 flex flex-col items-center justify-center">
          {/* Interactive Particle Text Wordmark */}
          <div className="w-full flex justify-center items-center my-2">
            <ParticleText text="FROSTLEDGER" />
          </div>

          {/* Main Headline with Hand-Drawn SVG Annotations */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight text-center"
          >
            Deterministic Observability for{' '}
            <AnnotatedText variant="underline">High-Value</AnnotatedText> Pharma &amp;{' '}
            <AnnotatedText variant="circle">Cold-Chain</AnnotatedText> Fleets.
          </motion.h1>

          {/* Narrative Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[var(--color-muted)] text-base sm:text-lg max-w-2xl mx-auto font-sans leading-relaxed text-center"
          >
            Hardware-enforced Ed25519 signing at the IoT edge, kinetic Arrhenius shelf-life modeling, and Polygon Amoy on-chain Merkle anchors. Mathematical truth over speculation.
          </motion.p>

          {/* Dual Call To Actions */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 mx-auto w-full"
          >
            <button
              onClick={() => onEnterDashboard('operator')}
              style={isLight ? { color: '#ffffff' } : undefined}
              className={`w-full sm:w-auto px-6 py-3.5 rounded font-bold text-sm font-mono flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(125,249,196,0.45)] transition-all cursor-pointer ${
                isLight
                  ? 'bg-[#033500] !text-white force-white hover:bg-[#022400]'
                  : 'bg-[var(--color-accent)] text-[#0a0a0b] hover:bg-[#6febb5]'
              }`}
            >
              <span className={isLight ? '!text-white force-white' : ''}>Launch Operator Console</span>
              <ArrowRight size={16} className={isLight ? '!text-white force-white' : ''} />
            </button>

            <button
              onClick={() => openAuth('login', 'admin')}
              className="w-full sm:w-auto px-6 py-3.5 rounded border border-amber-500/40 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-sm flex items-center justify-center gap-2 backdrop-blur transition-all cursor-pointer"
            >
              <Shield size={15} className="text-amber-400" />
              <span>Admin Governance Portal</span>
            </button>
          </motion.div>

          {/* TraceStatusCard Live Agent Flight-Board Monitor */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="pt-8 w-full flex justify-center items-center"
          >
            <div className="w-full max-w-xl mx-auto flex justify-center">
              <TraceStatusCard />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. VELOCITY SCROLL DUAL MARQUEE TICKER */}
      <VelocityScroll />

      {/* 6. HOW IT LOCALIZES A FAULT: 2x2 FEATURE DEEP DIVE */}
      <FeatureDeepDive />

      {/* 7. 3D PLATFORM GALLERY: PINNED 240vh PERSPECTIVE STAGE */}
      <SpiralGallery />

      {/* 8. ARCHITECTURAL CLAIMS & TRANSPARENT LIMITS */}
      <ClosingNotes />

      {/* 9. TERMINAL QUOTE, FINAL CTA & LIVE HEALTH POLLING FOOTER */}
      <FooterQuote
        onOpenAuth={(mode) => openAuth(mode, 'operator')}
        onLaunchDashboard={() => onEnterDashboard('operator')}
      />

      {/* 10. AUTH MODAL (LOGIN & SIGN IN) */}
      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        initialPortal={authPortal}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};
