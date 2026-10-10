# Black Box Landing Page — Design & Animation Architecture Specification

> **Aesthetic Identity:** Terminal-grade developer showcase. Dark cybernetic canvas (`#0A0A0B`), hairline borders (`#1F1F23`), electric mint interactive affordances (`#7DF9C4`), Floyd-Steinberg ASCII dithering, canvas particle physics, velocity-reactive tickers, and 3D scroll-driven perspective card choreography.

---

## 1. Landing Page Section Hierarchy & Narrative Flow

The landing page is designed as an interactive, scroll-driven developer narrative. Every section visually demonstrates technical depth without resorting to generic SaaS illustrations or purple gradients.

```
┌─────────────────────────────────────────────────────────────┐
│ ScrollProgress (Fixed 2px mint spring bar at viewport top) │
├─────────────────────────────────────────────────────────────┤
│ AmbientBackground (Fixed -z-10 downscaled sine plasma)     │
├─────────────────────────────────────────────────────────────┤
│ 1. HERO SECTION                                             │
│    - AsciiReveal matrix backdrop (canvas with mouse glow)   │
│    - Dot-matrix brand mark + minimal nav                    │
│    - Sentry for AI Agents monospace pill badge              │
│    - ParticleText interactive canvas particle wordmark      │
│    - Headline with AnnotatedText (SVG drawn underline/circle│
│    - Dual CTA: Launch Dashboard & Instant 1-Click Guest     │
│    - TraceStatusCard: Flight-status simulated live monitor  │
├─────────────────────────────────────────────────────────────┤
│ 2. VELOCITY SCROLL TICKER                                   │
│    - Bi-directional infinite marquee responding to velocity│
│    - Row 1: Injected fault classes (drifts left)            │
│    - Row 2: Measured accuracy & invariant metrics (right)   │
├─────────────────────────────────────────────────────────────┤
│ 3. HOW IT LOCALIZES A FAULT (FeatureDeepDive)               │
│    - Card 01: 10-Feature Invariant Scanner (scaleX meters)  │
│    - Card 02: Gemini Root Cause (syntax-lit JSON preview)   │
│    - Card 03: Deterministic Suffix Replay (swipe slider)    │
│    - Card 04: SHAP Feature Attribution (animated bars)      │
├─────────────────────────────────────────────────────────────┤
│ 4. 3D PLATFORM GALLERY (SpiralGallery)                      │
│    - Pinned 240vh scroll stage                              │
│    - Left: Floyd-Steinberg dithered ASCII bust (AsciiImage) │
│    - Right: 3D rotating card stack (rotateY, Z-depth, X)    │
├─────────────────────────────────────────────────────────────┤
│ 5. ARCHITECTURAL CLAIMS (ClosingNotes)                      │
│    - Staggered grid stating verified performance & limits   │
├─────────────────────────────────────────────────────────────┤
│ 6. FOOTER & TERMINAL QUOTE (FooterQuote)                    │
│    - Terminal blockquote: $ cat principles.txt (Dijkstra)   │
│    - Final 60-second CTA                                    │
│    - Live polling backend status ping (BACKEND LIVE/OFFLINE)│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens & Styling Primitives

Implemented in **Tailwind CSS v4** (`index.css`):

```css
@import 'tailwindcss';

@theme {
  --color-bg: #0a0a0b;
  --color-panel: #111113;
  --color-border: #1f1f23;
  --color-text: #e8e8e8;
  --color-muted: #8a8a92;
  --color-accent: #7df9c4;
  --color-warn: #e8b14c;
  --color-critical: #e0574c;
  --color-pass: #5bc98c;

  --font-display: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --radius-panel: 4px;
}

html {
  background-color: var(--color-bg);
  color-scheme: dark;
}

