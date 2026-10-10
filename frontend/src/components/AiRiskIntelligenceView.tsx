import React, { useState } from 'react';
import {
  ShipmentSummary,
  AiInsightItem,
  MOCK_SHIPMENTS,
  MOCK_AI_INSIGHTS,
  MOCK_EVALUATION_BENCHMARKS,
} from '../services/api';

interface AiRiskIntelligenceViewProps {
  currentShipment: ShipmentSummary;
  onSelectShipment: (s: ShipmentSummary) => void;
}

export const AiRiskIntelligenceView: React.FC<AiRiskIntelligenceViewProps> = ({
  currentShipment,
  onSelectShipment,
}) => {
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(currentShipment.shipment_id);

  const activeShipment =
    MOCK_SHIPMENTS.find((s) => s.shipment_id === selectedShipmentId) || currentShipment;

  const insights: AiInsightItem[] = MOCK_AI_INSIGHTS[activeShipment.shipment_id] || [];

  // Calculate simulated 5-factor breakdown based on shipment
  const factorBreakdown = {
    thermal:
      activeShipment.ai_risk_tier === 'CRITICAL'
        ? 94
        : activeShipment.ai_risk_tier === 'ELEVATED'
        ? 65
        : 12,
    anomaly:
      activeShipment.ai_risk_tier === 'CRITICAL'
        ? 91
        : activeShipment.ai_risk_tier === 'ELEVATED'
        ? 58
        : 8,
    drift:
      activeShipment.ai_risk_tier === 'CRITICAL'
        ? 82
        : activeShipment.ai_risk_tier === 'ELEVATED'
        ? 74
        : 14,
    kinetics:
      activeShipment.ai_risk_tier === 'CRITICAL'
        ? 88
        : activeShipment.ai_risk_tier === 'ELEVATED'
        ? 45
        : 10,
    security: 4, // Intact crypto signatures
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'CRITICAL':
        return 'var(--fl-danger)';
      case 'ELEVATED':
        return 'var(--fl-warning)';
      case 'MODERATE':
        return '#F59E0B';
      default:
        return 'var(--fl-mint)';
    }
  };

  const tierColor = getTierColor(activeShipment.ai_risk_tier);

  // SVG Gauge calculations
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (activeShipment.ai_risk_score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Advisory Notice Banner */}
      <div
        className="fl-card"
        style={{
          borderLeft: '4px solid var(--fl-mint)',
          background: 'rgba(125, 249, 196, 0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              background: 'rgba(125, 249, 196, 0.15)',
              color: 'var(--fl-mint)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontFamily: 'var(--fl-font-mono)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            ADVISORY LAYER ACTIVE
          </span>
          <span style={{ fontSize: '13px', color: 'var(--fl-muted)' }}>
            AI/ML outputs are advisory-only warnings and forecasts. The official cold chain record
            is produced strictly by deterministic code and Polygon Amoy smart contracts.
          </span>
        </div>
        <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
      </div>

      {/* Shipment Switcher */}
      <div
        className="fl-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: 'var(--fl-muted)', marginBottom: '4px' }}>
            SELECT SHIPMENT TELEMETRY STREAM
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {MOCK_SHIPMENTS.map((s) => (
              <button
                key={s.shipment_id}
                onClick={() => {
                  setSelectedShipmentId(s.shipment_id);
                  onSelectShipment(s);
                }}
                className="fl-button"
                style={{
                  background:
                    selectedShipmentId === s.shipment_id
                      ? 'rgba(125, 249, 196, 0.15)'
                      : 'var(--fl-bg-secondary)',
                  borderColor:
                    selectedShipmentId === s.shipment_id ? 'var(--fl-mint)' : 'var(--fl-hairline)',
                  color: selectedShipmentId === s.shipment_id ? 'var(--fl-mint)' : 'var(--fl-muted)',
                }}
              >
                {s.shipment_id} ({s.cargo_type})
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--fl-muted)' }}>Cargo Profile</div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fl-text)' }}>
            {activeShipment.profile_name}
          </div>
        </div>
      </div>

      {/* Composite Risk Score & 5-Factor Decomposition Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Risk Dial Card */}
        <div className="fl-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.02em' }}>
              COMPOSITE RISK INDEX
            </div>
            <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
          </div>

          {/* SVG Circular Dial */}
          <div style={{ position: 'relative', width: '200px', height: '200px', margin: '12px 0' }}>
            <svg width="200" height="200" viewBox="0 0 200 200">
              {/* Background Circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="14"
              />
              {/* Progress Arc */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={tierColor}
                strokeWidth="14"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
              />
            </svg>

            {/* Score in center */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--fl-font-mono)',
                  fontSize: '38px',
                  fontWeight: 700,
                  color: tierColor,
                  lineHeight: 1,
                }}
              >
                {activeShipment.ai_risk_score.toFixed(1)}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--fl-muted)', marginTop: '4px' }}>
                OUT OF 100
              </span>
            </div>
          </div>

          {/* Tier Label & Bio Hazard Flag */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
            <span
              style={{
                background: `${tierColor}22`,
                color: tierColor,
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'var(--fl-font-mono)',
                fontWeight: 600,
                border: `1px solid ${tierColor}44`,
              }}
            >
              TIER: {activeShipment.ai_risk_tier}
            </span>

            {activeShipment.cargo_type === 'biologics' && activeShipment.current_temp <= 2.5 && (
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--fl-cyan)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'var(--fl-font-mono)',
                }}
              >
                ❄ FREEZE SENSITIVE BIOLOGIC
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: '12px',
              color: 'var(--fl-muted)',
              textAlign: 'center',
              marginTop: '16px',
              lineHeight: 1.5,
              maxWidth: '320px',
            }}
          >
            {activeShipment.ai_risk_tier === 'CRITICAL'
              ? 'Immediate action recommended. High probability of thermal excursion and Arrhenius quality degradation.'
              : activeShipment.ai_risk_tier === 'ELEVATED'
              ? 'Warning: Positive drift detected. Excursion projected within the next 20 minutes if current trend continues.'
              : 'Shipment conditions are stable within validated kinetic boundaries. Model confidence high.'}
          </p>
        </div>

        {/* 5-Factor Risk Breakdown Bars */}
        <div className="fl-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 600 }}>5-FACTOR RISK BREAKDOWN</div>
            <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
            {/* Factor 1: Thermal Excursion */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--fl-text)' }}>Thermal Excursion Severity</span>
                <span style={{ fontFamily: 'var(--fl-font-mono)', color: 'var(--fl-muted)' }}>
                  {factorBreakdown.thermal} / 100 (Weight: 35%)
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.thermal}%`,
                    background:
                      factorBreakdown.thermal > 75
                        ? 'var(--fl-danger)'
                        : factorBreakdown.thermal > 40
                        ? 'var(--fl-warning)'
                        : 'var(--fl-mint)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Factor 2: River HalfSpaceTrees Anomaly */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--fl-text)' }}>Streaming Anomaly (HalfSpaceTrees)</span>
                <span style={{ fontFamily: 'var(--fl-font-mono)', color: 'var(--fl-muted)' }}>
                  {factorBreakdown.anomaly} / 100 (Weight: 25%)
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.anomaly}%`,
                    background:
                      factorBreakdown.anomaly > 75
                        ? 'var(--fl-danger)'
                        : factorBreakdown.anomaly > 40
                        ? 'var(--fl-warning)'
                        : 'var(--fl-mint)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Factor 3: Drift & CUSUM Trend */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--fl-text)' }}>Rate of Change & CUSUM Drift</span>
                <span style={{ fontFamily: 'var(--fl-font-mono)', color: 'var(--fl-muted)' }}>
                  {factorBreakdown.drift} / 100 (Weight: 15%)
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.drift}%`,
                    background:
                      factorBreakdown.drift > 75
                        ? 'var(--fl-danger)'
                        : factorBreakdown.drift > 40
                        ? 'var(--fl-warning)'
                        : 'var(--fl-mint)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Factor 4: Arrhenius Kinetics */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--fl-text)' }}>USP &lt;1160&gt; Shelf Life Loss Velocity</span>
                <span style={{ fontFamily: 'var(--fl-font-mono)', color: 'var(--fl-muted)' }}>
                  {factorBreakdown.kinetics} / 100 (Weight: 15%)
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.kinetics}%`,
                    background:
                      factorBreakdown.kinetics > 75
                        ? 'var(--fl-danger)'
                        : factorBreakdown.kinetics > 40
                        ? 'var(--fl-warning)'
                        : 'var(--fl-mint)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Factor 5: Cryptographic Integrity */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--fl-text)' }}>Signature & Sequence Security</span>
                <span style={{ fontFamily: 'var(--fl-font-mono)', color: 'var(--fl-muted)' }}>
                  {factorBreakdown.security} / 100 (Weight: 10%)
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.security}%`,
                    background: 'var(--fl-mint)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Streaming AI Insights & Explanations Feed */}
      <div className="fl-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>STREAMING AI INSIGHTS & EXPLANATIONS</div>
            <div style={{ fontSize: '12px', color: 'var(--fl-muted)' }}>
              Real-time inference generated by Python River HalfSpaceTrees and EWMA drift engines
            </div>
          </div>
          <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {insights.map((item) => (
            <div
              key={item.insight_id}
              style={{
                background: 'var(--fl-bg-secondary)',
                border: '1px solid var(--fl-hairline)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--fl-font-mono)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background:
                        item.severity === 'critical'
                          ? 'rgba(248, 113, 113, 0.2)'
                          : item.severity === 'warning'
                          ? 'rgba(251, 191, 36, 0.2)'
                          : 'rgba(125, 249, 196, 0.2)',
                      color:
                        item.severity === 'critical'
                          ? 'var(--fl-danger)'
                          : item.severity === 'warning'
                          ? 'var(--fl-warning)'
                          : 'var(--fl-mint)',
                    }}
                  >
                    {item.kind} · {item.severity}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--fl-font-mono)',
                      fontSize: '11px',
                      color: 'var(--fl-muted)',
                    }}
                  >
                    Model: {item.model_name} ({item.model_version})
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--fl-mint)',
                      background: 'rgba(125, 249, 196, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    Status: {item.warmup_status}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--fl-font-mono)',
                      fontSize: '11px',
                      color: 'var(--fl-muted)',
                    }}
                  >
                    {item.created_at}
                  </span>
                  <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--fl-text)', lineHeight: 1.5 }}>
                {item.explanation}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--fl-muted)', fontFamily: 'var(--fl-font-mono)' }}>
                Input Reference: {item.input_ref} | Anomaly / Risk Output: {item.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline ML Evaluation & Shadow Benchmarking Table */}
      <div className="fl-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              OFFLINE ML EVALUATION & SHADOW BENCHMARK
            </div>
            <div style={{ fontSize: '12px', color: 'var(--fl-muted)' }}>
              Evaluator test runs validating streaming River against offline batch models (Stage 7 CI
              Benchmark)
            </div>
          </div>
          <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
        </div>

        {/* Lead time hero callout */}
        <div
          style={{
            background: 'rgba(125, 249, 196, 0.05)',
            border: '1px solid rgba(125, 249, 196, 0.2)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--fl-mint)', fontWeight: 600 }}>
              VALIDATED EARLY WARNING ADVANTAGE
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fl-text)', marginTop: '2px' }}>
              16 Minutes (960 Seconds) Lead Time Prior to Hard Temperature Excursion
            </div>
            <div style={{ fontSize: '12px', color: 'var(--fl-muted)', marginTop: '4px' }}>
              Streaming River HalfSpaceTrees detects thermal ascent before upper limit breach,
              preventing irreparable biologic denaturing.
            </div>
          </div>
          <div
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'var(--fl-bg-secondary)',
              border: '1px solid var(--fl-hairline)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fl-muted)' }}>PRECISION / RECALL</div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--fl-mint)',
                fontFamily: 'var(--fl-font-mono)',
              }}
            >
              88% / 94%
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="fl-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Version</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>False Alert Rate</th>
                <th>Avg Early Lead Time</th>
                <th>Benchmark Dataset</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_EVALUATION_BENCHMARKS.map((m) => (
                <tr key={m.evaluation_id}>
                  <td style={{ fontWeight: 600, color: m.model_name.includes('River') ? 'var(--fl-mint)' : 'var(--fl-text)' }}>
                    {m.model_name}
                  </td>
                  <td>{m.model_version}</td>
                  <td>{(m.precision * 100).toFixed(1)}%</td>
                  <td>{(m.recall * 100).toFixed(1)}%</td>
                  <td>{(m.false_alert_rate * 100).toFixed(1)}%</td>
                  <td style={{ fontWeight: 600, color: 'var(--fl-mint)' }}>
                    {m.avg_lead_time_seconds}s ({(m.avg_lead_time_seconds / 60).toFixed(0)} min)
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--fl-muted)' }}>{m.dataset_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
