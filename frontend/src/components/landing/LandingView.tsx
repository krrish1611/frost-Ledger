import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Play, LogIn, UserCheck } from 'lucide-react';
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
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
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
            <div className="w-8 h-8 rounded border hairline bg-[var(--color-panel-elevated)] dark:bg-[#131316] flex items-center justify-center text-[#033500] dark:text-[var(--color-accent)] dot-matrix shadow-[0_0_12px_rgba(3,53,0,0.2)] dark:shadow-[0_0_12px_rgba(125,249,196,0.2)]">
              <Shield size={17} />
            </div>
            <div>
              <div className="font-display font-extrabold text-base tracking-tight text-[#033500] dark:text-white flex items-center gap-2">
                <span>FROSTLEDGER</span>
                <span className="w-2 h-2 rounded-full bg-[#033500] dark:bg-[var(--color-accent)] shadow-[0_0_8px_#033500] animate-pulse" />
              </div>
              <div className="font-mono text-[9px] text-[var(--color-muted)] tracking-wider uppercase hidden sm:block">
                POLYGON AMOY &bull; COLD CHAIN INTEGRITY &bull; ED25519
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
                {/* Login Button */}
                <button
                  onClick={() => openAuth('login')}
                  className="px-3 py-1.5 rounded border hairline hover:border-[var(--color-accent)] text-xs font-mono text-neutral-300 hover:text-white bg-[#111113] hover:bg-[#18181c] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn size={13} className="text-[var(--color-accent)]" />
                  <span>Login</span>
                </button>

                {/* Sign In / Register Button */}
                <button
                  onClick={() => openAuth('signup')}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded border border-[var(--color-accent)]/40 hover:border-[var(--color-accent)] text-xs font-mono text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 transition-all items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck size={13} />
                  <span>Register</span>
                </button>
              </>
            )}

            {/* Launch Dashboard Primary Button */}
            <button
              onClick={() => onEnterDashboard('operator')}
              className="px-3.5 py-1.5 rounded bg-[var(--color-accent)] text-[#0a0a0b] font-bold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_14px_rgba(125,249,196,0.35)] hover:bg-[#6febb5] transition-all cursor-pointer"
            >
              <span>Console</span>
              <ArrowRight size={13} />
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
              className="w-full sm:w-auto px-6 py-3.5 rounded bg-[var(--color-accent)] text-[#0a0a0b] font-bold text-sm font-mono flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(125,249,196,0.45)] hover:bg-[#6febb5] transition-all cursor-pointer"
            >
              <span>Launch Live Dashboard</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => openAuth('login')}
              className="w-full sm:w-auto px-6 py-3.5 rounded border hairline hover:border-[var(--color-accent)] bg-[#111113]/80 hover:bg-[#18181c] text-white font-mono text-sm flex items-center justify-center gap-2 backdrop-blur transition-all cursor-pointer"
            >
              <Play size={14} className="text-[var(--color-accent)]" />
              <span>Instant 1-Click Guest Access</span>
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
        onOpenAuth={openAuth}
        onLaunchDashboard={() => onEnterDashboard('operator')}
      />

      {/* 10. AUTH MODAL (LOGIN & SIGN IN) */}
      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};
