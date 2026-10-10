import React from 'react';
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion';

export const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const shouldReduceMotion = useReducedMotion();

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-50 origin-left bg-[var(--color-accent)] pointer-events-none"
      style={{
        scaleX: shouldReduceMotion ? scrollYProgress : scaleX,
        boxShadow: '0 0 10px rgba(125, 249, 196, 0.7), 0 0 20px rgba(125, 249, 196, 0.4)',
      }}
      aria-hidden="true"
    />
  );
};
