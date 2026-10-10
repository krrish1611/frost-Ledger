import {
  generateEd25519KeyPair,
  signWithEd25519,
  computeBatchHash,
  getUtcTimestamp,
  TelemetrySubmission,
  GENESIS_PREV_HASH,
} from '@frostledger/shared';

export type SimulatorScenario =
  | 'normal'
  | 'spike'
  | 'slow_drift'
  | 'door_open'
  | 'flat_copied'
  | 'gps_jump'
  | 'offline_gap'
  | 'replay'
  | 'unsigned';

export interface SimulatorConfig {
  deviceId: string;
  shipmentId: string;
  privateKeyHex: string;
  publicKeyHex: string;
  backendUrl?: string;
  webhookSecret?: string;
}

export class DeviceSimulator {
  private config: SimulatorConfig;
  private currentSeq: number = 0;
  private lastHash: string = GENESIS_PREV_HASH;
  private offlineCache: TelemetrySubmission[] = [];

  constructor(config?: Partial<SimulatorConfig>) {
    const keys = generateEd25519KeyPair();
    this.config = {
      deviceId: config?.deviceId || 'dev-esp32-001',
      shipmentId: config?.shipmentId || 'shipment-test-001',
      privateKeyHex: config?.privateKeyHex || keys.privateKeyHex,
      publicKeyHex: config?.publicKeyHex || keys.publicKeyHex,
      backendUrl: config?.backendUrl || process.env.BACKEND_API_URL || 'http://localhost:3001',
      webhookSecret: config?.webhookSecret || process.env.WEBHOOK_SECRET || 'frostledger_default_webhook_secret',
    };
  }

  public getPublicKey(): string {
    return this.config.publicKeyHex;
  }

  public getDeviceId(): string {
    return this.config.deviceId;
  }

  public getShipmentId(): string {
    return this.config.shipmentId;
  }

  public resetState(): void {
    this.currentSeq = 0;
    this.lastHash = GENESIS_PREV_HASH;
    this.offlineCache = [];
  }

  /**
   * Builds and signs a single batch deterministically
   */
  public createBatch(params: {
    temperature: number;
    humidity: number;
    gps?: { lat: number; lon: number; speed: number; time_utc: string };
    shock_events?: Array<{ magnitude_g: number; timestamp: string }>;
    forceSeq?: number;
    forcePrevHash?: string;
    corruptSignature?: boolean;
    corruptHash?: boolean;
  }): TelemetrySubmission {
    const seq = params.forceSeq !== undefined ? params.forceSeq : this.currentSeq + 1;
    this.currentSeq = seq;

    const prevHash = params.forcePrevHash !== undefined ? params.forcePrevHash : this.lastHash;
    const timestamp = getUtcTimestamp();

    const gps = params.gps || {
      lat: 37.7749 + seq * 0.001,
      lon: -122.4194 + seq * 0.001,
      speed: 45.0,
      time_utc: timestamp,
    };

    const payload = {
      readings: [
        {
          timestamp,
          temperature: params.temperature,
          humidity: params.humidity,
          gps,
          shock_events: params.shock_events || [],
        },
      ],
    };

    let batchHash = computeBatchHash({
      device_id: this.config.deviceId,
      shipment_id: this.config.shipmentId,
      sequence_no: seq,
      prev_hash: prevHash,
      payload,
    });

    if (params.corruptHash) {
      batchHash = 'f'.repeat(64);
    }

    let signature = signWithEd25519(batchHash, this.config.privateKeyHex);
    if (params.corruptSignature) {
      signature = 'bad_sig_' + '0'.repeat(120);
    }

    this.lastHash = batchHash;

    return {
      shipment_id: this.config.shipmentId,
      device_id: this.config.deviceId,
      sequence_no: seq,
      prev_hash: prevHash,
      hash: batchHash,
      signature,
      payload,
    };
  }

