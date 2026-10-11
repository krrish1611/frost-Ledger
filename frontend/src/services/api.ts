/**
 * FrostLedger API Client & Mock Data Service
 */

export interface TelemetryReading {
  timestamp: string;
  temperature: number;
  humidity: number;
  shock: number;
  speed: number;
}

export interface ShipmentSummary {
  shipment_id: string;
  device_id: string;
  profile_id: string;
  profile_name: string;
  cargo_type: string;
  status: 'created' | 'in_transit' | 'delivered' | 'flagged';
  temp_min_c: number;
  temp_max_c: number;
  current_temp: number;
  current_humidity: number;
  mkt: number;
  remaining_life_pct: number;
  anchored_tx: string | null;
  ai_enabled: boolean;
  ai_risk_score: number;
  ai_risk_tier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
}

export interface VerificationChecklist {
  shipment_id: string;
  overall_status: 'PASS' | 'FAIL';
  canonical_hash_verified: boolean;
  ed25519_signature_verified: boolean;
  hash_chain_intact: boolean;
  blockchain_anchored: boolean;
  profile_hash_match: boolean;
  tx_hash: string;
  batches_inspected: number;
}

export interface AiInsightItem {
  insight_id: string;
  kind: 'anomaly' | 'forecast' | 'risk' | 'spoofing';
  score: number;
  severity: 'info' | 'warning' | 'critical';
  explanation: string;
  input_ref: string;
  warmup_status: 'warming_up' | 'active';
  model_name: string;
  model_version: string;
  created_at: string;
  label: string;
}

export interface EvaluationBenchmark {
  evaluation_id: string;
  model_name: string;
  model_version: string;
  precision: number;
  recall: number;
  false_alert_rate: number;
  avg_lead_time_seconds: number;
  dataset_name: string;
  created_at: string;
  label: string;
}

export interface DeviceFleetItem {
  device_id: string;
  public_key: string;
  firmware_version: string;
  battery_pct: number;
  last_heartbeat: string;
  status: 'active' | 'revoked';
}

export interface ProductProfileItem {
  profile_id: string;
  name: string;
  cargo_type: string;
  temp_min_c: number;
  temp_max_c: number;
  max_excursion_seconds: number;
  mkt_activation_energy_kj: number;
  version: number;
  profile_hash: string;
  created_at: string;
}

export interface AuditLogItem {
  log_id: string;
  timestamp: string;
  actor: string;
  action: string;
  target_table: string;
  record_id: string;
  details: string;
}

export const API_BASE =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://4zxl3477-3001.inc1.devtunnels.ms'
    : 'http://localhost:3001');

// Mock dataset representing live and completed cold-chain shipments
export const MOCK_SHIPMENTS: ShipmentSummary[] = [
  {
    shipment_id: 'shipment-vax-amoy-001',
    device_id: 'dev-esp32-001',
    profile_id: 'profile-vaccine-2-8c',
    profile_name: 'Pfizer-BioNTech mRNA Vaccine',
    cargo_type: 'vaccine',
    status: 'in_transit',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    current_temp: 4.3,
    current_humidity: 48.5,
    mkt: 4.18,
    remaining_life_pct: 98.4,
    anchored_tx: '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37',
    ai_enabled: true,
    ai_risk_score: 18.5,
    ai_risk_tier: 'LOW',
  },
  {
    shipment_id: 'shipment-insulin-002',
    device_id: 'dev-esp32-002',
    profile_id: 'profile-insulin-2-8c',
    profile_name: 'Humalog Insulin Biologics',
    cargo_type: 'biologics',
    status: 'in_transit',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    current_temp: 7.9,
    current_humidity: 62.0,
    mkt: 6.45,
    remaining_life_pct: 86.2,
    anchored_tx: '0xb8135c01a13b3f53ceaf27385bd68677b8edbf80e67452a1a48d9fe5c28128c7',
    ai_enabled: true,
    ai_risk_score: 68.0,
    ai_risk_tier: 'ELEVATED',
  },
  {
    shipment_id: 'shipment-produce-003',
    device_id: 'dev-esp32-003',
    profile_id: 'profile-produce-0-4c',
    profile_name: 'Fresh Organic Blueberries',
    cargo_type: 'produce',
    status: 'flagged',
    temp_min_c: 0.0,
    temp_max_c: 4.0,
    current_temp: 14.2,
    current_humidity: 78.0,
    mkt: 8.92,
    remaining_life_pct: 54.0,
    anchored_tx: '0xb488c6631b50160b465e089ece3bcc7a4487cd972708fd84784fa4b3ae90db92',
    ai_enabled: true,
    ai_risk_score: 88.5,
    ai_risk_tier: 'CRITICAL',
  },
];

