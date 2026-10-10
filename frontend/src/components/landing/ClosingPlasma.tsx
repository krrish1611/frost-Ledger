import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface ClosingPlasmaProps {
  className?: string;
  speed?: number;
}

export const ClosingPlasma: React.FC<ClosingPlasmaProps> = ({
  className = '',
  speed = 0.008,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create 10x downscaled offscreen buffer
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    if (!offscreenCtx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      // Downscaled 10x buffer dimensions
      const bw = Math.max(1, Math.floor(width / 10));
      const bh = Math.max(1, Math.floor(height / 10));
      offscreenCanvas.width = bw;
      offscreenCanvas.height = bh;
    };

    resize();
    window.addEventListener('resize', resize);

    const renderFrame = (t: number) => {
      const bw = offscreenCanvas.width;
      const bh = offscreenCanvas.height;
      if (bw <= 0 || bh <= 0) return;

      const imgData = offscreenCtx.createImageData(bw, bh);
      const data = imgData.data;

      // Precalculate center for radial wave
      const cx = bw * 0.5;
      const cy = bh * 0.5;

      let idx = 0;
      for (let y = 0; y < bh; y++) {
        const dy = y - cy;
        const dy2 = dy * dy;
        const sinY = Math.sin(y * 0.07 + t * 0.55);

        for (let x = 0; x < bw; x++) {
          const dx = x - cx;
          const dist = Math.sqrt(dx * dx + dy2);

          const sinX = Math.sin(x * 0.07 + t * 0.65);
          const sinXY = Math.sin((x + y) * 0.05 + t * 0.75);
          const sinRad = Math.sin(dist * 0.08 - t * 0.85);

          // Combined wave normalized [0, 1]
          const rawWave = (sinX + sinY + sinXY + sinRad) * 0.25;
          const norm = (rawWave + 1) * 0.5;

          // Power curve for cybernetic high-contrast plasma
          const glow = Math.pow(norm, 2.4);

          // Color interpolation: #0a0a0b (10, 10, 11) to #7df9c4 (125, 249, 196)
          data[idx] = Math.floor(10 + glow * (125 - 10));
          data[idx + 1] = Math.floor(10 + glow * (249 - 10));
          data[idx + 2] = Math.floor(11 + glow * (196 - 11));
          data[idx + 3] = 255;

          idx += 4;
        }
      }

      offscreenCtx.putImageData(imgData, 0, 0);

      // Upscale smoothly to main canvas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
    };

    if (shouldReduceMotion) {
      // Single static frame under prefers-reduced-motion
      renderFrame(1.8);
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    const animate = () => {
      time += speed;
      renderFrame(time);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [shouldReduceMotion, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className}`}
      aria-hidden="true"
    />
  );
};
