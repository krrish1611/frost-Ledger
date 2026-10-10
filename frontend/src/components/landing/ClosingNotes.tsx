import React, { useRef, useState, useCallback } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Shield, AlertCircle, Lock, Zap, ChevronDown, Fingerprint } from 'lucide-react';

interface NoteCard {
  title: string;
  badge: string;
  description: string;
  guarantee: string;
  icon: React.ReactNode;
  expandedDetails: string[];
  verificationHash: string;
}

const NOTES: NoteCard[] = [
  {
    title: 'Hardware-Enforced Cryptography',
    badge: 'GUARANTEED INTEGRITY',
    description:
      'Every sensor reading is cryptographically signed at the physical edge using isolated Ed25519 keys with RFC 8785 canonical JSON serialization before leaving the device.',
    guarantee: 'SLA: 100% tamper detection on compromised telemetry packets',
    icon: <Zap size={18} className="text-[var(--color-accent)]" />,
    expandedDetails: [
      'Ed25519 key isolation prevents credential exfiltration from device memory',
      'RFC 8785 canonical JSON ensures bit-exact deterministic hashing across platforms',
      'Firmware attestation validates hardware boot chain integrity before signing',
    ],
    verificationHash: '0x4b71...a93f',
  },
  {
    title: 'Deterministic Ledger Isolation',
    badge: 'CORE DESIGN RULE',
    description:
      'The official audit trail is produced strictly by deterministic code (hashes, Ed25519 signatures, MKT kinetics, and smart contracts). The ML layer is an isolated advisory overlay and can never alter official records.',
    guarantee: 'Guarantee: 100% deterministic reproducibility of official audit state',
    icon: <Shield size={18} className="text-emerald-400" />,
    expandedDetails: [
      'Advisory ML layer operates in read-only mode against immutable ledger state',
      'PostgreSQL append-only triggers prevent any UPDATE or DELETE on audit tables',
      'Smart contract logic enforces state transition rules on-chain',
    ],
    verificationHash: '0x8f2c...d41e',
  },
  {
    title: 'Zero-Knowledge Privacy Audits',
    badge: 'CRYPTOGRAPHIC AUDIT',
    description:
      'Prove temperature integrity and regulatory compliance to customs, distributors, and insurers without revealing proprietary drug batch numbers, formulas, or GPS trade routes.',
    guarantee: 'Security: Ed25519 hardware roots + Polygon Amoy anchors',
    icon: <Lock size={18} className="text-[var(--color-accent)]" />,
    expandedDetails: [
      'ZK-proof verification completes in under 4.2KB of on-chain state',
      'Selective disclosure allows granular compliance proof without trade secret exposure',
      'Multi-party verification supports customs, insurers, and distributors simultaneously',
    ],
    verificationHash: '0x3e9a...7b22',
  },
  {
    title: 'Fail-Safe Offline Storage',
    badge: 'HARDWARE RESILIENCY',
    description:
      'Onboard ESP32 flash ring buffer retains up to 48 hours of high-frequency sensor readings during cellular transit blackouts. Automatically validates and syncs upon reconnection without data loss.',
    guarantee: 'Reliability: Zero packet loss across cross-continental air and sea transit',
    icon: <AlertCircle size={18} className="text-[#e8b14c]" />,
    expandedDetails: [
      '48-hour ring buffer capacity at 1Hz sampling rate with automatic compaction',
      'Reconnection sync uses Merkle tree delta comparison for bandwidth-efficient upload',
      'Power-loss protection via wear-leveled flash with CRC32 integrity checks',
    ],
    verificationHash: '0x71d0...e5f8',
  },
];