export const MOCK_DEVICES: DeviceFleetItem[] = [
  {
    device_id: 'dev-esp32-001',
    public_key: '9f6b92a47e923e4d9b0f15c7e3f88632a90184e1b7643b9df09c379a29e47261',
    firmware_version: 'v2.4.1-amoy',
    battery_pct: 94,
    last_heartbeat: '2 mins ago',
    status: 'active',
  },
  {
    device_id: 'dev-esp32-002',
    public_key: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    firmware_version: 'v2.4.1-amoy',
    battery_pct: 78,
    last_heartbeat: '4 mins ago',
    status: 'active',
  },
  {
    device_id: 'dev-esp32-003',
    public_key: '5f4dcc3b5aa765d61d8327deb882cf992b32194c7b897914757c9ac7f73d8a1c',
    firmware_version: 'v2.3.9-legacy',
    battery_pct: 22,
    last_heartbeat: '18 mins ago',
    status: 'active',
  },
  {
    device_id: 'dev-nordic-004',
    public_key: 'c8932938a1f81018864d24177018991732de334f64798367f003e87847c28d73',
    firmware_version: 'v2.4.0',
    battery_pct: 0,
    last_heartbeat: '2 days ago',
    status: 'revoked',
  },
];

export const MOCK_PROFILES: ProductProfileItem[] = [
  {
    profile_id: 'profile-vaccine-2-8c',
    name: 'Pfizer-BioNTech mRNA Vaccine',
    cargo_type: 'vaccine',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    max_excursion_seconds: 7200,
    mkt_activation_energy_kj: 83.144,
    version: 1,
    profile_hash: '3f7a1c8b9d0e2f4a6b8c1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    profile_id: 'profile-insulin-2-8c',
    name: 'Humalog Insulin Biologics',
    cargo_type: 'biologics',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    max_excursion_seconds: 3600,
    mkt_activation_energy_kj: 85.0,
    version: 2,
    profile_hash: '8a2f4c6e9b0d1a3c5e7f9a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d1e3f5a7b9c1d',
    created_at: '2026-09-15T00:00:00Z',
  },
  {
    profile_id: 'profile-produce-0-4c',
    name: 'Fresh Organic Produce (Blueberries)',
    cargo_type: 'produce',
    temp_min_c: 0.0,
    temp_max_c: 4.0,
    max_excursion_seconds: 14400,
    mkt_activation_energy_kj: 60.0,
    version: 1,
    profile_hash: '1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d1e3f5a7b9c1d3e',
    created_at: '2026-09-20T00:00:00Z',
  },
];

