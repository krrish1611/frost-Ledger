import React, { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CheckCircle2, RefreshCw, GitFork, ShieldAlert, Cpu, Play } from 'lucide-react';

const STEP_ANOMALY_SCORES = [2, 3, 1, 5, 2, 4, 9, 88, 11, 6, 3, 2];
const STEP_LABELS = [
  'BOOT_ENV_KERNEL',
  'NET_HANDSHAKE',
  'SENSOR_SYNC_RTC',
  'CALIBRATE_TEMP',
  'MKT_BASELINE',
  'ED25519_VERIFY',
  'POLYMARK_EPOCH',
  'INV_COLD_CHAIN_07', // Anomaly at step index 7
  'HASH_CHAIN_EXT',
  'ORACLE_SIGN_TX',
  'AMOY_BROADCAST',
  'FINAL_CONFIRM',
];

export const TraceStatusCard: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [currentStep, setCurrentStep] = useState(0);
  const [isResolved, setIsResolved] = useState(false);
  const [cycleCount, setCycleCount] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion || isPaused) {
      if (shouldReduceMotion) setCurrentStep(7);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEP_ANOMALY_SCORES.length - 1) {
          return prev + 1;
        } else if (prev === STEP_ANOMALY_SCORES.length - 1 && !isResolved) {
          // Trigger automatic checkpoint fork remediation
          setIsResolved(true);
          return prev;
        } else {
          // Reset after resolved pause
          setTimeout(() => {
            setIsResolved(false);
            setCycleCount((c) => c + 1);
            setCurrentStep(0);
          }, 1800);
          return prev;
        }
      });
    }, 230);

    return () => clearInterval(interval);
  }, [isResolved, shouldReduceMotion, isPaused]);

  const hasHitAnomaly = currentStep >= 7 && !isResolved;
  const isPostResolution = isResolved;

  return (
    <div className="w-full max-w-xl mx-auto rounded-lg border hairline bg-[var(--color-panel)] overflow-hidden shadow-2xl relative font-mono text-xs">
      {/* Top Cybernetic Flight-Board Header */}
      <div className="bg-[#151518] border-b hairline px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-critical)] animate-pulse" />
          <span className="text-[var(--color-text)] font-semibold tracking-wider font-display text-[13px]">
            AGENT TRACE TELEMETRY
          </span>
          <span className="text-[var(--color-muted)] text-[10px]">
            [CYCLE #{cycleCount.toString().padStart(3, '0')}]
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasHitAnomaly ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#e0574c]/50 bg-[#e0574c]/10 text-[var(--color-critical)] font-bold text-[11px] shadow-[0_0_12px_rgba(224,87,76,0.4)]">
              <ShieldAlert size={12} />
              EXCURSION : THRESHOLD BREACH
            </div>
          ) : isPostResolution ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#5bc98c]/50 bg-[#5bc98c]/10 text-[var(--color-pass)] font-bold text-[11px] shadow-[0_0_12px_rgba(91,201,140,0.4)]">
              <CheckCircle2 size={12} />
              ANCHORED : HASH CHAIN VERIFIED
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[11px]">
              <RefreshCw size={11} className={isPaused ? '' : 'animate-spin'} />
              {isPaused ? 'PAUSED AT STEP' : 'SAMPLING STEP'} {currentStep.toString().padStart(2, '0')}/11
            </div>
          )}
        </div>
      </div>

      {/* Flight Board Telemetry Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b hairline bg-[var(--color-bg)]/80 p-3 gap-2 text-[11px]">
        <div>
          <div className="text-[var(--color-muted)] text-[9px] uppercase tracking-wider">Target Profile</div>
          <div className="text-white font-semibold mt-0.5">WHO_VACCINE_TYPE_2A</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-[9px] uppercase tracking-wider">Sampling Interval</div>
          <div className="text-[var(--color-accent)] font-semibold mt-0.5">230 ms / tick</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-[9px] uppercase tracking-wider">Anomaly Risk</div>
          <div
            className={`font-bold mt-0.5 ${
              hasHitAnomaly
                ? 'text-[var(--color-critical)]'
                : isPostResolution
                ? 'text-[var(--color-pass)]'
                : 'text-white'
            }`}
          >
            {hasHitAnomaly ? '88.4% (CRITICAL)' : isPostResolution ? '1.2% (NORMAL)' : `${STEP_ANOMALY_SCORES[currentStep]}.0%`}
          </div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-[9px] uppercase tracking-wider">Blockchain Anchor</div>
          <div className="text-white font-semibold mt-0.5 flex items-center gap-1">
            <GitFork size={11} className="text-[var(--color-accent)]" />
            {isPostResolution ? 'AMOY: #49281.OK' : 'SYNCING'}
          </div>
        </div>
      </div>

      {/* Playable Trace Debugger Controller */}
      <div className="px-3 py-1.5 bg-[#101014] border-b hairline flex items-center justify-between flex-wrap gap-1.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--color-muted)] flex items-center gap-1">
            <Play size={9} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
            DEBUGGER:
          </span>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
              isPaused
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/40 font-bold'
                : 'bg-white/[0.04] text-[var(--color-muted)] hover:text-white border-white/[0.08]'
            }`}
          >
            {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
          </button>
          <button
            onClick={() => {
              setIsPaused(true);
              setCurrentStep((prev) => (prev + 1) % STEP_ANOMALY_SCORES.length);
            }}
            className="px-2 py-0.5 rounded bg-white/[0.04] text-[var(--color-muted)] hover:text-white border border-white/[0.08] cursor-pointer"
          >
            ⏭ STEP
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsPaused(true);
              setCurrentStep(7);
              setIsResolved(false);
            }}
            className="px-2 py-0.5 rounded bg-[var(--color-critical)]/15 text-[var(--color-critical)] border border-[var(--color-critical)]/30 hover:bg-[var(--color-critical)]/25 cursor-pointer font-semibold"
          >
            ⚡ INJECT BREACH
          </button>
          <button
            onClick={() => {
              setIsResolved(true);
            }}
            className="px-2 py-0.5 rounded bg-[var(--color-pass)]/15 text-[var(--color-pass)] border border-[var(--color-pass)]/30 hover:bg-[var(--color-pass)]/25 cursor-pointer font-semibold"
          >
            🛡️ ANCHOR AMOY
          </button>
        </div>
      </div>

      {/* Step Sequence Board - Click steps to inspect */}
      <div className="p-3 bg-[var(--color-panel)] space-y-1.5 max-h-[220px] overflow-y-auto">
        {STEP_ANOMALY_SCORES.map((score, idx) => {
          const isPassed = currentStep > idx;
          const isCurrent = currentStep === idx;
          const isAnomalyStep = idx === 7;
          const scoreValue = isAnomalyStep && isPostResolution ? 1 : score;

          let badgeColor = 'text-[var(--color-muted)] border-transparent bg-transparent';
          let barBg = 'bg-[#1f1f23]';

          if (isAnomalyStep && hasHitAnomaly) {
            badgeColor = 'text-[var(--color-critical)] border-[#e0574c]/50 bg-[#e0574c]/15 shadow-[0_0_10px_#e0574c]';
            barBg = 'bg-[var(--color-critical)]';
          } else if (isAnomalyStep && isPostResolution) {
            badgeColor = 'text-[var(--color-pass)] border-[#5bc98c]/40 bg-[#5bc98c]/10';
            barBg = 'bg-[var(--color-pass)]';
          } else if (isPassed || isCurrent) {
            badgeColor = isCurrent
              ? 'text-[var(--color-accent)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10'
              : 'text-neutral-300 border-transparent bg-white/5';
            barBg = isPassed ? 'bg-[var(--color-accent)]/60' : 'bg-[var(--color-accent)]';
          }

          return (
            <div
              key={idx}
              onClick={() => {
                setIsPaused(true);
                setCurrentStep(idx);
                if (idx < 7) setIsResolved(false);
              }}
              title="Click step to jump & inspect"
              className={`flex items-center justify-between px-2.5 py-1 rounded border text-[11px] transition-colors duration-150 cursor-pointer hover:border-white/20 ${badgeColor}`}
            >
              <div className="flex items-center gap-2.5 w-1/2 min-w-[170px]">
                <span className="text-[var(--color-muted)] font-mono">
                  {idx.toString().padStart(2, '0')}
                </span>
                <span className="truncate">{STEP_LABELS[idx]}</span>
              </div>

              {/* Anomaly Bar Gauge */}
              <div className="flex-1 mx-3 hidden sm:flex items-center gap-1.5">
                <div className="h-1.5 w-full bg-[#1b1b1f] rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-200 ${barBg}`}
                    style={{ width: `${Math.min(100, Math.max(8, scoreValue))}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-right">
                <span className="font-mono text-[10px]">
                  {scoreValue} pt
                </span>
                <span className="w-16 text-[10px] uppercase font-bold text-right">
                  {isAnomalyStep && hasHitAnomaly
                    ? 'ALERT'
                    : isAnomalyStep && isPostResolution
                    ? 'RESOLVED'
                    : isPassed
                    ? 'PASS'
                    : isCurrent
                    ? 'EVAL'
                    : 'QUEUED'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal Footer Status Message */}
      <div className="px-4 py-2 bg-[#0c0c0e] border-t hairline flex items-center justify-between text-[10px] text-[var(--color-muted)]">
        <div className="flex items-center gap-1.5">
          <Cpu size={12} className="text-[var(--color-accent)]" />
          <span>
            {hasHitAnomaly
              ? 'ALERT: Excursion detected: Temp reached 12.28°C (>8.0°C max) at step 07'
              : isPostResolution
              ? 'RESOLUTION: Temperature normalized; batch Merkle root anchored to Polygon Amoy'
              : 'TELEMETRY: Hardware Ed25519 hash chain continuous verification active'}
          </span>
        </div>
        <span className="font-mono text-[var(--color-accent)] hidden sm:inline">
          ED25519_VALID
        </span>
      </div>
    </div>
  );
};
