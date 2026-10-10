import React from 'react';
import { ClosingPlasma } from './ClosingPlasma';

export const AmbientBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none bg-[var(--color-bg)]"
      aria-hidden="true"
    >
      {/* Layer 1: Downscaled Sine Wave Plasma */}
      <div className="absolute inset-0 opacity-[0.18]">
        <ClosingPlasma />
      </div>

      {/* Layer 2: Cybernetic Dot Matrix Texture */}
      <div className="absolute inset-0 dot-matrix opacity-40 mix-blend-screen" />

      {/* Layer 3: Subtle Vignette / Edge Falloff */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, transparent 40%, rgba(10, 10, 11, 0.85) 90%)',
        }}
      />
    </div>
  );
};
