# Cold Chain PRD v3.1: IoT + Cybersecurity + Blockchain + AI/ML
## Blockchain-Enabled IoT Cold Chain Storage & Tamper Detection System
Status: Draft | Includes: PRD, Architecture, Workflows, Antigravity Build Guide

### Core Design Rule (Never Break)
The official record (sensor data, hashes, blockchain anchors, MKT and shelf-life numbers, official alerts) is produced only by deterministic code. The AI/ML layer only adds warnings, scores, forecasts, and suggestions. It must never edit, replace, or feed into the official record.

### Tech Stack
- **Firmware**: ESP32 (Arduino framework, PlatformIO), Wi-Fi only
- **Backend API**: Node.js + Express + TypeScript, deployed on Vercel (serverless)
- **Worker & Queue**: Node.js + TypeScript worker with BullMQ and Redis (host on Railway or Render)
- **Database**: PostgreSQL with SQL migrations
- **Blockchain**: Solidity smart contract, Hardhat, testnet (Polygon Amoy or Sepolia), ethers.js
- **AI Service**: Python 3.11/3.12 + FastAPI + River (streaming ML) + scikit-learn (offline evaluation only) + NumPy
- **Frontend**: React + TypeScript + Vite, Recharts for charts
- **Messaging**: Managed MQTT broker (HiveMQ Cloud or EMQX Cloud) forwarding to backend webhook
- **Testing**: Vitest / Jest (TypeScript), pytest (Python), Hardhat tests (contracts)

### Monorepo Structure
- `/firmware`: ESP32 code
- `/backend`: Express API
- `/worker`: BullMQ queue consumer
- `/contracts`: Smart contracts, tests, deploy scripts
- `/ai-service`: Python FastAPI service + notifier
- `/frontend`: React app (operator app + admin panel)
- `/simulator`: Fake device CLI that generates and signs batches
- `/shared`: Shared canonical serialization, schemas, and cryptographic utilities
- `/docs`: PRD, specifications, and architecture diagrams
- `/scripts`: Monorepo CI verification and maintenance scripts