export const MOCK_AUDIT_LOGS: AuditLogItem[] = [
  {
    log_id: 'aud-001',
    timestamp: '2026-10-10 12:45:10',
    actor: 'system-arrival-verifier',
    action: 'VERIFY_ARRIVAL',
    target_table: 'shipments',
    record_id: 'shipment-vax-amoy-001',
    details: 'Cryptographic 5-point arrival proof validated successfully. Contract batch #4 verified.',
  },
  {
    log_id: 'aud-002',
    timestamp: '2026-10-10 12:30:00',
    actor: 'ai-risk-service',
    action: 'RECORD_RISK_SCORE',
    target_table: 'ai_risk_scores',
    record_id: 'shipment-insulin-002',
    details: 'Composite score 68.0 recorded. Biologic threshold approaching upper limit 8.0°C.',
  },
  {
    log_id: 'aud-003',
    timestamp: '2026-10-10 12:15:22',
    actor: 'polygon-amoy-worker',
    action: 'ANCHOR_BATCH_TX',
    target_table: 'batches',
    record_id: 'batch-004',
    details: 'Tx 0x97273b89... confirmed block 18,294,011. Canonical Merkle root committed.',
  },
  {
    log_id: 'aud-004',
    timestamp: '2026-10-10 11:58:04',
    actor: 'admin@pharma.corp',
    action: 'REVOKE_DEVICE_KEY',
    target_table: 'devices',
    record_id: 'dev-nordic-004',
    details: 'Ed25519 public key c893... revoked due to physical seal inspection discrepancy.',
  },
];

export const MOCK_AI_INSIGHTS: Record<string, AiInsightItem[]> = {
  'shipment-vax-amoy-001': [
    {
      insight_id: 'ins-001',
      kind: 'risk',
      score: 18.5,
      severity: 'info',
      explanation: 'Thermal corridor nominal (4.1°C to 4.5°C). Arrhenius degradation rate standard. Low risk.',
      input_ref: 'batch-004',
      warmup_status: 'active',
      model_name: 'CompositeRiskScorer',
      model_version: 'v1.0.0',
      created_at: '2026-10-10 12:45:00',
      label: 'AI-generated, advisory',
    },
    {
      insight_id: 'ins-002',
      kind: 'anomaly',
      score: 0.12,
      severity: 'info',
      explanation: 'River HalfSpaceTrees streaming anomaly score 0.12 (well below 0.70 threshold).',
      input_ref: 'telemetry-seq-120',
      warmup_status: 'active',
      model_name: 'RiverHalfSpaceTrees',
      model_version: 'v1.0.0',
      created_at: '2026-10-10 12:40:00',
      label: 'AI-generated, advisory',
    },
  ],
  'shipment-insulin-002': [
    {
      insight_id: 'ins-003',
      kind: 'forecast',
      score: 68.0,
      severity: 'warning',
      explanation: 'Upward thermal trajectory detected. CUSUM positive drift detected (+0.08°C/min). Projected to cross 8.0°C in ~16 minutes.',
      input_ref: 'batch-012',
      warmup_status: 'active',
      model_name: 'CUSUMDriftDetector',
      model_version: 'v1.0.0',
      created_at: '2026-10-10 12:35:00',
      label: 'AI-generated, advisory',
    },
    {
      insight_id: 'ins-004',
      kind: 'risk',
      score: 68.0,
      severity: 'warning',
      explanation: 'ELEVATED risk tier reached. Humidity elevated (62%). Advising pre-emptive refrigeration check before biologic denaturing.',
      input_ref: 'batch-012',
      warmup_status: 'active',
      model_name: 'CompositeRiskScorer',
      model_version: 'v1.0.0',
      created_at: '2026-10-10 12:30:00',
      label: 'AI-generated, advisory',
    },
  ],
  'shipment-produce-003': [
    {
      insight_id: 'ins-005',
      kind: 'anomaly',
      score: 0.94,
      severity: 'critical',
      explanation: 'Severe thermal excursion (14.2°C vs max 4.0°C). HalfSpaceTrees anomaly score 0.94 indicates severe deviation.',
      input_ref: 'batch-026',
      warmup_status: 'active',
      model_name: 'RiverHalfSpaceTrees',
      model_version: 'v1.0.0',
      created_at: '2026-10-10 12:20:00',
      label: 'AI-generated, advisory',
    },
    {
      insight_id: 'ins-006',
      kind: 'risk',
      score: 88.5,
      severity: 'critical',
      explanation: 'CRITICAL risk tier triggered. Shelf life degraded by 46%. Arrhenius velocity accelerated 4.2x above baseline.',
      input_ref: 'batch-026',
      warmup_status: 'active',
      model_name: 'CompositeRiskScorer',
      model_version: 'v1.0.0',
      created_at: '2026-10-10 12:15:00',
      label: 'AI-generated, advisory',
    },
  ],
};

