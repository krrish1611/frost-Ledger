import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import { AsciiImage } from './AsciiImage';
import { Cpu, Thermometer, ShieldCheck, Radio, ChevronRight, Layers, Zap, Play, ShieldAlert } from 'lucide-react';

// Playable Component 1: ESP32 Hardware Ed25519 Signing Enclave
const Pillar1Playable: React.FC = () => {
  const [sampleType, setSampleType] = useState<'nominal' | 'excursion' | 'shock'>('nominal');
  const [isTampered, setIsTampered] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [verifiedCount, setVerifiedCount] = useState(1);

  const samples = {
    nominal: { temp: '4.2°C', mkt: '3.8°C', shock: '0.2G', hash: '0x8f2a...1e40', sig: '0x4b71...a93f' },
    excursion: { temp: '12.8°C', mkt: '9.4°C', shock: '0.4G', hash: '0xd4a1...99bc', sig: '0x7e29...bf01' },
    shock: { temp: '5.1°C', mkt: '4.0°C', shock: '3.4G', hash: '0xc107...fe32', sig: '0x1a88...42c9' },
  };

  const current = samples[sampleType];

  const handleSign = () => {
    setIsSigning(true);
    setIsTampered(false);
    setTimeout(() => {
      setIsSigning(false);
      setVerifiedCount((c) => c + 1);
    }, 300);
  };

  const handleTamper = () => {
    setIsTampered(!isTampered);
  };

  return (
    <div className="space-y-2.5 font-mono text-xs select-none">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-muted)]">SENSOR TELEMETRY SAMPLE:</span>
        <div className="flex gap-1">
          {(['nominal', 'excursion', 'shock'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setSampleType(type);
                setIsTampered(false);
              }}
              className={`px-2 py-0.5 rounded text-[9px] uppercase transition-all cursor-pointer ${
                sampleType === type
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40 font-bold'
                  : 'text-neutral-400 hover:text-white bg-white/[0.03] border border-white/[0.06]'
              }`}
            >
              {type === 'nominal' ? '4.2°C Norm' : type === 'excursion' ? '12.8°C Spike' : '3.4G Shock'}
            </button>
          ))}
        </div>
      </div>

      {/* Packet Hex & Signature Terminal */}
      <div className="p-2.5 rounded-lg bg-[#0b0c10] border border-white/[0.08] space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">RFC 8785 CANONICAL DIGEST</span>
          <span className="text-neutral-300">{isTampered ? '0xTAMPERED_BYTE_42' : current.hash}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">ED25519 HARDWARE SIG</span>
          <span className={isTampered ? 'text-[var(--color-critical)] font-bold' : 'text-[var(--color-accent)] font-semibold'}>
            {isTampered ? '0xINVALID_SIG_MISMATCH' : current.sig}
          </span>
        </div>
        <div
          className={`p-1.5 rounded text-[10px] font-semibold flex items-center justify-between transition-colors ${
            isTampered
              ? 'bg-[var(--color-critical)]/15 text-[var(--color-critical)] border border-[var(--color-critical)]/30'
              : 'bg-[var(--color-pass)]/15 text-[var(--color-pass)] border border-[var(--color-pass)]/30'
          }`}
        >
          <span>{isTampered ? '✗ SIGNATURE REJECTED · TAMPER DETECTED' : '✓ HARDWARE ENCLAVE VERIFIED'}</span>
          <span>{isTampered ? 'BIT MISMATCH' : `${verifiedCount} VALID`}</span>
        </div>
      </div>

      {/* Interactive Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          onClick={handleSign}
          disabled={isSigning}
          className="px-2.5 py-1.5 rounded-lg bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
        >
          <Zap size={11} className={isSigning ? 'animate-spin' : ''} />
          {isSigning ? 'SIGNING...' : '⚡ RE-SIGN PACKET'}
        </button>
        <button
          onClick={handleTamper}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            isTampered
              ? 'bg-white/10 text-white border border-white/20'
              : 'bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/30 text-[var(--color-critical)] hover:bg-[var(--color-critical)]/20'
          }`}
        >
          <ShieldAlert size={11} />
          {isTampered ? 'RESTORE ORIGINAL' : '⚠️ TAMPER 1 BYTE'}
        </button>
      </div>
    </div>
  );
};

// Playable Component 2: Arrhenius Shelf-Life Kinetics & MKT Simulator
const Pillar2Playable: React.FC = () => {
  const [temp, setTemp] = useState(8.5);
  const [duration, setDuration] = useState(12);

  // Arrhenius kinetic rate multiplier: doubles every ~3.5°C above 5°C
  const deltaT = Math.max(-5, temp - 5);
  const kRel = Math.max(0.1, Math.pow(1.85, deltaT / 3.0));
  const potencyLoss = Math.min(65, (kRel - 0.5) * duration * 0.18);
  const potency = Math.max(35, Math.min(100, 100 - (potencyLoss > 0 ? potencyLoss : 0)));
  const isExcursion = temp > 8.0 || potency < 85;

  return (
    <div className="space-y-2.5 font-mono text-xs select-none">
      {/* Sliders */}
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-[var(--color-muted)]">STORAGE TEMPERATURE:</span>
            <span className={`font-bold ${temp > 8 ? 'text-[var(--color-critical)]' : 'text-[#e8b14c]'}`}>
              {temp.toFixed(1)}°C {temp > 8 ? '(EXCURSION)' : '(WHO 2-8°C)'}
            </span>
          </div>
          <input
            type="range"
            min="-2"
            max="18"
            step="0.5"
            value={temp}
            onChange={(e) => setTemp(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#1f1f23] rounded appearance-none cursor-pointer accent-[#e8b14c]"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-[var(--color-muted)]">TRANSIT EXPOSURE:</span>
            <span className="text-white font-bold">{duration} HOURS</span>
          </div>
          <input
            type="range"
            min="2"
            max="48"
            step="2"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#1f1f23] rounded appearance-none cursor-pointer accent-[#e8b14c]"
          />
        </div>
      </div>

      {/* Physics Calculation Display */}
      <div className="p-2 rounded-lg bg-[#0b0c10] border border-white/[0.08] space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">ARRHENIUS RATE MULTIPLIER (k/k₀):</span>
          <span className="text-[#e8b14c] font-bold">{kRel.toFixed(2)}× BASELINE</span>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[var(--color-muted)]">REMAINING BATCH POTENCY:</span>
            <span
              className={`font-bold ${
                potency > 92 ? 'text-[var(--color-pass)]' : potency > 80 ? 'text-[#e8b14c]' : 'text-[var(--color-critical)]'
              }`}
            >
              {potency.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#1b1b20] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                potency > 92 ? 'bg-[var(--color-pass)]' : potency > 80 ? 'bg-[#e8b14c]' : 'bg-[var(--color-critical)]'
              }`}
              style={{ width: `${potency}%` }}
            />
          </div>
        </div>
        <div
          className={`p-1.5 rounded text-[10px] font-semibold flex items-center justify-between ${
            isExcursion
              ? 'bg-[var(--color-critical)]/15 text-[var(--color-critical)] border border-[var(--color-critical)]/30'
              : 'bg-[var(--color-pass)]/15 text-[var(--color-pass)] border border-[var(--color-pass)]/30'
          }`}
        >
          <span>{isExcursion ? '⚠️ CRITICAL MKT EXCURSION' : '✓ USP <1079> COMPLIANT'}</span>
          <span>{(kRel * duration * 0.08).toFixed(1)}d SHELF LOSS</span>
        </div>
      </div>
    </div>
  );
};

// Playable Component 3: Polygon Amoy On-Chain Merkle Tree Verifier
const Pillar3Playable: React.FC = () => {
  const [selectedBatch, setSelectedBatch] = useState(1);
  const [isCorrupted, setIsCorrupted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const batches = [
    { id: 0, label: 'Batch #41', hash: '0x9a31...4e81' },
    { id: 1, label: 'Batch #42', hash: '0x4b71...a93f' },
    { id: 2, label: 'Batch #43', hash: '0x8f2c...d41e' },
    { id: 3, label: 'Batch #44', hash: '0x3e9a...7b22' },
  ];

  const handleTamper = () => {
    setIsCorrupted(!isCorrupted);
  };

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
    }, 350);
  };

  return (
    <div className="space-y-2.5 font-mono text-xs select-none">
      <div className="text-[10px] text-[var(--color-muted)] flex justify-between items-center">
        <span>SELECT BATCH LEAF TO PROVE ON-CHAIN:</span>
        <span className="text-[var(--color-pass)]">POLYGON AMOY #49281</span>
      </div>

      {/* 4 Leaf Selector */}
      <div className="grid grid-cols-4 gap-1.5">
        {batches.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBatch(b.id)}
            className={`p-1 rounded text-center transition-all cursor-pointer ${
              selectedBatch === b.id
                ? 'bg-[var(--color-pass)]/20 text-[var(--color-pass)] border border-[var(--color-pass)]/50 font-bold'
                : 'bg-white/[0.03] text-neutral-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            <div className="text-[9px]">{b.label}</div>
            <div className="text-[8px] text-[var(--color-muted)] truncate">{b.hash}</div>
          </button>
        ))}
      </div>

      {/* Merkle Proof Tree Path */}
      <div className="p-2.5 rounded-lg bg-[#0b0c10] border border-white/[0.08] space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">LEAF HASH (BATCH #{selectedBatch + 41}):</span>
          <span className="text-white">{isCorrupted && selectedBatch === 1 ? '0xCORRUPT_LEAF_DATA' : batches[selectedBatch].hash}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">POLYGON MERKLE ROOT:</span>
          <span className={isCorrupted ? 'text-[var(--color-critical)] font-bold' : 'text-[var(--color-pass)] font-bold'}>
            {isCorrupted ? '0xBAD_ROOT_MISMATCH' : '0x8492f1b4029a1e0b5c77'}
          </span>
        </div>
        <div
          className={`p-1.5 rounded font-semibold flex items-center justify-between ${
            isCorrupted
              ? 'bg-[var(--color-critical)]/15 text-[var(--color-critical)] border border-[var(--color-critical)]/30'
              : 'bg-[var(--color-pass)]/15 text-[var(--color-pass)] border border-[var(--color-pass)]/30'
          }`}
        >
          <span>{isCorrupted ? '✗ ROOT MISMATCH · FRAUD DETECTED' : '✓ MERKLE INCLUSION PROOF CONFIRMED'}</span>
          <span>{isCorrupted ? 'REJECTED' : 'IMMUTABLE'}</span>
        </div>
      </div>

      {/* Interactive Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="px-2.5 py-1.5 rounded-lg bg-[var(--color-pass)]/15 border border-[var(--color-pass)]/40 text-[var(--color-pass)] hover:bg-[var(--color-pass)]/25 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
        >
          <ShieldCheck size={11} className={isVerifying ? 'animate-spin' : ''} />
          {isVerifying ? 'VERIFYING...' : '🔍 VERIFY ZK INCLUSION'}
        </button>
        <button
          onClick={handleTamper}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            isCorrupted
              ? 'bg-white/10 text-white border border-white/20'
              : 'bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/30 text-[var(--color-critical)] hover:bg-[var(--color-critical)]/20'
          }`}
        >
          {isCorrupted ? 'RESTORE DATA' : '⚡ TAMPER BATCH DATA'}
        </button>
      </div>
    </div>
  );
};

// Playable Component 4: River ML Streaming Anomaly Detection Sandbox
const Pillar4Playable: React.FC = () => {
  const [anomalyMode, setAnomalyMode] = useState<'normal' | 'spike' | 'compressor'>('normal');

  const modes = {
    normal: { score: 0.05, leadTime: 'NO EXCURSION FORECAST', color: '#5bc98c', status: 'NOMINAL FLOW' },
    spike: { score: 0.88, leadTime: '7.8 MIN ADVANCE WARNING', color: '#e8b14c', status: 'THERMAL SPIKE' },
    compressor: { score: 0.95, leadTime: '12.4 MIN ADVANCE WARNING', color: '#e0574c', status: 'COMPRESSOR STALL' },
  };

  const current = modes[anomalyMode];

  return (
    <div className="space-y-2.5 font-mono text-xs select-none">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-muted)]">INJECT STREAMING EVENT:</span>
        <span className="text-[#9d7bff]">RIVER ONLINE ML</span>
      </div>

      {/* Event Trigger Buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setAnomalyMode('normal')}
          className={`p-1 rounded text-center transition-all cursor-pointer ${
            anomalyMode === 'normal'
              ? 'bg-[var(--color-pass)]/20 text-[var(--color-pass)] border border-[var(--color-pass)]/50 font-bold'
              : 'bg-white/[0.03] text-neutral-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          <div className="text-[9px]">NORMAL</div>
          <div className="text-[8px] text-[var(--color-muted)]">0.05 score</div>
        </button>
        <button
          onClick={() => setAnomalyMode('spike')}
          className={`p-1 rounded text-center transition-all cursor-pointer ${
            anomalyMode === 'spike'
              ? 'bg-[#e8b14c]/20 text-[#e8b14c] border border-[#e8b14c]/50 font-bold'
              : 'bg-white/[0.03] text-neutral-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          <div className="text-[9px]">TEMP SPIKE</div>
          <div className="text-[8px] text-[var(--color-muted)]">+4.8°C spike</div>
        </button>
        <button
          onClick={() => setAnomalyMode('compressor')}
          className={`p-1 rounded text-center transition-all cursor-pointer ${
            anomalyMode === 'compressor'
              ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/50 font-bold'
              : 'bg-white/[0.03] text-neutral-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          <div className="text-[9px]">CUT POWER</div>
          <div className="text-[8px] text-[var(--color-muted)]">Motor stall</div>
        </button>
      </div>

      {/* Stream Status and Anomaly Score */}
      <div className="p-2.5 rounded-lg bg-[#0b0c10] border border-white/[0.08] space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">HALF-SPACE TREES ANOMALY SCORE:</span>
          <span style={{ color: current.color }} className="font-bold">
            {(current.score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-[#1b1b20] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{ width: `${current.score * 100}%`, backgroundColor: current.color }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-muted)]">EARLY WARNING ADVISORY:</span>
          <span className="text-white font-semibold">{current.leadTime}</span>
        </div>
        <div className="p-1.5 rounded text-[10px] font-semibold bg-[#9d7bff]/10 border border-[#9d7bff]/30 text-[#c4b5fd] flex items-center justify-between">
          <span>🛡️ CORE LEDGER UNMUTATED</span>
          <span>ISOLATION RULE ENFORCED</span>
        </div>
      </div>
    </div>
  );
};

interface ModuleCard {
  id: string;
  stepNum: string;
  tag: string;
  title: string;
  subtitle: string;
  specs: string[];
  icon: React.ReactNode;
  accent: string;
  footerLeft: string;
  footerRight: string;
}

const CARDS: ModuleCard[] = [
  {
    id: '01',
    stepNum: '01',
    tag: 'PILLAR 01 // IOT HARDWARE',
    title: 'ESP32 Firmware & Ed25519 Signing',
    subtitle:
      'Every sensor reading is cryptographically signed at the physical edge before transmission over Wi-Fi or cellular networks.',
    specs: [
      'RFC 8785 Canonical JSON serialization ensures bit-level deterministic hashing',
      'Hardware-isolated Ed25519 private key eliminates credential exfiltration',
      'Onboard flash ring buffer retains 48h offline telemetry during transport blackout',
    ],
    icon: <Cpu size={20} className="text-[var(--color-accent)]" />,
    accent: '#7df9c4',
    footerLeft: 'STACK: C++ / PLATFORMIO / ESP32',
    footerRight: 'HARDWARE SIGNED',
  },
  {
    id: '02',
    stepNum: '02',
    tag: 'PILLAR 02 // PHARMA SCIENCE',
    title: 'Arrhenius Shelf-Life Kinetics & MKT',
    subtitle:
      'Biochemical thermal degradation calculated strictly via deterministic physics and USP <1079> standards, not static thresholds.',
    specs: [
      'Continuous Mean Kinetic Temperature (MKT) integration across journey',
      'Exact Arrhenius activation energy kinetics (Ea = 83.14 kJ/mol)',
      'Real-time remaining shelf life degradation curves calculated per batch profile',
    ],
    icon: <Thermometer size={20} className="text-[#e8b14c]" />,
    accent: '#e8b14c',
    footerLeft: 'STANDARD: USP <1079> / WHO GMP',
    footerRight: 'DETERMINISTIC MATH',
  },
  {
    id: '03',
    stepNum: '03',
    tag: 'PILLAR 03 // BLOCKCHAIN',
    title: 'Polygon Amoy On-Chain Merkle Anchors',
    subtitle:
      'Cryptographic Merkle roots of batch telemetry are anchored to smart contracts for undisputed regulatory and insurer audits.',
    specs: [
      'Batch Merkle root commitments committed to Polygon Amoy smart contracts',
      'PostgreSQL append-only triggers enforce zero database tampering on-premise',
      'Instant zero-knowledge verification for customs without revealing trade secrets',
    ],
    icon: <ShieldCheck size={20} className="text-[var(--color-pass)]" />,
    accent: '#5bc98c',
    footerLeft: 'NETWORK: POLYGON AMOY L2',
    footerRight: 'IMMUTABLE AUDIT',
  },
  {
    id: '04',
    stepNum: '04',
    tag: 'PILLAR 04 // ADVISORY LAYER',
    title: 'Isolated Streaming Telemetry Advisory',
    subtitle:
      'Online ML analyzes telemetry trends for early warning while strictly isolated from mutating the official ledger.',
    specs: [
      'River online streaming HalfSpaceTrees & LOF anomaly detection models',
      'Predictive thermal rise early warnings up to 10 minutes before excursion breach',
      'Strict core rule: Advisory layer never mutates, edits, or alters official records',
    ],
    icon: <Radio size={20} className="text-[#9d7bff]" />,
    accent: '#9d7bff',
    footerLeft: 'PIPELINE: FASTAPI + RIVER ML',
    footerRight: 'ISOLATED ADVISORY',
  },
];

export const SpiralGallery: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Staged shuffle progress:
  // - 0.00 to 0.08: Pillar 1 stable in focus
  // - 0.08 to 0.32: Smooth shuffle from Pillar 1 -> Pillar 2
  // - 0.32 to 0.40: Pillar 2 stable in focus
  // - 0.40 to 0.64: Smooth shuffle from Pillar 2 -> Pillar 3
  // - 0.64 to 0.72: Pillar 3 stable in focus
  // - 0.72 to 0.94: Smooth shuffle from Pillar 3 -> Pillar 4
  // - 0.94 to 1.00: Pillar 4 stable in focus (all 4 pillars completed)
  const activeFloat = useTransform(
    scrollYProgress,
    [0, 0.08, 0.32, 0.40, 0.64, 0.72, 0.94, 1.0],
    [0, 0, 1, 1, 2, 2, 3, 3]
  );

  // Snappy, agile spring physics for faster, butter-smooth card transitions
  const smoothActiveFloat = useSpring(activeFloat, {
    stiffness: 150,
    damping: 20,
    mass: 0.35,
    restDelta: 0.001,
  });

  const STEP_PROGRESS = [0.04, 0.36, 0.68, 0.97];

  // Update discrete active card index for indicators
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (latest) => {
      let target = 0;
      if (latest < 0.20) target = 0;
      else if (latest < 0.52) target = 1;
      else if (latest < 0.83) target = 2;
      else target = 3;
      setActiveCardIndex(target);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  // Snappy smooth scroll animation for button navigation (380ms cubic ease-out)
  const smoothScrollTo = (targetY: number, duration: number = 380) => {
    const startY = window.scrollY;
    const diff = targetY - startY;
    if (Math.abs(diff) < 2) return;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Snappy cubic ease-out curve
      const ease = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startY + diff * ease);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  const handleStepClick = (index: number) => {
    setActiveCardIndex(index);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const height = containerRef.current.offsetHeight;
      const maxScroll = height - window.innerHeight;
      const targetScroll = top + STEP_PROGRESS[index] * maxScroll;
      smoothScrollTo(targetScroll, 380);
    }
  };

  return (
    <div
      ref={containerRef}
      id="architecture"
      className="relative w-full h-[260vh] bg-[var(--color-bg)]"
    >
      {/* Sticky Viewport Stage */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 pt-16 pb-4">
        <div className="w-full max-w-[1260px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* Left Column: Architecture Context & ASCII Visualizer */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-3 lg:pl-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border hairline bg-[var(--color-panel)] text-[var(--color-accent)] font-mono text-xs uppercase tracking-wider shadow-sm">
              <Layers size={12} />
              ARCHITECTURE // 4 CORE PILLARS
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              The Four Pillars of FrostLedger
            </h2>

            <p className="text-[var(--color-muted)] text-xs sm:text-sm max-w-md font-sans leading-relaxed">
              Engineered for pharmaceutical compliance and zero-tamper truth. A deterministic architecture where edge hardware, kinetic mathematics, and blockchain anchors meet.
            </p>

            {/* ASCII Hologram Seal - Enriched, Enlarged & Shifted Right toward the deck */}
            <div className="pt-2 lg:translate-x-7 sm:translate-x-3 transition-transform duration-300 flex flex-col items-center lg:items-start">
              <AsciiImage width={330} height={330} />

              {/* Stepper Progress Bar */}
              <div className="w-full max-w-[355px] flex items-center justify-between gap-2 pt-3">
                {CARDS.map((card, idx) => (
                  <button
                    key={card.id}
                    onClick={() => handleStepClick(idx)}
                    className={`flex-1 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      activeCardIndex === idx
                        ? 'bg-[var(--color-accent)] shadow-[0_0_10px_var(--color-accent)]'
                        : activeCardIndex > idx
                        ? 'bg-neutral-600'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }`}
                    title={`View Pillar ${idx + 1}: ${card.title}`}
                  />
                ))}
              </div>

              <div className="font-mono text-[11px] text-[var(--color-muted)] flex items-center gap-2 pt-2">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      activeCardIndex === 3 ? 'bg-[var(--color-pass)]' : 'bg-[var(--color-accent)]'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      activeCardIndex === 3 ? 'bg-[var(--color-pass)]' : 'bg-[var(--color-accent)]'
                    }`}
                  />
                </span>
                {activeCardIndex === 3 ? (
                  <span className="text-[var(--color-pass)] font-semibold">
                    ALL 4 PILLARS VERIFIED · SCROLL DOWN FOR STANDARDS ↓
                  </span>
                ) : (
                  <span>PILLAR {activeCardIndex + 1} OF 4 ACTIVE · SCROLL TO SHUFFLE</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Stacked Card Stage - Moved downwards with lg:pt-[88px] to align with neighbour */}
          <div className="lg:col-span-7 flex flex-col items-center w-full lg:pt-[88px]">

            {/* Interactive Step Switcher Header */}
            <div className="w-full max-w-[580px] flex items-center justify-between mb-3 border-b border-white/[0.08] pb-2 px-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {CARDS.map((card, idx) => (
                  <button
                    key={card.id}
                    onClick={() => handleStepClick(idx)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all duration-200 cursor-pointer ${
                      activeCardIndex === idx
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40 font-bold shadow-[0_0_12px_rgba(125,249,196,0.12)]'
                        : 'text-[var(--color-muted)] hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    0{idx + 1} {idx === 0 ? 'HARDWARE' : idx === 1 ? 'KINETICS' : idx === 2 ? 'ANCHORS' : 'ADVISORY'}
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs text-[var(--color-muted)] hidden sm:inline">
                {CARDS[activeCardIndex].footerRight}
              </span>
            </div>

            {/* Card Deck Stage with 3D perspective - Increased size */}
            <div className="relative w-full max-w-[580px] h-[465px] [perspective:1200px]">
              {shouldReduceMotion ? (
                // Reduced motion fallback
                <StaticCard card={CARDS[activeCardIndex]} />
              ) : (
                // Smooth 3D Tactile Card Deck Shuffle with Spring Physics
                <div className="relative w-full h-full">
                  {CARDS.map((card, index) => {
                    return (
                      <StackedCard
                        key={card.id}
                        card={card}
                        index={index}
                        total={CARDS.length}
                        activeFloat={smoothActiveFloat}
                        isActive={activeCardIndex === index}
                        onSelect={() => handleStepClick(index)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Navigation Control Strip */}
            <div className="w-full max-w-[580px] flex items-center justify-between pt-3 mt-1 border-t border-white/[0.08] text-xs font-mono">
              <button
                onClick={() => handleStepClick(Math.max(0, activeCardIndex - 1))}
                disabled={activeCardIndex === 0}
                className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] bg-[var(--color-panel)] text-[var(--color-muted)] hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
              >
                ← PREV PILLAR
              </button>
              <div className="text-[11px] text-[var(--color-muted)]">
                {activeCardIndex === 3 ? (
                  <span className="text-[var(--color-accent)] font-semibold">
                    SHUFFLE COMPLETE · SCROLL DOWN TO CONTINUE ↓
                  </span>
                ) : (
                  'CLICK CARDS OR SCROLL TO SHUFFLE'
                )}
              </div>
              <button
                onClick={() => handleStepClick(Math.min(CARDS.length - 1, activeCardIndex + 1))}
                disabled={activeCardIndex === CARDS.length - 1}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-panel)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 hover:border-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                NEXT PILLAR →
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

interface StackedCardProps {
  card: ModuleCard;
  index: number;
  total: number;
  activeFloat: any;
  isActive: boolean;
  onSelect: () => void;
}

const StackedCard: React.FC<StackedCardProps> = ({ card, index, activeFloat, isActive, onSelect }) => {
  const [cardMode, setCardMode] = useState<'specs' | 'lab'>('specs');

  // continuous diff between this card's index and spring-smoothed active float progress
  const diff = useTransform(activeFloat, (active: number) => index - active);

  // Dynamic 3D peel & shuffle transforms with tactile spring continuity
  const x = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Moves smoothly to the RIGHT as it lifts off the deck
      return `${Math.min(36, Math.abs(d) * 36)}px`;
    }
    // Cards in deck stay strictly centered
    return '0px';
  });

  const y = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Lifts cleanly UP off the deck
      return `${d * 140}px`;
    }
    // Cards stacked behind step down smoothly to show deck depth
    return `${Math.min(d * 12, 36)}px`;
  });

  const rotateZ = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Subtle clockwise tilt as lifted away
      return `${Math.min(3.5, Math.abs(d) * 3.5)}deg`;
    }
    return '0deg';
  });

  const rotateY = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Subtle 3D perspective turn
      return `${Math.min(5, Math.abs(d) * 5)}deg`;
    }
    return '0deg';
  });

  const scale = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Lifts slightly toward user before fading
      return Math.max(0.97, 1 + d * 0.02);
    }
    // Cards behind get slightly smaller
    return Math.max(0.90, 1 - d * 0.035);
  });

  const opacity = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Solid until d = -0.45 (lifted cleanly away), then dissolves cleanly
      if (d > -0.45) return 1;
      return Math.max(0, (d + 0.95) / 0.5);
    }
    // Cards on the deck are 100% solid opaque to eliminate text bleed
    return 1;
  });

  // Content opacity: title, subtitle, and specs only reveal when stepping to the front (d <= 0.15)
  // This completely eliminates ghost text bleeding from stacked cards behind
  const contentOpacity = useTransform(diff, (d: number) => {
    if (d > 0.15) return 0;
    if (d > 0) return (0.15 - d) / 0.15;
    return 1;
  });

  const zIndex = useTransform(diff, (d: number) => {
    if (d < 0) {
      // Stay above while peeling off
      return d > -0.85 ? 50 : 0;
    }
    // Natural descending order: card 0 = 40, card 1 = 35, card 2 = 30, card 3 = 25
    return Math.round(40 - index * 5);
  });

  const pointerEvents = useTransform(diff, (d: number) => {
    if (d < -0.15) return 'none';
    return 'auto';
  });

  return (
    <motion.div
      onClick={onSelect}
      className={`absolute inset-0 p-6 sm:p-7 rounded-2xl border flex flex-col justify-between select-none glow-accent cursor-pointer transition-all duration-300 ${
        isActive
          ? 'border-[var(--color-accent)]/50 ring-1 ring-[var(--color-accent)]/20 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(125,249,196,0.1)]'
          : 'border-white/[0.08] shadow-[0_15px_40px_rgba(0,0,0,0.65)] hover:border-white/20'
      }`}
      style={{
        x,
        y,
        rotateZ,
        rotateY,
        scale,
        opacity,
        zIndex,
        pointerEvents,
        backgroundColor: '#101116',
      }}
    >
      <div>
        {/* Top Tag & Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-muted)]">
            {card.icon}
            <span className="tracking-wider">{card.tag}</span>
          </div>
          <span
            className="font-mono text-[11px] px-2.5 py-0.5 rounded-md border font-semibold"
            style={{
              color: card.accent,
              borderColor: `${card.accent}40`,
              backgroundColor: `${card.accent}15`,
            }}
          >
            {card.footerRight}
          </span>
        </div>

        {/* Inner Content - Faded out while card is waiting in stack, blooms in as it reaches front */}
        <motion.div style={{ opacity: contentOpacity }}>
          {/* Title */}
          <h3 className="card-title text-xl sm:text-2xl text-white mb-1.5 leading-snug tracking-tight">
            {card.title}
          </h3>

          {/* Subtitle */}
          <p className="text-[var(--color-muted)] text-xs mb-3 leading-relaxed font-sans line-clamp-2">
            {card.subtitle}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCardMode('specs');
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                cardMode === 'specs'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[var(--color-muted)] hover:text-white border border-transparent'
              }`}
            >
              ARCHITECTURE SPECS
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCardMode('lab');
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                cardMode === 'lab'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/40 shadow-[0_0_12px_rgba(125,249,196,0.15)]'
                  : 'text-[var(--color-accent)]/80 hover:text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/10'
              }`}
            >
              <Play size={9} className="fill-[var(--color-accent)]" />
              🎮 PLAYABLE LAB // TEST LIVE
            </button>
          </div>

          {/* Either Specs List or Playable Lab */}
          {cardMode === 'specs' ? (
            <div className="space-y-2.5 font-mono text-xs">
              {card.specs.map((spec, sIdx) => (
                <div
                  key={sIdx}
                  className="flex items-start gap-2.5 text-neutral-300 py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <ChevronRight
                    size={14}
                    className="shrink-0 mt-0.5"
                    style={{ color: card.accent }}
                  />
                  <span className="leading-relaxed">{spec}</span>
                </div>
              ))}
            </div>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              {card.id === '01' && <Pillar1Playable />}
              {card.id === '02' && <Pillar2Playable />}
              {card.id === '03' && <Pillar3Playable />}
              {card.id === '04' && <Pillar4Playable />}
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer Rule & Metadata */}
      <motion.div
        style={{ opacity: contentOpacity }}
        className="pt-3 border-t border-white/[0.08] flex items-center justify-between font-mono text-[11px] text-[var(--color-muted)]"
      >
        <span>{card.footerLeft}</span>
        <span style={{ color: card.accent }} className="font-bold tracking-wide">
          VERIFIED ARCHITECTURE
        </span>
      </motion.div>
    </motion.div>
  );
};

const StaticCard: React.FC<{ card: ModuleCard }> = ({ card }) => {
  const [cardMode, setCardMode] = useState<'specs' | 'lab'>('specs');

  return (
    <div className="w-full h-full p-6 sm:p-7 rounded-2xl border border-white/[0.08] bg-[#101116] shadow-2xl flex flex-col justify-between select-none glow-accent">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-muted)]">
            {card.icon}
            <span className="tracking-wider">{card.tag}</span>
          </div>
          <span
            className="font-mono text-[11px] px-2.5 py-0.5 rounded-md border font-semibold"
            style={{
              color: card.accent,
              borderColor: `${card.accent}40`,
              backgroundColor: `${card.accent}15`,
            }}
          >
            {card.footerRight}
          </span>
        </div>

        <h3 className="card-title text-xl sm:text-2xl text-white mb-1.5 leading-snug tracking-tight">
          {card.title}
        </h3>

        <p className="text-[var(--color-muted)] text-xs mb-3 leading-relaxed font-sans line-clamp-2">
          {card.subtitle}
        </p>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setCardMode('specs')}
            className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
              cardMode === 'specs'
                ? 'bg-white/10 text-white font-semibold border border-white/20'
                : 'text-[var(--color-muted)] hover:text-white border border-transparent'
            }`}
          >
            ARCHITECTURE SPECS
          </button>
          <button
            onClick={() => setCardMode('lab')}
            className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              cardMode === 'lab'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/40 shadow-[0_0_12px_rgba(125,249,196,0.15)]'
                : 'text-[var(--color-accent)]/80 hover:text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/10'
            }`}
          >
            <Play size={9} className="fill-[var(--color-accent)]" />
            🎮 PLAYABLE LAB // TEST LIVE
          </button>
        </div>

        {cardMode === 'specs' ? (
          <div className="space-y-2.5 font-mono text-xs">
            {card.specs.map((spec, sIdx) => (
              <div
                key={sIdx}
                className="flex items-start gap-2.5 text-neutral-300 py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <ChevronRight
                  size={14}
                  className="shrink-0 mt-0.5"
                  style={{ color: card.accent }}
                />
                <span className="leading-relaxed">{spec}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {card.id === '01' && <Pillar1Playable />}
            {card.id === '02' && <Pillar2Playable />}
            {card.id === '03' && <Pillar3Playable />}
            {card.id === '04' && <Pillar4Playable />}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between font-mono text-[11px] text-[var(--color-muted)]">
        <span>{card.footerLeft}</span>
        <span style={{ color: card.accent }} className="font-bold tracking-wide">
          VERIFIED ARCHITECTURE
        </span>
      </div>
    </div>
  );
};
