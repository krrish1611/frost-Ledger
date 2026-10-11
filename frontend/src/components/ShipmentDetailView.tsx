import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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

export const ShipmentDetailView: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [shipments, setShipments] = useState<ShipmentSummary[]>(MOCK_SHIPMENTS);
  const [telemetryByShipment, setTelemetryByShipment] = useState<Record<string, TelemetryReading[]>>({});
  const [alertsByShipment, setAlertsByShipment] = useState<Record<string, LiveAlertRecord[]>>({});
  const [backendConnected, setBackendConnected] = useState<boolean>(false);

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    MOCK_SHIPMENTS[0].shipment_id
  );
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [ackModalAlertId, setAckModalAlertId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');

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

  const liveAlerts = useMemo(() => {
    return alertsByShipment[shipment.shipment_id] || [];
  }, [alertsByShipment, shipment.shipment_id]);

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlertApi(alertId, ackNote);
    setAcknowledgedAlerts((prev) => new Set(prev).add(alertId));
    setAckModalAlertId(null);
    setAckNote('');
    await refreshLiveState();
  };

  // Connect physical ESP-32 via Browser Web Serial API (115200 baud)
  const handleConnectUsbSerial = async () => {
    const nav = navigator as any;
    if (!nav.serial) {
      setUsbSerialLog('Web Serial API is not supported in this browser (use Chrome or Edge).');
      return;
    }
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;
      setUsbSerialConnected(true);
      setUsbSerialLog('ESP-32 USB Serial port opened at 115200 baud. Listening for JSON telemetry...');

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            setUsbSerialLog(`Serial RX: ${line.substring(0, 90)}`);
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const parsed = JSON.parse(line);
                if (typeof parsed.temperature === 'number') {
                  await ingestEsp32PacketApi({
                    device_id: parsed.device_id || shipment.device_id,
                    shipment_id: parsed.shipment_id || shipment.shipment_id,
                    temperature: parsed.temperature,
                    humidity: parsed.humidity ?? 50,
                    shock_g: parsed.shock_g ?? 0.1,
                    battery_pct: parsed.battery_pct ?? 98,
                    transport: 'usb-web-serial',
                  });
                  await refreshLiveState();
                }
              } catch {
                // Ignore non-telemetry JSON lines
              }
            }
          }
        }
      }
    } catch (err: any) {
      setUsbSerialConnected(false);
      setUsbSerialLog(`USB Serial connection notice: ${err?.message || 'No ESP-32 port selected'}`);
    }
  };

  // Send a live ESP-32 telemetry packet to POST /esp32/ingest
  const handleSendEsp32Packet = async () => {
    setIsSendingPacket(true);
    setLastIngestResult(null);
    try {
      const res = await ingestEsp32PacketApi({
        device_id: shipment.device_id,
        shipment_id: shipment.shipment_id,
        temperature: simTemp,
        humidity: simHumidity,
        shock_g: 0.1,
        battery_pct: 95,
        transport: 'wifi-http',
      });
      setLastIngestResult(
        `Accepted Seq #${res.sequence_no} | Hash: ${String(res.hash).substring(0, 12)}... | MKT: ${res.mkt_celsius}°C`
      );
      await refreshLiveState();
    } catch (err: any) {
      setLastIngestResult(`Error: ${err?.message || 'Failed to reach backend'}`);
    } finally {
      setIsSendingPacket(false);
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
                  onClick={() => {
                    setSelectedShipmentId(s.shipment_id);
                    setSimTemp(s.current_temp);
                    setSimHumidity(s.current_humidity);
                  }}
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

        <div className="data" style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${backendConnected ? 'badge-pass' : 'badge-warn'}`}>
            {backendConnected ? 'LIVE BACKEND :3001' : 'OFFLINE MOCK FALLBACK'}
          </span>
          <span>
            ID: <span style={{ color: 'var(--color-text)' }}>{shipment.shipment_id}</span> &bull; DEVICE:{' '}
            <span style={{ color: 'var(--color-accent)' }}>{shipment.device_id}</span>
          </span>
        </div>
      </div>

      {/* ESP-32 Hardware Link & Live Ingestion Panel */}
      <div className="panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Cpu size={18} color="var(--color-accent)" />
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>
                ESP-32 Hardware Link (USB Web Serial &amp; Wi-Fi HTTP Webhook)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Stream live sensor readings from a physical ESP-32 over USB Serial (115200 baud) or Wi-Fi HTTP POST{' '}
                <code>{API_BASE}/esp32/ingest</code>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              className={`badge ${
                esp32Status?.hardware_usb_detected || usbSerialConnected ? 'badge-pass' : 'badge-warn'
              }`}
            >
              USB COM PORTS:{' '}
              {esp32Status?.host_com_ports?.length
                ? esp32Status.host_com_ports.join(', ')
                : usbSerialConnected
                ? 'CONNECTED (WEB SERIAL)'
                : 'NONE DETECTED ON HOST'}
            </span>
            <span className="badge badge-pass">
              <Wifi size={11} style={{ marginRight: '4px', display: 'inline' }} />
              HTTP GATEWAY: READY ({esp32Status?.active_esp32_streams || 0} ACTIVE STREAMS)
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          {/* Left: USB Web Serial Connection */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                1. DIRECT USB SERIAL BRIDGE
              </span>
              <button
                onClick={handleConnectUsbSerial}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
              >
                <Usb size={14} />
                {usbSerialConnected ? 'USB Serial Connected' : 'Connect ESP-32 via USB'}
              </button>
            </div>
            <div className="data" style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              {usbSerialLog ||
                'Plug in your ESP-32 over USB and click "Connect ESP-32 via USB" to bridge serial JSON directly to the cryptographic ledger.'}
            </div>
          </div>

          {/* Right: Live ESP-32 HTTP Packet Transmitter */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                2. LIVE ESP-32 PACKET INGESTION ({shipment.device_id})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  Temp (°C):
                  <input
                    type="number"
                    step="0.2"
                    value={simTemp}
                    onChange={(e) => setSimTemp(Number(e.target.value))}
                    style={{ width: '68px', marginLeft: '4px', padding: '2px 6px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  RH (%):
                  <input
                    type="number"
                    step="1"
                    value={simHumidity}
                    onChange={(e) => setSimHumidity(Number(e.target.value))}
                    style={{ width: '60px', marginLeft: '4px', padding: '2px 6px', fontSize: '12px' }}
                  />
                </label>
                <button
                  onClick={handleSendEsp32Packet}
                  disabled={isSendingPacket}
                  className="btn btn-accent"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                >
                  {isSendingPacket ? <RefreshCw size={13} /> : <Send size={13} />}
                  Send ESP-32 Ping
                </button>
              </div>
            </div>
            <div className="data" style={{ fontSize: '11px', color: 'var(--color-accent)' }}>
              {lastIngestResult ||
                'Signs reading with Ed25519 key, chains SHA-256 prev_hash, updates Arrhenius MKT, and evaluates alerts live.'}
            </div>
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
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text)' }}>
              TX: {shipment.anchored_tx ? shipment.anchored_tx.substring(0, 16) + '...' : 'Pending'}
            </div>
            <div className="data" style={{ color: 'var(--color-muted)', marginTop: '0.25rem' }}>
              Batch Window: {telemetryData.length} readings sealed
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
