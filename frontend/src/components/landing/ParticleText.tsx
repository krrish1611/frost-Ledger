import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
  size: number;
}

interface ParticleTextProps {
  text?: string;
  className?: string;
}

export const ParticleText: React.FC<ParticleTextProps> = ({
  text = 'FROSTLEDGER',
  className = '',
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  useEffect(() => {
    if (isMobile || shouldReduceMotion) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const isLightNow = () => document.documentElement.classList.contains('light');

    const initParticles = () => {
      const width = Math.min(container.clientWidth || 1000, 1200);
      const height = 160;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const isLight = isLightNow();

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Create offscreen text canvas to sample alpha
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      const fontSize = Math.min(92, Math.floor(width / (text.length * 0.62)));
      offCtx.font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
      offCtx.fillStyle = '#ffffff';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText(text, width / 2, height / 2);

      const imgData = offCtx.getImageData(0, 0, width, height);
      const data = imgData.data;
      // Sample every 4px to produce the authentic LED dot-matrix raster in both light and dark modes
      const step = 4;
      particles = [];

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          if (data[idx + 3] > 100) {
            // Register particle at home coordinate (hx, hy)
            particles.push({
              x: x + (Math.random() - 0.5) * 6,
              y: y + (Math.random() - 0.5) * 6,
              vx: 0,
              vy: 0,
              hx: x,
              hy: y,
              size: isLight ? 2.6 : 1.8,
            });
          }
        }
      }
    };

    initParticles();

    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const onPointerLeave = () => {
      mouse.active = false;
    };

    const onThemeChange = () => {
      initParticles();
    };

    const observer = new MutationObserver(() => {
      initParticles();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('resize', initParticles);
    window.addEventListener('frostledger-theme-change', onThemeChange);

    const radius = 80;

    const loop = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);
      const isLight = isLightNow();
      // In light mode use user requested green #033500 for the wordmark
      ctx.fillStyle = isLight ? '#033500' : '#7df9c4';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Pointer repulsion
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);

          if (dist < radius && dist > 0.001) {
            const force = (1 - dist / radius) * 8.0;
            const angle = Math.atan2(dy, dx);
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
          }
        }

        // Spring-to-Home Force
        p.vx += (p.hx - p.x) * 0.09;
        p.vy += (p.hy - p.y) * 0.09;

        // Friction / Damping
        p.vx *= 0.82;
        p.vy *= 0.82;

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Render square matrix dot with crisp pixel alignment
        const pSize = p.size;
        ctx.fillRect(
          Math.round(p.x - pSize / 2),
          Math.round(p.y - pSize / 2),
          pSize,
          pSize
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('resize', initParticles);
      window.removeEventListener('frostledger-theme-change', onThemeChange);
    };
  }, [isMobile, shouldReduceMotion, text]);

  if (isMobile || shouldReduceMotion) {
    return (
      <div className={`text-center py-2 select-none ${className}`}>
        <h1 className={`font-display font-extrabold tracking-tight text-5xl sm:text-7xl md:text-8xl drop-shadow-[0_2px_12px_rgba(3,53,0,0.22)] dark:drop-shadow-[0_0_35px_rgba(125,249,196,0.35)] ${isLight ? 'text-[#033500]' : 'text-[var(--color-accent)]'}`}>
          {text}
        </h1>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full flex items-center justify-center min-h-[140px] select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="block cursor-crosshair mx-auto"
        style={{ margin: '0 auto' }}
        title="Interactive particle typography — hover to displace"
      />
    </div>
  );
};
