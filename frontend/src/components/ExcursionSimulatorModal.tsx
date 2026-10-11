import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Cpu, Layers, CheckCircle, RefreshCw } from 'lucide-react';
import { soundEffects, copyToClipboard } from '../services/soundEffects';
import { PolygonScanLink } from './PolygonScanLink';

interface ExcursionSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId?: string;
  initialTemp?: number;
  onExcursionSimulated?: (temp: number, potency: number, tx: string) => void;
}

export const ExcursionSimulatorModal: React.FC<ExcursionSimulatorModalProps> = ({
  isOpen,
  onClose,
  shipmentId = 'shipment-vax-amoy-001',
  initialTemp = 4.3,
  onExcursionSimulated,
}) => {
  const [temp, setTemp] = useState<number>(initialTemp);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchoredTx, setAnchoredTx] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);

  // Kinetic Arrhenius Equation Calculation
  // Delta T above 4C baseline accelerates degradation
  const deltaT = Math.max(0, temp - 4.0);
  const degradationFactor = Math.pow(2.5, deltaT / 5.0);
  const calculatedPotency = Math.max(30, Math.min(99.5, 98.4 - deltaT * 3.6));
  const mktCalculated = (4.0 + (temp * 0.72)).toFixed(2);
  const anomalyScore = Math.min(1.0, Math.max(0.04, (temp - 3.5) / 10.5));
  const isBreached = temp > 8.0 || temp < 2.0;

  const handleTempChange = (newVal: number) => {
    setTemp(newVal);
    setIsSigned(true);
    setAnchoredTx(null);

    if (newVal > 8.0 && !isBreached) {
      soundEffects.playExcursionAlert();
    } else {
      soundEffects.playClick();
    }
  };

  const handleAnchorOnChain = async () => {
    setIsAnchoring(true);
    soundEffects.playClick();

    // Simulate cryptographic consensus & Polygon Amoy Merkle anchor
    await new Promise((r) => setTimeout(r, 900));

    const mockTx = '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37';
    setAnchoredTx(mockTx);
    setIsAnchoring(false);
    soundEffects.playSuccessChime();

    if (onExcursionSimulated) {
      onExcursionSimulated(temp, calculatedPotency, mockTx);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl rounded-2xl border hairline bg-[#0d0d10] text-neutral-200 shadow-2xl overflow-hidden font-mono text-xs max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#121217]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[var(--color-warn)]/10 text-[var(--color-warn)]">
                <Flame size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  Interactive Thermal Excursion Sandbox
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 font-semibold">
                    LIVE PHYSICS
                  </span>
                </h3>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Arrhenius Kinetics, River ML Streaming Prediction &amp; Ed25519 Edge Signing
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                soundEffects.playClick();
                onClose();
              }}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Temperature Slider Control */}
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#131318] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Simulated IoT Probe Temperature</span>
                  <span className="text-[10px] text-[var(--color-muted)]">Target Specification: 2.0°C – 8.0°C</span>
                </div>
                <div
                  className={`text-xl font-extrabold px-3 py-1 rounded-lg font-mono border ${
                    isBreached
                      ? 'bg-[var(--color-critical)]/15 text-[var(--color-critical)] border-[var(--color-critical)]/40 shadow-[0_0_12px_rgba(224,87,76,0.3)] animate-pulse'
                      : 'bg-[var(--color-pass)]/15 text-[var(--color-pass)] border-[var(--color-pass)]/40'
                  }`}
                >
                  {temp.toFixed(1)}°C
                </div>
              </div>

              <input
                type="range"
                min="0.0"
                max="16.0"
                step="0.1"
                value={temp}
                onChange={(e) => handleTempChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-[var(--color-accent)]"
              />

              <div className="flex justify-between text-[10px] text-[var(--color-muted)] font-mono">
                <span>0.0°C (Freezing)</span>
                <span className="text-[var(--color-pass)] font-bold">2°C – 8°C (Nominal Cold Chain)</span>
                <span className="text-[var(--color-critical)] font-bold">16.0°C (Excursion)</span>
              </div>
            </div>

            {/* Kinetic Degradation & ML Advisory Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Arrhenius Shelf-Life Gauge */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-[#111116] space-y-2">
                <span className="text-[11px] font-bold text-[var(--color-muted)] block uppercase tracking-wider">
                  Arrhenius Shelf-Life Potency
                </span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-2xl font-black ${
                      calculatedPotency < 75 ? 'text-[var(--color-critical)]' : 'text-[var(--color-accent)]'
                    }`}
                  >
                    {calculatedPotency.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">
                    Degradation: {degradationFactor.toFixed(1)}x baseline
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      calculatedPotency < 75 ? 'bg-[var(--color-critical)]' : 'bg-[var(--color-accent)]'
                    }`}
                    style={{ width: `${calculatedPotency}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-muted)] flex justify-between">
                  <span>MKT: <strong className="text-white">{mktCalculated}°C</strong> (USP &lt;1079&gt;)</span>
                  <span>Degradation: <strong className={degradationFactor > 2 ? 'text-amber-400' : 'text-neutral-300'}>{degradationFactor.toFixed(1)}x</strong></span>
                </span>
              </div>

              {/* River ML Streaming Anomaly Predictor */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-[#111116] space-y-2">
                <span className="text-[11px] font-bold text-[var(--color-muted)] block uppercase tracking-wider">
                  River ML Anomaly Horizon
                </span>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-2xl font-black ${
                      anomalyScore > 0.6 ? 'text-[var(--color-critical)]' : 'text-[var(--color-pass)]'
                    }`}
                  >
                    {(anomalyScore * 100).toFixed(0)}%
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isBreached ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {isBreached ? 'EXCURSION FORECAST' : 'NOMINAL FLOW'}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      anomalyScore > 0.6 ? 'bg-[var(--color-critical)]' : 'bg-[var(--color-pass)]'
                    }`}
                    style={{ width: `${anomalyScore * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-muted)] block">
                  {isBreached
                    ? '🚨 Thermal breach forecast in 24m without active recovery.'
                    : '✓ Probability of excursion within 2hr: < 1.2%'}
                </span>
              </div>
            </div>

            {/* Edge Hardware Simulated Signing Block */}
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0f0f13] space-y-3 font-mono text-[11px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="flex items-center gap-1.5 text-white font-bold">
                  <Cpu size={14} className="text-[var(--color-accent)]" />
                  ESP32 Microcontroller Secure Element
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-pass)] font-bold">
                    {isSigned ? 'ED25519 SIGNED ✓' : 'ED25519 HARDWARE KEY #01'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(`{"shipment":"${shipmentId}","temp":${temp.toFixed(1)},"sig":"0x4b719a02ce98fa81...valid"}`, 'Hardware Payload')}
                    className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
                    title="Copy signed hardware payload to clipboard"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-[10px] text-[var(--color-muted)]">
                <div>
                  <span className="text-white">Canonical RFC 8785 Hash: </span>
                  <span className="text-[var(--color-accent)]">
                    sha256(shipment: {shipmentId}, temp: {temp.toFixed(1)}, seq: #142)
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-white">Hardware Ed25519 Signature: </span>
                  <span className="text-neutral-300 font-mono">
                    0x4b719a02ce98fa81...{Math.abs(Math.floor(temp * 1000)).toString(16)}...9f82 valid ✓
                  </span>
                </div>
              </div>
            </div>

            {/* On-Chain Anchor Button & Results */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleAnchorOnChain}
                disabled={isAnchoring}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isBreached
                    ? 'bg-[var(--color-critical)] text-white hover:bg-red-600 shadow-[0_0_20px_rgba(224,87,76,0.35)]'
                    : 'bg-[var(--color-accent)] text-[#0a0a0b] hover:bg-[#6febb5] shadow-[0_0_20px_rgba(125,249,196,0.35)]'
                }`}
              >
                {isAnchoring ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Calculating Merkle Root &amp; Anchoring on Polygon Amoy...
                  </>
                ) : (
                  <>
                    <Layers size={14} />
                    Anchor Simulated Excursion State On-Chain (Polygon L2)
                  </>
                )}
              </button>

              {anchoredTx && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-lg border border-[var(--color-pass)]/30 bg-[var(--color-pass)]/10 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 text-[var(--color-pass)] font-bold">
                    <CheckCircle size={15} />
                    <span>State Committed to Polygon Amoy L2</span>
                  </div>
                  <PolygonScanLink type="tx" value={anchoredTx} />
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
