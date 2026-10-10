# Black Box Frontend Design System & Component Architecture Specification

> **Aesthetic Archetype:** *Sentry for AI Agents* — Dark, terminal-adjacent cybernetic telemetry with hairline borders, monospace data precision, and electric mint interactive affordances.

---

## 1. Executive Summary & Design Philosophy

The Black Box frontend is built as a developer-grade observability dashboard. It consciously avoids generic AI SaaS clichés (e.g., violet/indigo blur gradients, floating cards with high border radii, bubbly illustrations, fake counters, and em dashes in copy).

### Core Aesthetic Pillars
1. **Terminal-Adjacent Precision**: Hairline (`1px`) borders (`#1F1F23`) establish visual hierarchy. Backgrounds sit on near-black (`#0A0A0B` / `#111113`).
2. **Reserved Accent Role**: Electric mint (`#7DF9C4`) is strictly reserved for interactive affordances, selected states, focus outlines, and actionable insights. It is never used as large decorative floods on data pages.
3. **Typography Discipline**:
   - **Headings & Display**: Space Grotesk (geometric, technical).
   - **Body & Prose**: Geist (clean, neutral neo-grotesque).
   - **Data & Telemetry**: Geist Mono (mandatory for all IDs, JSON, step indices, field paths, timestamps, metric outputs, and diffs).
4. **Honest Data Visualization**: No fake metrics, no smoothed/approximated curves, no synthetic "99.9% uptime" badges. Every metric and bar directly reflects measurable telemetry.
5. **GPU-Accelerated Lightweight Motion**: Micro-interactions rely on transform and opacity (`scaleX`, `translate`, `pathLength`). Layout-thrashing properties (`width`, `height`, `margin`) are avoided.
6. **Strict Motion Accessibility**: Every canvas animation and Framer Motion transition natively checks `useReducedMotion()`. If reduced motion is requested, canvas loops halt and paint a single static frame; transitions drop duration to zero.

---

## 2. Design Tokens & CSS Foundation

The design system is implemented with **Tailwind CSS v4** using the `@theme` directive.

### Color Tokens
| Token | Hex Value | Usage / Semantics |
| :--- | :--- | :--- |
| `--color-bg` | `#0A0A0B` | Canvas background. Must be set on `html`, not `body`, to allow negative z-index canvas atmospheres to shine through. |
| `--color-panel` | `#111113` | Panels, card containers, dialog modals, side drawers, tables. |
| `--color-border` | `#1F1F23` | Structural hairline 1px borders, separators, subtle grid lines. |
| `--color-text` | `#E8E8E8` | High-contrast body text, primary values. |
| `--color-muted` | `#8A8A92` | Secondary labels, descriptions, timestamps, inactive states. |
| `--color-accent` | `#7DF9C4` | Electric mint. Interactive states, focused inputs, key highlights. |
| `--color-warn` | `#E8B14C` | Amber/Gold. Elevated risk, outlier warnings, moderate blame. |
| `--color-critical`| `#E0574C` | Crimson. Injected fault, fatal error, flagged blame step, failures. |
| `--color-pass` | `#5BC98C` | Emerald. Successful execution, clean state, resolved fork. |

### Typography Tokens
| Token | Font Family | Intended Context |
| :--- | :--- | :--- |
| `--font-display`| `'Space Grotesk', ui-sans-serif, system-ui, sans-serif` | H1–H4 headings, key metric numbers, showcase banners. |
| `--font-sans` | `'Geist', ui-sans-serif, system-ui, sans-serif` | Paragraphs, documentation, button labels, descriptions. |
| `--font-mono` | `'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace` | All machine identifiers, step indices, JSON blocks, diffs. |