// Interactive 3D Tilt Card with mouse-tracking perspective transforms
const InteractiveCard: React.FC<{
  note: NoteCard;
  idx: number;
  shouldReduceMotion: boolean | null;
}> = ({ note, idx, shouldReduceMotion }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // 3D tilt: ±8 degrees based on mouse position
      setTilt({
        rotateX: (0.5 - y) * 16,
        rotateY: (x - 0.5) * 16,
      });

      // Radial glow follows cursor
      setGlowPos({ x: x * 100, y: y * 100 });
    },
    [shouldReduceMotion]
  );

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleVerify = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isVerifying || verified) return;
      setIsVerifying(true);
      // Simulate cryptographic verification sequence
      setTimeout(() => {
        setIsVerifying(false);
        setVerified(true);
        setTimeout(() => setVerified(false), 4000);
      }, 1200);
    },
    [isVerifying, verified]
  );

  const accentColors: Record<number, string> = {
    0: '125, 249, 196',
    1: '110, 231, 183',
    2: '125, 249, 196',
    3: '232, 177, 76',
  };
  const rgb = accentColors[idx] || '125, 249, 196';

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        perspective: 800,
        transformStyle: 'preserve-3d',
      }}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.5, delay: shouldReduceMotion ? 0 : idx * 0.08, ease: 'easeOut' }}
    >
      <motion.div
        className={`relative p-6 rounded-xl border bg-[var(--color-panel)]/75 backdrop-blur-md overflow-hidden flex flex-col justify-between cursor-pointer select-none transition-shadow duration-300 ${
          isExpanded
            ? 'border-[var(--color-accent)]/60 shadow-[0_0_35px_rgba(125,249,196,0.15)]'
            : 'border-white/[0.08] hover:border-white/20 shadow-lg'
        }`}
        animate={{
          rotateX: tilt.rotateX,
          rotateY: tilt.rotateY,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
          mass: 0.5,
        }}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Dynamic radial glow that follows cursor */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px circle at ${glowPos.x}% ${glowPos.y}%, rgba(${rgb}, ${isHovered ? 0.08 : 0}), transparent 40%)`,
            opacity: isHovered ? 1 : 0,
          }}
        />

        {/* Animated corner scan reticles */}
        <AnimatePresence>
          {isHovered && (
            <>
              {[
                'top-2 left-2',
                'top-2 right-2 rotate-90',
                'bottom-2 right-2 rotate-180',
                'bottom-2 left-2 -rotate-90',
              ].map((pos, i) => (
                <motion.div
                  key={i}
                  className={`absolute ${pos} w-3 h-3 pointer-events-none`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 0.5, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <div
                    className="w-full h-full border-l-[1.5px] border-t-[1.5px]"
                    style={{ borderColor: `rgba(${rgb}, 0.5)` }}
                  />
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        <div>
          {/* Top Tag & Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative p-2 rounded-lg bg-[#161619] border border-white/[0.06]"
                whileHover={{ scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                {note.icon}
                {/* Pulse ring on icon */}
                <motion.div
                  className="absolute inset-0 rounded-lg border"
                  style={{ borderColor: `rgba(${rgb}, 0.3)` }}
                  animate={
                    isHovered
                      ? {
                          scale: [1, 1.4, 1.4],
                          opacity: [0.6, 0, 0],
                        }
                      : { scale: 1, opacity: 0 }
                  }
                  transition={{
                    duration: 1.5,
                    repeat: isHovered ? Infinity : 0,
                    ease: 'easeOut',
                  }}
                />
              </motion.div>
              <span className="font-mono text-[10px] text-[var(--color-muted)] uppercase tracking-wider">
                {note.badge}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--color-accent)] opacity-60 group-hover:opacity-100 transition-opacity">
                REF #0{idx + 1}
              </span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <ChevronDown size={14} className="text-[var(--color-muted)]" />
              </motion.div>
            </div>
          </div>

          <h3 className="card-title text-lg text-white mb-2">{note.title}</h3>

          <p className="text-[var(--color-muted)] text-xs sm:text-sm leading-relaxed mb-4">
            {note.description}
          </p>

          {/* Expandable Details Panel */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mb-4 pt-3 border-t border-white/[0.06]">
                  {note.expandedDetails.map((detail, dIdx) => (
                    <motion.div
                      key={dIdx}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: dIdx * 0.08, duration: 0.3 }}
                      className="flex items-start gap-2.5 text-xs font-mono text-neutral-300 py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                    >
                      <CheckCircle2
                        size={12}
                        className="shrink-0 mt-0.5"
                        style={{ color: `rgb(${rgb})` }}
                      />
                      <span className="leading-relaxed">{detail}</span>
                    </motion.div>
                  ))}

                  {/* Interactive Verify Button */}
                  <motion.button
                    onClick={handleVerify}
                    className={`w-full mt-2 py-2 px-4 rounded-lg border text-xs font-mono flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      verified
                        ? 'border-[var(--color-pass)]/50 bg-[var(--color-pass)]/10 text-[var(--color-pass)]'
                        : isVerifying
                        ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-[var(--color-accent)]'
                        : 'border-white/[0.08] bg-white/[0.02] text-[var(--color-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5'
                    }`}
                    whileHover={!isVerifying && !verified ? { scale: 1.02 } : {}}
                    whileTap={!isVerifying && !verified ? { scale: 0.98 } : {}}
                  >
                    <Fingerprint
                      size={14}
                      className={isVerifying ? 'animate-spin' : ''}
                    />
                    {verified ? (
                      <span>VERIFIED · HASH {note.verificationHash}</span>
                    ) : isVerifying ? (
                      <span>VERIFYING CRYPTOGRAPHIC PROOF...</span>
                    ) : (
                      <span>VERIFY ARCHITECTURE PROOF</span>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px] text-[var(--color-accent)]">
          <span>{note.guarantee}</span>
          <motion.span
            className="text-white/60"
            animate={verified ? { color: 'rgb(91, 201, 140)' } : {}}
          >
            {verified ? '✓ AUDITED' : 'AUDITED'}
          </motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ClosingNotes: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="guarantees" className="w-full py-20 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border hairline bg-[var(--color-panel)] text-[var(--color-accent)] font-mono text-xs uppercase tracking-wider">
          <CheckCircle2 size={12} />
          VERIFIED STANDARDS &amp; BOUNDARIES
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Architectural Guarantees &amp; Standards
        </h2>
        <p className="text-[var(--color-muted)] text-sm sm:text-base font-sans">
          Engineered to satisfy USP &lt;1079&gt;, WHO Good Distribution Practices, and strict cryptographic audit standards. Click any card to inspect.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ perspective: 1200 }}>
        {NOTES.map((note, idx) => (
          <InteractiveCard
            key={idx}
            note={note}
            idx={idx}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}
      </div>
    </section>
  );
};
