import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion, AnimatePresence, useInView } from 'framer-motion';
import { Terminal, ArrowRight, Shield, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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
const LiveTerminal: React.FC<{ shouldReduceMotion: boolean | null; isLight: boolean }> = ({ shouldReduceMotion, isLight }) => {
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
    <div
      ref={terminalRef}
      className={`rounded-xl border overflow-hidden shadow-xl ${
        isLight ? 'bg-white border-[#033500]' : 'border-white/[0.06] bg-[#0a0a0c]'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${
          isLight ? 'bg-[#eaf5ea] border-[#033500]/20' : 'bg-[#111114] border-white/[0.06]'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#b21919]" />
          <span className="w-2 h-2 rounded-full bg-[#8f7200]" />
          <span className="w-2 h-2 rounded-full bg-[#033500]" />
          <span className={`ml-2 text-[10px] font-mono ${isLight ? 'text-[#2d552b] font-bold' : 'text-[var(--color-muted)]'}`}>
            frostledger-verify.sh
          </span>
        </div>
        <motion.button
          onClick={runSequence}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-mono cursor-pointer transition-colors ${
            isLight
              ? 'border-[#033500]/30 text-[#033500] hover:bg-[#033500]/10 font-bold'
              : 'border-white/[0.08] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/30'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isRunning}
        >
          <RefreshCw size={9} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'RUNNING' : 'RE-RUN'}
        </motion.button>
      </div>
      <div className="p-3 font-mono text-[11px] space-y-1 min-h-[120px]">
        <AnimatePresence mode="popLayout">
          {visibleLines.map((lineIdx) => {
            const line = TERMINAL_LINES[lineIdx];
            const textColor = isLight
              ? line.color
                ? line.color.includes('critical') || line.color.includes('danger')
                  ? '#b21919'
                  : '#033500'
                : '#164014'
              : line.color || '#a0a0a8';
            return (
              <motion.div
                key={lineIdx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                style={{ color: textColor }}
                className={isLight ? 'font-semibold' : ''}
              >
                {line.cmd}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {/* Blinking cursor */}
        {isRunning && (
          <motion.span
            className={`inline-block w-2 h-3.5 ${isLight ? 'bg-[#033500]' : 'bg-[var(--color-accent)]'}`}
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
};

export const FooterQuote: React.FC<FooterQuoteProps> = ({ onOpenAuth, onLaunchDashboard }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
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
    <footer
      ref={containerRef}
      className={`w-full border-t relative overflow-hidden font-mono py-16 ${
        isLight ? 'bg-[#f5faf5] border-[#033500]/20' : 'bg-[#080809] hairline'
      }`}
    >
      {/* Subtle gradient pulse */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px]"
          style={{
            background: isLight
              ? 'radial-gradient(circle, rgba(3,53,0,0.06), transparent 70%)'
              : 'radial-gradient(circle, rgba(125,249,196,0.04), transparent 70%)',
          }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Quote Terminal */}
          <div>
            {/* Dijkstra Terminal Blockquote with Typewriter */}
            <div
              className={`rounded-xl border p-6 text-xs shadow-xl ${
                isLight
                  ? 'bg-white border-[#033500] text-[#033500]'
                  : 'border-white/[0.06] bg-[#0d0d0f] text-neutral-300'
              }`}
            >
              <div
                className={`flex items-center justify-between pb-2 mb-3 border-b text-[11px] ${
                  isLight ? 'border-[#033500]/20 text-[#2d552b]' : 'border-white/[0.06] text-[var(--color-muted)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Terminal size={14} className={isLight ? 'text-[#033500]' : 'text-[var(--color-accent)]'} />
                  <span className="font-bold">$ cat principles.txt</span>
                </div>
                <motion.button
                  onClick={nextQuote}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] cursor-pointer transition-colors ${
                    isLight
                      ? 'border-[#033500]/30 text-[#033500] hover:bg-[#033500]/10 font-bold'
                      : 'border-white/[0.08] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/30'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw size={9} />
                  NEXT
                </motion.button>
              </div>

              <div className="min-h-[60px]">
                <p
                  className={`italic text-sm leading-relaxed font-mono ${
                    isLight ? 'text-[#033500] font-bold' : 'text-neutral-200'
                  }`}
                  style={isLight ? { color: '#033500' } : undefined}
                >
                  “{displayText}
                  {!isComplete && (
                    <motion.span
                      className={`inline-block w-0.5 h-4 ml-0.5 align-middle ${
                        isLight ? 'bg-[#033500]' : 'bg-[var(--color-accent)]'
                      }`}
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                  {isComplete && '”'}
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
                    className={`mt-2 text-right text-[11px] font-bold ${
                      isLight ? 'text-[#033500]' : 'text-[var(--color-accent)]'
                    }`}
                  >
                    — {quote.author}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quote navigation dots */}
              <div
                className={`flex items-center justify-center gap-2 mt-4 pt-3 border-t ${
                  isLight ? 'border-[#033500]/20' : 'border-white/[0.06]'
                }`}
              >
                {QUOTES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuoteIndex(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      quoteIndex === idx
                        ? isLight
                          ? 'bg-[#033500] shadow-[0_0_8px_#033500] w-4'
                          : 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)] w-4'
                        : isLight
                          ? 'bg-[#033500]/25 hover:bg-[#033500]/50'
                          : 'bg-neutral-700 hover:bg-neutral-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Verification Terminal */}
          <div className="space-y-4">
            <LiveTerminal shouldReduceMotion={shouldReduceMotion} isLight={isLight} />

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              {onLaunchDashboard && (
                <motion.button
                  onClick={onLaunchDashboard}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    isLight
                      ? 'bg-[#033500] text-white force-white hover:bg-[#022400]'
                      : 'bg-[var(--color-accent)] text-[#0a0a0b] hover:bg-[#6febb5]'
                  }`}
                  whileHover={{ scale: 1.02 }}
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
                  className={`px-4 py-2.5 rounded-lg border font-mono text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isLight
                      ? 'border-[#033500] bg-white text-[#033500] hover:bg-[#033500]/5 font-bold shadow-sm'
                      : 'border-white/[0.12] bg-[#111113]/80 text-white hover:border-[var(--color-accent)]/40'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Sign In
                </motion.button>
              )}
            </div>
          </div>
        </div>

        <div
          className={`mt-12 text-center text-xs font-mono border-t pt-6 ${
            isLight ? 'text-[#2d552b] border-[#033500]/20 font-medium' : 'text-[var(--color-muted)] border-white/[0.06]'
          }`}
        >
          © {new Date().getFullYear()} FrostLedger · Cold Chain Cryptographic Verification · Polygon Amoy L2
        </div>
      </div>
    </footer>
  );
};

