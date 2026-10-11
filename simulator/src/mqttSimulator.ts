import mqtt from 'mqtt';
import {
  signWithEd25519,
  computeBatchHash,
  getUtcTimestamp,
  GENESIS_PREV_HASH,
  TelemetrySubmission,
} from '@frostledger/shared';

export interface MqttSimulatorOptions {
  brokerUrl: string;
  deviceId: string;
  shipmentId: string;
  privateKeyHex: string;
  scenario: 'normal' | 'spike' | 'drift' | 'shock';
  intervalMs: number;
  count: number; // 0 = continuous
}

const DEFAULT_PRIVATE_KEY_HEX =
  process.env.DEVICE_PRIVATE_KEY_HEX ||
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';

export class MqttDeviceSimulator {
  private options: MqttSimulatorOptions;
  private client: mqtt.MqttClient | null = null;
  private currentSeq = 0;
  private lastHash = GENESIS_PREV_HASH;
  private running = false;
  private sentCount = 0;

  constructor(options?: Partial<MqttSimulatorOptions>) {
    this.options = {
      brokerUrl:
        options?.brokerUrl ||
        process.env.MQTT_BROKER_URL ||
        'wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt',
      deviceId: options?.deviceId || process.env.DEVICE_ID || 'dev-esp32-001',
      shipmentId: options?.shipmentId || process.env.SHIPMENT_ID || 'shipment-vax-amoy-001',
      privateKeyHex: options?.privateKeyHex || DEFAULT_PRIVATE_KEY_HEX,
      scenario: options?.scenario || 'normal',
      intervalMs: options?.intervalMs || 2000,
      count: options?.count !== undefined ? options?.count : 10,
    };
  }

