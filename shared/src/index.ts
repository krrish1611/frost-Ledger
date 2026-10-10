import crypto from 'node:crypto';
import { z } from 'zod';

// ==========================================
// Standard Error Response Schema (Rule 12)
// ==========================================
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export function createErrorResponse(code: string, message: string): ApiErrorResponse {
  return {
    error: {
      code,
      message,
    },
  };
}

// ==========================================
// Roles & Authentication Schemas
// ==========================================
export const UserRoleSchema = z.enum(['operator', 'receiver', 'auditor', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  user_id: z.string().uuid(),
  org_id: z.string().min(1),
  email: z.string().email(),
  password_hash: z.string(),
  role: UserRoleSchema,
  created_at: z.string().datetime({ offset: true }),
});
export type User = z.infer<typeof UserSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: UserRoleSchema,
  org_id: z.string().min(1).default('default-org'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export interface JwtTokenPayload {
  user_id: string;
  email: string;
  role: UserRole;
  org_id: string;
  iat?: number;
  exp?: number;
}

// ==========================================
// Digital Product Profiles
// ==========================================
export const ProfileParametersSchema = z.object({
  name: z.string().min(1),
  cargo_type: z.string().min(1),
  temp_min_c: z.number(),
  temp_max_c: z.number(),
  ref_temp_c: z.number(),
  ref_shelf_life_hours: z.number().positive(),
  activation_energy_j_mol: z.number().positive(), // e.g. 83144 for typical Arrhenius cold chain
  humidity_min_pct: z.number().min(0).max(100).optional(),
  humidity_max_pct: z.number().min(0).max(100).optional(),
  max_shock_g: z.number().positive().optional(),
  max_tilt_degrees: z.number().positive().optional(),
});
export type ProfileParameters = z.infer<typeof ProfileParametersSchema>;

export const ProfileSchema = z.object({
  profile_id: z.string().min(1),
  version: z.number().int().positive(),
  parameters: ProfileParametersSchema,
  created_by: z.string(),
  created_at: z.string().datetime({ offset: true }),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const CreateProfileInputSchema = z.object({
  profile_id: z.string().min(1),
  parameters: ProfileParametersSchema,
});
export type CreateProfileInput = z.infer<typeof CreateProfileInputSchema>;

// ==========================================
// Devices & Shipments
// ==========================================
export const DeviceStatusSchema = z.enum(['active', 'revoked']);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const DeviceSchema = z.object({
  device_id: z.string().min(1),
  org_id: z.string().min(1),
  public_key: z.string().min(1), // hex representation of Ed25519 public key
  status: DeviceStatusSchema,
  created_at: z.string().datetime({ offset: true }),
  revoked_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const ShipmentStatusSchema = z.enum(['created', 'in_transit', 'delivered', 'flagged']);
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;

export const ShipmentSchema = z.object({
  shipment_id: z.string().min(1),
  device_id: z.string().min(1),
  profile_id: z.string().min(1),
  profile_version: z.number().int().positive(),
  profile_hash: z.string().length(64), // SHA-256 of canonical profile parameters
  status: ShipmentStatusSchema,
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }).nullable().optional(),
  ai_enabled: z.boolean().default(true),
  ai_email_enabled: z.boolean().default(false),
});
export type Shipment = z.infer<typeof ShipmentSchema>;

export const CreateShipmentInputSchema = z.object({
  shipment_id: z.string().min(1),
  device_id: z.string().min(1),
  profile_id: z.string().min(1),
  profile_version: z.number().int().positive().optional(), // if omitted, uses latest version
  ai_enabled: z.boolean().default(true),
  ai_email_enabled: z.boolean().default(false),
});
export type CreateShipmentInput = z.infer<typeof CreateShipmentInputSchema>;

// ==========================================
// Telemetry & Batches
// ==========================================
export const SensorReadingSchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  temperature: z.number(),
  humidity: z.number(),
  gps: z.object({
    lat: z.number(),
    lon: z.number(),
    speed: z.number(),
    time_utc: z.string().datetime({ offset: true }),
  }).optional(),
  shock_events: z.array(z.object({
    magnitude_g: z.number(),
    timestamp: z.string().datetime({ offset: true }),
  })).optional(),
});
export type SensorReading = z.infer<typeof SensorReadingSchema>;

export const BatchPayloadSchema = z.object({
  readings: z.array(SensorReadingSchema).min(1),
});
export type BatchPayload = z.infer<typeof BatchPayloadSchema>;

export const BatchSchema = z.object({
  batch_id: z.string().uuid(),
  shipment_id: z.string().min(1),
  device_id: z.string().min(1),
  sequence_no: z.number().int().nonnegative(),
  prev_hash: z.string().length(64),
  hash: z.string().length(64),
  signature: z.string(), // Hex string of Ed25519 signature
  payload: BatchPayloadSchema,
  received_at: z.string().datetime({ offset: true }),
});
export type Batch = z.infer<typeof BatchSchema>;

export const GENESIS_PREV_HASH = '0'.repeat(64);

export const TelemetrySubmissionSchema = z.object({
  batch_id: z.string().optional(),
  shipment_id: z.string().min(1),
  device_id: z.string().min(1),
  sequence_no: z.number().int().positive(),
  prev_hash: z.string().length(64),
  hash: z.string().length(64),
  signature: z.string(), // Hex string of Ed25519 signature
  payload: BatchPayloadSchema,
});
export type TelemetrySubmission = z.infer<typeof TelemetrySubmissionSchema>;

export const EventSubmissionSchema = z.object({
  event_id: z.string().optional(),
  shipment_id: z.string().min(1),
  type: z.string().min(1),
  magnitude: z.number(),
  timestamp: z.string().datetime({ offset: true }),
});
export type EventSubmission = z.infer<typeof EventSubmissionSchema>;

/**
 * Computes canonical hash over fixed batch parameters
 */
export function computeBatchHash(data: {
  device_id: string;
  shipment_id: string;
  sequence_no: number;
  prev_hash: string;
  payload: unknown;
}): string {
  const canonicalData = {
    device_id: data.device_id,
    payload: data.payload,
    prev_hash: data.prev_hash,
    sequence_no: data.sequence_no,
    shipment_id: data.shipment_id,
  };
  return computeCanonicalHash(canonicalData);
}

// ==========================================
// Audit Log & Alerts
// ==========================================
export const AuditLogSchema = z.object({
  log_id: z.string().uuid(),
  actor: z.string().min(1),
  action: z.string().min(1),
  target: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// ==========================================
// Canonical Serialization & Hashing Functions
// ==========================================

/**
 * Deterministically serializes any JavaScript object or primitive.
 * - Object keys are sorted lexicographically.
 * - Floating point numbers are rounded to 4 fixed decimal places to prevent platform discrepancies.
 * - Strings are trimmed and escaped consistently.
 * - Timestamps remain in standardized UTC ISO string format.
 */
export function canonicalSerialize(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new Error('Cannot serialize non-finite numbers');
    }
    // Fixed precision of 4 decimal places for consistency between ESP32/simulator and backend
    return Number(val.toFixed(4)).toString();
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'string') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => canonicalSerialize(item)).join(',') + ']';
  }
  if (typeof val === 'object') {
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
    const parts = sortedKeys.map((key) => {
      const serializedKey = JSON.stringify(key);
      const serializedVal = canonicalSerialize((val as Record<string, unknown>)[key]);
      return `${serializedKey}:${serializedVal}`;
    });
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(String(val));
}

