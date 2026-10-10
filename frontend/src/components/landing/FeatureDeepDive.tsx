import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, useReducedMotion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Check, Copy, Terminal, Sliders, GitBranch, Sparkles, ChevronRight, Activity, Zap, Play, ShieldCheck } from 'lucide-react';

const SCANNER_FEATURES = [
  { name: 'MKT_THERMAL_INTEGRATION', val: 0.94, unit: '3.8°C avg', status: 'PASS', detail: 'Mean Kinetic Temperature within USP <1079> limits' },
  { name: 'MEMS_VIBRATION_SHOCK', val: 0.28, unit: '0.4 G', status: 'PASS', detail: 'MEMS accelerometer below 2G threshold' },
  { name: 'DELTA_T_MAX_EXCURSION', val: 0.88, unit: '+4.2°C', status: 'ALERT', detail: 'Temperature delta approaching 5°C excursion limit' },
  { name: 'SEAL_LUX_DEGRADATION', val: 0.12, unit: '0.04 lux', status: 'PASS', detail: 'Light exposure within photodegradation safety' },
  { name: 'BATTERY_VOLTAGE_SAG', val: 0.35, unit: '3.82 V', status: 'PASS', detail: 'Voltage above 3.3V minimum operating threshold' },
  { name: 'RF_RSSI_ATTENUATION', val: 0.52, unit: '-68 dBm', status: 'PASS', detail: 'Signal strength sufficient for reliable transmission' },
  { name: 'TIMESTAMP_MONOTONICITY', val: 0.99, unit: '<2 ms', status: 'PASS', detail: 'Clock drift within NTP sync tolerance' },
  { name: 'REPLAY_SUFFIX_DIVERGENCE', val: 0.82, unit: 'Delt=0.18', status: 'ALERT', detail: 'Suffix divergence suggests potential replay attack vector' },
  { name: 'ED25519_KEY_VALIDITY', val: 1.0, unit: 'VERIFIED', status: 'PASS', detail: 'Hardware-isolated Ed25519 key pair validated' },
  { name: 'GEO_FENCE_PROXIMITY', val: 0.18, unit: '0.04 km', status: 'PASS', detail: 'Device within authorized geofence boundary' },
];

const SHAP_FEATURES = [
  { name: 'delta_t_thermal_spike', weight: 0.42, dir: '+', desc: 'Sustained temperature above threshold' },
  { name: 'refrigeration_duty_cycle', weight: 0.24, dir: '+', desc: 'Compressor cutoff duration anomalous' },
  { name: 'mkt_rate_of_change', weight: 0.16, dir: '+', desc: 'Accelerated Mean Kinetic Temperature accumulation' },
  { name: 'mems_shock_correlation', weight: 0.11, dir: '+', desc: 'Mechanical shock preceded thermal rise' },
  { name: 'relative_humidity_shift', weight: 0.07, dir: '+', desc: 'Condensation risk index elevated' },
];

const JSON_PAYLOAD = `{
  "shipment_id": "shipment-pharma-7712",
  "device_id": "esp32-node-09",
  "profile": "WHO_VACCINE_TYPE_2A",
  "ed25519_signature": "0x4b719a02ce...",
  "excursion_event": {
    "classification": "THERMAL_EXCURSION_COMPRESSOR_FAIL",
    "failing_invariant": "INV_MAX_TEMP_8C",
    "peak_temp_c": 12.28,
    "delta_celsius": 4.28,
    "mkt_accumulated_c": 9.42,
    "duration_seconds": 380
  },
  "blockchain_anchor": {
    "merkle_root": "0x8492f1b4029a1e0b5c77",
    "polygon_amoy_tx": "0x9727...ed37",
    "status": "ANCHORED_IMMUTABLE"
  }
}`;

