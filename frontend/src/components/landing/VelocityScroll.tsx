import React from 'react';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
  useReducedMotion,
  wrap,
} from 'framer-motion';

const FAULT_CLASSES = [
  'TEMP_SPIKE_EXCURSION',
  'SENSOR_CLOCK_DRIFT',
  'MEMS_TAMPER_SHOCK',
  'UNAUTHORIZED_DOOR_OPEN',
  'GPS_SPOOF_TELEMETRY',
  'COMPRESSOR_CYCLE_FAULT',
  'ORACLE_SIGNATURE_INVALID',
  'HUMIDITY_THRESHOLD_BREACH',
  'ED25519_KEY_REVOCATION',
  'VOLTAGE_SAG_ANOMALY',
];

const ACCURACY_METRICS = [
  '0.984 ROC-AUC ACCURACY',
  '<12ms INVARIANT EVAL',
  '100% SUFFIX DETERMINISM',
  'ZERO FALSE FORKS',
  'SHAP FIDELITY 0.992',
  '4.2KB ZK-PROOF STATE',
  '230ms REPLAY CONVERGENCE',
  'POLYGON AMOY MERKLE ANCHOR',
  'POSTGRESQL IMMUTABLE TRIGGERS',
];

interface ParallaxRowProps {
  items: string[];
  baseVelocity: number;
  isMint?: boolean;
}

const ParallaxRow: React.FC<ParallaxRowProps> = ({
  items,
  baseVelocity = 1,
  isMint = false,
}) => {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const velocityFactor = useTransform(smoothVelocity, [-1000, 0, 1000], [-3.5, 0, 3.5], {
    clamp: false,
  });
  const shouldReduceMotion = useReducedMotion();

  const [isHovered, setIsHovered] = React.useState(false);

  // Wrap percentage for 4 cloned sets between -25% and -50%
  const x = useTransform(baseX, (v) => `${wrap(-50, -25, v)}%`);

  useAnimationFrame((_t, delta) => {
    if (shouldReduceMotion) return;

    // Smooth medium speed drift (slowed down from fast rush)
    const hoverFactor = isHovered ? 0.35 : 1;
    let moveBy = baseVelocity * (delta / 1000) * 4.5 * hoverFactor;

    const currentVelocityFactor = velocityFactor.get();
    if (currentVelocityFactor !== 0) {
      // Controlled, gentle scroll velocity acceleration
      moveBy += currentVelocityFactor * (delta / 1000) * 4;
    }

    baseX.set(baseX.get() + moveBy);
  });

  // 4 cloned repetitions to guarantee seamless loop
  const repeatedItems = [...items, ...items, ...items, ...items];

  return (
    <div
      className="overflow-hidden whitespace-nowrap flex select-none py-2 border-y hairline bg-[var(--color-bg)] cursor-default"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="flex gap-4 font-mono text-xs sm:text-sm tracking-wider uppercase items-center will-change-transform"
        style={{ x: shouldReduceMotion ? '0%' : x }}
      >
        {repeatedItems.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-4 px-3 py-1 rounded transition-colors ${
              isMint
                ? 'text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 shadow-[0_0_12px_rgba(125,249,196,0.15)]'
                : 'text-[var(--color-muted)] hover:text-white border border-[#232328] bg-[#121214]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isMint ? 'bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent)]' : 'bg-[#e0574c]/80'
              }`}
            />
            <span>{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export const VelocityScroll: React.FC = () => {
  return (
    <section className="relative w-full py-8 space-y-3 bg-[#0c0c0e] border-y hairline overflow-hidden">
      {/* Subtle Side Vignette Gradients */}
      <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-[var(--color-bg)] to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-[var(--color-bg)] to-transparent z-10 pointer-events-none" />

      {/* Row 1: Fault classes drifting left at medium speed */}
      <ParallaxRow items={FAULT_CLASSES} baseVelocity={-0.4} isMint={false} />

      {/* Row 2: Accuracy & invariant metrics drifting right at medium speed */}
      <ParallaxRow items={ACCURACY_METRICS} baseVelocity={0.4} isMint={true} />
    </section>
  );
};
