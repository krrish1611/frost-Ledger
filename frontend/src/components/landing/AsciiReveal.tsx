import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const GLYPHS = ' .:-=+*#%@';

interface AsciiRevealProps {
  className?: string;
  cellSize?: number;
  interactiveRadius?: number;
}

export const AsciiReveal: React.FC<AsciiRevealProps> = ({
  className = '',
  cellSize = 17,
  interactiveRadius = 160,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;
    const heatMap = new Map<string, number>();

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : window.innerWidth;
      const height = parent ? parent.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const onPointerLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseleave', onPointerLeave);

    const render = (timeVal: number) => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : window.innerWidth;
      const height = parent ? parent.clientHeight : window.innerHeight;

      ctx.clearRect(0, 0, width, height);
      ctx.font = '11px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cols = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);
      const mouse = mouseRef.current;

      for (let r = 0; r < rows; r++) {
        const y = r * cellSize + cellSize / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * cellSize + cellSize / 2;
          const key = `${c},${r}`;

          // Ambient baseline sine wave pulse
          const wave = 0.22 + 0.12 * Math.sin(x * 0.03 + y * 0.025 + timeVal);

          // Pointer interaction with decaying heatmap
          let heat = (heatMap.get(key) || 0) * 0.92;

          if (mouse.active) {
            const dist = Math.hypot(x - mouse.x, y - mouse.y);
            if (dist < interactiveRadius) {
              const linear = 1 - dist / interactiveRadius;
              const near = linear * linear * (3 - 2 * linear); // smoothstep
              heat = Math.max(heat, near);
            }
          }

          if (heat > 0.004) {
            heatMap.set(key, heat);
          } else {
            heatMap.delete(key);
          }

          const combined = Math.min(1, Math.max(0, wave + heat * 0.85));
          const glyphIdx = Math.min(
            GLYPHS.length - 1,
            Math.floor(combined * GLYPHS.length)
          );
          const char = GLYPHS[glyphIdx];

          // Skip completely empty glyphs to optimize paint
          if (char === ' ') continue;

          const isLight = document.documentElement.classList.contains('light');
          const tColor = Math.min(1, Math.pow(combined, 1.4));
          let red: number, green: number, blue: number;
          if (isLight) {
            // Light mode: soft lavender slate (#a397ba: 163, 151, 186) to electric violet (#7c3aed: 124, 58, 237)
            red = Math.floor(163 + tColor * (124 - 163));
            green = Math.floor(151 + tColor * (58 - 151));
            blue = Math.floor(186 + tColor * (237 - 186));
          } else {
            // Dark mode: Dark baseline (#3a3a40: 58, 58, 64) to Mint (#7DF9C4: 125, 249, 196)
            red = Math.floor(58 + tColor * (125 - 58));
            green = Math.floor(58 + tColor * (249 - 58));
            blue = Math.floor(64 + tColor * (196 - 64));
          }
          const alpha = isLight ? 0.35 + combined * 0.65 : 0.25 + combined * 0.75;

          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
          ctx.fillText(char, x, y);
        }
      }
    };

    if (shouldReduceMotion) {
      render(2.0);
      return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseleave', onPointerLeave);
      };
    }

    const loop = () => {
      t += 0.028;
      render(t);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseleave', onPointerLeave);
    };
  }, [cellSize, interactiveRadius, shouldReduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
};
