#!/usr/bin/env node
/**
 * ============================================================================
 * FrostLedger Standalone MQTT Sensor Device Emulator
 * ============================================================================
 * This script is completely self-contained and can run on ANY laptop/device
 * with Node.js (v18+) installed.
 *
 * It streams cryptographically signed sensor readings over MQTT (via WebSockets
 * or TCP) to the FrostLedger backend, where they are verified and saved into
 * the PostgreSQL database.
 *
 * Usage:
 *   node run-simulator.js [options]
 *
 * Options:
 *   --url <url>         MQTT broker URL
 *                       Default: wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt
 *                       (Local: ws://localhost:3001/mqtt)
 *   --scenario <name>   normal | spike | drift | shock (default: normal)
 *   --interval <sec>    Interval between batches in seconds (default: 2)
 *   --count <num>       Total batches to publish (default: 10, 0 = continuous)
 *   --shipment <id>     Shipment ID (default: shipment-vax-amoy-001)
 *   --device <id>       Device ID (default: auto-selected by shipment or dev-esp32-001)
 *   --key <hex>         Ed25519 private key in hex (default: built-in demo key)
 *   --seq <num>         Force starting sequence number (default: auto-resumes from DB)
 *   --help              Show this help menu
 * ============================================================================
 */

const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ----------------------------------------------------------------------------
// 1. Dependency Loader for 'mqtt'
// ----------------------------------------------------------------------------
let mqtt;
try {
  mqtt = require('mqtt');
} catch (e1) {
  // Check common sibling paths
  const candidatePaths = [
    path.join(__dirname, 'node_modules/mqtt'),
    path.join(__dirname, '../node_modules/mqtt'),
    path.join(__dirname, 'simulator/node_modules/mqtt'),
  ];
  for (const p of candidatePaths) {
    try {
      mqtt = require(p);
      break;
    } catch {}
  }

  if (!mqtt) {
    console.log('📦 MQTT package not detected locally. Auto-installing "mqtt" for zero-setup execution...');
    try {
      execSync('npm install --no-save mqtt', { stdio: 'inherit', cwd: __dirname });
      mqtt = require('mqtt');
      console.log('✅ "mqtt" installed successfully!\n');
    } catch (installErr) {
      console.error('❌ Failed to auto-install "mqtt":', installErr.message);
      console.error('Please run: npm install mqtt');
      process.exit(1);
    }
  }
}

// ----------------------------------------------------------------------------
// 2. Cryptographic & Canonical Hashing Functions (RFC 8032 & SHA-256)
// ----------------------------------------------------------------------------
const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const DEFAULT_PRIVATE_KEY_HEX =
  process.env.DEVICE_PRIVATE_KEY_HEX ||
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';

function canonicalSerialize(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error('Cannot serialize non-finite numbers');
    return Number(val.toFixed(4)).toString();
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalSerialize(item)).join(',') + ']';
  }
  if (typeof val === 'object') {
    const sortedKeys = Object.keys(val).sort();
    const parts = sortedKeys.map((key) => {
      const serializedKey = JSON.stringify(key);
      const serializedVal = canonicalSerialize(val[key]);
      return `${serializedKey}:${serializedVal}`;
    });
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(String(val));
}

function computeSha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function computeCanonicalHash(data) {
  const canonicalString = canonicalSerialize(data);
  return computeSha256(canonicalString);
}

function computeBatchHash(data) {
  const canonicalData = {
    device_id: data.device_id,
    payload: data.payload,
    prev_hash: data.prev_hash,
    sequence_no: data.sequence_no,
    shipment_id: data.shipment_id,
  };
  return computeCanonicalHash(canonicalData);
}

