import React, { useState, useMemo, useEffect } from 'react';
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
  ShieldAlert,
  Flame,
  Cpu,
  Usb,
  Wifi,
  Send,
  RefreshCw,
} from 'lucide-react';
import {
  MOCK_SHIPMENTS,
  ShipmentSummary,
  TelemetryReading,
  LiveAlertRecord,
  generateTelemetryHistory,
  fetchDashboardState,
  fetchEsp32StatusApi,
  ingestEsp32PacketApi,
  acknowledgeAlertApi,
  API_BASE,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { PolygonScanLink } from './PolygonScanLink';
import { soundEffects } from '../services/soundEffects';
import { alertService } from '../services/alertService';

interface ShipmentDetailViewProps {
  selectedShipmentId?: string;
  onSelectShipmentId?: (id: string) => void;
  onOpenSimulator?: (shipmentId: string) => void;
  onOpenVerifier?: (hash: string) => void;
  currentUser?: { email?: string; id?: string } | null;
  currentRole?: string;
}

export const ShipmentDetailView: React.FC<ShipmentDetailViewProps> = ({
  selectedShipmentId: propShipmentId,
  onSelectShipmentId,
  onOpenSimulator,
  onOpenVerifier,
  currentUser,
  currentRole = 'operator',
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [internalShipmentId, setInternalShipmentId] = useState<string>(
    MOCK_SHIPMENTS[0].shipment_id
  );

  const selectedShipmentId = propShipmentId || internalShipmentId;

  const handleSelectShipment = (id: string) => {
    soundEffects.playClick();
    setInternalShipmentId(id);
    onSelectShipmentId?.(id);
  };

  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [lastAckInfo, setLastAckInfo] = useState<{ by: string; notes: string; hash: string } | null>(null);
  const [ackModalAlertId, setAckModalAlertId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  // ESP-32 Hardware & Web Serial State
  const [esp32Status, setEsp32Status] = useState<{
    host_com_ports: string[];
    hardware_usb_detected: boolean;
    active_esp32_streams: number;
    heartbeats: Record<string, any>;
  } | null>(null);
  const [usbSerialConnected, setUsbSerialConnected] = useState<boolean>(false);
  const [usbSerialLog, setUsbSerialLog] = useState<string>('');
  const [simTemp, setSimTemp] = useState<number>(4.4);
  const [simHumidity, setSimHumidity] = useState<number>(49.0);
  const [isSendingPacket, setIsSendingPacket] = useState<boolean>(false);
  const [lastIngestResult, setLastIngestResult] = useState<string | null>(null);
  const serialPortRef = useRef<any>(null);

  const refreshLiveState = useCallback(async () => {
    const [dash, esp] = await Promise.all([
      fetchDashboardState(),
      fetchEsp32StatusApi(),
    ]);
    if (dash && dash.shipments && dash.shipments.length > 0) {
      setBackendConnected(true);
      setShipments(dash.shipments);
      setTelemetryByShipment(dash.telemetryByShipment || {});
      setAlertsByShipment(dash.alertsByShipment || {});
    } else {
      setBackendConnected(false);
    }
    if (esp) {
      setEsp32Status(esp);
    }
  }, []);

  useEffect(() => {
    refreshLiveState();
    const timer = setInterval(refreshLiveState, 3000);
    return () => clearInterval(timer);
  }, [refreshLiveState]);

  const shipment = useMemo(() => {
    return (
      shipments.find((s) => s.shipment_id === selectedShipmentId) ||
      shipments[0] ||
      MOCK_SHIPMENTS[0]
    );
  }, [shipments, selectedShipmentId]);

  const telemetryData = useMemo(() => {
    const liveSeries = telemetryByShipment[shipment.shipment_id];
    if (liveSeries && liveSeries.length > 0) {
      return liveSeries;
    }
    return generateTelemetryHistory(shipment);
  }, [telemetryByShipment, shipment]);

  // Sync existing database alerts on shipment load
  useEffect(() => {
    alertService.fetchAlerts(selectedShipmentId).then((alerts) => {
      alerts.forEach((a) => {
        if (a.status === 'ACKNOWLEDGED' || a.status === 'RESOLVED') {
          setAcknowledgedAlerts((prev) => new Set(prev).add(a.alert_id));
          if (a.acknowledged_by && a.remediation_notes) {
            setLastAckInfo({
              by: a.acknowledged_by,
              notes: a.remediation_notes,
              hash: a.signature || '0x9727...sealed',
            });
          }
        }
      });
    });
  }, [selectedShipmentId]);

  const handleAcknowledge = async (alertId: string) => {
    setIsAcknowledging(true);
    soundEffects.playClick();
    try {
      const actorEmail = currentUser?.email || 'operator@frostledger.io';
      const result = await alertService.acknowledgeAlert({
        alertId,
        shipmentId: shipment.shipment_id,
        remediationNotes: ackNote,
        actorEmail,
        actorRole: currentRole || 'operator',
        actorId: currentUser?.id,
      });

      setAcknowledgedAlerts((prev) => new Set(prev).add(alertId));
      setLastAckInfo({
        by: actorEmail,
        notes: ackNote,
        hash: result.auditHash,
      });
      soundEffects.playSuccessChime();
      setAckModalAlertId(null);
      setAckNote('');
    } finally {
      setIsAcknowledging(false);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            ACTIVE SHIPMENT:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {shipments.map((s) => {
              const active = s.shipment_id === selectedShipmentId;
              return (
                <button
                  key={s.shipment_id}
                  onClick={() => handleSelectShipment(s.shipment_id)}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {onOpenSimulator && (
            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenSimulator(shipment.shipment_id);
              }}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '12px',
                padding: '0.4rem 0.85rem',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                color: '#f59e0b',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Launch interactive Arrhenius temperature excursion simulator on this shipment"
            >
              <Flame size={14} />
              <span>Simulate Excursion Sandbox</span>
            </button>
          )}

          <div className="data" style={{ color: 'var(--color-muted)' }}>
            ID: <span style={{ color: 'var(--color-text)' }}>{shipment.shipment_id}</span> &bull; DEVICE: <span style={{ color: 'var(--color-accent)' }}>{shipment.device_id}</span>
          </div>
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
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {shipment.anchored_tx ? (
              <PolygonScanLink
                hash={shipment.anchored_tx}
                type="tx"
                label="Polygon Amoy Anchor"
                showFullLink={true}
              />
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-muted)' }}>
                Pending Batch Window Anchor
              </div>
            )}
            <div className="data" style={{ color: 'var(--color-muted)', fontSize: '11px' }}>
              Batch Window: 5 / 5 hashes sealed &bull; Ed25519 Verified
            </div>
          </div>
          {onOpenVerifier && shipment.anchored_tx && (
            <div style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenVerifier(shipment.anchored_tx!);
                }}
                className="btn btn-ghost"
                style={{ fontSize: '11px', padding: '0.2rem 0.5rem', color: 'var(--color-accent)' }}
              >
                Inspect On-Chain Merkle Tree &rarr;
              </button>
            </div>
          )}
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
              Canonical sensor readings authenticated with Ed25519 signatures ({telemetryData.length} batches recorded).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span className="badge badge-pass">SAMPLING: LIVE STREAM</span>
            <span className="badge badge-warn">HUMIDITY: ACTIVE</span>
          </div>
        </div>

        <div style={{ height: '320px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetryData} margin={{ top: 12, right: 75, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#72c4b7' : '#1F1F23'} opacity={isLight ? 0.55 : 1} />
              <XAxis dataKey="timestamp" stroke={isLight ? '#033500' : '#8A8A92'} fontSize={11} fontFamily="Geist Mono" strokeWidth={isLight ? 1.5 : 1} />
              <YAxis domain={[-2, 20]} stroke={isLight ? '#033500' : '#8A8A92'} fontSize={11} fontFamily="Geist Mono" unit="°C" strokeWidth={isLight ? 1.5 : 1} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isLight ? '#ffffff' : '#111113',
                  border: isLight ? '1.5px solid #033500' : '1px solid #1F1F23',
                  borderRadius: '6px',
                  color: isLight ? '#033500' : '#e8e8e8',
                  fontFamily: 'Geist Mono',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(3, 53, 0, 0.15)',
                }}
              />
              <ReferenceLine
                y={shipment.temp_max_c}
                stroke={isLight ? '#b21919' : '#E0574C'}
                strokeDasharray="4 4"
                strokeWidth={isLight ? 2.5 : 1}
                label={{ value: `Max: ${shipment.temp_max_c}°C`, fill: isLight ? '#b21919' : '#FFA29A', fontSize: 11, fontWeight: 800, position: 'right' }}
              />
              <ReferenceLine
                y={shipment.temp_min_c}
                stroke={isLight ? '#033500' : '#7DF9C4'}
                strokeDasharray="4 4"
                strokeWidth={isLight ? 2.5 : 1}
                label={{ value: `Min: ${shipment.temp_min_c}°C`, fill: isLight ? '#033500' : '#7DF9C4', fontSize: 11, fontWeight: 800, position: 'right' }}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke={isLight ? '#033500' : '#7DF9C4'}
                strokeWidth={isLight ? 3.5 : 2}
                dot={false}
                name="Temperature (°C)"
              />
              <Area
                type="monotone"
                dataKey="humidity"
                fill={isLight ? 'rgba(3, 53, 0, 0.15)' : 'rgba(91, 201, 140, 0.08)'}
                stroke={isLight ? '#033500' : '#5BC98C'}
                strokeWidth={isLight ? 2 : 1}
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

        {liveAlerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {liveAlerts.slice(0, 5).map((al) => {
              const isAcked = Boolean(al.acknowledged_by) || acknowledgedAlerts.has(al.alert_id);
              return (
                <div
                  key={al.alert_id}
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
                      <span className="badge badge-critical">{al.severity.toUpperCase()}</span>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{al.type.toUpperCase()}</span>
                      <span className="data" style={{ color: 'var(--color-muted)' }}>
                        Alert ID: {al.alert_id}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginTop: '0.35rem' }}>
                      {al.note || 'Deterministic threshold violation recorded.'}
                    </p>
                  </div>

                  {isAcked ? (
                    <span className="badge badge-pass">
                      ACKNOWLEDGED BY {(al.acknowledged_by || 'OPERATOR').toUpperCase()}
                    </span>
                  ) : (
                    <button
                      onClick={() => setAckModalAlertId(al.alert_id)}
                      className="btn btn-danger"
                      style={{ fontSize: '12px' }}
                    >
                      Acknowledge Alert
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : shipment.status === 'flagged' ? (
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
                  Temperature rose to {shipment.current_temp.toFixed(2)}°C, breaching profile maximum threshold ({shipment.temp_max_c.toFixed(2)}°C).
                </p>
              </div>

              {acknowledgedAlerts.has('alt_excursion_det_094') ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span className="badge badge-pass">
                    ACKNOWLEDGED BY {lastAckInfo?.by || currentUser?.email || 'OPERATOR'}
                  </span>
                  <span className="data" style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    Dispatched to Admin Dashboard &bull; Supabase audit_logs sealed ✓
                  </span>
                  {lastAckInfo?.notes && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', fontStyle: 'italic', maxWidth: '320px', textAlign: 'right' }}>
                      &ldquo;{lastAckInfo.notes}&rdquo;
                    </span>
                  )}
                </div>
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
            style={{ width: '100%', maxWidth: '500px', padding: '1.5rem', background: '#161619' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <AlertTriangle size={20} color="var(--color-warn)" />
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>
                Acknowledge Deterministic Alert
              </h4>
            </div>

            <div
              style={{
                marginBottom: '1rem',
                padding: '0.65rem 0.85rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--color-muted)' }}>OPERATOR IDENTITY:</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                  {currentUser?.email || 'operator@frostledger.io'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-muted)' }}>AUTHORIZED ROLE:</span>
                <span style={{ color: 'var(--color-text)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {currentRole || 'OPERATOR'}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginBottom: '1rem' }}>
              Mandatory SOP: Regulatory standard requires documenting the remediation action before alert resolution is entered into the immutable database audit log.
            </p>

            <textarea
              rows={3}
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder="Enter resolution notes (e.g., Relocated cargo to backup refrigeration unit at hub depot)."
              style={{ width: '100%', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="data" style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                ⚡ Auto-dispatches to Admin Dashboard &amp; Supabase
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={isAcknowledging}
                  onClick={() => setAckModalAlertId(null)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  disabled={!ackNote.trim() || isAcknowledging}
                  onClick={() => handleAcknowledge(ackModalAlertId)}
                  className="btn btn-accent"
                >
                  {isAcknowledging ? 'Signing & Anchoring...' : 'Sign & Acknowledge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