### Custom Utility Classes
```css
/* Dot-matrix texture for subtle cybernetic background layers */
.dot-matrix {
  background-image: radial-gradient(var(--color-border) 1px, transparent 1px);
  background-size: 4px 4px;
}

/* Hairline border rule */
.hairline {
  border: 1px solid var(--color-border);
}

/* Strict data cell typography */
.data {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: -0.01em;
}

/* Mint glow effect for featured showcase cards */
.glow-accent {
  border-color: color-mix(in oklab, var(--color-accent) 34%, transparent);
  box-shadow: 0 0 22px -10px var(--color-accent), inset 0 0 18px -14px var(--color-accent);
}

.glow-accent-strong {
  border-color: color-mix(in oklab, var(--color-accent) 55%, transparent);
  box-shadow: 0 0 34px -10px var(--color-accent), inset 0 0 22px -14px var(--color-accent);
}

/* Glow text title */
.card-title {
  font-family: var(--font-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-accent);
  text-shadow: 0 0 14px color-mix(in oklab, var(--color-accent) 45%, transparent),
               0 0 30px color-mix(in oklab, var(--color-accent) 20%, transparent);
}
```

### Global Input Hover/Focus Styling
```css
input:not([type='range']):not([type='checkbox']):not([type='radio']),
textarea,
select {
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

input:not([type='range']):not([type='checkbox']):not([type='radio']):hover,
textarea:hover,
select:hover {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px rgba(125, 249, 196, 0.18);
}

input:not([type='range']):not([type='checkbox']):not([type='radio']):focus,
textarea:focus,
select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px rgba(125, 249, 196, 0.25);
}
```

---

## 3. Component Catalog & Architecture

The frontend consists of four primary component tiers:
1. **Foundational & Shell Components**
2. **Telemetry & Execution Observability Components**
3. **Creative Canvas & Procedural Visuals (`ui/`)**
4. **Analytics & Data Visualizations (`views/`)**

---

### Tier 1: Foundational & Shell Components

#### `AppShell.tsx`
- **Purpose**: Global application container providing persistent navigation header, route view host, background health checking, user session pill, toast notification host, and footer.
- **Key Features**:
  - Polling backend health hook (`useBackendHealth`) with colored status indicator dot (`bg-pass` / `bg-critical`).
  - Toast provider (`ToastContext`) with auto-dismissing notification toasts animated via Framer Motion's `AnimatePresence`.
  - Consistent `LoadingState`, `ErrorState`, and `EmptyState` primitives used across all child views.
- **Props**:
  ```ts
  interface AppShellProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    children: ReactNode;
  }
  ```

#### `CopyableId.tsx`
- **Purpose**: Monospace identifier with click-to-copy clipboard integration.
- **Behavior**:
  - Truncates long hashes if `displayLength` is provided (e.g., first 8 chars in tables).
  - Shows copy icon on hover; on click, writes to `navigator.clipboard` and switches to a green checkmark + "copied" badge for 1.2s via Framer Motion.
  - Gracefully catches clipboard failures over insecure HTTP.

#### `AnimatedNumber.tsx`
- **Purpose**: Smoothly animates numeric counters from 0 (or previous value) to a target value using Framer Motion's imperative `animate()`.
- **Behavior**:
  - Uses `display.toFixed(decimals) + suffix`.
  - Automatically bypasses interpolation under `useReducedMotion()`.

#### `FilterBar.tsx`
- **Purpose**: High-performance client-side filter bar.
- **Signature Feature**: Uses Framer Motion's `layoutId="pill-[group]"` to slide a single active highlight pill behind selected buttons smoothly without jarring swaps. Includes live search input with immediate count update.

---

### Tier 2: Telemetry & Execution Observability Components

#### `MetricsHeader.tsx`
- **Purpose**: Four-column KPI metrics row above data tables (`Total Runs`, `Trained-Class Accuracy`, `Hybrid Engine Accuracy`, `Fault Detection Rate`).
- **Behavior**: Staggered container animations, pulse skeleton loaders when loading, hover mint-glow border highlights.

#### `RunsTable.tsx`
- **Purpose**: High-density table displaying execution runs with instant visual cues.
- **Key Elements**:
  - `StatusBadge`: Pulsing dot (`bg-pass` or `bg-critical`) with glow ring.
  - `OriginBadge`: Shows whether a run is `original` or `fork @step X`.
  - `AnimatePresence` layout transitions for filtered rows.
  - Monospace formatting on step counts, execution durations, and run IDs.

