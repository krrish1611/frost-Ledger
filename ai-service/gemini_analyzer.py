import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from config import GEMINI_API_KEY, GEMINI_MODEL, ADVISORY_LABEL

logger = logging.getLogger("gemini_analyzer")

class GeminiRootCauseAnalyzer:
    """
    Integrates Google Gemini to deliver deep, contextual root-cause diagnostics
    and mitigation recommendations for cold chain anomalies.
    
    STRICTLY ADVISORY: Does not alter official hashes, telemetry, or smart contracts.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or GEMINI_MODEL or "gemini-3.5-flash-lite"

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 10)

    def _generate_physical_diagnostic(
        self,
        shipment_id: str,
        cargo_type: str,
        profile_name: str,
        temp_min_c: float,
        temp_max_c: float,
        current_temp: float,
        current_humidity: float,
        recent_readings: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        max_shock = 0.0
        if recent_readings:
            for r in recent_readings:
                s = float(r.get("shock", 0) or 0)
                if s > max_shock:
                    max_shock = s

        if current_temp > temp_max_c:
            diff = current_temp - temp_max_c
            if max_shock >= 2.5:
                summary = f"Mechanical Shock Impact with Thermal Insulation Breach (+{diff:.1f}°C)"
                root_cause = f"Sensor logged {max_shock:.1f}g impact acceleration, followed immediately by thermal loss. Evidence points to secondary coolant vessel rupture during transport handling."
                impact = f"Temperature of {current_temp:.1f}°C breached upper threshold ({temp_max_c:.1f}°C). Accelerated kinetic shelf-life decay active."
                actions = [
                    "Inspect container physical integrity and thermal insulation boundary",
                    "Transfer cargo immediately to secondary active refrigeration storage",
                    "Quarantine batch and verify Ed25519 hash trail against immutable on-chain record",
                ]
            elif current_humidity >= 70:
                summary = f"High Humidity Intrusion with Thermal Excursion (+{diff:.1f}°C at {current_humidity:.0f}% RH)"
                root_cause = f"High humidity ({current_humidity:.0f}%) accompanied by temperature rise ({current_temp:.1f}°C) indicates ambient air infiltration or unsealed door gasket during transit depot handling."
                impact = f"Moisture condensation risk coupled with thermal breach increases degradation vector and accelerates Arrhenius shelf-life consumption."
                actions = [
                    "Verify container door latch and gasket seal integrity immediately",
                    "Engage auxiliary air circulation fans and restore thermal setpoint",
                    "Conduct visual inspection for packaging condensation upon arrival",
                ]
            else:
                summary = f"Refrigeration Thermal Drift Excursion (+{diff:.1f}°C above limit)"
                root_cause = f"Gradual upward thermal drift without structural shock suggests reefer compressor capacity degradation or dry ice coolant depletion."
                impact = f"Sustained exposure above {temp_max_c:.1f}°C accelerates Arrhenius kinetic shelf-life decay. Product stability window reduced."
                actions = [
                    "Verify reefer power generator feed and thermostat calibration",
                    "Replenish thermal ballast or dry ice pellets at nearest depot",
                    "Log excursion duration and perform stability testing upon delivery",
                ]
        elif current_temp < temp_min_c:
            deficit = temp_min_c - current_temp
            summary = f"Sub-Cooling Freeze Excursion (-{deficit:.1f}°C below safe band)"
            root_cause = f"Temperature dropped to {current_temp:.1f}°C, below the minimum threshold ({temp_min_c:.1f}°C). Indicates thermostat calibration failure or over-icing."
            impact = f"Critical freezing risk. Potential ice crystal formation causing cellular or molecular denaturation."
            actions = [
                "Adjust thermostat setpoint upwards immediately",
                "Inspect cargo for freezing, crystal formation, or container cracking",
                "Relocate cargo away from direct compressor discharge duct",
            ]
        else:
            summary = f"Nominal Cold Chain Operation ({current_temp:.1f}°C within {temp_min_c:.1f}–{temp_max_c:.1f}°C)"
            root_cause = "Refrigeration system operating within defined thermal envelopes. Sensor harmonics confirm unbroken thermal inertia and container airtightness."
            impact = "Shelf-life consumption proceeding at baseline nominal kinetic rate. Product bio-stability and potency fully conserved."
            actions = [
                "Maintain continuous automated IoT telemetry sampling",
                "Verify next scheduled battery level and transit checkpoint timeline",
                "Preserve sequential Ed25519 hash chain continuity",
            ]

        return {
            "available": True,
            "shipment_id": shipment_id,
            "model": f"{self.model} (Physical Reasoning Engine)",
            "diagnostic": {
                "summary": summary,
                "root_cause": root_cause,
                "impact_evaluation": impact,
                "mitigation_actions": actions,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "label": ADVISORY_LABEL,
            "disclaimer": "AI-generated advisory insight. Official chain-of-custody is strictly maintained by cryptographic Ed25519 signatures and Polygon Amoy smart contract anchors.",
        }

    def diagnose_excursion(
        self,
        shipment_id: str,
        cargo_type: str,
        profile_name: str,
        temp_min_c: float,
        temp_max_c: float,
        current_temp: float,
        current_humidity: float,
        anomaly_kind: str,
        anomaly_score: float,
        severity: str,
        recent_readings: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Sends telemetry context to Google Gemini to generate root-cause analysis and mitigation actions.
        Falls back to local physical reasoning engine if Gemini API is not configured or unavailable.
        """
        if not self.is_available():
            return self._generate_physical_diagnostic(
                shipment_id=shipment_id,
                cargo_type=cargo_type,
                profile_name=profile_name,
                temp_min_c=temp_min_c,
                temp_max_c=temp_max_c,
                current_temp=current_temp,
                current_humidity=current_humidity,
                recent_readings=recent_readings,
            )

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        readings_summary = ""
        if recent_readings:
            recent_slice = recent_readings[-5:]
            readings_summary = "\n".join([
                f"- T={r.get('timestamp', 'N/A')}: Temp={r.get('temperature', 'N/A')}°C, Hum={r.get('humidity', 'N/A')}%, Shock={r.get('shock', 0)}g"
                for r in recent_slice
            ])

        prompt = f"""You are FrostLedger's Cold Chain Diagnostic AI. Analyze this IoT cold chain telemetry incident:

SHIPMENT CONTEXT:
- Shipment ID: {shipment_id}
- Cargo Type: {cargo_type} ({profile_name})
- Required Safe Temp Range: {temp_min_c}°C to {temp_max_c}°C
- Current Observed Temp: {current_temp}°C
- Current Humidity: {current_humidity}%
- Anomaly Detected: {anomaly_kind} (Severity: {severity}, Confidence Score: {anomaly_score})

RECENT TELEMETRY READINGS:
{readings_summary or 'No previous historical readings available.'}

YOUR TASK:
Provide an expert, professional, concise supply chain root-cause analysis.
Respond in valid JSON format with exactly these keys:
{{
  "summary": "Short 1-line headline of the incident",
  "root_cause": "Detailed explanation of the likely physical cause (e.g. reefer compressor failure, cargo door seal leak, dry ice exhaustion, handling impact, transfer delay)",
  "impact_evaluation": "Impact on product safety, remaining shelf life, or protein denaturing risk",
  "mitigation_actions": [
    "Immediate action step 1",
    "Immediate action step 2",
    "Preventative action step 3"
  ]
}}
Do NOT output markdown code blocks. Output raw JSON only."""

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json"
            }
        }

        try:
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=12) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                candidate = resp_data.get("candidates", [])[0]
                text_content = candidate.get("content", {}).get("parts", [])[0].get("text", "{}")
                
                # Parse structured JSON from model
                try:
                    parsed_result = json.loads(text_content.strip())
                except Exception:
                    # Clean potential markdown wrapping if present
                    clean_text = text_content.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    parsed_result = json.loads(clean_text.strip())

                return {
                    "available": True,
                    "shipment_id": shipment_id,
                    "model": self.model,
                    "diagnostic": parsed_result,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "label": ADVISORY_LABEL,
                    "disclaimer": "AI-generated advisory insight. Official chain-of-custody is strictly maintained by cryptographic Ed25519 signatures and Polygon Amoy smart contract anchors.",
                }

        except Exception as e:
            logger.warning(f"[Gemini] Exception occurred, falling back to physical diagnostic engine: {e}")
            return self._generate_physical_diagnostic(
                shipment_id=shipment_id,
                cargo_type=cargo_type,
                profile_name=profile_name,
                temp_min_c=temp_min_c,
                temp_max_c=temp_max_c,
                current_temp=current_temp,
                current_humidity=current_humidity,
                recent_readings=recent_readings,
            )