body {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Hairline rule */
.hairline {
  border: 1px solid var(--color-border);
}

/* Monospace telemetry */
.data {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: -0.01em;
}

/* Cybernetic dot-matrix */
.dot-matrix {
  background-image: radial-gradient(var(--color-border) 1px, transparent 1px);
  background-size: 4px 4px;
}

/* Mint showcase glow */
.glow-accent {
  border-color: color-mix(in oklab, var(--color-accent) 34%, transparent);
  box-shadow: 0 0 22px -10px var(--color-accent), inset 0 0 18px -14px var(--color-accent);
}

.glow-accent-strong {
  border-color: color-mix(in oklab, var(--color-accent) 55%, transparent);
  box-shadow: 0 0 34px -10px var(--color-accent), inset 0 0 22px -14px var(--color-accent);
}
```

---

## 3. Detailed Component & Animation Specifications

### 1. `ScrollProgress.tsx` (Top Scroll Meter)
- **Concept**: A 2px thin horizontal indicator fixed at `top: 0, left: 0, right: 0`.
- **Implementation**:
  - Connects to Framer Motion's `useScroll().scrollYProgress`.
  - Smoothed using `useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })`.
  - Driven purely by `scaleX` transform (`origin-left bg-accent`), preventing layout recalculation.

### 2. `AsciiReveal.tsx` (Hero Background Interactive Matrix)
- **Concept**: An ambient full-screen ASCII field of characters (` .:-=+*#%@`) that reacts to pointer interaction with a decaying mint trail.
- **Canvas Pipeline**:
  - Grid cell size: 17px (`Geist Mono`, centered).
  - Ambient base wave: `wave = 0.3 + 0.1 * Math.sin(x * 0.03 + y * 0.025 + t)`.
  - Cursor interaction: Calculates distance from mouse pointer `dist = Math.hypot(x - mouse.x, y - mouse.y)`.
  - Smoothstep falloff: `linear = 1 - dist / radius`, `near = linear * linear * (3 - 2 * linear)`.
  - Heatmap trail: Stored in a `Map<string, number>` decaying at `prev * 0.92` per frame.
  - Character rendering: Maps brightness to glyph array. RGB interpolates from dark baseline (`#3a3a40`) to mint (`#7DF9C4`).
  - Accessibility: If `useReducedMotion()` is true, renders a single static frame with no `requestAnimationFrame` loop.

### 3. `ParticleText.tsx` (Interactive Wordmark Physics)
- **Concept**: "BLACK BOX" wordmark rendered as interactive canvas particles.
- **Physics Engine**:
  - Measures text on an offscreen canvas with `Space Grotesk 700` at 104px.
  - Scans pixels: If alpha > 128, registers a particle at home coordinates `(hx, hy)`.
  - Pointer Repulsion: When cursor is within radius (80px), calculates repulsion velocity vector:
    $$F = (1 - \text{dist} / \text{radius}) \cdot 7$$
    $$vx -= \cos(\theta) \cdot F, \quad vy -= \sin(\theta) \cdot F$$
  - Spring-to-Home Force:
    $$vx += (hx - x) \cdot 0.08, \quad vy += (hy - y) \cdot 0.08$$
  - Friction/Damping: `vx *= 0.84`, `vy *= 0.84`.
  - Responsive Fallback: Detects screens < 1024px or reduced-motion preference and falls back to clean, responsive text.

### 4. `AnnotatedText.tsx` (Hand-Drawn SVG Accent Annotations)
- **Concept**: Organic hand-drawn SVG underlines and circles that draw themselves when scrolled into viewport.
- **Path Geometry**:
  - Underline: `M2,15 C 22,10 44,19 66,13 C 80,9 92,16 98,12`
  - Circle: `M50,4 C 80,4 97,12 97,20 C 97,30 74,36 50,36 C 26,36 3,30 3,20 C 3,12 22,4 50,5`
- **Animation**:
  - Uses Framer Motion's `whileInView={{ pathLength: 1, opacity: 0.9 }}` with `viewport={{ once: true, amount: 0.8 }}`.
  - Duration: 0.7s `easeOut`. Zero animation under reduced motion (`pathLength: 1`).

### 5. `TraceStatusCard.tsx` (Simulated Live Trace Monitor)
- **Concept**: Flight-board style widget demonstrating real-time fault localization and fork resolution.
- **State Machine**:
  - Step ticks every 230ms across 12 steps (`[2, 3, 1, 5, 2, 4, 9, 88, 11, 6, 3, 2]`).
  - Step 7 is scored at `88` (critical threshold).
  - While running: Step 7 lights up in crimson (`#E0574C`) with a glowing box-shadow `0 0 10px #e0574c` and header displays `FAIL`.
  - When the cycle exceeds step count: Simulates automatic checkpoint fork. Step 7 and the run flip to emerald `SUCCESS` (`#5BC98C`).