#### `TraceHeatmap.tsx`
- **Purpose**: Horizontal per-step blame heatmap scoring step suspicion from `0` to `100`.
- **Design Logic**:
  - Step bars dynamically scale in height: `16 + score * 0.4 px`.
  - Binned into 3 score bands:
    - **Healthy** (`< 8`): `bg-pass/70`.
    - **Elevated** (`8 - 39`): `bg-warn` with amber shadow.
    - **Flagged / Critical** (`>= 40` or flagged by classifier): `bg-critical` with crimson shadow.
  - Selected step elevates by `-4px` with an electric mint focus ring (`ring-2 ring-accent shadow-[0_0_16px_-2px_var(--color-accent)]`).
  - Hovering reveals a contextual monospace tooltip with tool name, execution latency, score, and anomaly signals.

#### `StepTimeline.tsx`
- **Purpose**: Vertical sequential step timeline showing sequential execution flow.
- **Design Logic**:
  - Left vertical timeline spine (`w-px bg-border`) with circular step sequence badges (`size-7`).
  - Real step duration bar (`Math.round((step.duration_ms / maxDuration) * 100)%`).
  - Duration outliers calculated using client-side Z-score `(durationMs - mean) / std`:
    - `Z >= 2`: `bg-critical/70`.
    - `Z >= 1`: `bg-warn/70`.
    - `Z < 1`: `bg-muted/50`.
  - Flagged step prominently badges `flagged` and displays model feature `duration_z`.

#### `StepInspector.tsx`
- **Purpose**: Slide-over drawer dialog (`fixed inset-y-0 right-0 max-w-xl`) detailing step telemetry, feature attributions, and remediation tools.
- **Sub-Panels**:
  1. **Step Telemetry**: Formatted JSON blocks for `input`, `output`, and `state_snapshot`.
  2. **SHAP Feature Attribution**: Horizontal bar chart comparing positive vs negative SHAP impacts (`semantic_deviation`, `arg_novelty`, `duration_z`, etc.) with mint vs muted bars.
  3. **Root Cause Analysis (AI Explain)**: Displays predicted fault class, explanation of root cause, evidence summary, and proposed JSON code fix.
  4. **Multi-Candidate Parallel Forking**: Forks multiple candidate patches in parallel via `Promise.allSettled()`, checks if child runs flip from `failed` to `success`, and allows saving the winner as a regression test.

#### `TraceComparison.tsx`
- **Purpose**: Side-by-side comparative inspection between parent run and forked child run.
- **Layout**: Two columns (Parent vs Child), each hosting `MiniHeatmap` and `MiniTimeline`. The patched step is framed with a mint accent ring on both sides to track the mutation.

---

### Tier 3: Creative Canvas & Procedural Visuals (`ui/`)

#### `ClosingPlasma.tsx`
- **Mathematics & Pipeline**:
  - Renders a multi-sine wave plasma shader entirely on HTML5 Canvas 2D without WebGL overhead.
  - **Downscaled Rendering Trick**: Calculates math on an offscreen buffer at **1/10th scale** (`bw = width / 10`, `bh = height / 10`). Blits onto the display canvas with `imageSmoothingEnabled = true`, yielding a silky smooth ambient atmospheric glow at negligible CPU/GPU cost.
  - Formula:
    $$v = \sin(x \cdot 0.28 + t) + \sin(y \cdot 0.24 - 0.8t) + \sin((x+y) \cdot 0.18 + 0.5t) + \sin(\sqrt{x^2+y^2} \cdot 0.3 - t)$$
    $$m = \left(\frac{v+4}{8}\right)^{2.2} \cdot 0.5$$
  - Interpolates RGB strictly between canvas dark (`#0A0A0B`) and electric mint (`#7DF9C4`). Zero purple banding.

#### `AsciiImage.tsx`
- **Pipeline**:
  1. Image loaded and drawn to an offscreen buffer with cover-fit aspect ratio.
  2. Pixel data converted to luminance: $L = 0.299R + 0.587G + 0.114B$.
  3. Contrast and brightness adjustments applied.
  4. **Floyd-Steinberg Error Diffusion Dithering**: Diffuses quantization error to neighbor cells (`(x+1, y)`, `(x-1, y+1)`, `(x, y+1)`, `(x+1, y+1)`) to create a textured, photographic print quality.
  5. **Interactive Pointer Flow**: Cells within cursor radius compute a radial sine wave displacement ripple, dynamically warping the ASCII characters on hover.

