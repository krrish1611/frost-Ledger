import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const ASCII_RAMP = ' .:-=+*#%@';

// 4x4 Bayer Dither Matrix for temporal-stable spatial gradients without frame jitter
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

interface AsciiImageProps {
  className?: string;
  width?: number;
  height?: number;
}

export const AsciiImage: React.FC<AsciiImageProps> = ({
  className = '',
  width = 330,
  height = 330,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{
    currX: number;
    currY: number;
    targetX: number;
    targetY: number;
    active: boolean;
    intensity: number;
  }>({
    currX: -9999,
    currY: -9999,
    targetX: -9999,
    targetY: -9999,
    active: false,
    intensity: 0,
  });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = 0;
    let elapsedTime = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Procedural Authentic Cryptographic Seal & Security Crest
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const sCtx = srcCanvas.getContext('2d');
    if (!sCtx) return;

    sCtx.fillStyle = '#0a0a0b';
    sCtx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Ambient radial glow behind the seal
    const rad = sCtx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.48);
    rad.addColorStop(0, '#7df9c4');
    rad.addColorStop(0.2, '#1a4032');
    rad.addColorStop(0.5, '#0e1d17');
    rad.addColorStop(1, '#0a0a0b');
    sCtx.fillStyle = rad;
    sCtx.beginPath();
    sCtx.arc(cx, cy, width * 0.46, 0, Math.PI * 2);
    sCtx.fill();

    // A. Outer Certified Seal Rim with Notches / Teeth
    const rOuter = width * 0.42;
    sCtx.strokeStyle = '#7df9c4';
    sCtx.lineWidth = 3.5;
    sCtx.beginPath();
    sCtx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    sCtx.stroke();

    // 32 Precision Serrated Seal Teeth around perimeter
    for (let i = 0; i < 32; i++) {
      const angle = ((Math.PI * 2) / 32) * i;
      const isCardinal = i % 8 === 0;
      const isMajor = i % 4 === 0;
      const toothLen = isCardinal ? 10 : isMajor ? 7 : 4;
      sCtx.lineWidth = isCardinal ? 3 : isMajor ? 2 : 1.2;
      sCtx.strokeStyle = isCardinal ? '#ffffff' : '#7df9c4';
      sCtx.beginPath();
      sCtx.moveTo(
        cx + Math.cos(angle) * (rOuter - toothLen),
        cy + Math.sin(angle) * (rOuter - toothLen)
      );
      sCtx.lineTo(
        cx + Math.cos(angle) * (rOuter + 3),
        cy + Math.sin(angle) * (rOuter + 3)
      );
      sCtx.stroke();
    }

    // B. Secondary Concentric Certificate Ring
    const rInner = width * 0.355;
    sCtx.strokeStyle = '#5bc98c';
    sCtx.lineWidth = 1.8;
    sCtx.beginPath();
    sCtx.arc(cx, cy, rInner, 0, Math.PI * 2);
    sCtx.stroke();

    // Security hash beads around inner track
    for (let i = 0; i < 16; i++) {
      const a = ((Math.PI * 2) / 16) * i;
      sCtx.fillStyle = i % 2 === 0 ? '#7df9c4' : '#ffffff';
      sCtx.beginPath();
      sCtx.arc(
        cx + Math.cos(a) * (width * 0.388),
        cy + Math.sin(a) * (width * 0.388),
        2,
        0,
        Math.PI * 2
      );
      sCtx.fill();
    }

    // C. Central Cryptographic Security Shield
    const sw = width * 0.28; // Shield half-width
    const shTop = cy - width * 0.23;
    const shMid = cy + width * 0.05;
    const shBot = cy + width * 0.27;

    sCtx.beginPath();
    sCtx.moveTo(cx - sw, shTop);
    sCtx.lineTo(cx + sw, shTop);
    sCtx.quadraticCurveTo(cx + sw * 0.92, shMid, cx, shBot);
    sCtx.quadraticCurveTo(cx - sw * 0.92, shMid, cx - sw, shTop);
    sCtx.closePath();
    sCtx.fillStyle = '#101b16';
    sCtx.fill();
    sCtx.strokeStyle = '#7df9c4';
    sCtx.lineWidth = 3.5;
    sCtx.stroke();

    // Inner contour line of shield
    sCtx.beginPath();
    sCtx.moveTo(cx - sw + 7, shTop + 6);
    sCtx.lineTo(cx + sw - 7, shTop + 6);
    sCtx.quadraticCurveTo(cx + (sw - 7) * 0.92, shMid - 2, cx, shBot - 9);
    sCtx.quadraticCurveTo(cx - (sw - 7) * 0.92, shMid - 2, cx - sw + 7, shTop + 6);
    sCtx.closePath();
    sCtx.strokeStyle = '#225540';
    sCtx.lineWidth = 2;
    sCtx.stroke();

    // D. Cryptographic Padlock inside the Shield
    // 1. Shackle
    const shackleR = width * 0.075;
    const shackleY = cy - width * 0.06;
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 5.5;
    sCtx.beginPath();
    sCtx.arc(cx, shackleY, shackleR, Math.PI, 0);
    sCtx.lineTo(cx + shackleR, shackleY + 16);
    sCtx.moveTo(cx - shackleR, shackleY + 16);
    sCtx.lineTo(cx - shackleR, shackleY);
    sCtx.stroke();

    // 2. Padlock Body
    const bodyW = width * 0.21;
    const bodyH = width * 0.16;
    const bodyX = cx - bodyW / 2;
    const bodyY = shackleY + 8;

    sCtx.fillStyle = '#7df9c4';
    sCtx.beginPath();
    sCtx.roundRect(bodyX, bodyY, bodyW, bodyH, 7);
    sCtx.fill();
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 2;
    sCtx.stroke();

    // Horizontal cyber ribbing across padlock body
    sCtx.strokeStyle = '#101b16';
    sCtx.lineWidth = 2;
    sCtx.beginPath();
    sCtx.moveTo(bodyX + 6, bodyY + bodyH * 0.32);
    sCtx.lineTo(bodyX + bodyW - 6, bodyY + bodyH * 0.32);
    sCtx.stroke();

    // 3. Cryptographic Keyhole in center of padlock
    const khY = bodyY + bodyH * 0.58;
    sCtx.fillStyle = '#0a0a0b';
    sCtx.beginPath();
    sCtx.arc(cx, khY - 2, 4.5, 0, Math.PI * 2);
    sCtx.fill();

    sCtx.beginPath();
    sCtx.moveTo(cx - 3, khY);
    sCtx.lineTo(cx + 3, khY);
    sCtx.lineTo(cx + 4.5, khY + 11);
    sCtx.lineTo(cx - 4.5, khY + 11);
    sCtx.closePath();
    sCtx.fill();

    // E. Merkle Root Branches below the Shield
    sCtx.strokeStyle = '#7df9c4';
    sCtx.lineWidth = 2;
    sCtx.beginPath();
    sCtx.moveTo(cx, shBot);
    sCtx.lineTo(cx - 16, shBot + 14);
    sCtx.moveTo(cx, shBot);
    sCtx.lineTo(cx + 16, shBot + 14);
    sCtx.stroke();

    sCtx.fillStyle = '#ffffff';
    sCtx.beginPath();
    sCtx.arc(cx - 16, shBot + 14, 2.5, 0, Math.PI * 2);
    sCtx.arc(cx + 16, shBot + 14, 2.5, 0, Math.PI * 2);
    sCtx.fill();

    // F. Cardinal Verification Crosshairs
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      sCtx.fillStyle = '#ffffff';
      sCtx.beginPath();
      sCtx.arc(
        cx + Math.cos(a) * (rOuter + 8),
        cy + Math.sin(a) * (rOuter + 8),
        3,
        0,
        Math.PI * 2
      );
      sCtx.fill();
    }

    const srcImgData = sCtx.getImageData(0, 0, width, height);
    const srcPixels = srcImgData.data;

    // Grid sampling parameters (higher fidelity resolution)
    const cellSize = 5.2;
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);

    // Mouse handlers with smooth interpolation
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const m = mouseRef.current;
      m.targetX = e.clientX - rect.left;
      m.targetY = e.clientY - rect.top;
      if (!m.active) {
        m.currX = m.targetX;
        m.currY = m.targetY;
      }
      m.active = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    const render = (timeVal: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = '600 6.8px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Rotating cryptographic radar sweep angle (smooth time-based)
      const sweepAngle = (timeVal * 1.25) % (Math.PI * 2);

      // Smooth mouse coordinates lerp
      const m = mouseRef.current;
      if (m.active) {
        m.intensity += (1 - m.intensity) * 0.12;
      } else {
        m.intensity += (0 - m.intensity) * 0.08;
      }
      m.currX += (m.targetX - m.currX) * 0.15;
      m.currY += (m.targetY - m.currY) * 0.15;

      for (let r = 0; r < rows; r++) {
        const y = r * cellSize + cellSize / 2;
        const bayerRow = BAYER_4X4[r % 4];

        for (let c = 0; c < cols; c++) {
          const x = c * cellSize + cellSize / 2;
          let sx = x;
          let sy = y;

          // Pointer-driven radial ripple warp with viscous damping
          if (m.intensity > 0.01) {
            const dx = sx - m.currX;
            const dy = sy - m.currY;
            const dist = Math.hypot(dx, dy);
            const maxDist = 135;

            if (dist < maxDist && dist > 1) {
              const ripple =
                Math.sin(dist * 0.085 - timeVal * 3.2) *
                Math.max(0, 1 - dist / maxDist) *
                8.5 *
                m.intensity;
              const angle = Math.atan2(dy, dx);
              sx += Math.cos(angle) * ripple;
              sy += Math.sin(angle) * ripple;
            }
          }

          // Sample source pixel
          const clampedX = Math.max(0, Math.min(width - 1, Math.floor(sx)));
          const clampedY = Math.max(0, Math.min(height - 1, Math.floor(sy)));
          const idx = (clampedY * width + clampedX) * 4;

          // Luminance grayscale formula
          let lum =
            0.299 * srcPixels[idx] +
            0.587 * srcPixels[idx + 1] +
            0.114 * srcPixels[idx + 2];

          // Dynamic radar verification sweep effect across the seal
          const dxC = sx - cx;
          const dyC = sy - cy;
          const distFromCenter = Math.hypot(dxC, dyC);
          let beamFactor = 0;

          if (distFromCenter <= width * 0.46) {
            const cellAngle = Math.atan2(dyC, dxC);
            let angleDiff = sweepAngle - cellAngle;
            while (angleDiff < 0) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI * 2) angleDiff -= Math.PI * 2;

            // Trailing holographic sweep sector with smooth quadratic decay
            const sweepSector = 0.75;
            if (angleDiff < sweepSector) {
              beamFactor = Math.pow(1 - angleDiff / sweepSector, 2.0);
              lum += beamFactor * 58;
            }

            // Subtle harmonic breathing wave
            const breath = Math.sin(timeVal * 1.8 - distFromCenter * 0.04) * 4.5;
            lum += breath;
          }

          // Apply static Bayer dither offset for butter-smooth gradients without frame boiling
          const dither = (bayerRow[c % 4] / 15 - 0.5) * 10;
          const finalVal = Math.max(0, Math.min(255, lum + dither));

          // Map smoothly to ASCII ramp
          const rampIdx = Math.min(
            ASCII_RAMP.length - 1,
            Math.floor((finalVal / 255) * (ASCII_RAMP.length - 1))
          );
          const char = ASCII_RAMP[rampIdx];
          if (char === ' ') continue;

          // Smooth holographic color grading
          const ratio = finalVal / 255;
          const isLight = document.documentElement.classList.contains('light');

          if (isLight) {
            if (beamFactor > 0.45) {
              ctx.fillStyle = '#0369a1'; // Deep oceanic sapphire wavefront
            } else if (beamFactor > 0.15) {
              ctx.fillStyle = '#0284c7'; // Vibrant cryo-cobalt trail
            } else if (ratio > 0.65) {
              ctx.fillStyle = '#0ea5e9'; // Luminous electric cyan highlight
            } else if (ratio > 0.42) {
              ctx.fillStyle = '#38bdf8'; // Soft sky blue
            } else if (ratio > 0.22) {
              ctx.fillStyle = '#7dd3fc'; // Pale ice
            } else {
              ctx.fillStyle = '#bae6fd'; // Faint frost boundary
            }
          } else {
            if (beamFactor > 0.45) {
              ctx.fillStyle = '#ffffff'; // Radiant sweep wavefront
            } else if (beamFactor > 0.15) {
              ctx.fillStyle = '#b6ffdf'; // Soft glowing mint trail
            } else if (ratio > 0.65) {
              ctx.fillStyle = '#7df9c4'; // Vibrant mint highlight
            } else if (ratio > 0.42) {
              ctx.fillStyle = '#5bc98c'; // Emerald
            } else if (ratio > 0.22) {
              ctx.fillStyle = '#9ca3af'; // Cyber gray
            } else {
              ctx.fillStyle = '#374151'; // Dark matrix hairline
            }
          }

          ctx.fillText(char, x, y);
        }
      }
    };

    if (shouldReduceMotion) {
      render(0);
      return () => {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
      };
    }

    const loop = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;
      elapsedTime += dt;

      render(elapsedTime);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [height, shouldReduceMotion, width]);

  return (
    <div
      className={`relative inline-flex flex-col justify-between w-full max-w-[355px] h-[435px] rounded-2xl border border-[var(--color-accent)]/25 bg-[#0c0d12]/95 p-3.5 shadow-[0_0_35px_rgba(125,249,196,0.1),0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl glow-accent group transition-all duration-300 hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_45px_rgba(125,249,196,0.18),0_25px_60px_rgba(0,0,0,0.85)] ${className}`}
    >
      {/* 4 Precision Optic Corner Reticles */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-[var(--color-accent)]/70 pointer-events-none transition-all duration-300 group-hover:border-[var(--color-accent)] group-hover:scale-105" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-[var(--color-accent)]/70 pointer-events-none transition-all duration-300 group-hover:border-[var(--color-accent)] group-hover:scale-105" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-[var(--color-accent)]/70 pointer-events-none transition-all duration-300 group-hover:border-[var(--color-accent)] group-hover:scale-105" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-[var(--color-accent)]/70 pointer-events-none transition-all duration-300 group-hover:border-[var(--color-accent)] group-hover:scale-105" />

      {/* Top Header Strip */}
      <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
        <div className="font-mono text-[10px] text-[var(--color-accent)] bg-black/60 px-2.5 py-1 rounded-md border border-[var(--color-accent)]/30 flex items-center gap-2 backdrop-blur shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]" />
          </span>
          <span className="font-bold tracking-wider">CRYPTOGRAPHIC_SEAL // ED25519</span>
        </div>
        <div className="font-mono text-[9px] text-[var(--color-muted)] bg-black/60 px-2 py-1 rounded-md border hairline">
          RFC 8785
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="block rounded-xl cursor-pointer mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
        title="Interactive Holographic ASCII Seal — move cursor to induce radial ripple warp"
      />

      {/* Bottom Footer Strip */}
      <div className="flex items-center justify-between gap-2 mt-2.5 px-1 font-mono text-[9px] text-[var(--color-muted)]">
        <span className="bg-black/60 px-2 py-1 rounded-md border hairline text-neutral-400">
          SHA-256 ROOTS
        </span>
        <span className="text-[var(--color-accent)] bg-black/60 px-2 py-1 rounded-md border border-[var(--color-accent)]/30 flex items-center gap-1.5 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent)]" />
          HARDWARE LOCKED
        </span>
      </div>
    </div>
  );
};