// Interactive Tooltip for bar hover
const BarTooltip: React.FC<{
  item: (typeof SCANNER_FEATURES)[0];
  isVisible: boolean;
  mouseX: number;
}> = ({ item, isVisible, mouseX }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50 bottom-full mb-2 pointer-events-none"
        style={{ left: `${Math.min(80, Math.max(10, mouseX))}%`, transform: 'translateX(-50%)' }}
      >
        <div className="px-3 py-2 rounded-lg bg-[#1a1a1f] border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-[10px] font-mono whitespace-nowrap">
          <div className="text-white font-semibold mb-1">{item.name}</div>
          <div className="text-[var(--color-muted)]">{item.detail}</div>
          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/[0.06]">
            <span className="text-[var(--color-accent)]">VALUE: {(item.val * 100).toFixed(0)}%</span>
            <span className={item.status === 'ALERT' ? 'text-[var(--color-critical)]' : 'text-[var(--color-pass)]'}>
              {item.status}
            </span>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Interactive Scanner Bar with hover, pulse, and live shimmer
const InteractiveScannerBar: React.FC<{
  item: (typeof SCANNER_FEATURES)[0];
  idx: number;
  shouldReduceMotion: boolean | null;
  isScanning: boolean;
}> = ({ item, idx, shouldReduceMotion: _shouldReduceMotion, isScanning }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mouseX, setMouseX] = useState(50);
  const isAlert = item.status === 'ALERT';
  const barRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    setMouseX(((e.clientX - rect.left) / rect.width) * 100);
  };

  return (
    <div
      ref={barRef}
      className="space-y-1 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      <BarTooltip item={item} isVisible={isHovered} mouseX={mouseX} />
      <div className="flex justify-between items-center text-[11px]">
        <span className={`font-mono truncate max-w-[180px] sm:max-w-none transition-colors duration-200 ${isHovered ? 'text-white' : 'text-neutral-300'}`}>
          {item.name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-muted)] text-[10px]">{item.unit}</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-all duration-200 ${
              isAlert
                ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/40 shadow-[0_0_8px_rgba(224,87,76,0.3)]'
                : 'bg-[var(--color-pass)]/15 text-[var(--color-pass)]'
            } ${isHovered ? 'scale-110' : ''}`}
          >
            {item.status}
          </span>
        </div>
      </div>
      <div className={`h-1.5 w-full bg-[#1c1c20] rounded-full overflow-hidden relative cursor-pointer ${isHovered ? 'h-2.5' : ''} transition-all duration-200`}>
        <motion.div
          className={`h-full rounded-full origin-left transition-all duration-300 ${
            isAlert ? 'bg-[var(--color-critical)] shadow-[0_0_8px_#e0574c]' : 'bg-[var(--color-accent)]'
          }`}
          style={{ width: `${item.val * 100}%` }}
        />
        {/* Live scan shimmer when scanning */}
        {isScanning && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(${isAlert ? '224,87,76' : '125,249,196'}, 0.3), transparent)`,
              width: '30%',
            }}
            animate={{ x: ['0%', '400%'] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: idx * 0.1,
              ease: 'linear',
            }}
          />
        )}
      </div>
    </div>
  );
};

// Playable Risk Model Bar with real-time interactive slider control
const InteractiveRiskBar: React.FC<{
  feat: (typeof SHAP_FEATURES)[0];
  idx: number;
  interactiveWeight: number;
  onWeightChange: (newWeight: number) => void;
}> = ({ feat, idx: _idx, interactiveWeight, onWeightChange }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`space-y-1 p-2 rounded-lg transition-all duration-200 ${
        isHovered ? 'bg-white/[0.04] border border-white/[0.08]' : 'border border-transparent'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-between items-center text-[11px]">
        <span className={`font-mono transition-colors duration-200 ${isHovered ? 'text-[var(--color-accent)]' : 'text-white'}`}>
          {feat.name}
        </span>
        <span className="text-[var(--color-accent)] font-bold">
          {feat.dir}{(interactiveWeight * 100).toFixed(0)}%
        </span>
      </div>
      <div className="text-[10px] text-[var(--color-muted)] flex justify-between items-center">
        <span>{feat.desc}</span>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <input
          type="range"
          min="0.02"
          max="0.85"
          step="0.01"
          value={interactiveWeight}
          onChange={(e) => onWeightChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-[#1b1b20] rounded appearance-none cursor-pointer accent-[var(--color-accent)]"
        />
      </div>
    </div>
  );
};

export const FeatureDeepDive: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [sliderVal, setSliderVal] = useState(55);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scannerFeatures, setScannerFeatures] = useState(SCANNER_FEATURES);
  const [activeFault, setActiveFault] = useState<string | null>(null);
  const [riskWeights, setRiskWeights] = useState(SHAP_FEATURES.map((f) => f.weight));

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON_PAYLOAD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScan = useCallback(() => {
    if (isScanning) return;
    setIsScanning(true);
    setScanComplete(false);
    setTimeout(() => {
      setIsScanning(false);
      setScanComplete(true);
      setTimeout(() => setScanComplete(false), 3000);
    }, 2500);
  }, [isScanning]);

  // Fault Injection Handler
  const injectFault = (faultType: 'thermal' | 'mems' | 'voltage' | 'replay' | 'reset') => {
    setActiveFault(faultType === 'reset' ? null : faultType);
    if (faultType === 'reset') {
      setScannerFeatures(SCANNER_FEATURES);
      return;
    }
    setScannerFeatures((prev) =>
      prev.map((item) => {
        if (faultType === 'thermal' && item.name === 'DELTA_T_MAX_EXCURSION') {
          return { ...item, val: 0.98, unit: '+7.4°C', status: 'ALERT', detail: 'Critical thermal breach: +7.4°C exceeds 5°C max limit' };
        }
        if (faultType === 'thermal' && item.name === 'MKT_THERMAL_INTEGRATION') {
          return { ...item, val: 0.99, unit: '8.4°C avg', status: 'ALERT', detail: 'Mean Kinetic Temperature accelerating past USP limits' };
        }
        if (faultType === 'mems' && item.name === 'MEMS_VIBRATION_SHOCK') {
          return { ...item, val: 0.96, unit: '3.6 G', status: 'ALERT', detail: 'Severe transit impact shock registered by 3-axis accelerometer' };
        }
        if (faultType === 'voltage' && item.name === 'BATTERY_VOLTAGE_SAG') {
          return { ...item, val: 0.94, unit: '2.84 V', status: 'ALERT', detail: 'Critical voltage drop below MCU safe operating point' };
        }
        if (faultType === 'replay' && item.name === 'REPLAY_SUFFIX_DIVERGENCE') {
          return { ...item, val: 0.99, unit: 'Delt=0.74', status: 'ALERT', detail: 'Cryptographic nonce replay detected from unauthorized gateway' };
        }
        return item;
      })
    );
  };

  // Auto-sweep radar animation for wipe slider
  useEffect(() => {
    if (!isAutoScanning) return;
    let forward = true;
    const interval = setInterval(() => {
      setSliderVal((prev) => {
        if (prev >= 96) forward = false;
        if (prev <= 4) forward = true;
        return forward ? prev + 2 : prev - 2;
      });
    }, 45);
    return () => clearInterval(interval);
  }, [isAutoScanning]);

  // Smooth animated slider value with spring physics
  const sliderMotion = useMotionValue(sliderVal);
  const smoothSlider = useSpring(sliderMotion, { stiffness: 200, damping: 25 });
  const clipPath = useTransform(smoothSlider, (v) => `inset(0 ${100 - v}% 0 0)`);

  useEffect(() => {
    sliderMotion.set(sliderVal);
  }, [sliderVal, sliderMotion]);

  // Composite Risk Score Calculation
  const compositeScore = Math.min(100, Math.round(riskWeights.reduce((a, b) => a + b, 0) * 85));

  return (
    <section id="features" className="w-full py-20 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border hairline bg-[var(--color-panel)] text-[var(--color-accent)] font-mono text-xs uppercase tracking-wider">
          <Sparkles size={12} />
          TELEMETRY ANALYSIS // FAULT DIAGNOSTICS
        </div>
        <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Real-Time Cold Chain Diagnostics
        </h2>
        <p className="text-[var(--color-muted)] text-base sm:text-lg font-sans">
          Zero guesswork. From hardware-rate sensor sampling to deterministic Arrhenius kinetics and immutable on-chain audit records.
        </p>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 01: 10-Feature Invariant Scanner */}
        <div className="p-6 rounded-lg border hairline bg-[var(--color-panel)] relative overflow-hidden flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                <span className="font-mono text-xs text-[var(--color-muted)] uppercase tracking-wider">
                  CARD 01 // ENGINE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                  10 INVARIANTS LIVE
                </span>
                {/* Interactive Scan Button */}
                <motion.button
                  onClick={handleScan}
                  className={`px-2.5 py-1 rounded-md border text-[10px] font-mono flex items-center gap-1.5 cursor-pointer transition-all ${
                    isScanning
                      ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : scanComplete
                      ? 'border-[var(--color-pass)]/50 bg-[var(--color-pass)]/10 text-[var(--color-pass)]'
                      : 'border-white/[0.08] text-[var(--color-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isScanning ? (
                    <>
                      <Activity size={10} className="animate-pulse" />
                      SCANNING...
                    </>
                  ) : scanComplete ? (
                    <>
                      <Check size={10} />
                      SCAN OK
                    </>
                  ) : (
                    <>
                      <Zap size={10} />
                      RUN SCAN
                    </>
                  )}
                </motion.button>
              </div>
            </div>
            <h3 className="card-title text-xl mb-1">10-Feature Invariant Scanner</h3>
            <p className="text-[var(--color-muted)] text-xs mb-4">
              Continuous multi-sensor telemetry matrix evaluating physical state invariants at hardware line rate.
            </p>

            {/* Playable Fault Injection Toolbar */}
            <div className="mb-4 p-2.5 rounded-lg bg-[#0d0e12] border border-white/[0.08] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-muted)]">
                <span className="flex items-center gap-1.5">
                  <Play size={9} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
                  PLAYABLE FAULT INJECTOR:
                </span>
                {activeFault && (
                  <span className="text-[var(--color-critical)] font-bold animate-pulse">
                    FAULT INJECTED // LINE RATE DETECTED
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono text-[9px]">
                <button
                  onClick={() => injectFault('thermal')}
                  className={`px-2 py-1 rounded transition-all cursor-pointer ${
                    activeFault === 'thermal'
                      ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/50 font-bold'
                      : 'bg-white/[0.03] text-neutral-300 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  🔥 TEMP SPIKE
                </button>
                <button
                  onClick={() => injectFault('mems')}
                  className={`px-2 py-1 rounded transition-all cursor-pointer ${
                    activeFault === 'mems'
                      ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/50 font-bold'
                      : 'bg-white/[0.03] text-neutral-300 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  ⚡ 3.6G SHOCK
                </button>
                <button
                  onClick={() => injectFault('voltage')}
                  className={`px-2 py-1 rounded transition-all cursor-pointer ${
                    activeFault === 'voltage'
                      ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/50 font-bold'
                      : 'bg-white/[0.03] text-neutral-300 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  🔋 2.8V SAG
                </button>
                <button
                  onClick={() => injectFault('replay')}
                  className={`px-2 py-1 rounded transition-all cursor-pointer ${
                    activeFault === 'replay'
                      ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/50 font-bold'
                      : 'bg-white/[0.03] text-neutral-300 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  🔄 REPLAY
                </button>
                <button
                  onClick={() => injectFault('reset')}
                  className="px-2 py-1 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 border border-[var(--color-accent)]/40 font-bold transition-all cursor-pointer col-span-2 sm:col-span-1"
                >
                  ✓ RESET
                </button>
              </div>
            </div>

            {/* 10 Interactive Bars */}
            <div className="space-y-2.5 font-mono text-xs">
              {scannerFeatures.map((item, idx) => (
                <InteractiveScannerBar
                  key={idx}
                  item={item}
                  idx={idx}
                  shouldReduceMotion={shouldReduceMotion}
                  isScanning={isScanning}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t hairline flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)]">
            <span>TOTAL LATENCY: 11.4 ms</span>
            <span className="text-[var(--color-accent)]">
              {isScanning ? 'SCANNING IN PROGRESS...' : scanComplete ? '✓ ALL INVARIANTS VERIFIED' : 'EVALUATION CONVERGED'}
            </span>
          </div>
        </div>

        {/* CARD 02: Automated Excursion Analysis Engine */}
        <div className="p-6 rounded-lg border hairline bg-[var(--color-panel)] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-[var(--color-accent)]" />
                <span className="font-mono text-xs text-[var(--color-muted)] uppercase tracking-wider">
                  CARD 02 // DIAGNOSTICS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 font-semibold">
                  rule-engine-v3
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded hover:bg-[#202025] text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
                  title="Copy JSON Payload"
                >
                  {copied ? <Check size={13} className="text-[var(--color-accent)]" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <h3 className="card-title text-xl mb-2">Automated Excursion Analysis Engine</h3>
            <p className="text-[var(--color-muted)] text-xs mb-4 font-sans">
              Deterministic diagnostics evaluating temperature excursions, MKT impact, and batch cryptographic provenance.
            </p>

            {/* Terminal Preview with interactive mutation and validator */}
            <TerminalPreview />
          </div>

          <div className="mt-6 pt-4 border-t hairline flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)]">
            <span>RFC 8785 CANONICAL JSON</span>
            <span className="text-[var(--color-pass)]">BIT-EXACT DETERMINISTIC</span>
          </div>
        </div>

        {/* CARD 03: Telemetry Replay & Verification Wipe */}
        <div className="p-6 rounded-lg border hairline bg-[var(--color-panel)] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-[var(--color-accent)]" />
                <span className="font-mono text-xs text-[var(--color-muted)] uppercase tracking-wider">
                  CARD 03 // AUDIT REPLAY
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAutoScanning(!isAutoScanning)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all ${
                    isAutoScanning
                      ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/50'
                      : 'bg-white/[0.04] text-[var(--color-muted)] hover:text-white border border-white/[0.08]'
                  }`}
                >
                  <Play size={9} className={isAutoScanning ? 'fill-[var(--color-accent)] animate-pulse' : ''} />
                  {isAutoScanning ? 'PAUSE SWEEP' : 'AUTO-SWEEP'}
                </button>
                <span className="font-mono text-[11px] text-[var(--color-accent)]">
                  {sliderVal}% WIPED
                </span>
              </div>
            </div>
            <h3 className="card-title text-xl mb-1">Telemetry Replay &amp; Verification Wipe</h3>
            <p className="text-[var(--color-muted)] text-xs mb-3 font-sans">
              Drag the interactive slider or trigger auto-sweep to compare raw signals against verified records.
            </p>

            {/* Slider Wipe Canvas Container with spring-smoothed clip */}
            <div className="relative rounded border hairline bg-[#0b0b0d] h-[200px] overflow-hidden select-none">
              {/* Underlying Layer: Verified Telemetry (Emerald) */}
              <div className="absolute inset-0 p-4 bg-[#0d1611] text-[var(--color-pass)] font-mono text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                    <Check size={14} className="text-[var(--color-pass)]" />
                    CRYPTOGRAPHICALLY VERIFIED &amp; ANCHORED
                  </div>
                  <div className="space-y-1 text-[11px] text-[#86efac]">
                    <div>• Ed25519 Hardware Signature: VALID (Key: 0x4b71...a93f)</div>
                    <div>• MKT Continuous Integration: 3.42°C (Compliant with USP &lt;1079&gt;)</div>
                    <div>• On-Chain Merkle Root: Anchored at Amoy Block #49281</div>
                    <div>• Shelf-Life Loss: 0.14 days (99.8% Potency Retained)</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--color-muted)] flex justify-between">
                  <span>RECORD: OFFICIAL IMMUTABLE</span>
                  <span className="text-[var(--color-pass)] font-bold">100% VALIDATED</span>
                </div>
              </div>

              {/* Top Layer: Raw Excursion Signal (Crimson), clipped by spring-smoothed slider */}
              <motion.div
                className="absolute inset-0 p-4 bg-[#1a0e0e] text-[var(--color-critical)] font-mono text-xs flex flex-col justify-between"
                style={{ clipPath }}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-critical)] animate-ping" />
                    RAW SENSOR SIGNAL (ANOMALY DETECTED)
                  </div>
                  <div className="space-y-1 text-[11px] text-[#fca5a5]">
                    <div>• Temperature Spike: 12.28°C (+4.28°C above 8°C max limit)</div>
                    <div>• Compressor Cycle Stall: 380s duration excursion</div>
                    <div>• MEMS Accelerometer: 3.2 G shock event recorded at 14:22 UTC</div>
                    <div>• Advisory Risk Score: 88.4% (Elevated Excursion Warning)</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--color-muted)] flex justify-between">
                  <span>STATE: EXCURSION DETECTED</span>
                  <span className="text-[var(--color-critical)] font-bold">BREACH AT STEP 07</span>
                </div>
              </motion.div>

              {/* Slider Divider Line - spring smoothed */}
              <motion.div
                className="absolute top-0 bottom-0 w-[2px] bg-[var(--color-accent)] pointer-events-none shadow-[0_0_10px_var(--color-accent)]"
                style={{ left: useTransform(smoothSlider, (v) => `${v}%`) }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-accent)] flex items-center justify-center text-[9px] text-[var(--color-accent)] shadow-[0_0_16px_rgba(125,249,196,0.4)]">
                  ↔
                </div>
              </motion.div>
            </div>

            {/* Scrubber Shortcuts + Slider Control */}
            <div className="mt-3 space-y-1.5">
              <input
                type="range"
                min="0"
                max="100"
                value={sliderVal}
                onChange={(e) => {
                  setIsAutoScanning(false);
                  setSliderVal(Number(e.target.value));
                }}
                className="w-full h-1.5 bg-[#1f1f23] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
              />
              <div className="flex justify-between items-center text-[10px] font-mono">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setIsAutoScanning(false); setSliderVal(0); }}
                    className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[var(--color-critical)] hover:bg-white/[0.08] cursor-pointer"
                  >
                    0% RAW
                  </button>
                  <button
                    onClick={() => { setIsAutoScanning(false); setSliderVal(50); }}
                    className="px-1.5 py-0.5 rounded bg-white/[0.04] text-white hover:bg-white/[0.08] cursor-pointer"
                  >
                    50% SPLIT
                  </button>
                  <button
                    onClick={() => { setIsAutoScanning(false); setSliderVal(100); }}
                    className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[var(--color-pass)] hover:bg-white/[0.08] cursor-pointer"
                  >
                    100% AUDIT
                  </button>
                </div>
                <span className="text-[var(--color-muted)]">DRAG TO REVEAL</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t hairline flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)]">
            <span>PROVENANCE VERIFICATION</span>
            <span className="text-[var(--color-accent)]">TAMPER-EVIDENT</span>
          </div>
        </div>

        {/* CARD 04: Multivariable Risk Factor Decomposition */}
        <div className="p-6 rounded-lg border hairline bg-[var(--color-panel)] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-[var(--color-accent)]" />
                <span className="font-mono text-xs text-[var(--color-muted)] uppercase tracking-wider">
                  CARD 04 // RISK MODEL
                </span>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 font-semibold">
                MODEL ACCURACY: 0.984
              </span>
            </div>
            <h3 className="card-title text-xl mb-1">Multivariable Risk Factor Decomposition</h3>
            <p className="text-[var(--color-muted)] text-xs mb-3 font-sans">
              Playable streaming risk model. Drag sliders or click scenarios to evaluate risk contributions in real time.
            </p>

            {/* Playable Scenario Buttons */}
            <div className="mb-3 p-2 rounded-lg bg-[#0d0e12] border border-white/[0.08] flex items-center justify-between flex-wrap gap-1.5 font-mono text-[9px]">
              <span className="text-[var(--color-muted)]">PRESET SCENARIOS:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setRiskWeights([0.68, 0.54, 0.38, 0.12, 0.08])}
                  className="px-2 py-0.5 rounded bg-[var(--color-critical)]/15 text-[var(--color-critical)] border border-[var(--color-critical)]/30 hover:bg-[var(--color-critical)]/25 cursor-pointer font-semibold"
                >
                  COMPRESSOR FAIL
                </button>
                <button
                  onClick={() => setRiskWeights([0.15, 0.12, 0.22, 0.76, 0.45])}
                  className="px-2 py-0.5 rounded bg-[#e8b14c]/15 text-[#e8b14c] border border-[#e8b14c]/30 hover:bg-[#e8b14c]/25 cursor-pointer font-semibold"
                >
                  ROUGH TRANSIT
                </button>
                <button
                  onClick={() => setRiskWeights([0.10, 0.06, 0.04, 0.08, 0.03])}
                  className="px-2 py-0.5 rounded bg-[var(--color-pass)]/15 text-[var(--color-pass)] border border-[var(--color-pass)]/30 hover:bg-[var(--color-pass)]/25 cursor-pointer font-semibold"
                >
                  NOMINAL
                </button>
              </div>
            </div>

            {/* Interactive Feature Bars with Sliders */}
            <div className="space-y-1 font-mono text-xs">
              {SHAP_FEATURES.map((feat, idx) => (
                <InteractiveRiskBar
                  key={idx}
                  feat={feat}
                  idx={idx}
                  interactiveWeight={riskWeights[idx]}
                  onWeightChange={(newWeight) => {
                    setRiskWeights((prev) => {
                      const next = [...prev];
                      next[idx] = newWeight;
                      return next;
                    });
                  }}
                />
              ))}
            </div>

            {/* Dynamic Composite Risk Score Meter */}
            <div className="mt-3 p-2.5 rounded-lg bg-[#0b0c10] border border-white/[0.08] space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[var(--color-muted)]">COMPOSITE ANOMALY RISK:</span>
                <span
                  className={`font-bold ${
                    compositeScore > 65
                      ? 'text-[var(--color-critical)]'
                      : compositeScore > 35
                      ? 'text-[#e8b14c]'
                      : 'text-[var(--color-pass)]'
                  }`}
                >
                  {compositeScore}% {compositeScore > 65 ? '(CRITICAL EXCURSION)' : compositeScore > 35 ? '(ELEVATED RISK)' : '(LOW RISK / SAFE)'}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#1b1b20] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    compositeScore > 65
                      ? 'bg-[var(--color-critical)] shadow-[0_0_8px_#e0574c]'
                      : compositeScore > 35
                      ? 'bg-[#e8b14c]'
                      : 'bg-[var(--color-pass)]'
                  }`}
                  style={{ width: `${compositeScore}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t hairline flex items-center justify-between text-[11px] font-mono text-[var(--color-muted)]">
            <span>ONLINE STREAMING EVALUATION</span>
            <span className="text-[var(--color-accent)]">MATHEMATICAL RIGOR</span>
          </div>
        </div>
      </div>
    </section>
  );
};