  public createBatch(tempC: number, humPct: number, shockG: number = 0): TelemetrySubmission {
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

  public getTemperatureForStep(step: number): { temp: number; humidity: number; shock: number } {
    switch (this.options.scenario) {
      case 'spike': {
        // First 3 normal, then spike to 18.5°C
        const temp = step < 3 ? 4.5 : 18.5;
        return { temp, humidity: 50.0, shock: 0 };
      }
      case 'drift': {
        // Gradual upward climb: 4.0, 4.8, 5.6, 6.4, 7.2, 8.0, 8.8...
        const temp = 4.0 + step * 0.7;
        return { temp, humidity: 55.0, shock: 0 };
      }
      case 'shock': {
        // Normal with physical impact event at step 3
        const shock = step === 3 ? 4.8 : 0;
        const temp = step === 3 ? 12.0 : 4.4;
        return { temp, humidity: 52.0, shock };
      }
      case 'normal':
      default: {
        // Nominal cold chain: 4.2°C to 4.7°C
        const temp = 4.2 + (step % 5) * 0.12;
        const humidity = 48.0 + (step % 3) * 1.5;
        return { temp, humidity, shock: 0 };
      }
    }
  }

  public async initResumeState(): Promise<void> {
    try {
      const httpBase = this.options.brokerUrl
        .replace(/^wss:\/\//i, 'https://')
        .replace(/^ws:\/\//i, 'http://')
        .replace(/\/mqtt.*$/i, '');

      // 1. Check dedicated device resume endpoint
      try {
        const devRes = await fetch(`${httpBase}/telemetry/resume/${this.options.deviceId}`);
        if (devRes.ok) {
          const devData: any = await devRes.json();
          if (devData.has_history) {
            this.currentSeq = Number(devData.last_sequence_no);
            this.lastHash = devData.last_hash || GENESIS_PREV_HASH;
            console.log(`🔗 [MQTT Emulator] Resuming stream for ${this.options.deviceId} from Seq #${this.currentSeq + 1} (chained to: ${this.lastHash.substring(0, 10)}...)`);
            return;
          }
        }
      } catch {}

      // 2. Check shipment readings fallback
      const res = await fetch(`${httpBase}/telemetry/live/${this.options.shipmentId}`);
      if (res.ok) {
        const data: any = await res.json();
        if (data.readings && data.readings.length > 0) {
          const lastReading = data.readings[data.readings.length - 1];
          this.currentSeq = Number(lastReading.sequence_no);
          this.lastHash = lastReading.hash || GENESIS_PREV_HASH;
          console.log(`🔗 [MQTT Emulator] Resuming stream from Seq #${this.currentSeq + 1} (chained to: ${this.lastHash.substring(0, 10)}...)`);
        }
      }
    } catch {
      // Continue from initial sequence if HTTP check is unreachable
    }
  }

  public async start(): Promise<void> {
    await this.initResumeState();

    return new Promise((resolve, reject) => {
      console.log('='.repeat(70));
      console.log('❄️  FrostLedger Hardware Sensor Device Emulator');
      console.log('='.repeat(70));
      console.log(`🌐 MQTT Broker URL : ${this.options.brokerUrl}`);
      console.log(`📱 Device ID       : ${this.options.deviceId}`);
      console.log(`📦 Shipment ID     : ${this.options.shipmentId}`);
      console.log(`🧪 Scenario        : ${this.options.scenario.toUpperCase()}`);
      console.log(`⏱️  Interval        : ${this.options.intervalMs / 1000}s`);
      console.log(`🔢 Target Batches  : ${this.options.count === 0 ? 'Continuous' : this.options.count}`);
      console.log('-'.repeat(70));

      const client = mqtt.connect(this.options.brokerUrl, {
        clientId: `${this.options.deviceId}-${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 3000,
        rejectUnauthorized: false,
      });

      this.client = client;

      client.on('connect', () => {
        console.log(`✅ [MQTT Emulator] Connected to broker successfully!`);
        this.running = true;

        // Subscribe to server ACK and error topics
        const ackTopic = `frostledger/telemetry/ack/${this.options.deviceId}`;
        const errTopic = `frostledger/telemetry/error`;

        client.subscribe([ackTopic, errTopic], (err) => {
          if (err) console.warn('Subscription warning:', err);
        });

        // Start publishing loop
        this.runPublishLoop(resolve);
      });

      client.on('message', (topic, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          if (topic.includes('ack')) {
            console.log(`   └─ 🟢 [Server ACK] DB Stored Batch #${msg.sequence_no} (ID: ${msg.batch_id})`);
          } else if (topic.includes('error')) {
            console.error(`   └─ 🔴 [Server Error] ${msg.error} (${msg.code})`);
          }
        } catch {
          // ignore non-json
        }
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

  private async runPublishLoop(onComplete: () => void) {
    const loop = async () => {
      if (!this.running || !this.client) return;

      if (this.options.count > 0 && this.sentCount >= this.options.count) {
        console.log('-'.repeat(70));
        console.log(`🎉 [MQTT Emulator] Completed all ${this.sentCount} batches!`);
        console.log('='.repeat(70));
        this.client.end();
        onComplete();
        return;
      }

      const { temp, humidity, shock } = this.getTemperatureForStep(this.sentCount);
      const batch = this.createBatch(temp, humidity, shock);

      const topic = `frostledger/telemetry`;
      const payloadStr = JSON.stringify(batch);

      this.client.publish(topic, payloadStr, { qos: 0 }, (err) => {
        if (err) {
          console.error(`❌ Failed to publish batch #${batch.sequence_no}:`, err);
        } else {
          const shockStr = shock > 0 ? ` 💥 SHOCK ${shock}g!` : '';
          console.log(
            `📤 [MQTT -> Backend] Seq #${batch.sequence_no} | Temp: ${temp.toFixed(2)}°C | Hum: ${humidity.toFixed(1)}% | Hash: ${batch.hash.substring(0, 12)}...${shockStr}`
          );
        }
      });

      this.sentCount++;
      setTimeout(loop, this.options.intervalMs);
    };

    loop();
  }

  public stop(): void {
    this.running = false;
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}

// CLI Execution Entry Point
export function parseArgs(): Partial<MqttSimulatorOptions> {
  const args = process.argv.slice(2);
  const opts: Partial<MqttSimulatorOptions> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      opts.brokerUrl = args[i + 1];
      i++;
    } else if (args[i] === '--scenario' && args[i + 1]) {
      opts.scenario = args[i + 1] as any;
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      opts.count = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--interval' && args[i + 1]) {
      opts.intervalMs = parseFloat(args[i + 1]) * 1000;
      i++;
    } else if (args[i] === '--shipment' && args[i + 1]) {
      opts.shipmentId = args[i + 1];
      i++;
    } else if (args[i] === '--device' && args[i + 1]) {
      opts.deviceId = args[i + 1];
      i++;
    }
  }

  return opts;
}

if (require.main === module) {
  const opts = parseArgs();
  const sim = new MqttDeviceSimulator(opts);

  sim.start().catch((err) => {
    console.error('Fatal simulator error:', err);
    process.exit(1);
  });
}