  /**
   * Generates a batch stream according to the selected scenario
   */
  public generateScenarioBatches(scenario: SimulatorScenario, count: number = 10): TelemetrySubmission[] {
    const batches: TelemetrySubmission[] = [];

    switch (scenario) {
      case 'normal': {
        for (let i = 0; i < count; i++) {
          const temp = 4.0 + (i % 3) * 0.4;
          const humidity = 50.0 + (i % 2) * 1.5;
          batches.push(this.createBatch({ temperature: temp, humidity }));
        }
        break;
      }

      case 'spike': {
        for (let i = 0; i < count; i++) {
          // Normal for first 3 pings, then severe thermal excursion spike
          const temp = i < 3 ? 4.5 : 19.8;
          batches.push(this.createBatch({ temperature: temp, humidity: 50.0 }));
        }
        break;
      }

      case 'slow_drift': {
        for (let i = 0; i < count; i++) {
          // Slow incremental rise: 4.0, 4.8, 5.6, 6.4, 7.2, 8.0, 8.8, 9.6...
          const temp = 4.0 + i * 0.8;
          batches.push(this.createBatch({ temperature: temp, humidity: 55.0 }));
        }
        break;
      }

      case 'door_open': {
        for (let i = 0; i < count; i++) {
          if (i === 4) {
            batches.push(
              this.createBatch({
                temperature: 14.5,
                humidity: 70.0,
                shock_events: [{ magnitude_g: 3.8, timestamp: getUtcTimestamp() }],
              })
            );
          } else {
            batches.push(this.createBatch({ temperature: 4.2, humidity: 48.0 }));
          }
        }
        break;
      }

      case 'flat_copied': {
        for (let i = 0; i < count; i++) {
          // Exactly identical flat values
          batches.push(this.createBatch({ temperature: 4.25, humidity: 50.1 }));
        }
        break;
      }

      case 'gps_jump': {
        for (let i = 0; i < count; i++) {
          if (i >= 4) {
            // Instantaneous GPS jump to coordinates 10,000 km away
            batches.push(
              this.createBatch({
                temperature: 4.5,
                humidity: 50.0,
                gps: {
                  lat: 51.5074,
                  lon: -0.1278,
                  speed: 4500.0, // Impossible speed indicator
                  time_utc: getUtcTimestamp(),
                },
              })
            );
          } else {
            batches.push(this.createBatch({ temperature: 4.5, humidity: 50.0 }));
          }
        }
        break;
      }

      case 'offline_gap': {
        // Generate batches cached locally
        for (let i = 0; i < count; i++) {
          const batch = this.createBatch({ temperature: 4.5, humidity: 50.0 });
          this.offlineCache.push(batch);
        }
        // Return full cached collection ready for in-order transmission
        return [...this.offlineCache];
      }

      case 'replay': {
        // Generate seq 1 and seq 2
        const b1 = this.createBatch({ temperature: 4.5, humidity: 50.0 });
        const b2 = this.createBatch({ temperature: 4.6, humidity: 50.0 });
        batches.push(b1, b2);
        // Add replay of seq 1
        batches.push(b1);
        break;
      }

      case 'unsigned': {
        const b1 = this.createBatch({ temperature: 4.5, humidity: 50.0, corruptSignature: true });
        batches.push(b1);
        break;
      }
    }

    return batches;
  }

  /**
   * Posts telemetry batch to backend /telemetry endpoint via HTTP
   */
  public async postBatch(batch: TelemetrySubmission): Promise<any> {
    const url = `${this.config.backendUrl}/telemetry`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': this.config.webhookSecret || '',
      },
      body: JSON.stringify(batch),
    });

    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  }
}

// ==========================================
// CLI Execution Entry Point
// ==========================================
function parseArgs(): { scenario: SimulatorScenario; count: number } {
  const args = process.argv.slice(2);
  let scenario: SimulatorScenario = 'normal';
  let count = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      scenario = args[i + 1] as SimulatorScenario;
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { scenario, count };
}

if (require.main === module) {
  const { scenario, count } = parseArgs();
  console.log(`[Simulator CLI] Initializing device simulator for scenario: '${scenario}', count: ${count}`);

  const sim = new DeviceSimulator();
  const batches = sim.generateScenarioBatches(scenario, count);
  console.log(`[Simulator CLI] Generated ${batches.length} batches.`);
  console.log(`Sample batch 1:`, JSON.stringify(batches[0], null, 2));
}
