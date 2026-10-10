import math
from typing import Dict, Any, Tuple
from config import ADVISORY_LABEL

class CompositeRiskScorer:
    """
    Computes a composite multi-dimensional risk score in [0, 100] for a shipment
    combining thermal deviation, streaming anomaly score, CUSUM drift, Arrhenius kinetics,
    and security/spoofing signals.
    Strictly advisory.
    """

    R_GAS_CONSTANT = 8.3144 # J / (mol * K)

    @staticmethod
    def calculate_risk(
        current_temp: float,
        profile: Dict[str, Any],
        hst_score: float = 0.0,
        cusum_stat: float = 0.0,
        cusum_h: float = 2.0,
        is_flat_copied: bool = False,
        remaining_shelf_life_hours: float = 720.0,
    ) -> Dict[str, Any]:
        temp_min = float(profile.get("temp_min_c", 2.0))
        temp_max = float(profile.get("temp_max_c", 8.0))
        ref_temp = float(profile.get("ref_temp_c", 4.0))
        ea = float(profile.get("activation_energy_j_mol", 83144.0))

        # 1. Thermal Deviation Risk [0, 100]
        if temp_min <= current_temp <= temp_max:
            # Safe zone: slight penalty near edges
            span = max(temp_max - temp_min, 1.0)
            dist_from_mid = abs(current_temp - (temp_min + temp_max) / 2.0)
            thermal_risk = (dist_from_mid / (span / 2.0)) * 15.0
        elif current_temp > temp_max:
            excess = current_temp - temp_max
            thermal_risk = min(100.0, 20.0 + excess * 20.0)
        else: # current_temp < temp_min
            deficit = temp_min - current_temp
            # Freezing damage is catastrophic for biologics (WHO guidelines)
            if current_temp <= 0.0 and temp_min >= 0.0:
                thermal_risk = 100.0
            else:
                thermal_risk = min(100.0, 30.0 + deficit * 25.0)

        # 2. Anomaly Risk [0, 100]
        anomaly_risk = min(100.0, max(0.0, hst_score * 100.0))

        # 3. Drift Risk [0, 100]
        drift_ratio = cusum_stat / max(cusum_h, 0.5)
        drift_risk = min(100.0, drift_ratio * 50.0)

        # 4. Kinetic Degradation Risk (Arrhenius acceleration) [0, 100]
        temp_k = current_temp + 273.15
        ref_temp_k = ref_temp + 273.15
        try:
            arrhenius_factor = math.exp((ea / CompositeRiskScorer.R_GAS_CONSTANT) * (1.0 / ref_temp_k - 1.0 / temp_k))
            if arrhenius_factor <= 1.0:
                kinetics_risk = 5.0
            else:
                # E.g. factor 2.0 -> 30, factor 5.0 -> 70, factor 10 -> 100
                kinetics_risk = min(100.0, 10.0 + math.log(arrhenius_factor) * 35.0)
        except Exception:
            kinetics_risk = 50.0

        # 5. Security Penalty [0, 100]
        security_penalty = 35.0 if is_flat_copied else 0.0

        # Weighted Composite Score
        composite_score = (
            0.40 * thermal_risk +
            0.25 * anomaly_risk +
            0.20 * drift_risk +
            0.15 * kinetics_risk +
            security_penalty
        )
        if current_temp <= 0.0 and temp_min >= 0.0:
            composite_score = max(composite_score, 55.0)
        composite_score = round(min(100.0, max(0.0, composite_score)), 2)

        # Risk Tier Classification
        if composite_score < 25.0:
            tier = "LOW"
            recommendation = "Normal operating parameters. Continue standard scheduled monitoring."
        elif composite_score < 50.0:
            tier = "MODERATE"
            recommendation = "Mild temperature variance or drift detected. Verify active cooling airflow."
        elif composite_score < 75.0:
            tier = "ELEVATED"
            recommendation = "Persistent drift or anomalous readings. Inspect cargo compartment and prepare contingency transfer."
        else:
            tier = "CRITICAL"
            recommendation = "Severe thermal excursions or potential hardware tamper detected. Immediate operational intervention required."

        explanation = (
            f"Composite risk assessed at {composite_score:.1f}/100 ({tier}). "
            f"Thermal risk: {thermal_risk:.1f}, Anomaly: {anomaly_risk:.1f}, Drift: {drift_risk:.1f}, Kinetics: {kinetics_risk:.1f}."
        )

        return {
            "composite_score": composite_score,
            "tier": tier,
            "factors": {
                "thermal_risk": round(thermal_risk, 2),
                "anomaly_risk": round(anomaly_risk, 2),
                "drift_risk": round(drift_risk, 2),
                "kinetics_risk": round(kinetics_risk, 2),
                "security_penalty": round(security_penalty, 2),
            },
            "explanation": explanation,
            "recommendation": recommendation,
            "label": ADVISORY_LABEL,
        }
