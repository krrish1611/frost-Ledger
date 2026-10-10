import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from config import MODEL_VERSION, ADVISORY_LABEL, WARMUP_SAMPLES
from models.ewma_cusum import EwmaCusumDetector
from models.rate_of_change import RateOfChangeDetector
from models.hst_detector import HalfSpaceTreesDetector
from models.rules import RuleDetector

class ShipmentLearner:
    """
    Per-shipment online learning instance.
    Maintains isolated ML model state and streaming detectors for a single shipment.
    """

    def __init__(
        self,
        shipment_id: str,
        profile: Optional[Dict[str, Any]] = None,
        warmup_samples: int = WARMUP_SAMPLES,
    ):
        self.shipment_id = shipment_id
        self.profile = profile or {}
        self.warmup_samples = warmup_samples
        self.sample_count = 0
        self.last_batch_id: Optional[str] = None

        temp_min = self.profile.get("temp_min_c")
        temp_max = self.profile.get("temp_max_c")
        hum_min = self.profile.get("humidity_min_pct", 20.0)
        hum_max = self.profile.get("humidity_max_pct", 80.0)

        # Detectors
        self.temp_cusum = EwmaCusumDetector(
            feature_name="temperature",
            target_min=temp_min,
            target_max=temp_max,
            alpha=0.1,
            k_multiplier=0.5,
            h_multiplier=4.0,
        )
        self.hum_cusum = EwmaCusumDetector(
            feature_name="humidity",
            target_min=hum_min,
            target_max=hum_max,
            alpha=0.1,
            k_multiplier=0.5,
            h_multiplier=4.0,
        )
        self.rate_of_change = RateOfChangeDetector()
        self.hst = HalfSpaceTreesDetector(
            n_trees=25,
            height=6,
            window_size=50,
            anomaly_threshold=0.65,
        )
        self.rules = RuleDetector(flat_window_size=5)

    @property
    def warmup_status(self) -> str:
        return "warming_up" if self.sample_count <= self.warmup_samples else "active"

    def process_reading(
        self,
        reading: Dict[str, Any],
        batch_id: str,
        events: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Ingests a single sensor reading and evaluates all advisory models.
        Returns newly generated AI insights (if any).
        """
        self.sample_count += 1
        self.last_batch_id = batch_id
        current_status = self.warmup_status

        temp = float(reading.get("temperature", 0.0))
        humidity = float(reading.get("humidity", 0.0))
        ts_str = reading.get("timestamp") or datetime.now(timezone.utc).isoformat()

        # Extract shock & speed
        shock = 0.0
        shock_events = reading.get("shock_events") or []
        if shock_events:
            shock = max(float(s.get("magnitude_g", 0.0)) for s in shock_events)

        speed = 0.0
        gps = reading.get("gps")
        if gps and "speed" in gps:
            speed = float(gps["speed"])

        # Check known event downweighting (e.g. door_open or severe shock)
        is_known_door_open = False
        is_high_shock_event = shock > 2.5

        if events:
            for ev in events:
                ev_type = str(ev.get("type", "")).lower()
                if "door" in ev_type:
                    is_known_door_open = True
                elif "shock" in ev_type and float(ev.get("magnitude", 0.0)) > 2.5:
                    is_high_shock_event = True

        # Weight determination
        sample_weight = 1.0
        if is_known_door_open:
            sample_weight = 0.05 # Downweight during planned door opening
        elif is_high_shock_event:
            sample_weight = 0.20 # Downweight during rough transit shock

        # 1. Update EWMA + CUSUM
        temp_drift, temp_score, temp_sev, temp_exp = self.temp_cusum.update(temp, weight=sample_weight)
        hum_drift, hum_score, hum_sev, hum_exp = self.hum_cusum.update(humidity, weight=sample_weight)

        # 2. Rate of Change
        roc_spike, roc_score, roc_sev, roc_exp = self.rate_of_change.update(ts_str, temp, humidity)

        # 3. Half-Space Trees Multivariate
        hst_features = {
            "temperature": temp,
            "humidity": humidity,
            "shock": shock,
            "speed": speed,
        }
        hst_anomaly, hst_score, hst_sev, hst_exp = self.hst.evaluate_and_learn(hst_features, weight=sample_weight)

        # 4. Rules
        flat_spoof, flat_score, flat_sev, flat_exp = self.rules.check_flat_copied(temp, humidity)

        insights: List[Dict[str, Any]] = []

        def create_insight(
            kind: str,
            score: float,
            severity: str,
            explanation: str,
            model_name: str,
        ) -> Dict[str, Any]:
            return {
                "insight_id": f"ins_{uuid.uuid4().hex[:16]}",
                "shipment_id": self.shipment_id,
                "kind": kind,
                "score": round(score, 4),
                "severity": severity,
                "explanation": explanation,
                "input_ref": batch_id,
                "warmup_status": current_status,
                "model_name": model_name,
                "model_version": MODEL_VERSION,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "label": ADVISORY_LABEL,
            }

        # During warm-up phase, we train models but suppress warning/critical insights
        if current_status == "warming_up":
            return insights

        # If known door open, suppress temporary temperature spike warnings
        if is_known_door_open:
            return insights

        # Priority 1: Check Flat / Copied Readings (Spoofing / Freeze)
        if flat_spoof:
            insights.append(
                create_insight("spoofing", flat_score, flat_sev, flat_exp, "rule_flat_detector")
            )

        # Priority 2: Check Sudden Rate-of-Change Spike
        if roc_spike:
            insights.append(
                create_insight("anomaly", roc_score, roc_sev, roc_exp, "rate_of_change_detector")
            )

        # Priority 3: Check CUSUM Level Shift / Drift
        if temp_drift:
            insights.append(
                create_insight("forecast", temp_score, temp_sev, temp_exp, "cusum_drift_detector")
            )
        if hum_drift:
            insights.append(
                create_insight("anomaly", hum_score, hum_sev, hum_exp, "cusum_humidity_detector")
            )

        # Priority 4: Multivariate Half-Space Trees Anomaly
        if hst_anomaly:
            insights.append(
                create_insight("anomaly", hst_score, hst_sev, hst_exp, "half_space_trees_detector")
            )

        return insights

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes complete learner state for database checkpointing.
        """
        return {
            "shipment_id": self.shipment_id,
            "profile": self.profile,
            "warmup_samples": self.warmup_samples,
            "sample_count": self.sample_count,
            "last_batch_id": self.last_batch_id,
            "temp_cusum": self.temp_cusum.to_dict(),
            "hum_cusum": self.hum_cusum.to_dict(),
            "rate_of_change": self.rate_of_change.to_dict(),
            "hst": self.hst.to_dict(),
            "rules": self.rules.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ShipmentLearner":
        """
        Restores learner state from serialized checkpoint dictionary.
        """
        inst = cls(
            shipment_id=data["shipment_id"],
            profile=data.get("profile", {}),
            warmup_samples=data.get("warmup_samples", WARMUP_SAMPLES),
        )
        inst.sample_count = data.get("sample_count", 0)
        inst.last_batch_id = data.get("last_batch_id")

        if "temp_cusum" in data:
            inst.temp_cusum = EwmaCusumDetector.from_dict(data["temp_cusum"])
        if "hum_cusum" in data:
            inst.hum_cusum = EwmaCusumDetector.from_dict(data["hum_cusum"])
        if "rate_of_change" in data:
            inst.rate_of_change = RateOfChangeDetector.from_dict(data["rate_of_change"])
        if "hst" in data:
            inst.hst = HalfSpaceTreesDetector.from_dict(data["hst"])
        if "rules" in data:
            inst.rules = RuleDetector.from_dict(data["rules"])

        return inst
