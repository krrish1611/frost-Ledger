import { getDbClient } from '../db';
import {
  computeBatchHash,
  computeCanonicalHash,
  verifyEd25519Signature,
  GENESIS_PREV_HASH,
  getUtcTimestamp,
} from '@frostledger/shared';
import { blockchainService, computeWindowHash } from './blockchainService';

export interface VerificationCheckSummary {
  pass: boolean;
  failures: string[];
}

export interface BatchVerificationDetail {
  sequence_no: number;
  batch_id: string;
  stored_hash: string;
  recomputed_hash: string;
  hash_valid: boolean;
  signature_valid: boolean;
  chain_valid: boolean;
  sequence_valid: boolean;
}

export interface VerificationReport {
  shipment_id: string;
  status: 'PASS' | 'FAIL';
  verified_at: string;
  device_id: string;
  profile_id: string;
  profile_version: number;
  profile_hash: string;
  profile_integrity_pass: boolean;
  total_batches: number;
  checks: {
    hash_integrity: VerificationCheckSummary;
    signature_authenticity: VerificationCheckSummary;
    hash_chain_continuity: VerificationCheckSummary;
    sequence_continuity: VerificationCheckSummary;
    blockchain_anchors: VerificationCheckSummary;
  };
  tampered_batches: number[];
  batch_details: BatchVerificationDetail[];
  shelf_life_trail: Array<{
    batch_id: string;
    mkt: number;
    consumed_fraction: number;
    remaining_life: number;
    created_at: string;
  }>;
  ai_insights: {
    label: string;
    disclaimer: string;
    items: Array<{
      kind: string;
      score: number;
      severity: string;
      explanation: string;
      created_at: string;
    }>;
  };
}

