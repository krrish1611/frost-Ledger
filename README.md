# FrostLedger: Blockchain-Enabled Cold Chain & Tamper Detection

A secure, hardware-agnostic IoT cold chain monitoring system with deterministic Arrhenius kinetic shelf-life decay, Ed25519 cryptographic batch signing, on-chain hash anchoring, and an isolated streaming AI/ML advisory layer.

---

## Core Design Rule
> **The official record** (sensor telemetry, hashes, blockchain anchors, MKT and shelf-life numbers, official alerts) is produced strictly by deterministic code.
> The AI/ML layer only adds warnings, scores, forecasts, and suggestions as an advisory overlay. It **never edits, replaces, or feeds into** the official record.

---

## Service Commands (Run, Test, Lint)

| Service | Run Command | Test Command | Lint / Typecheck Command |
| :--- | :--- | :--- | :--- |
| **Monorepo (All)** | `npm run build` | `npm run test` | `npm run ci` |
| **Shared Library** | `npm run build --workspace=@frostledger/shared` | `npm run test --workspace=@frostledger/shared` | `npm run typecheck --workspace=@frostledger/shared` |
| **Backend API** | `npm run dev --workspace=@frostledger/backend` | `npm run test --workspace=@frostledger/backend` | `npm run typecheck --workspace=@frostledger/backend` |
| **Worker Queue** | `npm run start --workspace=@frostledger/worker` | `npm run test --workspace=@frostledger/worker` | `npm run typecheck --workspace=@frostledger/worker` |
| **Simulator CLI** | `npm run start --workspace=@frostledger/simulator` | `npm run test --workspace=@frostledger/simulator` | `npm run typecheck --workspace=@frostledger/simulator` |
| **Contracts** | `npx hardhat node` (in `/contracts`) | `npm run test --workspace=@frostledger/contracts` | `npm run typecheck --workspace=@frostledger/contracts` |
| **Frontend UI** | `npm run dev --workspace=@frostledger/frontend` | `npm run test --workspace=@frostledger/frontend` | `npm run typecheck --workspace=@frostledger/frontend` |
| **AI Service** | `python -m uvicorn main:app --reload` (in `/ai-service`) | `pytest` (in `/ai-service`) | `flake8 .` (in `/ai-service`) |
| **Firmware** | `pio run -t upload` (in `/firmware`) | `pio test` (in `/firmware`) | `pio check` (in `/firmware`) |

---

## Quickstart (From Scratch)

### 1. Prerequisites
- Node.js >= 20.x
- Python >= 3.11
- PostgreSQL (or automated embedded PGlite for self-contained testing)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy example configs in each service:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
cp contracts/.env.example contracts/.env
cp ai-service/.env.example ai-service/.env
cp frontend/.env.example frontend/.env
cp simulator/.env.example simulator/.env
```

### 4. Run Migrations & Seed Data
```bash
npm run migrate
npm run seed
```

### 5. Run Full CI Checks
```bash
npm run ci
```

---

## Repository Structure
```
/firmware      ESP32 firmware (Wi-Fi, sensor sampling, Ed25519 signing, flash caching)
/backend       Express + TypeScript REST API (Zod validation, auth, versioned profiles)
/worker        BullMQ queue consumer (hash chain, MKT, thresholds, blockchain anchoring)
/contracts     Solidity smart contracts and Hardhat testing suite
/ai-service    Python FastAPI service (River online streaming ML, advisory warnings)
/frontend      React + TypeScript + Vite operator dashboard and admin AI panel
/simulator     Synthetic device CLI simulating 9 sensor failure/attack scenarios
/shared        Canonical serialization, crypto helpers, Zod schemas, error formats
/docs          Full PRD specifications and architecture diagrams
/scripts       Monorepo verification and CI automation scripts
```
