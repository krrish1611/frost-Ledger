import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from 'recharts';
import {
  Thermometer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import {
  MOCK_SHIPMENTS,
  generateTelemetryHistory,
} from '../services/api';

export const ShipmentDetailView: React.FC = () => {
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    MOCK_SHIPMENTS[0].shipment_id
  );
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [ackModalAlertId, setAckModalAlertId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');

  const shipment = useMemo(() => {
    return (
      MOCK_SHIPMENTS.find((s) => s.shipment_id === selectedShipmentId) ||
      MOCK_SHIPMENTS[0]
    );
  }, [selectedShipmentId]);

  const telemetryData = useMemo(() => {
    return generateTelemetryHistory(shipment);
  }, [shipment]);

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts((prev) => new Set(prev).add(alertId));
    setAckModalAlertId(null);
    setAckNote('');
  };

  const isTempExcursion =
    shipment.current_temp > shipment.temp_max_c ||
    shipment.current_temp < shipment.temp_min_c;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Shipment Selector Bar */}
      <div
        className="panel"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            ACTIVE SHIPMENT:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {MOCK_SHIPMENTS.map((s) => {
              const active = s.shipment_id === selectedShipmentId;
              return (
                <button
                  key={s.shipment_id}
                  onClick={() => setSelectedShipmentId(s.shipment_id)}
                  className={`btn ${active ? 'btn-accent' : 'btn-outline'}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                >
                  <span
                    className={`status-dot ${
                      s.status === 'flagged'
                        ? 'status-dot-critical'
                        : s.status === 'in_transit'
                        ? 'status-dot-active'
                        : 'status-dot-warn'
                    }`}
                  />
                  {s.profile_name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="data" style={{ color: 'var(--color-muted)' }}>
          ID: <span style={{ color: 'var(--color-text)' }}>{shipment.shipment_id}</span> &bull; DEVICE: <span style={{ color: 'var(--color-accent)' }}>{shipment.device_id}</span>
        </div>
      </div>

      {/* KPI 4-Card Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Card 1: Current Temperature */}
        <div className={`panel ${isTempExcursion ? 'glow-critical' : 'glow-accent'}`} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: '12px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
              Current Temperature
            </span>
            <Thermometer size={18} color={isTempExcursion ? 'var(--color-critical)' : 'var(--color-accent)'} />
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.25rem',
                fontWeight: 700,
                color: isTempExcursion ? 'var(--color-critical)' : 'var(--color-text)',
              }}
            >
              {shipment.current_temp.toFixed(1)}&deg;C
            </span>
            <span className="data" style={{ color: 'var(--color-muted)' }}>
              Range: {shipment.temp_min_c}&deg;C &ndash; {shipment.temp_max_c}&deg;C
            </span>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {isTempExcursion ? (
              <span className="badge badge-critical">EXCURSION DETECTED</span>
            ) : (
              <span className="badge badge-pass">WITHIN PROFILE SPEC</span>
            )}
          </div>
        </div>

        {/* Card 2: Mean Kinetic Temperature (MKT) */}
        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: '12px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
              Mean Kinetic Temp (USP &lt;1160&gt;)
            </span>
            <Flame size={18} color="var(--color-warn)" />
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 700 }}>
              {shipment.mkt.toFixed(2)}&deg;C
            </span>
            <span className="data" style={{ color: 'var(--color-muted)' }}>
              Ea = 83.14 kJ/mol
            </span>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="badge badge-pass">THERMAL LOAD INTEGRATED</span>
          </div>
        </div>

        {/* Card 3: Remaining Shelf Life */}
        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: '12px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
              Remaining Shelf-Life
            </span>
            <Clock size={18} color="var(--color-accent)" />
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 700 }}>
              {shipment.remaining_life_pct.toFixed(1)}%
            </span>
            <span className="data" style={{ color: 'var(--color-muted)' }}>
              Arrhenius Decay
            </span>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'var(--color-border)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${shipment.remaining_life_pct}%`,
                  height: '100%',
                  backgroundColor:
                    shipment.remaining_life_pct > 80
                      ? 'var(--color-pass)'
                      : shipment.remaining_life_pct > 50
                      ? 'var(--color-warn)'
                      : 'var(--color-critical)',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Blockchain Anchor Status */}
        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: '12px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
              Polygon Amoy Anchor
            </span>
            <CheckCircle2 size={18} color="var(--color-pass)" />
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text)' }}>
              TX: {shipment.anchored_tx ? shipment.anchored_tx.substring(0, 16) + '...' : 'Pending'}
            </div>
            <div className="data" style={{ color: 'var(--color-muted)', marginTop: '0.25rem' }}>
              Batch Window: 5 / 5 hashes sealed
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <a
              href={`https://amoy.polygonscan.com/tx/${shipment.anchored_tx}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '11px',
                color: 'var(--color-accent)',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            >
              View on Polygonscan <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      {/* Telemetry Chart Panel */}
      <div className="panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600 }}>
              Live Telemetry Stream &amp; Environmental Ingestion
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
              Canonical sensor readings authenticated with Ed25519 signatures.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span className="badge badge-pass">SAMPLING: 10s PINGS</span>
            <span className="badge badge-warn">HUMIDITY: ACTIVE</span>
          </div>
        </div>

        <div style={{ height: '320px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetryData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1F23" />
              <XAxis dataKey="timestamp" stroke="#8A8A92" fontSize={11} fontFamily="Geist Mono" />
              <YAxis domain={[-2, 20]} stroke="#8A8A92" fontSize={11} fontFamily="Geist Mono" unit="°C" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111113',
                  border: '1px solid #1F1F23',
                  borderRadius: '4px',
                  fontFamily: 'Geist Mono',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine
                y={shipment.temp_max_c}
                stroke="#E0574C"
                strokeDasharray="4 4"
                label={{ value: `Max: ${shipment.temp_max_c}°C`, fill: '#FFA29A', fontSize: 10, position: 'right' }}
              />
              <ReferenceLine
                y={shipment.temp_min_c}
                stroke="#7DF9C4"
                strokeDasharray="4 4"
                label={{ value: `Min: ${shipment.temp_min_c}°C`, fill: '#7DF9C4', fontSize: 10, position: 'right' }}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#7DF9C4"
                strokeWidth={2}
                dot={false}
                name="Temperature (°C)"
              />
              <Area
                type="monotone"
                dataKey="humidity"
                fill="rgba(91, 201, 140, 0.08)"
                stroke="#5BC98C"
                strokeWidth={1}
                name="Humidity (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Official Deterministic Alerts Panel */}
      <div className="panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="var(--color-critical)" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600 }}>
              Official Deterministic Regulatory Alerts
            </h3>
          </div>
          <span className="badge badge-critical">OFFICIAL RECORD &bull; DETERMINISTIC ONLY</span>
        </div>

        {shipment.status === 'flagged' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: 'rgba(224, 87, 76, 0.08)',
                border: '1px solid rgba(224, 87, 76, 0.3)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-critical">CRITICAL</span>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>THERMAL_EXCURSION_HIGH</span>
                  <span className="data" style={{ color: 'var(--color-muted)' }}>
                    Alert ID: alt_excursion_det_094
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginTop: '0.35rem' }}>
                  Temperature rose to 14.20°C, breaching profile maximum threshold (4.00°C) by +10.20°C.
                </p>
              </div>

              {acknowledgedAlerts.has('alt_excursion_det_094') ? (
                <span className="badge badge-pass">ACKNOWLEDGED BY OPERATOR</span>
              ) : (
                <button
                  onClick={() => setAckModalAlertId('alt_excursion_det_094')}
                  className="btn btn-danger"
                  style={{ fontSize: '12px' }}
                >
                  Acknowledge Alert
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-muted)' }}>
            <CheckCircle2 size={32} color="var(--color-pass)" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontWeight: 500 }}>No Deterministic Breaches or Security Anomalies</p>
            <p className="data" style={{ fontSize: '11px', marginTop: '0.2rem' }}>
              Hash chains and kinetic Arrhenius bounds strictly verified.
            </p>
          </div>
        )}
      </div>

      {/* Alert Acknowledge Modal */}
      {ackModalAlertId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="panel glow-critical"
            style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', background: '#161619' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <AlertTriangle size={20} color="var(--color-warn)" />
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>
                Acknowledge Deterministic Alert
              </h4>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginBottom: '1rem' }}>
              Mandatory SOP: Regulatory standard requires documenting the remediation action before alert resolution is entered into the immutable audit log.
            </p>

            <textarea
              rows={3}
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder="Enter resolution notes (e.g., Relocated cargo to backup refrigeration unit at hub depot)."
              style={{ width: '100%', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setAckModalAlertId(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button
                disabled={!ackNote.trim()}
                onClick={() => handleAcknowledge(ackModalAlertId)}
                className="btn btn-accent"
              >
                Sign &amp; Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