export async function verifyShipmentArrival(shipmentId: string): Promise<VerificationReport> {
  const db = await getDbClient();

  // 1. Fetch shipment
  const shipmentRes = await db.query(
    `SELECT shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time
     FROM shipments WHERE shipment_id = $1`,
    [shipmentId]
  );

  if (shipmentRes.rowCount === 0) {
    throw new Error(`Shipment '${shipmentId}' not found`);
  }

  const shipment = shipmentRes.rows[0];

  // 2. Fetch profile parameters and verify canonical profile hash
  const profileRes = await db.query(
    'SELECT parameters FROM profiles WHERE profile_id = $1 AND version = $2',
    [shipment.profile_id, shipment.profile_version]
  );

  let profileIntegrityPass = true;
  if (profileRes.rowCount > 0) {
    const rawParams = profileRes.rows[0].parameters;
    const params = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;
    const calculatedHash = computeCanonicalHash(params);
    profileIntegrityPass = calculatedHash === shipment.profile_hash;
  } else {
    profileIntegrityPass = false;
  }

  // 3. Fetch device public key
  const deviceRes = await db.query(
    'SELECT public_key, status FROM devices WHERE device_id = $1',
    [shipment.device_id]
  );
  const devicePublicKey = deviceRes.rows[0]?.public_key || '';

  // 4. Fetch all batches for shipment in sequence order
  const batchesRes = await db.query(
    `SELECT batch_id, sequence_no, prev_hash, hash, signature, payload
     FROM batches
     WHERE shipment_id = $1
     ORDER BY sequence_no ASC`,
    [shipmentId]
  );

  const hashFailures: string[] = [];
  const sigFailures: string[] = [];
  const chainFailures: string[] = [];
  const seqFailures: string[] = [];
  const tamperedBatches: number[] = [];
  const batchDetails: BatchVerificationDetail[] = [];

  let previousHash = GENESIS_PREV_HASH;
  let expectedSeq = 1;

  for (const b of batchesRes.rows) {
    const seq = Number(b.sequence_no);
    const payload = typeof b.payload === 'string' ? JSON.parse(b.payload) : b.payload;

    // Check sequence continuity
    const sequenceValid = seq === expectedSeq;
    if (!sequenceValid) {
      seqFailures.push(`Sequence mismatch: expected ${expectedSeq}, received ${seq}`);
      tamperedBatches.push(seq);
    }
    expectedSeq = seq + 1;

    // Check hash chain continuity
    const chainValid = b.prev_hash === previousHash;
    if (!chainValid) {
      chainFailures.push(`Hash chain break on seq ${seq}: expected prev_hash ${previousHash}, found ${b.prev_hash}`);
      tamperedBatches.push(seq);
    }

    // Recompute canonical batch hash
    const recomputedHash = computeBatchHash({
      device_id: shipment.device_id,
      shipment_id: shipmentId,
      sequence_no: seq,
      prev_hash: b.prev_hash,
      payload,
    });

    const hashValid = recomputedHash === b.hash;
    if (!hashValid) {
      hashFailures.push(`Hash mismatch on seq ${seq}: stored ${b.hash}, recomputed ${recomputedHash}`);
      tamperedBatches.push(seq);
    }

    // Verify digital signature
    const signatureValid = verifyEd25519Signature(b.hash, b.signature, devicePublicKey);
    if (!signatureValid) {
      sigFailures.push(`Cryptographic signature invalid on seq ${seq}`);
      tamperedBatches.push(seq);
    }

    previousHash = b.hash;

    batchDetails.push({
      sequence_no: seq,
      batch_id: b.batch_id,
      stored_hash: b.hash,
      recomputed_hash: recomputedHash,
      hash_valid: hashValid,
      signature_valid: signatureValid,
      chain_valid: chainValid,
      sequence_valid: sequenceValid,
    });
  }

  // 5. Compare with On-Chain Blockchain Records
  const onChainWindows = await blockchainService.getOnChainWindows(shipmentId);
  const blockchainFailures: string[] = [];

  // Group verified batches into windows to compare against on-chain anchors
  const batchHashes = batchesRes.rows.map((b) => b.hash);
  for (const win of onChainWindows) {
    const windowBatchHashes = batchesRes.rows
      .filter((b) => Number(b.sequence_no) >= win.startSeq && Number(b.sequence_no) <= win.endSeq)
      .map((b) => b.hash);

    if (windowBatchHashes.length === 0) {
      blockchainFailures.push(`On-chain window [${win.startSeq}..${win.endSeq}] has no corresponding database batches`);
      continue;
    }

    const expectedWindowHash = '0x' + computeWindowHash(windowBatchHashes);
    if (win.windowHash.toLowerCase() !== expectedWindowHash.toLowerCase()) {
      blockchainFailures.push(
        `On-chain window hash mismatch for [${win.startSeq}..${win.endSeq}]: contract has ${win.windowHash}, computed ${expectedWindowHash}`
      );
    }
  }

  // 6. Fetch Shelf Life Trail
  const trailRes = await db.query(
    `SELECT batch_id, mkt, consumed_fraction, remaining_life, created_at
     FROM shelf_life_trail
     WHERE shipment_id = $1
     ORDER BY created_at ASC`,
    [shipmentId]
  );

  // 7. Fetch AI Insights (Isolated advisory section)
  const insightsRes = await db.query(
    `SELECT kind, score, severity, explanation, created_at
     FROM ai_insights
     WHERE shipment_id = $1
     ORDER BY created_at DESC`,
    [shipmentId]
  );

  const overallPass =
    profileIntegrityPass &&
    hashFailures.length === 0 &&
    sigFailures.length === 0 &&
    chainFailures.length === 0 &&
    seqFailures.length === 0 &&
    blockchainFailures.length === 0;

  return {
    shipment_id: shipmentId,
    status: overallPass ? 'PASS' : 'FAIL',
    verified_at: getUtcTimestamp(),
    device_id: shipment.device_id,
    profile_id: shipment.profile_id,
    profile_version: Number(shipment.profile_version),
    profile_hash: shipment.profile_hash,
    profile_integrity_pass: profileIntegrityPass,
    total_batches: batchesRes.rowCount,
    checks: {
      hash_integrity: { pass: hashFailures.length === 0, failures: hashFailures },
      signature_authenticity: { pass: sigFailures.length === 0, failures: sigFailures },
      hash_chain_continuity: { pass: chainFailures.length === 0, failures: chainFailures },
      sequence_continuity: { pass: seqFailures.length === 0, failures: seqFailures },
      blockchain_anchors: { pass: blockchainFailures.length === 0, failures: blockchainFailures },
    },
    tampered_batches: Array.from(new Set(tamperedBatches)).sort((a, b) => a - b),
    batch_details: batchDetails,
    shelf_life_trail: trailRes.rows.map((r) => ({
      batch_id: r.batch_id,
      mkt: Number(r.mkt),
      consumed_fraction: Number(r.consumed_fraction),
      remaining_life: Number(r.remaining_life),
      created_at: r.created_at,
    })),
    ai_insights: {
      label: 'AI-generated, advisory',
      disclaimer: 'Official alerts and records are shown above and never depend on AI.',
      items: insightsRes.rows.map((r) => ({
        kind: r.kind,
        score: Number(r.score),
        severity: r.severity,
        explanation: r.explanation,
        created_at: r.created_at,
      })),
    },
  };
}

/**
 * Generates printable HTML audit certificate view
 */
