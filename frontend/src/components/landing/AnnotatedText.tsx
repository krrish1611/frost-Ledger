import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnnotatedTextProps {
  children: React.ReactNode;
  variant?: 'underline' | 'circle';
  className?: string;
  strokeColor?: string;
}

export const AnnotatedText: React.FC<AnnotatedTextProps> = ({
  children,
  variant = 'underline',
  className = '',
  strokeColor,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const effectiveColor = strokeColor || (variant === 'circle' ? 'var(--color-circle-annotation, #4ade80)' : 'var(--color-accent)');

  if (variant === 'circle') {
    return (
      <span className={`relative inline-block px-2 ${className}`}>
        <span className="relative z-10">{children}</span>
        <svg
          className="absolute inset-x-[-12%] inset-y-[-16%] w-[124%] h-[132%] pointer-events-none overflow-visible"
          viewBox="0 0 100 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <motion.path
            d="M50,4 C 80,4 97,12 97,20 C 97,30 74,36 50,36 C 26,36 3,30 3,20 C 3,12 22,4 50,5"
            stroke={effectiveColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: shouldReduceMotion ? 1 : 0, opacity: shouldReduceMotion ? 0.95 : 0 }}
            whileInView={{ pathLength: 1, opacity: 0.95 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{
              duration: shouldReduceMotion ? 0.01 : 0.8,
              ease: 'easeOut',
            }}
          />
        </svg>
      </span>
    );
  }

  // Default: underline
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <svg
        className="absolute left-0 right-0 -bottom-2 w-full h-[14px] pointer-events-none overflow-visible"
        viewBox="0 0 100 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M2,15 C 22,10 44,19 66,13 C 80,9 92,16 98,12"
          stroke={effectiveColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          initial={{ pathLength: shouldReduceMotion ? 1 : 0, opacity: shouldReduceMotion ? 0.9 : 0 }}
          whileInView={{ pathLength: 1, opacity: 0.9 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{
            duration: shouldReduceMotion ? 0.01 : 0.7,
            ease: 'easeOut',
          }}
        />
      </svg>
    </span>
  );
};