export const MOCK_EVALUATION_BENCHMARKS: EvaluationBenchmark[] = [
  {
    evaluation_id: 'eval-001',
    model_name: 'River HalfSpaceTrees (Streaming)',
    model_version: 'v1.0.0',
    precision: 0.88,
    recall: 0.94,
    false_alert_rate: 0.04,
    avg_lead_time_seconds: 960, // 16 min early warning
    dataset_name: 'FrostLedger Historical Excursion Benchmark v1 (N=1,200)',
    created_at: '2026-10-10 10:00:00',
    label: 'AI-generated, advisory',
  },
  {
    evaluation_id: 'eval-002',
    model_name: 'IsolationForest (Batch Baseline)',
    model_version: 'v1.4.2',
    precision: 0.82,
    recall: 0.87,
    false_alert_rate: 0.08,
    avg_lead_time_seconds: 600, // 10 min early warning
    dataset_name: 'FrostLedger Historical Excursion Benchmark v1 (N=1,200)',
    created_at: '2026-10-10 10:00:00',
    label: 'AI-generated, advisory',
  },
  {
    evaluation_id: 'eval-003',
    model_name: 'LocalOutlierFactor (Density Baseline)',
    model_version: 'v1.4.2',
    precision: 0.79,
    recall: 0.81,
    false_alert_rate: 0.11,
    avg_lead_time_seconds: 480, // 8 min early warning
    dataset_name: 'FrostLedger Historical Excursion Benchmark v1 (N=1,200)',
    created_at: '2026-10-10 10:00:00',
    label: 'AI-generated, advisory',
  },
];

export function generateTelemetryHistory(shipment: ShipmentSummary): TelemetryReading[] {
  const points: TelemetryReading[] = [];
  const baseTime = new Date(Date.now() - 3600 * 1000 * 4); // 4 hours ago

  for (let i = 0; i < 40; i++) {
    const ts = new Date(baseTime.getTime() + i * 6 * 60 * 1000).toISOString();
    let temp = shipment.current_temp;
    let hum = shipment.current_humidity;
    let shock = 0.0;

    if (shipment.status === 'flagged') {
      if (i > 25) {
        temp = 4.0 + (i - 25) * 0.7; // Excursion climbing
        shock = i === 26 ? 3.2 : 0.0;
      } else {
        temp = 2.5 + Math.sin(i * 0.3) * 0.5;
      }
    } else if (shipment.shipment_id === 'shipment-insulin-002') {
      // Gradual drift upwards
      temp = 3.5 + (i / 40) * 4.4;
    } else {
      // Stable Pfizer
      temp = 4.2 + Math.sin(i * 0.2) * 0.4;
    }

    points.push({
      timestamp: ts.substring(11, 16),
      temperature: Number(temp.toFixed(2)),
      humidity: Number((hum + Math.sin(i * 0.4) * 3).toFixed(1)),
      shock,
      speed: 45 + Math.sin(i) * 10,
    });
  }

  return points;
}

export async function fetchLiveShipments(): Promise<ShipmentSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/shipments`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.shipments && data.shipments.length > 0) {
      return data.shipments;
    }
  } catch (err) {
    console.warn('[API Client] Live shipments fetch notice (using cache/fallback):', err);
  }
  return MOCK_SHIPMENTS;
}

export async function fetchLiveTelemetry(shipment: ShipmentSummary): Promise<TelemetryReading[]> {
  try {
    const res = await fetch(`${API_BASE}/shipments/${shipment.shipment_id}/telemetry`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.readings && data.readings.length > 0) {
      return data.readings;
    }
  } catch (err) {
    console.warn('[API Client] Live telemetry fetch notice (using fallback):', err);
  }
  return generateTelemetryHistory(shipment);
}

export async function verifyLiveShipment(shipmentId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/verify/${shipmentId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API Client] Live verification fetch notice:', err);
    return null;
  }
}