export function generateHtmlIntegrityReport(report: VerificationReport): string {
  const isPass = report.status === 'PASS';
  const statusColor = isPass ? '#16a34a' : '#dc2626';
  const statusBadge = isPass ? 'VERIFIED AUTHENTIC (PASS)' : 'TAMPERING DETECTED (FAIL)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FrostLedger Verification Report - ${report.shipment_id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1e293b; padding: 2rem; background: #f8fafc; }
    .card { background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 2rem; max-width: 900px; margin: 0 auto; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
    .status-badge { font-weight: bold; padding: 0.5rem 1rem; border-radius: 9999px; color: white; background: ${statusColor}; font-size: 1.1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; margin-bottom: 1.5rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
    th { background: #f1f5f9; color: #475569; }
    .ai-section { margin-top: 2rem; padding: 1.5rem; background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 6px; }
    .ai-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600; font-size: 0.75rem; }
    .print-btn { background: #0284c7; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    @media print { .print-btn { display: none; } body { background: white; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1 style="margin: 0; font-size: 1.5rem;">FrostLedger Official Integrity Audit Report</h1>
        <p style="margin: 0.25rem 0 0 0; color: #64748b;">Cryptographic Arrival Verification & Chain of Custody</p>
      </div>
      <div>
        <span class="status-badge">${statusBadge}</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
      <div><strong>Shipment ID:</strong> ${report.shipment_id}</div>
      <div><strong>Verification Time:</strong> ${report.verified_at}</div>
      <div><strong>Device Hardware ID:</strong> ${report.device_id}</div>
      <div><strong>Profile Version:</strong> ${report.profile_id} (v${report.profile_version})</div>
      <div><strong>Canonical Profile Hash:</strong> <code style="font-size: 0.8rem;">${report.profile_hash.substring(0, 16)}...</code></div>
      <div><strong>Total Batches Verified:</strong> ${report.total_batches}</div>
    </div>

    <h3>Deterministic Verification Checklist</h3>
    <table>
      <thead>
        <tr><th>Verification Check</th><th>Result</th><th>Notes</th></tr>
      </thead>
      <tbody>
        <tr><td>Canonical SHA-256 Batch Hashing</td><td>${report.checks.hash_integrity.pass ? 'PASS' : 'FAIL'}</td><td>${report.checks.hash_integrity.failures.length ? report.checks.hash_integrity.failures.join('; ') : 'All batch hashes match recomputed canonical format'}</td></tr>
        <tr><td>Ed25519 Hardware Signatures</td><td>${report.checks.signature_authenticity.pass ? 'PASS' : 'FAIL'}</td><td>${report.checks.signature_authenticity.failures.length ? report.checks.signature_authenticity.failures.join('; ') : 'Cryptographic authenticity proven for all batches'}</td></tr>
        <tr><td>Continuous Hash Chain</td><td>${report.checks.hash_chain_continuity.pass ? 'PASS' : 'FAIL'}</td><td>${report.checks.hash_chain_continuity.failures.length ? report.checks.hash_chain_continuity.failures.join('; ') : 'Genesis to arrival prev_hash unbroken'}</td></tr>
        <tr><td>Monotonic Sequence Continuity</td><td>${report.checks.sequence_continuity.pass ? 'PASS' : 'FAIL'}</td><td>${report.checks.sequence_continuity.failures.length ? report.checks.sequence_continuity.failures.join('; ') : 'Zero skipped packets or sequence gaps detected'}</td></tr>
        <tr><td>Blockchain On-Chain Anchors</td><td>${report.checks.blockchain_anchors.pass ? 'PASS' : 'FAIL'}</td><td>${report.checks.blockchain_anchors.failures.length ? report.checks.blockchain_anchors.failures.join('; ') : 'Window batch hashes match smart contract snapshot'}</td></tr>
      </tbody>
    </table>

    <h3>Audited Shelf Life Trail (Arrhenius Kinetics)</h3>
    <table>
      <thead>
        <tr><th>Batch ID</th><th>Arrhenius MKT (°C)</th><th>Consumed Life Fraction</th><th>Remaining Life (Hours)</th></tr>
      </thead>
      <tbody>
        ${report.shelf_life_trail.slice(-5).map(t => `
          <tr>
            <td><code>${t.batch_id}</code></td>
            <td>${t.mkt.toFixed(2)} °C</td>
            <td>${(t.consumed_fraction * 100).toFixed(2)} %</td>
            <td>${t.remaining_life.toFixed(1)} h</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="ai-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h4 style="margin: 0; color: #166534;">AI/ML Advisory Observations</h4>
        <span class="ai-badge">${report.ai_insights.label}</span>
      </div>
      <p style="font-size: 0.8rem; color: #15803d; margin: 0 0 0.5rem 0;"><em>${report.ai_insights.disclaimer}</em></p>
      ${report.ai_insights.items.length === 0 
        ? '<p style="font-size: 0.85rem; color: #475569; margin: 0;">No advisory warnings recorded for this shipment.</p>'
        : `<ul>${report.ai_insights.items.map(i => `<li style="font-size: 0.85rem;">[${i.severity.toUpperCase()}] ${i.kind}: ${i.explanation}</li>`).join('')}</ul>`
      }
    </div>

    <div style="text-align: right; margin-top: 2rem;">
      <button class="print-btn" onclick="window.print()">Print Audit Certificate</button>
    </div>
  </div>
</body>
</html>`;
}
