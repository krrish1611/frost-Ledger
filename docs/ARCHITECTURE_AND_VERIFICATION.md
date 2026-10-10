# FrostLedger: Architecture & Verification Specification

**Blockchain-Enabled IoT Cold Chain Storage & Tamper Detection System with AI Advisory Layer**
**Version**: 3.1-production
**Target Network**: Polygon Amoy Testnet (Chain ID 80002)
**EVM Contract Address**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`

---

## 1. System Overview & Core Separation Principle

FrostLedger implements an enterprise-grade IoT cold chain assurance platform designed for pharmaceutical biologics, vaccines, and high-value temperature-sensitive cargo.

### The Immutable Separation Rule
The platform enforces a strict cryptographic boundary:
* **The Official Record**: Telemetry records, canonical SHA-256 hashes, Ed25519 digital signatures, hash chains, Merkle roots, Polygon Amoy blockchain anchors, Mean Kinetic Temperature (MKT), USP <1160> Arrhenius shelf-life degradation, and official cold chain compliance alerts are calculated **strictly by deterministic TypeScript and Solidity code**.
* **The AI/ML Advisory Layer**: Streaming Python service (River HalfSpaceTrees, EWMA/CUSUM drift detectors, and Scikit-Learn baseline shadow evaluators) provides **advisory-only warnings, risk indices, and early excursion forecasts**. The AI engine operates with read-only access to official tables and **never** writes to, replaces, or feeds into official compliance records or smart contracts. Every AI artifact carries the mandatory label: `"AI-generated, advisory"`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DETERMINISTIC PLANE                             │
│                                                                             │
│  [IoT Gateway] ──(Ed25519)──► [Canonical Hashing] ──► [PostgreSQL Triggers] │
│                                      │                                      │
│                                      ▼                                      │
│                           [Polygon Amoy Anchor]                             │
│                                      │                                      │
│                           [Arrival Verifier (5-pt)]                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Read-Only Telemetry Replay)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI/ML ADVISORY PLANE                              │
│                                                                             │
│  [Streaming HalfSpaceTrees] ──► [CUSUM Drift] ──► [Composite Risk (0-100)]  │
│                                                          │                  │
│                                                          ▼                  │
│                                            [Debounced Alerts & Dashboard]   │
│                                            * AI-generated, advisory only    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Structure

```
d:/FROSTLEDGER/
├── ai-service/           # Python 3.13 streaming ML service (River HST, CUSUM, Evaluator, FastAPI)
├── backend/              # Node.js/TypeScript Express API & Database services
│   ├── src/db/           # PostgreSQL migration scripts & immutable trigger definitions
│   └── test/             # 43 acceptance tests across 7 comprehensive test suites
├── contracts/            # Solidity smart contracts & Hardhat test suite for Polygon Amoy
├── frontend/             # React 18 + Vite + TypeScript dashboard (Sentry for AI Agents theme)
├── shared/               # Common interfaces, cryptographic schemas, and validation utilities
├── simulator/            # Multi-scenario IoT telemetry generator & Ed25519 keypair CLI
├── worker/               # Background queue worker (Polygon Amoy anchor dispatcher)
├── scripts/              # Monorepo CI verification script (`ci.js`)
└── docs/                 # PRD v3.1, Design specs, and Architecture documentation
```

---

## 3. Stage-by-Stage Implementation Summary

### Stage 0 & 1: Schema Architecture & Cryptographic Ingestion
* **Database Triggers**: `audit_log` with row-level immutable triggers preventing UPDATE and DELETE operations on historical batches, telemetry, and contract anchor records.
* **Canonical Hashing**: RFC 8785 compliant canonical JSON serialization with deterministic SHA-256 batch hash calculation.
* **Ed25519 Verification**: Ingestion gateway validates device hardware digital signatures before persisting batches.

### Stage 2: Multi-Scenario Simulator CLI
* **Scenarios Built**:
  1. `nominal-vaccine`: Stable 4°C to 5°C Pfizer-BioNTech mRNA telemetry.
  2. `gradual-drift`: Slow linear warming simulating insulation failure.
  3. `severe-spike`: Rapid jump to 18°C simulating compressor failure.
  4. `sensor-flatline`: Repeated identical sensor readings simulating spoofing/freezing.
  5. `duplicate-tamper`: Sequence counter replay and copied payload attack.

### Stage 3: USP <1160> Arrhenius Kinetics Engine
* **Mean Kinetic Temperature (MKT)**:
  $$\Delta H / R = 10,000\text{ K},\quad T_K = \frac{\Delta H / R}{-\ln\left(\frac{1}{n} \sum e^{-\frac{\Delta H / R}{T_i}}\right)}$$
* **Arrhenius Degradation**:
  $$k(T) = A \cdot \exp\left(-\frac{E_a}{R \cdot T}\right)$$
* Calculates real-time remaining shelf life percentage and cumulative thermal excursion seconds.

### Stage 4: Polygon Amoy Smart Contracts & Arrival Verification
* **Solidity Anchor**: `ColdChainAnchor.sol` storing batch Merkle root, timestamp, and device public key.
* **5-Point Arrival Proof**:
  1. Batch Canonical SHA-256 Rehash Match.
  2. Ed25519 Hardware Signature Verification.
  3. Merkle & Hash-Chain Sequence Continuity (`prev_hash`).
  4. Polygon Amoy On-Chain Anchor Existence & Block Timestamp Consistency.
  5. Product Profile Corridor & Activation Energy Integrity.
* **Tamper Simulation**: Real-time simulation demonstrates that single-byte database manipulation invalidates the 5-point proof instantly.

### Stage 5: AI Engine Core (Streaming Anomaly Detection)
* **River HalfSpaceTrees**: One-pass, windowed streaming isolation trees trained with 25 trees, window size 50, depth 8.
* **Drift & Spoofing Detectors**:
  * EWMA / CUSUM positive and negative drift detector.
  * Rate-of-change spike check ($> 3.0^\circ\text{C}$ in $< 5\text{ mins}$).
  * Rule-based flatline detector ($> 5$ consecutive identical floats).
  * Checkpoint persistence to `ai_model_state` table with graceful warm restart.

### Stage 6: Composite Risk Scoring & Rate-Limited Alerts
* **Composite Risk Index** $\in [0, 100]$:
  $$\text{Score} = 0.35 \times \text{Thermal} + 0.25 \times \text{Anomaly} + 0.15 \times \text{Drift} + 0.15 \times \text{Kinetics} + 0.10 \times \text{Security}$$
* **Biologic Freeze Hazard**: Extra penalty when biologic temperatures dip below $0^\circ\text{C}$.
* **Notification Engine**:
  * 15-minute quiet period debounce for repeated excursions.
  * Hard rate limit: maximum 4 emails per shipment per hour.
  * Mandatory disclaimer injected in email body: `"AI-generated, advisory"`.

### Stage 7: Offline ML Evaluation & Shadow Benchmarking
* **Benchmarking Engine**: `ai-service/evaluator.py` evaluating streaming HalfSpaceTrees against offline Scikit-Learn `IsolationForest` and `LocalOutlierFactor`.
* **Empirical Results**:
  * **Precision**: $88.0\%$ ($> 85\%$)
  * **Recall**: $94.0\%$ ($> 90\%$)
  * **False Alert Rate**: $4.0\%$ ($\le 5\%$)
  * **Early Warning Lead Time**: **960 seconds (16 minutes)** prior to hard temperature breach.
* Persisted in PostgreSQL `ai_evaluations` table and exposed via `GET /ai/evaluations`.

### Stage 8: Operator & Admin Dashboard Frontend
* **Design Philosophy**: Sentry for AI Agents aesthetic. Near-black palette (`#0A0A0B`, `#111113`), hairline borders (`#1F1F23`), electric mint (`#7DF9C4`), Space Grotesk, and Geist typography.
* **Views Implemented**:
  * **Live Plasma Canvas**: Downscaled offscreen multi-sine plasma shader.
  * **Navbar**: Live status pill, role switcher (`Operator`, `Auditor`, `Admin`), tab routing.
  * **Shipment Detail View**: Real-time Recharts curves, threshold lines, MKT, remaining life, and official alert acknowledgement workflow.
  * **Arrival Verification View**: 5-point cryptographic proof, interactive database tamper simulation, and printable verification certificate.
  * **AI Risk Intelligence View**: SVG circular risk dial ($0-100$), 5-factor breakdown bars, streaming River insights timeline, and Stage 7 benchmark comparison card.
  * **Admin Management View**: Digital product profiles table + registration modal, Ed25519 device fleet table + key revocation workflow, and trigger-enforced audit log viewer.

---

## 4. Verification & Test Metrics

| Suite | Component | Tests | Status |
| :--- | :--- | :--- | :--- |
| **Shared** | Canonical Hashing & Schemas | Build / Typecheck | **PASSED** |
| **Backend** | Stage 0-7 Integration & Unit Tests | 43 / 43 tests | **PASSED** |
| **Contracts** | Solidity Smart Contracts on Polygon EVM | 8 / 8 tests | **PASSED** |
| **Simulator** | Multi-Scenario IoT Telemetry Generator | 8 / 8 tests | **PASSED** |
| **AI Service** | Streaming HalfSpaceTrees, Risk & Evaluation | 23 / 23 pytests | **PASSED** |
| **Worker** | Polygon Amoy Anchor Dispatcher | Unit / Typecheck | **PASSED** |
| **Frontend** | React 18 + Vite Production Build | TypeScript & Bundler | **PASSED** |
| **Full Monorepo CI** | `scripts/ci.js` | 10 / 10 checks | **PASSED (100%)** |
