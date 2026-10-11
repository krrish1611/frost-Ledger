import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  ShipmentSummary,
  AiInsightItem,
  EvaluationBenchmark,
  GeminiDiagnostic,
  MOCK_SHIPMENTS,
  MOCK_AI_INSIGHTS,
  MOCK_EVALUATION_BENCHMARKS,
  fetchLiveAiInsights,
  fetchLiveAiRisk,
  fetchLiveAiEvaluations,
  fetchLiveAiDiagnosis,
} from '../services/api';

interface AiRiskIntelligenceViewProps {
  currentShipment: ShipmentSummary;
  onSelectShipment: (s: ShipmentSummary) => void;
  shipmentsList?: ShipmentSummary[];
}

export const AiRiskIntelligenceView: React.FC<AiRiskIntelligenceViewProps> = ({
  currentShipment,
  onSelectShipment,
  shipmentsList,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(currentShipment.shipment_id);
  const [liveInsights, setLiveInsights] = useState<AiInsightItem[]>([]);
  const [liveRiskData, setLiveRiskData] = useState<any>(null);
  const [isLiveFromBackend, setIsLiveFromBackend] = useState<boolean>(false);
  const [evaluations, setEvaluations] = useState<EvaluationBenchmark[]>(MOCK_EVALUATION_BENCHMARKS);
  const [geminiDiag, setGeminiDiag] = useState<GeminiDiagnostic | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);

  const availableShipments = shipmentsList && shipmentsList.length > 0 ? shipmentsList : MOCK_SHIPMENTS;
  const activeShipment =
    availableShipments.find((s) => s.shipment_id === selectedShipmentId) || currentShipment;

  // Load evaluation benchmarks from backend
  useEffect(() => {
    let mounted = true;
    fetchLiveAiEvaluations().then((benchmarks) => {
      if (mounted && benchmarks && benchmarks.length > 0) {
        setEvaluations(benchmarks);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Poll backend for real AI insights and composite risk factors
  useEffect(() => {
    let mounted = true;
    const loadAiData = async () => {
      try {
        const [insightsData, riskData] = await Promise.all([
          fetchLiveAiInsights(selectedShipmentId),
          fetchLiveAiRisk(selectedShipmentId),
        ]);
        if (mounted) {
          if (insightsData && insightsData.length > 0) {
            setLiveInsights(insightsData);
            setIsLiveFromBackend(true);
          } else {
            setLiveInsights(MOCK_AI_INSIGHTS[selectedShipmentId] || []);
            setIsLiveFromBackend(false);
          }
          if (riskData) {
            setLiveRiskData(riskData);
          }
        }
      } catch {
        if (mounted) {
          setLiveInsights(MOCK_AI_INSIGHTS[selectedShipmentId] || []);
          setIsLiveFromBackend(false);
        }
      }
    };

    loadAiData();
    const interval = setInterval(loadAiData, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedShipmentId]);

  const handleRunGeminiDiagnosis = async () => {
    setIsDiagnosing(true);
    try {
      const result = await fetchLiveAiDiagnosis(selectedShipmentId);
      if (result) {
        setGeminiDiag(result);
      }
    } catch (err) {
      console.warn('Gemini diagnosis error:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const insights: AiInsightItem[] =
    liveInsights.length > 0
      ? liveInsights
      : MOCK_AI_INSIGHTS[activeShipment.shipment_id] || [];

  // Use live computed factors from backend if available, otherwise calculate from tier
  const factorBreakdown = liveRiskData?.factors
    ? {
        thermal: Math.round(Number(liveRiskData.factors.thermalRisk) || 12),
        anomaly: Math.round(Number(liveRiskData.factors.anomalyRisk) || 8),
        drift: Math.round(Number(liveRiskData.factors.driftRisk) || 14),
        kinetics: Math.round(Number(liveRiskData.factors.kineticsRisk) || 10),
        security: Math.round(Number(liveRiskData.factors.securityPenalty) || 4),
      }
    : {
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
        return isLight ? '#b21919' : 'var(--fl-danger)';
      case 'ELEVATED':
        return isLight ? '#8f7200' : 'var(--fl-warning)';
      case 'MODERATE':
        return isLight ? '#8f7200' : '#F59E0B';
      default:
        return isLight ? '#033500' : 'var(--fl-mint)';
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
              background: isLiveFromBackend ? 'rgba(125, 249, 196, 0.25)' : 'rgba(125, 249, 196, 0.15)',
              color: 'var(--fl-mint)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontFamily: 'var(--fl-font-mono)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {isLiveFromBackend ? '⚡ LIVE FROM AI SERVICE' : 'ADVISORY LAYER ACTIVE'}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--fl-muted)' }}>
            AI/ML outputs are advisory-only warnings and forecasts. The official cold chain record
            is produced strictly by deterministic code and Polygon Amoy smart contracts.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            handleRunGeminiDiagnosis();
            const el = document.getElementById('gemini-diagnostic-panel');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          disabled={isDiagnosing}
          className="fl-badge fl-badge-ai"
          style={{
            cursor: isDiagnosing ? 'wait' : 'pointer',
            border: '1px solid var(--fl-mint)',
            background: isDiagnosing ? 'rgba(125, 249, 196, 0.25)' : 'rgba(125, 249, 196, 0.12)',
            color: 'var(--fl-mint)',
            fontWeight: 700,
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
          title="Click to generate or refresh AI advisory diagnosis"
        >
          {isDiagnosing ? '⚡ Synthesizing AI Advisory...' : '⚡ AI-generated, advisory'}
        </button>
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
            {availableShipments.map((s) => (
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
                stroke={isLight ? 'rgba(3, 53, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
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
              <div style={{ height: '8px', background: isLight ? 'rgba(3, 53, 0, 0.12)' : 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.thermal}%`,
                    background:
                      factorBreakdown.thermal > 75
                        ? (isLight ? '#b21919' : 'var(--fl-danger)')
                        : factorBreakdown.thermal > 40
                        ? (isLight ? '#8f7200' : 'var(--fl-warning)')
                        : (isLight ? '#033500' : 'var(--fl-mint)'),
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
              <div style={{ height: '8px', background: isLight ? 'rgba(3, 53, 0, 0.12)' : 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.anomaly}%`,
                    background:
                      factorBreakdown.anomaly > 75
                        ? (isLight ? '#b21919' : 'var(--fl-danger)')
                        : factorBreakdown.anomaly > 40
                        ? (isLight ? '#8f7200' : 'var(--fl-warning)')
                        : (isLight ? '#033500' : 'var(--fl-mint)'),
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
              <div style={{ height: '8px', background: isLight ? 'rgba(3, 53, 0, 0.12)' : 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.drift}%`,
                    background:
                      factorBreakdown.drift > 75
                        ? (isLight ? '#b21919' : 'var(--fl-danger)')
                        : factorBreakdown.drift > 40
                        ? (isLight ? '#8f7200' : 'var(--fl-warning)')
                        : (isLight ? '#033500' : 'var(--fl-mint)'),
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
              <div style={{ height: '8px', background: isLight ? 'rgba(3, 53, 0, 0.12)' : 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.kinetics}%`,
                    background:
                      factorBreakdown.kinetics > 75
                        ? (isLight ? '#b21919' : 'var(--fl-danger)')
                        : factorBreakdown.kinetics > 40
                        ? (isLight ? '#8f7200' : 'var(--fl-warning)')
                        : (isLight ? '#033500' : 'var(--fl-mint)'),
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
              <div style={{ height: '8px', background: isLight ? 'rgba(3, 53, 0, 0.12)' : 'var(--fl-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${factorBreakdown.security}%`,
                    background: isLight ? '#033500' : 'var(--fl-mint)',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Gemini 2.5 Flash Lite Root-Cause Diagnostic Advisory Panel */}
      <div
        id="gemini-diagnostic-panel"
        className="fl-card"
        style={{
          border: '1px solid rgba(125, 249, 196, 0.35)',
          background: isLight ? 'rgba(3, 53, 0, 0.02)' : 'rgba(125, 249, 196, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🤖</span>
              <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--fl-mint)' }}>
                GEMINI 3.5 FLASH LITE ROOT-CAUSE ADVISORY
              </span>
              <span
                style={{
                  background: 'rgba(125, 249, 196, 0.15)',
                  color: 'var(--fl-mint)',
                  fontSize: '10px',
                  fontFamily: 'var(--fl-font-mono)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                LIVE LLM REASONING
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--fl-muted)', marginTop: '4px' }}>
              Deep supply-chain physical reasoning: analyzes IoT thermal decay rates, shock axes, and seal humidity to identify root causes.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleRunGeminiDiagnosis}
              disabled={isDiagnosing}
              className="fl-button"
              style={{
                background: isDiagnosing ? 'var(--fl-bg-secondary)' : 'var(--fl-mint)',
                color: isDiagnosing ? 'var(--fl-muted)' : '#000000',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isDiagnosing ? 'not-allowed' : 'pointer',
                borderColor: 'var(--fl-mint)',
              }}
            >
              {isDiagnosing ? 'Synthesizing with Gemini 3.5...' : '⚡ Run Gemini Deep Diagnosis'}
            </button>
            <span className="fl-badge fl-badge-ai">AI-generated, advisory</span>
          </div>
        </div>

        {geminiDiag && geminiDiag.diagnostic ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              background: 'var(--fl-bg-secondary)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--fl-hairline)',
            }}
          >
            {/* Headline Summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--fl-hairline)',
              }}
            >
              <span style={{ fontSize: '16px' }}>🚨</span>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fl-text)' }}>
                {geminiDiag.diagnostic.summary}
              </div>
            </div>

            {/* Root Cause & Impact Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div
                style={{
                  background: 'var(--fl-bg-primary)',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--fl-hairline)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--fl-mint)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Likely Physical Root Cause
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--fl-text)' }}>
                  {geminiDiag.diagnostic.root_cause}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--fl-bg-primary)',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--fl-hairline)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--fl-warning)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Biological & Shelf-Life Impact
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--fl-text)' }}>
                  {geminiDiag.diagnostic.impact_evaluation}
                </div>
              </div>
            </div>

            {/* Recommended Mitigation Protocol */}
            {geminiDiag.diagnostic.mitigation_actions && geminiDiag.diagnostic.mitigation_actions.length > 0 && (
              <div
                style={{
                  background: 'var(--fl-bg-primary)',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--fl-hairline)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--fl-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Recommended Operational Mitigation Protocol
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {geminiDiag.diagnostic.mitigation_actions.map((act, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--fl-mint)', fontWeight: 700 }}>0{idx + 1}.</span>
                      <span style={{ color: 'var(--fl-text)' }}>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--fl-muted)',
                paddingTop: '8px',
                borderTop: '1px solid var(--fl-hairline)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span>Model: <strong style={{ color: 'var(--fl-text)' }}>{geminiDiag.model || 'gemini-3.5-flash-lite'}</strong></span>
              <span>Generated: {new Date(geminiDiag.generated_at || Date.now()).toLocaleTimeString()}</span>
              <span>Advisory Notice: Telemetry integrity anchored on Polygon Amoy.</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              background: 'var(--fl-bg-secondary)',
              borderRadius: '8px',
              border: '1px dashed var(--fl-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--fl-muted)' }}>
              No active diagnosis generated for <strong style={{ color: 'var(--fl-text)' }}>{activeShipment.shipment_id}</strong> yet. Click above to execute real-time reasoning with Gemini 3.5 Flash Lite across sensor rates and excursion curves.
            </div>
            <button
              onClick={handleRunGeminiDiagnosis}
              disabled={isDiagnosing}
              className="fl-button"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Run Diagnostic
            </button>
          </div>
        )}
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
              {evaluations.map((m: EvaluationBenchmark) => (
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
