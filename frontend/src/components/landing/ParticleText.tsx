import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

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

    const initParticles = () => {
      const width = Math.min(container.clientWidth || 1000, 1200);
      const height = 160;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
      const step = 4; // Sample every 4 pixels for optimal density and 60fps
      particles = [];

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          if (data[idx + 3] > 128) {
            // Register particle at home coordinate (hx, hy)
            particles.push({
              x: x + (Math.random() - 0.5) * 10,
              y: y + (Math.random() - 0.5) * 10,
              vx: 0,
              vy: 0,
              hx: x,
              hy: y,
              size: 1.4,
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

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('resize', initParticles);

    const radius = 80;

    const loop = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);
      const isLight = document.documentElement.classList.contains('light');
      ctx.fillStyle = isLight ? '#008072' : '#7df9c4';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Pointer repulsion
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);

          if (dist < radius && dist > 0.001) {
            const force = (1 - dist / radius) * 7.5;
            const angle = Math.atan2(dy, dx);
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
          }
        }

        // Spring-to-Home Force
        p.vx += (p.hx - p.x) * 0.08;
        p.vy += (p.hy - p.y) * 0.08;

        // Friction / Damping
        p.vx *= 0.84;
        p.vy *= 0.84;

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Render particle
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('resize', initParticles);
    };
  }, [isMobile, shouldReduceMotion, text]);

  if (isMobile || shouldReduceMotion) {
    return (
      <div className={`text-center py-2 select-none ${className}`}>
        <h1 className="font-display font-extrabold tracking-tight text-5xl sm:text-7xl md:text-8xl text-white drop-shadow-[0_0_35px_rgba(125,249,196,0.35)]">
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