function signWithEd25519(data, privateKeyHex) {
  const privKeyRaw = Buffer.from(privateKeyHex, 'hex');
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const derPrivateKey = Buffer.concat([pkcs8Prefix, privKeyRaw]);

  const privateKey = crypto.createPrivateKey({
    key: derPrivateKey,
    format: 'der',
    type: 'pkcs8',
  });

  const bufferToSign = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const signature = crypto.sign(null, bufferToSign, privateKey);
  return signature.toString('hex');
}

function getUtcTimestamp() {
  return new Date().toISOString();
}

// ----------------------------------------------------------------------------
// 3. Command Line Argument Parser
// ----------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    brokerUrl: 'wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt',
    shipmentId: 'shipment-vax-amoy-001',
    deviceId: '',
    scenario: 'normal',
    intervalMs: 2000,
    count: 10,
    privateKeyHex: DEFAULT_PRIVATE_KEY_HEX,
    forceSeq: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
FrostLedger MQTT Hardware Emulator Runner

Usage: node run-simulator.js [options]

Options:
  --url <url>         MQTT broker URL (default: wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt)
  --scenario <name>   Scenario: normal | spike | drift | shock (default: normal)
  --interval <sec>    Interval in seconds between batches (default: 2)
  --count <num>       Total batches to publish (default: 10, 0 = continuous)
  --shipment <id>     Shipment ID (default: shipment-vax-amoy-001)
  --device <id>       Device ID (default: dev-esp32-001)
  --key <hex>         Ed25519 32-byte private key in hex
  --seq <num>         Force starting sequence number
      `);
      process.exit(0);
    } else if (arg === '--url' && args[i + 1]) {
      opts.brokerUrl = args[++i];
    } else if (arg === '--scenario' && args[i + 1]) {
      opts.scenario = args[++i];
    } else if (arg === '--interval' && args[i + 1]) {
      opts.intervalMs = Math.max(200, Math.round(parseFloat(args[++i]) * 1000));
    } else if (arg === '--count' && args[i + 1]) {
      opts.count = parseInt(args[++i], 10);
    } else if (arg === '--shipment' && args[i + 1]) {
      opts.shipmentId = args[++i];
    } else if (arg === '--device' && args[i + 1]) {
      opts.deviceId = args[++i];
    } else if (arg === '--key' && args[i + 1]) {
      opts.privateKeyHex = args[++i];
    } else if (arg === '--seq' && args[i + 1]) {
      opts.forceSeq = parseInt(args[++i], 10);
    }
  }

  // Auto-map device ID to shipment if not explicitly supplied
  if (!opts.deviceId) {
    if (opts.shipmentId === 'shipment-vax-amoy-001') opts.deviceId = 'dev-esp32-001';
    else if (opts.shipmentId === 'shipment-test-001') opts.deviceId = 'dev-esp32-002';
    else if (opts.shipmentId === 'shipment-insulin-002') opts.deviceId = 'dev-esp32-003';
    else if (opts.shipmentId === 'shipment-produce-003') opts.deviceId = 'dev-esp32-004';
    else opts.deviceId = `dev-esp32-${opts.shipmentId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6)}`;
  }

  return opts;
}

// ----------------------------------------------------------------------------
// 4. Standalone MqttDeviceSimulator Class
// ----------------------------------------------------------------------------
class MqttDeviceSimulator {
  constructor(options) {
    this.options = options;
    this.client = null;
    this.currentSeq = 0;
    this.lastHash = GENESIS_PREV_HASH;
    this.running = false;
    this.sentCount = 0;
  }

  async fetchHttpJson(endpoint) {
    return new Promise((resolve) => {
      try {
        const httpBase = this.options.brokerUrl
          .replace(/^wss:\/\//i, 'https://')
          .replace(/^ws:\/\//i, 'http://')
          .replace(/\/mqtt.*$/i, '');
        const targetUrl = new URL(endpoint, httpBase).toString();
        const clientLib = targetUrl.startsWith('https://') ? https : http;

        const req = clientLib.get(targetUrl, { timeout: 10000 }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(JSON.parse(body));
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  async initResumeState() {
    if (this.options.forceSeq !== undefined) {
      this.currentSeq = Math.max(0, this.options.forceSeq - 1);
      console.log(`⚙️  [MQTT Emulator] Manual sequence override: Starting at Seq #${this.currentSeq + 1}`);
      return;
    }

    try {
      // 1. Try dedicated resume endpoint by device ID
      const resumeData = await this.fetchHttpJson(`/telemetry/resume/${this.options.deviceId}`);
      if (resumeData && resumeData.has_history) {
        this.currentSeq = Number(resumeData.last_sequence_no);
        this.lastHash = resumeData.last_hash || GENESIS_PREV_HASH;
        console.log(`🔗 [MQTT Emulator] Resuming stream for ${this.options.deviceId} from Seq #${this.currentSeq + 1} (chained to: ${this.lastHash.substring(0, 12)}...)`);
        return;
      }

      // 2. Fall back to live shipment readings check
      const liveData = await this.fetchHttpJson(`/telemetry/live/${this.options.shipmentId}`);
      if (liveData && liveData.readings && liveData.readings.length > 0) {
        const lastReading = liveData.readings[liveData.readings.length - 1];
        this.currentSeq = Number(lastReading.sequence_no);
        this.lastHash = lastReading.hash || GENESIS_PREV_HASH;
        console.log(`🔗 [MQTT Emulator] Resuming stream for ${this.options.shipmentId} from Seq #${this.currentSeq + 1} (chained to: ${this.lastHash.substring(0, 12)}...)`);
        return;
      }

      console.log(`🌱 [MQTT Emulator] Starting brand-new stream at Seq #1 (Genesis Prev Hash)`);
    } catch {
      console.log(`🌱 [MQTT Emulator] Initializing default stream at Seq #1`);
    }
  }

  getTelemetryValuesForStep(step) {
    switch (this.options.scenario) {
      case 'spike': {
        const temp = step < 3 ? 4.5 : 18.5;
        return { temp, humidity: 50.0, shock: 0.0 };
      }
      case 'drift': {
        const temp = 4.0 + step * 0.7;
        return { temp, humidity: 55.0, shock: 0.0 };
      }
      case 'shock': {
        const shock = step === 3 ? 4.8 : 0.0;
        const temp = step === 3 ? 12.0 : 4.4;
        return { temp, humidity: 52.0, shock };
      }
      case 'normal':
      default: {
        const temp = 4.2 + (step % 5) * 0.12;
        const humidity = 48.0 + (step % 3) * 1.5;
        return { temp, humidity, shock: 0.0 };
      }
    }
  }

  createBatch(tempC, humPct, shockG = 0) {
    this.currentSeq += 1;
    const seq = this.currentSeq;
    const prevHash = this.lastHash;
    const timestamp = getUtcTimestamp();

    const gps = {
      lat: 37.7749 + seq * 0.0005,
      lon: -122.4194 + seq * 0.0005,
      speed: 45.0,
      time_utc: timestamp,
    };

    const shock_events = shockG > 0 ? [{ magnitude_g: shockG, timestamp }] : [];

    const payload = {
      readings: [
        {
          timestamp,
          temperature: Number(tempC.toFixed(2)),
          humidity: Number(humPct.toFixed(1)),
          gps,
          shock_events,
        },
      ],
    };

    const batchHash = computeBatchHash({
      device_id: this.options.deviceId,
      shipment_id: this.options.shipmentId,
      sequence_no: seq,
      prev_hash: prevHash,
      payload,
    });

    const signature = signWithEd25519(batchHash, this.options.privateKeyHex);
    this.lastHash = batchHash;

    return {
      shipment_id: this.options.shipmentId,
      device_id: this.options.deviceId,
      sequence_no: seq,
      prev_hash: prevHash,
      hash: batchHash,
      signature,
      payload,
    };
  }

  async start() {
    await this.initResumeState();

    return new Promise((resolve, reject) => {
      console.log('='.repeat(72));
      console.log('❄️  FrostLedger Hardware Sensor Device Emulator (Standalone)');
      console.log('='.repeat(72));
      console.log(`🌐 MQTT Broker URL : ${this.options.brokerUrl}`);
      console.log(`📱 Device ID       : ${this.options.deviceId}`);
      console.log(`📦 Shipment ID     : ${this.options.shipmentId}`);
      console.log(`🧪 Scenario        : ${this.options.scenario.toUpperCase()}`);
      console.log(`⏱️  Interval        : ${this.options.intervalMs / 1000}s`);
      console.log(`🔢 Target Batches  : ${this.options.count === 0 ? 'Continuous' : this.options.count}`);
      console.log('-'.repeat(72));

      const clientId = `${this.options.deviceId}-${Math.random().toString(16).substring(2, 8)}`;
      const client = mqtt.connect(this.options.brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 30000,
        keepalive: 60,
        reconnectPeriod: 3000,
        rejectUnauthorized: false,
      });

      this.client = client;

      client.on('connect', () => {
        console.log(`✅ [MQTT Emulator] Connected to broker successfully!`);
        this.running = true;

        const ackTopic = `frostledger/telemetry/ack/${this.options.deviceId}`;
        const errTopic = `frostledger/telemetry/error`;

        client.subscribe([ackTopic, errTopic], (err) => {
          if (err) console.warn('Subscription warning:', err);
        });

        this.runPublishLoop(resolve);
      });

      client.on('message', (topic, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          if (topic.includes('ack')) {
            console.log(`   └─ 🟢 [Server ACK] Stored in PostgreSQL! Batch #${msg.sequence_no} (ID: ${msg.batch_id})`);
          } else if (topic.includes('error')) {
            console.error(`   └─ 🔴 [Server Error] ${msg.error} (${msg.code})`);
          }
        } catch {}
      });

      client.on('error', (err) => {
        console.error(`❌ [MQTT Emulator] Connection error:`, err.message);
        if (!this.running) reject(err);
      });

      client.on('reconnect', () => {
        console.log(`🔄 [MQTT Emulator] Reconnecting to broker...`);
      });
    });
  }

  async runPublishLoop(onComplete) {
    const loop = async () => {
      if (!this.running || !this.client) return;

      if (this.options.count > 0 && this.sentCount >= this.options.count) {
        console.log('-'.repeat(72));
        console.log(`🎉 [MQTT Emulator] Successfully published all ${this.sentCount} batches!`);
        console.log('='.repeat(72));
        this.client.end();
        onComplete();
        return;
      }

      const { temp, humidity, shock } = this.getTelemetryValuesForStep(this.sentCount);
      const batch = this.createBatch(temp, humidity, shock);
      const topic = 'frostledger/telemetry';

      const shockMsg = shock > 0 ? ` ⚠️  [SHOCK: ${shock}g]` : '';
      console.log(
        `📡 [Batch #${batch.sequence_no}] Temp: ${temp.toFixed(2)}°C | Hum: ${humidity.toFixed(1)}%${shockMsg} | Hash: ${batch.hash.substring(0, 10)}...`
      );

      this.client.publish(topic, JSON.stringify(batch), { qos: 0 }, (err) => {
        if (err) {
          console.error(`   └─ ❌ Publish error for seq #${batch.sequence_no}:`, err.message);
        }
      });

      this.sentCount++;
      setTimeout(loop, this.options.intervalMs);
    };

    loop();
  }
}

// ----------------------------------------------------------------------------
// 5. Main Execution Entry Point
// ----------------------------------------------------------------------------
const opts = parseArgs();
const sim = new MqttDeviceSimulator(opts);

sim.start().catch((err) => {
  console.error('Simulator exited with error:', err.message);
  process.exit(1);
});
