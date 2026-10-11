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
        """
        if not self.is_available():
            return {
                "available": False,
                "shipment_id": shipment_id,
                "message": "Gemini API key is not configured.",
                "label": ADVISORY_LABEL,
            }

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

        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode('utf-8', errors='ignore')
            logger.error(f"[Gemini] HTTP error {http_err.code}: {error_body}")
            return {
                "available": False,
                "shipment_id": shipment_id,
                "error": f"Gemini API HTTP {http_err.code}",
                "label": ADVISORY_LABEL,
            }
        except Exception as e:
            logger.error(f"[Gemini] Failed to generate root cause analysis: {e}")
            return {
                "available": False,
                "shipment_id": shipment_id,
                "error": str(e),
                "label": ADVISORY_LABEL,
            }
