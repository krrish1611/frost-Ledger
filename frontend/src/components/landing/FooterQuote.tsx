import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion, AnimatePresence, useInView } from 'framer-motion';
import { Terminal, ArrowRight, Shield, RefreshCw } from 'lucide-react';

interface FooterQuoteProps {
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onLaunchDashboard?: () => void;
}

const QUOTES = [
  { text: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra' },
  { text: 'In mathematics you don\'t understand things. You just get used to them.', author: 'John von Neumann' },
  { text: 'The purpose of computing is insight, not numbers.', author: 'Richard Hamming' },
  { text: 'Program testing can be used to show the presence of bugs, but never to show their absence.', author: 'Edsger W. Dijkstra' },
];

const TERMINAL_LINES = [
  { cmd: '$ sha256sum audit_trail.db', delay: 0 },
  { cmd: '  → 8f2c4b1a...d41e  OK', delay: 800, color: 'var(--color-pass)' },
  { cmd: '$ verify --ed25519 --batch latest', delay: 1400 },
  { cmd: '  → 4/4 signatures VALID ✓', delay: 2200, color: 'var(--color-accent)' },
  { cmd: '$ merkle-anchor --status polygon-amoy', delay: 2800 },
  { cmd: '  → Block #49281 CONFIRMED  TX: 0x9727...ed37', delay: 3600, color: 'var(--color-pass)' },
];

// Typewriter hook
const useTypewriter = (text: string, speed: number = 35, startDelay: number = 0, enabled: boolean = true) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text);
      setIsComplete(true);
      return;
    }

    setDisplayText('');
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, startDelay, enabled]);

  return { displayText, isComplete };
};

// Interactive Live Terminal
const LiveTerminal: React.FC<{ shouldReduceMotion: boolean | null }> = ({ shouldReduceMotion }) => {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(terminalRef, { once: false, amount: 0.5 });

  const runSequence = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setVisibleLines([]);

    TERMINAL_LINES.forEach((line, idx) => {
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, idx]);
        if (idx === TERMINAL_LINES.length - 1) {
          setTimeout(() => setIsRunning(false), 500);
        }
      }, shouldReduceMotion ? 0 : line.delay);
    });
  }, [isRunning, shouldReduceMotion]);

  // Auto-run when scrolled into view
  useEffect(() => {
    if (isInView && visibleLines.length === 0) {
      runSequence();
    }
  }, [isInView]);

  return (
    <div ref={terminalRef} className="rounded-lg border border-white/[0.06] bg-[#0a0a0c] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111114] border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#e0574c]/80" />
          <span className="w-2 h-2 rounded-full bg-[#e8b14c]/80" />
          <span className="w-2 h-2 rounded-full bg-[#5bc98c]/80" />
          <span className="ml-2 text-[10px] font-mono text-[var(--color-muted)]">
            frostledger-verify.sh
          </span>
        </div>
        <motion.button
          onClick={runSequence}
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/[0.08] text-[9px] font-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/30 cursor-pointer transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isRunning}
        >
          <RefreshCw size={9} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'RUNNING' : 'RE-RUN'}
        </motion.button>
      </div>
      <div className="p-3 font-mono text-[11px] space-y-0.5 min-h-[120px]">
        <AnimatePresence mode="popLayout">
          {visibleLines.map((lineIdx) => {
            const line = TERMINAL_LINES[lineIdx];
            return (
              <motion.div
                key={lineIdx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                style={{ color: line.color || '#a0a0a8' }}
              >
                {line.cmd}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {/* Blinking cursor */}
        {isRunning && (
          <motion.span
            className="inline-block w-2 h-3.5 bg-[var(--color-accent)]"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
};

export const FooterQuote: React.FC<FooterQuoteProps> = ({ onOpenAuth, onLaunchDashboard }) => {
  const shouldReduceMotion = useReducedMotion();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quote = QUOTES[quoteIndex];
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });

  const { displayText, isComplete } = useTypewriter(
    quote.text,
    shouldReduceMotion ? 0 : 30,
    300,
    isInView
  );

  const nextQuote = useCallback(() => {
    setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
  }, []);

  // Auto-cycle quotes every 8 seconds when in view
  useEffect(() => {
    if (!isInView || shouldReduceMotion) return;
    const interval = setInterval(nextQuote, 8000);
    return () => clearInterval(interval);
  }, [isInView, shouldReduceMotion, nextQuote, quoteIndex]);

  return (
    <footer ref={containerRef} className="w-full bg-[#080809] border-t hairline relative overflow-hidden font-mono py-16">
      {/* Subtle gradient pulse */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(125,249,196,0.04), transparent 70%)' }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Quote Terminal */}
          <div>
            {/* Dijkstra Terminal Blockquote with Typewriter */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0f] p-6 text-xs text-neutral-300 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/[0.06] text-[11px] text-[var(--color-muted)]">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[var(--color-accent)]" />
                  <span>$ cat principles.txt</span>
                </div>
                <motion.button
                  onClick={nextQuote}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/[0.08] text-[9px] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/30 cursor-pointer transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw size={9} />
                  NEXT
                </motion.button>
              </div>

              <div className="min-h-[60px]">
                <p className="italic text-sm text-neutral-200 leading-relaxed font-mono">
                  &ldquo;{displayText}
                  {!isComplete && (
                    <motion.span
                      className="inline-block w-0.5 h-4 bg-[var(--color-accent)] ml-0.5 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                  {isComplete && '&rdquo;'}
                </p>
              </div>

              <AnimatePresence mode="wait">
                {isComplete && (
                  <motion.div
                    key={quoteIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 text-right text-[11px] text-[var(--color-accent)]"
                  >
                    — {quote.author}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quote navigation dots */}
              <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                {QUOTES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuoteIndex(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      quoteIndex === idx
                        ? 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)] w-4'
                        : 'bg-neutral-700 hover:bg-neutral-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Verification Terminal */}
          <div className="space-y-4">
            <LiveTerminal shouldReduceMotion={shouldReduceMotion} />

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              {onLaunchDashboard && (
                <motion.button
                  onClick={onLaunchDashboard}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-[#0a0a0b] font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(125,249,196,0.3)] hover:bg-[#6febb5] transition-all cursor-pointer"
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(125,249,196,0.45)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Shield size={14} />
                  Launch Dashboard
                  <ArrowRight size={14} />
                </motion.button>
              )}
              {onOpenAuth && (
                <motion.button
                  onClick={() => onOpenAuth('login')}
                  className="px-4 py-2.5 rounded-lg border border-white/[0.12] bg-[#111113]/80 text-white font-mono text-xs flex items-center justify-center gap-2 hover:border-[var(--color-accent)]/40 transition-all cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Sign In
                </motion.button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-[var(--color-muted)] font-mono border-t border-white/[0.06] pt-6">
          © {new Date().getFullYear()} FrostLedger · Cold Chain Cryptographic Verification · Polygon Amoy L2
        </div>
      </div>
    </footer>
  );
};
