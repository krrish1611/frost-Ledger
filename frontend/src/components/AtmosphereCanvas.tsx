import React, { useEffect, useRef } from 'react';

/**
 * Atmospheric plasma shader rendered on Canvas 2D using the 1/10th downscale trick.
 * Generates an electric mint ambient energy glow at near-zero CPU footprint.
 */
export const AtmosphereCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let t = 0;

    // 1/10 scale offscreen buffer
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      offscreen.width = Math.max(1, Math.floor(rect.width / 10));
      offscreen.height = Math.max(1, Math.floor(rect.height / 10));
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!ctx || !offCtx) return;
      const bw = offscreen.width;
      const bh = offscreen.height;

      const imgData = offCtx.createImageData(bw, bh);
      const data = imgData.data;

      // Multi-sine wave plasma
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const idx = (y * bw + x) * 4;
          const v =
            Math.sin(x * 0.22 + t) +
            Math.sin(y * 0.18 - 0.7 * t) +
            Math.sin((x + y) * 0.14 + 0.4 * t) +
            Math.sin(Math.sqrt(x * x + y * y) * 0.2 - t);

          // Scaled intensity [0, 1]
          const m = Math.pow(Math.max(0, (v + 4) / 8), 2.5) * 0.45;

          const isLight = document.documentElement.classList.contains('light');
          if (isLight) {
            // Official Success Emerald Teal (#008072) & Seafoam (#A0E3D8) on ice-mint canvas
            data[idx] = Math.floor(244 - m * (244 - 0));
            data[idx + 1] = Math.floor(250 - m * (250 - 128));
            data[idx + 2] = Math.floor(248 - m * (248 - 114));
            data[idx + 3] = Math.floor(m * 145);
          } else {
            // Electric mint (#7DF9C4 -> r: 125, g: 249, b: 196) on dark (#0A0A0B)
            data[idx] = Math.floor(10 + m * (125 - 10));
            data[idx + 1] = Math.floor(10 + m * (249 - 10));
            data[idx + 2] = Math.floor(11 + m * (196 - 11));
            data[idx + 3] = Math.floor(m * 180);
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);

      // Blit onto main canvas with bilinear smoothing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

      if (!prefersReducedMotion) {
        t += 0.015;
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '500px',
        height: '240px',
        pointerEvents: 'none',
        opacity: 0.65,
        zIndex: 0,
      }}
    />
  );
};