/**
 * Computes standard SHA-256 hash in lowercase hex
 */
export function computeSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Computes canonical hash of a batch object (or profile parameters)
 */
export function computeCanonicalHash(data: unknown): string {
  const canonicalString = canonicalSerialize(data);
  return computeSha256(canonicalString);
}

/**
 * UTC ISO 8601 timestamp helper
 */
export function getUtcTimestamp(): string {
  return new Date().toISOString();
}

// ==========================================
// Ed25519 Cryptographic Signatures
// ==========================================

export function generateEd25519KeyPair(): { publicKeyHex: string; privateKeyHex: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Extract raw 32-byte keys from standard DER encodings
  const pubRaw = publicKey.subarray(publicKey.length - 32);
  const privRaw = privateKey.subarray(privateKey.length - 32);

  return {
    publicKeyHex: pubRaw.toString('hex'),
    privateKeyHex: privRaw.toString('hex'),
  };
}

export function signWithEd25519(data: string | Buffer, privateKeyHex: string): string {
  const privKeyRaw = Buffer.from(privateKeyHex, 'hex');
  // Reconstruct PKCS8 DER wrapper for 32-byte Ed25519 raw key
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

export function verifyEd25519Signature(data: string | Buffer, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const pubKeyRaw = Buffer.from(publicKeyHex, 'hex');
    // Reconstruct SPKI DER wrapper for 32-byte Ed25519 raw key
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const derPublicKey = Buffer.concat([spkiPrefix, pubKeyRaw]);

    const publicKey = crypto.createPublicKey({
      key: derPublicKey,
      format: 'der',
      type: 'spki',
    });

    const bufferToVerify = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const signature = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, bufferToVerify, publicKey, signature);
  } catch {
    return false;
  }
}

