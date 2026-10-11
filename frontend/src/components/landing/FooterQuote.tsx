import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion, AnimatePresence, useInView } from 'framer-motion';
import { Terminal, RefreshCw } from 'lucide-react';
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

export const FooterQuote: React.FC<FooterQuoteProps> = () => {
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
        <div className="max-w-2xl mx-auto">
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