#### `AsciiReveal.tsx`
- **Purpose**: Monospace glyph background matrix (` .:-=+*#%@`).
- **Behavior**: Baseline glyphs pulse with an ambient low-frequency wave. Cursor hover injects additive mint brightness with a decaying heat trail (smoothstep falloff).

#### `ParticleText.tsx`
- **Purpose**: Large typography composed of canvas particles that disperse on mouse interaction.
- **Physics**: Renders text to an offscreen canvas, samples pixels with alpha > 128 into particle coordinates `(hx, hy)`. On cursor proximity, particles are pushed away; spring forces pull particles back to home coordinates with velocity damping.

#### `SpiralGallery.tsx`
- **Purpose**: 3D scroll-driven stacked cards alongside an ASCII portrait bust.
- **Transforms**: Maps `useScroll()` progress to 3D CSS transforms: `rotateY`, depth `z` (up to -260px), translation `x`, `opacity`, and `zIndex`.

#### `VelocityScroll.tsx`
- **Purpose**: Bi-directional marquee ticker that accelerates or reverses based on page scroll velocity (`useVelocity(scrollY)` + `useSpring()`).

#### `TraceStatusCard.tsx`
- **Purpose**: Flight-board style widget simulating a live agent run.
- **Animation**: Ticks through step indices sequentially, flags step 7 in crimson, and animates a fork resolution that turns the run emerald `SUCCESS`.

#### `AnnotatedText.tsx`
- **Purpose**: Hand-drawn SVG underline or circle highlights that draw themselves with Framer Motion `pathLength: 1` when scrolled into view.

---

### Tier 4: Analytics & Data Visualizations (`views/`)

Built using **Recharts**, configured to strictly match the terminal design tokens:
- **Radar Charts**: Multi-axis model capability breakdown across failure classes.
- **Bar & Area Charts**: Reliability trends, tokens/step distributions, error frequencies.
- **Chart Tooltips**: Fully customized with `.hairline`, `.bg-panel`, and `.data` monospace labels.

---

## 4. Reusability & Extraction Guide

To lift these components into another project, follow these dependency and configuration steps:

### 1. Required Dependencies
```bash
npm install framer-motion recharts
npm install -D tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom
```

### 2. Fonts Configuration
Include the following in your `index.html` `<head>` or CSS imports:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

### 3. Tailwind CSS Setup (`index.css`)
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
```

### 4. Component File Structure for Reuse
```
src/
├── components/
│   ├── ui/
│   │   ├── ClosingPlasma.tsx      # Canvas ambient plasma shader
│   │   ├── AsciiImage.tsx         # Floyd-Steinberg ASCII canvas renderer
│   │   ├── AsciiReveal.tsx        # Interactive ASCII matrix background
│   │   ├── ParticleText.tsx       # Interactive particle text physics
│   │   ├── SpiralGallery.tsx      # Scroll-driven 3D card carousel
│   │   ├── VelocityScroll.tsx     # Velocity-responsive marquee ticker
│   │   ├── TraceStatusCard.tsx    # Live simulation status widget
│   │   ├── AnnotatedText.tsx      # SVG self-drawing text annotation
│   │   └── ScrollProgress.tsx     # Top scroll indicator
│   ├── AmbientBackground.tsx      # Viewport background manager
│   ├── AnimatedNumber.tsx         # Imperative count-up number
│   ├── CopyableId.tsx             # Click-to-copy mono ID button
│   ├── FilterBar.tsx              # Sliding pill filter controls
│   ├── MetricsHeader.tsx          # Metric cards grid
│   ├── RunsTable.tsx              # High-density data table
│   ├── StepTimeline.tsx           # Vertical execution timeline
│   ├── TraceHeatmap.tsx           # Step blame heat bar
│   ├── StepInspector.tsx          # Slide-over telemetry & fix drawer
│   └── TraceComparison.tsx        # Side-by-side run comparison
```