export * from './kinetics';

// ==========================================
// AI / ML Advisory Schemas (Stage 5)
// ==========================================
export const ADVISORY_LABEL = 'AI-generated, advisory';

export const AiInsightKindSchema = z.enum(['anomaly', 'forecast', 'risk', 'spoofing']);
export type AiInsightKind = z.infer<typeof AiInsightKindSchema>;

export const AiInsightSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AiInsightSeverity = z.infer<typeof AiInsightSeveritySchema>;

export const AiWarmupStatusSchema = z.enum(['warming_up', 'active']);
export type AiWarmupStatus = z.infer<typeof AiWarmupStatusSchema>;

export const AiInsightSchema = z.object({
  insight_id: z.string(),
  shipment_id: z.string(),
  kind: AiInsightKindSchema,
  score: z.number().min(0).max(1),
  severity: AiInsightSeveritySchema,
  explanation: z.string(),
  input_ref: z.string(),
  warmup_status: AiWarmupStatusSchema,
  model_name: z.string(),
  model_version: z.string(),
  created_at: z.string().datetime({ offset: true }),
  label: z.literal(ADVISORY_LABEL).default(ADVISORY_LABEL),
});
export type AiInsight = z.infer<typeof AiInsightSchema>;

// ==========================================
// Risk Scoring & Notification Schemas (Stage 6)
// ==========================================
export const AiRiskTierSchema = z.enum(['LOW', 'MODERATE', 'ELEVATED', 'CRITICAL']);
export type AiRiskTier = z.infer<typeof AiRiskTierSchema>;

export const AiRiskScoreFactorsSchema = z.object({
  thermal_risk: z.number().min(0).max(100),
  anomaly_risk: z.number().min(0).max(100),
  drift_risk: z.number().min(0).max(100),
  kinetics_risk: z.number().min(0).max(100),
  security_penalty: z.number().min(0).max(100),
});
export type AiRiskScoreFactors = z.infer<typeof AiRiskScoreFactorsSchema>;

export const AiRiskScoreSchema = z.object({
  shipment_id: z.string(),
  composite_score: z.number().min(0).max(100),
  tier: AiRiskTierSchema,
  factors: AiRiskScoreFactorsSchema,
  explanation: z.string(),
  recommendation: z.string(),
  evaluated_at: z.string().datetime({ offset: true }),
  label: z.literal(ADVISORY_LABEL).default(ADVISORY_LABEL),
});
export type AiRiskScore = z.infer<typeof AiRiskScoreSchema>;

export const AiNotificationStatusSchema = z.enum(['sent', 'suppressed', 'failed']);
export type AiNotificationStatus = z.infer<typeof AiNotificationStatusSchema>;

export const AiNotificationSchema = z.object({
  notification_id: z.string(),
  insight_id: z.string(),
  shipment_id: z.string(),
  sent_at: z.string().datetime({ offset: true }),
  status: AiNotificationStatusSchema,
  reason: z.string().optional(),
  label: z.literal(ADVISORY_LABEL).default(ADVISORY_LABEL),
});
export type AiNotification = z.infer<typeof AiNotificationSchema>;

// ==========================================
// Offline ML Evaluation Schemas (Stage 7)
// ==========================================
export const AiEvaluationSchema = z.object({
  evaluation_id: z.string(),
  model_name: z.string(),
  model_version: z.string(),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  false_alert_rate: z.number().min(0).max(1),
  avg_lead_time_seconds: z.number().nonnegative(),
  dataset_name: z.string(),
  created_at: z.string().datetime({ offset: true }),
  label: z.literal(ADVISORY_LABEL).default(ADVISORY_LABEL),
});
export type AiEvaluation = z.infer<typeof AiEvaluationSchema>;

