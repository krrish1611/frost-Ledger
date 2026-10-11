# FrostLedger MQTT Telemetry & Hardware Device Emulator Guide

This guide describes how to run the device emulator from **any laptop** and stream real-time IoT sensor data into the FrostLedger backend and PostgreSQL database via the port-forwarded devtunnel URL.

---

## 1. Architecture Overview

```
┌─────────────────────────────────┐
│     Device Emulator Script      │
│  (Self-contained on ANY laptop) │
└───────────────┬─────────────────┘
                │
                │ MQTT over WebSockets (TLS)
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Devtunnel Port Forward:                                     │
│ wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt                 │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ FrostLedger Backend (Express + Embedded Aedes MQTT Broker)  │
│  - Listens on topic 'frostledger/telemetry'                 │
│  - Verifies Ed25519 hardware signature                      │
│  - Verifies canonical SHA-256 hash & hash chain continuity  │
│  - Calculates USP <1160> Mean Kinetic Temperature (MKT)     │
│  - Commits batches into PostgreSQL database                 │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│ PostgreSQL / PGlite Database  │ │ React Frontend Dashboard  │
│  - 'batches' table            │ │  - Real-time chart stream │
│  - 'shelf_life_trail'         │ │  - Live batch audit table │
│  - 'alerts' & 'audit_log'     │ │  - Cryptographic checklist│
└───────────────────────────────┘ └───────────────────────────┘
```

---

## 2. Running the Emulator on Any Laptop

The script [`run-simulator.js`](run-simulator.js) is **100% self-contained**:
- Built-in RFC-8785 canonical JSON serializer.
- Built-in SHA-256 batch hash calculation.
- Built-in Ed25519 hardware key signing using Node.js standard library `node:crypto`.
- Zero manual project build required. If the `mqtt` library is missing, it will auto-install it automatically.

### Prerequisites
- Node.js (v18+)

### Command to Run
You can copy or run `run-simulator.js` on **ANY laptop**:

```bash
# Pointing to the active devtunnel URL:
node run-simulator.js --url wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt
```

*(If running locally on the same machine as the backend, use `node run-simulator.js --url ws://localhost:3001/mqtt`)*

### Command Line Options

```bash
node run-simulator.js [options]

Options:
  --url <url>         MQTT broker URL
                      Default: wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt
                      Local:   ws://localhost:3001/mqtt

  --scenario <name>   normal | spike | drift | shock
                      normal : Nominal 4.2°C - 4.8°C cold chain corridor
                      spike  : Severe thermal excursion (18.5°C) triggering regulatory alerts
                      drift  : Incremental temperature rise (+0.7°C per step)
                      shock  : Nominal with physical 4.8g shock impact event

  --interval <sec>    Seconds between sensor readings (default: 2)

  --count <number>    Number of batches to send (default: 10, 0 = continuous stream)

  --shipment <id>     Shipment ID (default: shipment-vax-amoy-001)

  --device <id>       Device ID (default: dev-esp32-001)

  --seq <number>      Manual starting sequence override (default: auto-resumes from DB)
```

### Examples

**1. Stream 10 nominal vaccine batches (Cold Storage):**
```bash
node run-simulator.js --url wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt --count 10 --interval 2
```

**2. Simulate a thermal excursion spike (breaching 8°C):**
```bash
node run-simulator.js --url wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt --scenario spike --count 6
```

**3. Stream for a secondary shipment (`shipment-test-001`):**
```bash
node run-simulator.js --url wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt --shipment shipment-test-001 --count 5
```

**4. Continuous telemetry stream (runs until Ctrl+C):**
```bash
node run-simulator.js --url wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt --count 0 --interval 3
```

---

## 3. Verifying PostgreSQL Database Storage

You can verify that the PostgreSQL database is receiving and storing the telemetry:

1. **Check Backend & Database Health:**
   ```bash
   curl https://4zxl3477-3001.inc1.devtunnels.ms/health
   ```
   Output confirms:
   - `database.connected: true`
   - `database.engine: "PGlite (PostgreSQL 16 WASM)"` or `"PostgreSQL"`
   - `database.batchesStored: <total_count>`
   - `mqtt.active: true`

2. **Inspect Stored Batches in Database:**
   ```bash
   curl https://4zxl3477-3001.inc1.devtunnels.ms/telemetry/live/shipment-vax-amoy-001
   ```
   Returns all stored batches with temperatures, timestamps, and hashes from PostgreSQL.

3. **Check Device Resume State:**
   ```bash
   curl https://4zxl3477-3001.inc1.devtunnels.ms/telemetry/resume/dev-esp32-001
   ```
   Returns the current sequence number and latest recorded hash for the device.

4. **Run Cryptographic Verification Audit:**
   ```bash
   curl https://4zxl3477-3001.inc1.devtunnels.ms/verify/shipment-vax-amoy-001
   ```
   Recomputes all canonical hashes and Ed25519 digital signatures to verify 100% integrity.

---

## 4. Frontend Dashboard Verification

Open the frontend dashboard in your browser (`http://localhost:5173`):
1. Navigate to **Shipments Console**.
2. Notice the top banner: **"PostgreSQL Live Ingestion Active — Real telemetry batches streaming over MQTT"**.
3. Watch the **Live Telemetry Stream** chart update in real-time as batches arrive.
4. Review the **PostgreSQL Telemetry Ledger** table directly underneath the chart:
   - Lists sequence numbers (`#1`, `#2`, `#3`...).
   - Shows timestamp down to the second.
   - Confirms **✓ VERIFIED** Ed25519 signature and **POSTGRESQL** persistence status.
5. Switch to the **Arrival Verification** tab to run a full cryptographic audit on the database records.
