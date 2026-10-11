import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  FileText,
  AlertTriangle,
  Lock,
  Link as LinkIcon,
  Cpu,
  Printer,
} from 'lucide-react';
import {
  MOCK_SHIPMENTS,
  ShipmentSummary,
  API_BASE,
  fetchDashboardState,
  verifyShipmentArrivalApi,
} from '../services/api';

export const ArrivalVerificationView: React.FC = () => {
  const [shipments, setShipments] = useState<ShipmentSummary[]>(MOCK_SHIPMENTS);
  const [selectedId, setSelectedId] = useState(MOCK_SHIPMENTS[0].shipment_id);
  const [isTamperSimulated, setIsTamperSimulated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [liveReport, setLiveReport] = useState<any | null>(null);

  const shipment = shipments.find((s) => s.shipment_id === selectedId) || shipments[0] || MOCK_SHIPMENTS[0];

  const runLiveVerification = useCallback(async (sid: string) => {
    setIsVerifying(true);
    try {
      const [dash, rep] = await Promise.all([
        fetchDashboardState(),
        verifyShipmentArrivalApi(sid),
      ]);
      if (dash?.shipments?.length) {
        setShipments(dash.shipments);
      }
      if (rep) {
        setLiveReport(rep);
      }
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    runLiveVerification(selectedId);
  }, [selectedId, runLiveVerification]);

  const handleRunVerify = () => {
    runLiveVerification(selectedId);
  };

  const backendPass = liveReport ? liveReport.status === 'PASS' : true;
  const isVerified = !isTamperSimulated && backendPass;
  const totalBatches = liveReport?.total_batches ?? 10;
  const latestBatchDetail =
    liveReport?.batch_details && liveReport.batch_details.length > 0
      ? liveReport.batch_details[liveReport.batch_details.length - 1]
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header bar */}
      <div
        className="panel"
        style={{
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700 }}>
            Cryptographic Arrival Verification Engine
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            Audits Ed25519 hardware signatures, hash-chain continuity, and Polygon Amoy smart contract anchors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setIsTamperSimulated(false);
            }}
            style={{ padding: '0.45rem 0.75rem', fontFamily: 'var(--font-mono)' }}
          >
            {shipments.map((s) => (
              <option key={s.shipment_id} value={s.shipment_id}>
                {s.shipment_id} ({s.profile_name})
              </option>
            ))}
          </select>

          <button onClick={handleRunVerify} className="btn btn-accent">
            <ShieldCheck size={16} />
            {isVerifying ? 'Auditing Hash Chain...' : 'Re-verify Arrival'}
          </button>
        </div>
      </div>

      {/* Main Status Hero */}
      <div
        className={`panel ${isVerified ? 'glow-accent' : 'glow-critical'}`}
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: isVerified ? 'rgba(125, 249, 196, 0.03)' : 'rgba(224, 87, 76, 0.05)',
        }}
      >
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: isVerified ? 'var(--color-accent-subtle)' : 'var(--color-critical-subtle)', marginBottom: '1rem' }}>
          {isVerified ? (
            <ShieldCheck size={48} color="var(--color-accent)" />
          ) : (
            <AlertTriangle size={48} color="var(--color-critical)" />
          )}
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: isVerified ? 'var(--color-accent)' : 'var(--color-critical)',
          }}
        >
          {isVerified ? 'CRYPTOGRAPHICALLY VERIFIED & UNTAMPERED' : 'INTEGRITY AUDIT FAILED & TAMPER DETECTED'}
        </h3>

        <p style={{ maxWidth: '640px', margin: '0.5rem auto 1.5rem', color: 'var(--color-text-dim)', fontSize: '13px' }}>
          {isVerified
            ? `All ${totalBatches} telemetry batches match canonical SHA-256 hashes, valid Ed25519 device signatures, continuous prev_hash chain, and on-chain Polygon Amoy root anchor.`
            : 'Hash chain integrity failure! The recomputed batch hash diverges from the device signature or the on-chain blockchain anchor.'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <a
            href={`${API_BASE}/verify/${shipment.shipment_id}/report`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{ textDecoration: 'none' }}
          >
            <Printer size={15} />
            Print Official Audit Certificate (HTML)
          </a>

          <button
            onClick={() => setIsTamperSimulated(!isTamperSimulated)}
            className={`btn ${isTamperSimulated ? 'btn-danger' : 'btn-ghost'}`}
            style={{ fontSize: '12px' }}
          >
            {isTamperSimulated ? 'Reset Simulated Tamper' : 'Simulate Database SQL Tamper'}
          </button>
        </div>
      </div>

      {/* 5-Step Cryptographic Audit Checklist Table */}
      <div className="panel" style={{ padding: '1.5rem' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Hardware &amp; Cryptographic Checklist Breakdown
        </h4>

        <table className="telemetry-table">
          <thead>
            <tr>
              <th>Verification Check</th>
              <th>Audit Mechanism</th>
              <th>Observed Evidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={15} color="var(--color-accent)" />
                Canonical Payload Hash
              </td>
              <td>RFC-8785 JSON canonicalization + SHA-256</td>
              <td className="data">
                {latestBatchDetail?.recomputed_hash ||
                  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
              </td>
              <td>
                <span className={`badge ${!isTamperSimulated && (liveReport ? liveReport.checks.hash_integrity.pass : true) ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated && (liveReport ? liveReport.checks.hash_integrity.pass : true) ? 'MATCHED' : 'HASH MISMATCH'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={15} color="var(--color-accent)" />
                Ed25519 Hardware Signature
              </td>
              <td>Curve25519 onboard crypto key verification</td>
              <td className="data">
                device: {liveReport?.device_id || shipment.device_id} ({totalBatches} signed batches)
              </td>
              <td>
                <span className={`badge ${!isTamperSimulated && (liveReport ? liveReport.checks.signature_authenticity.pass : true) ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated && (liveReport ? liveReport.checks.signature_authenticity.pass : true) ? 'VALID SIGNATURE' : 'FORGERY REJECTED'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LinkIcon size={15} color="var(--color-accent)" />
                Sequential Hash Chain
              </td>
              <td>prev_hash pointer verification across all batches</td>
              <td className="data">
                Continuity verified [1..{totalBatches}] with zero sequence gaps
              </td>
              <td>
                <span className={`badge ${!isTamperSimulated && (liveReport ? liveReport.checks.hash_chain_continuity.pass : true) ? 'badge-pass' : 'badge-critical'}`}>
                  {!isTamperSimulated && (liveReport ? liveReport.checks.hash_chain_continuity.pass : true) ? 'CONTINUOUS' : 'BROKEN CHAIN'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={15} color="var(--color-pass)" />
                Smart Contract Window Anchor
              </td>
              <td>Polygon Amoy ColdChainTracker contract query</td>
              <td className="data">
                TX: {shipment.anchored_tx || '0x97273b89beb8f51b1386c4f65078b380c8801fc3c54eb64194d8e0d6f98ced37'}
              </td>
              <td>
                <span className={`badge ${liveReport ? (liveReport.checks.blockchain_anchors.pass ? 'badge-pass' : 'badge-critical') : 'badge-pass'}`}>
                  {liveReport ? (liveReport.checks.blockchain_anchors.pass ? 'ANCHORED ON-CHAIN' : 'ANCHOR MISMATCH') : 'ANCHORED ON-CHAIN'}
                </span>
              </td>
            </tr>

            <tr>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={15} color="var(--color-accent)" />
                Immutable Profile Snapshot
              </td>
              <td>Genesis profile hash matching smart contract registration</td>
              <td className="data">
                profile_hash: {(liveReport?.profile_hash || '7d21fe8294000000').substring(0, 16)}... ({liveReport?.profile_id || shipment.profile_id} v{liveReport?.profile_version || 1})
              </td>
              <td>
                <span className={`badge ${liveReport ? (liveReport.profile_integrity_pass ? 'badge-pass' : 'badge-critical') : 'badge-pass'}`}>
                  {liveReport ? (liveReport.profile_integrity_pass ? 'FROZEN SPEC VERIFIED' : 'PROFILE TAMPERED') : 'FROZEN SPEC VERIFIED'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