// Interactive Terminal Preview with line highlighting, payload mutation, and live validator
const TerminalPreview: React.FC = () => {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [isTampered, setIsTampered] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const handleValidate = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerifiedStatus(isTampered ? 'invalid' : 'valid');
      setTimeout(() => setVerifiedStatus('idle'), 4000);
    }, 450);
  };

  const lines = [
    { key: 'shipment_id', value: '"shipment-pharma-7712"', color: '#e8b14c', info: 'Unique shipment identifier linked to WHO vaccine batch' },
    { key: 'device_id', value: '"esp32-node-09"', color: '#e8b14c', info: 'ESP32 edge device with Ed25519 hardware signing module' },
    { key: 'profile', value: '"WHO_VACCINE_TYPE_2A"', color: 'white', info: 'WHO temperature profile: 2-8°C cold chain requirement' },
    {
      key: 'classification',
      value: isTampered ? '"MALICIOUS_DATA_INJECTION"' : '"THERMAL_EXCURSION_COMPRESSOR_FAIL"',
      color: 'var(--color-critical)',
      info: isTampered ? 'Tampered payload: unauthorized memory modification' : 'Root cause: compressor duty cycle failure caused thermal spike',
      isNested: true,
      isAlert: true,
    },
    { key: 'failing_invariant', value: '"INV_MAX_TEMP_8C"', color: '#e8b14c', info: 'Temperature exceeded 8°C maximum for vaccine integrity', isNested: true },
    {
      key: 'peak_temp_c',
      value: isTampered ? '24.50' : '12.28',
      color: 'var(--color-critical)',
      info: isTampered ? 'TAMPERED VALUE: 24.5°C injected into packet' : '4.28°C above maximum limit — excursion severity: HIGH',
      isNested: true,
      isAlert: true,
    },
    { key: 'mkt_accumulated_c', value: isTampered ? '18.82' : '9.42', color: 'white', info: 'Mean Kinetic Temperature accumulated via Arrhenius equation', isNested: true },
    { key: 'merkle_root', value: isTampered ? '"0xCORRUPT_ROOT"' : '"0x8492f1b4029a1e0b5c77"', color: isTampered ? 'var(--color-critical)' : 'var(--color-pass)', info: 'Merkle root anchored to Polygon Amoy smart contract', isNested: true },
    { key: 'polygon_tx', value: '"0x9727...ed37"', color: 'var(--color-pass)', info: 'Polygon Amoy L2 transaction hash — publicly verifiable', isNested: true },
  ];

  return (
    <div className="rounded border hairline bg-[#0b0b0d] text-[11px] font-mono overflow-hidden">
      {/* Interactive Controls Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b hairline text-[10px] bg-[#101014]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#e0574c]/80" />
          <span className="w-2 h-2 rounded-full bg-[#e8b14c]/80" />
          <span className="w-2 h-2 rounded-full bg-[#5bc98c]/80" />
          <span className="ml-1 text-[var(--color-muted)]">excursion_report.json</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsTampered(!isTampered);
              setVerifiedStatus('idle');
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer transition-all ${
              isTampered
                ? 'bg-[var(--color-critical)]/20 text-[var(--color-critical)] border border-[var(--color-critical)]/40'
                : 'bg-white/[0.04] text-[var(--color-muted)] hover:text-white border border-white/[0.08]'
            }`}
          >
            {isTampered ? '⚠️ TAMPERED (24.5°C)' : '✓ CANONICAL'}
          </button>
          <button
            onClick={handleValidate}
            disabled={isVerifying}
            className="px-2 py-0.5 rounded bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-all"
          >
            {isVerifying ? (
              <Activity size={9} className="animate-spin" />
            ) : (
              <ShieldCheck size={9} />
            )}
            VERIFY SIG
          </button>
        </div>
      </div>

      {/* Verification Flash Banner */}
      {verifiedStatus !== 'idle' && (
        <div
          className={`px-3 py-1.5 text-[9px] font-mono border-b flex items-center justify-between ${
            verifiedStatus === 'valid'
              ? 'bg-[var(--color-pass)]/15 border-[var(--color-pass)]/30 text-[var(--color-pass)]'
              : 'bg-[var(--color-critical)]/15 border-[var(--color-critical)]/30 text-[var(--color-critical)]'
          }`}
        >
          <span>
            {verifiedStatus === 'valid'
              ? '✓ ED25519 SIGNATURE VALID · BIT-EXACT MATCH WITH POLYGON ROOT'
              : '✗ ED25519 SIGNATURE MISMATCH · CRYPTO REJECTED // TAMPER DETECTED'}
          </span>
          <span className="font-bold">{verifiedStatus === 'valid' ? 'PASS' : 'FRAUD ALERT'}</span>
        </div>
      )}

      {/* JSON Lines */}
      <div className="relative">
        {lines.map((line, idx) => (
          <div key={idx}>
            <div
              className={`flex items-center px-3 py-1 cursor-pointer transition-all duration-150 ${
                hoveredLine === idx
                  ? 'bg-white/[0.04]'
                  : selectedLine === idx
                  ? 'bg-[var(--color-accent)]/[0.06] border-l-2 border-[var(--color-accent)]'
                  : ''
              }`}
              onMouseEnter={() => setHoveredLine(idx)}
              onMouseLeave={() => setHoveredLine(null)}
              onClick={() => setSelectedLine(selectedLine === idx ? null : idx)}
            >
              <span className="text-[var(--color-muted)] w-5 text-right mr-3 text-[9px] select-none">{idx + 1}</span>
              <span className="text-neutral-500 mr-1">{line.isNested ? '  ' : ''}</span>
              <span className="text-[var(--color-accent)]">"{line.key}"</span>
              <span className="text-neutral-500">: </span>
              <span style={{ color: line.color }} className={line.isAlert ? 'font-bold' : ''}>
                {line.value}
              </span>
              {hoveredLine === idx && (
                <ChevronRight size={10} className="ml-auto text-[var(--color-accent)] opacity-50" />
              )}
            </div>
            {/* Expandable info panel */}
            <AnimatePresence>
              {selectedLine === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className={`px-3 py-1.5 text-[9px] border-l-2 ml-5 ${
                      line.isAlert
                        ? 'bg-[var(--color-critical)]/[0.06] border-[var(--color-critical)] text-[#fca5a5]'
                        : 'bg-[var(--color-accent)]/[0.04] border-[var(--color-accent)] text-[var(--color-accent)]'
                    }`}
                  >
                    ↳ {line.info}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};