### 6. `VelocityScroll.tsx` (Velocity-Reactive Dual Marquee)
- **Concept**: Infinite ticker running in two opposite directions whose speed and direction dynamically adapt to scroll velocity.
- **Physics**:
  - Connects `scrollY` -> `useVelocity(scrollY)` -> `useSpring(..., { damping: 50, stiffness: 400 })`.
  - Normalizes velocity multiplier: `useTransform(smoothVelocity, [0, 1000], [0, 4])`.
  - Translates `baseX` continuously in `useAnimationFrame()`.
  - If user scrolls downward fast, marquee accelerates; if user scrolls upward, marquee reverses direction.
  - Four cloned repetitions ensure seamless looping using modulo wrap `wrap(-25, -50, v)%`.

### 7. `FeatureDeepDive.tsx` (Interactive Localization Visuals)
Four interactive cards demonstrating technical mechanics:
- **Card 01 (10-Feature Invariant Scanner)**: 10 progress bars animated via `whileInView={{ scaleX: fill }}` with staggered delay (`i * 0.03s`).
- **Card 02 (Gemini Root Cause)**: Terminal card rendering `explanation.json` with mint keys and off-white values.
- **Card 03 (Deterministic Suffix Replay)**: Interactive range slider (`input[type="range"]`) controlling a CSS `clipPath: inset(0 (100 - val)% 0 0)` overlay to wipe between failed parent steps and resolved child steps.
- **Card 04 (SHAP Feature Attribution)**: Horizontal bars comparing feature weights (`semantic_deviation`, `arg_novelty`, `duration_z`) using `whileInView={{ scaleX }}`.

### 8. `SpiralGallery.tsx` (Scroll-Driven 3D Perspective Stack)
- **Concept**: Pinned 240vh scroll stage pairing a 3D rotating card stack with a Floyd-Steinberg ASCII portrait.
- **3D Transform Matrix**:
  - `active = progress * (total - 1)`
  - `rotateY = (index - active) * -32deg`
  - `z = -Math.abs(index - active) * 260px`
  - `x = (index - active) * 46%`
  - `opacity = Math.max(0, 1 - Math.abs(index - active) * 0.6)`
  - `zIndex = Math.round(100 - Math.abs(index - active) * 10)`
- **`AsciiImage.tsx` Integration**:
  - Renders image to offscreen canvas, applies luminance grayscale, contrast, and Floyd-Steinberg error diffusion dithering.
  - Pointer Flow: Cursor movement generates radial sine wave distortion ripples in real time.

### 9. `ClosingNotes.tsx` (Verified Claims & Caveats)
- Staggered container (`staggerChildren: 0.08s`) displaying 4 glassmorphic cards (`.hairline .glow-accent .bg-panel/70 .backdrop-blur`).
- Communicates verified performance guarantees and architectural transparency.

### 10. `FooterQuote.tsx` (Terminal Quote & Live Health Ping)
- **Terminal Figure**: `$ cat principles.txt` with quote from Edsger W. Dijkstra: *"Simplicity is prerequisite for reliability."*
- **Final CTA**: "Get Started in 60 Seconds" with 1-click access button.
- **Live Health Status**: Polls backend `/health` endpoint every 30s with `AbortController`, rendering live status indicator dot (`bg-pass` / `bg-critical`) and label (`BACKEND LIVE` / `BACKEND OFFLINE`).

---

## 4. Responsive & Accessibility Rules
- **Reduced Motion**: Under `prefers-reduced-motion`, all canvas animations cease continuous rAF loops and paint one static frame; 3D perspective transforms collapse into a readable two-column grid.
- **Device Scaling**: ParticleText automatically collapses to responsive display text on screens `< 1024px`.
- **Contrast**: All body text is `#E8E8E8` on `#0A0A0B` / `#111113`, achieving WCAG AAA compliance.
