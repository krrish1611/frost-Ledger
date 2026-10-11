import math
from typing import Dict, Any, Tuple, Optional
from config import ADVISORY_LABEL

class CompositeRiskScorer:
    """
    Computes a composite multi-dimensional risk score in [0, 100] for a shipment
    combining thermal deviation, streaming anomaly score, CUSUM drift, Arrhenius/Q10 kinetics,
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
        current_humidity: Optional[float] = None,
        shock_g: float = 0.0,
        remaining_shelf_life_hours: float = 720.0,
    ) -> Dict[str, Any]:
        cargo = str(profile.get("cargo_type", "vaccine")).lower()
        is_produce = any(k in cargo for k in ["produce", "fruit", "veg", "berry", "apple"])

        temp_min = float(profile.get("temp_min_c", 0.0 if is_produce else 2.0))
        temp_max = float(profile.get("temp_max_c", 4.0 if is_produce else 8.0))
        ref_temp = float(profile.get("ref_temp_c", 2.0 if is_produce else 4.0))

        if is_produce:
            # -------------------------------------------------------------
            # PRODUCE (FRUITS & VEGETABLES) DOMAIN RISK ENGINE
            # -------------------------------------------------------------
            # 1. Produce Thermal Risk
            if current_temp < -0.5:
                # Ice crystallization bursts cell walls
                thermal_risk = 95.0 + min(5.0, abs(current_temp + 0.5) * 5.0)
            elif temp_min <= current_temp <= temp_max:
                span = max(temp_max - temp_min, 1.0)
                dist_from_mid = abs(current_temp - (temp_min + temp_max) / 2.0)
                thermal_risk = (dist_from_mid / (span / 2.0)) * 12.0
            elif current_temp > temp_max:
                excess = current_temp - temp_max
                thermal_risk = min(100.0, 15.0 + excess * 14.0)
            else: # -0.5 <= current_temp < temp_min
                thermal_risk = 15.0 + (temp_min - current_temp) * 20.0

            # 2. Q10 Respiration Kinetics (Produce respire and consume sugars)
            # Respiration rate Q10 = 2.2
            q10_factor = math.pow(2.2, max(0.0, current_temp) / 10.0)
            kinetics_risk = min(100.0, max(5.0, (q10_factor - 1.0) * 30.0 + 8.0))

            # 3. Transpiration & Condensation Humidity Risk
            produce_humidity_risk = 0.0
            if current_humidity is not None:
                if current_humidity < 78.0:
                    # Low humidity causes vapor pressure deficit, wilting, moisture loss
                    deficit = 78.0 - current_humidity
                    produce_humidity_risk = min(80.0, deficit * 2.5)
                elif current_humidity > 96.0:
                    # Saturated condensation triggers Botrytis mold
                    produce_humidity_risk = min(75.0, (current_humidity - 96.0) * 18.0 + 20.0)

            # 4. Bruising Shock Risk
            bruising_penalty = 30.0 if shock_g > 1.8 else (10.0 if shock_g > 1.2 else 0.0)

            # Anomaly & Drift
            anomaly_risk = min(100.0, max(0.0, hst_score * 100.0))
            drift_ratio = cusum_stat / max(cusum_h, 0.5)
            drift_risk = min(100.0, drift_ratio * 40.0)
            security_penalty = 35.0 if is_flat_copied else 0.0

            # Composite Score for Produce
            composite_score = (
                0.30 * thermal_risk +
                0.20 * anomaly_risk +
                0.15 * drift_risk +
                0.15 * kinetics_risk +
                0.20 * produce_humidity_risk +
                bruising_penalty +
                security_penalty
            )
            composite_score = round(min(100.0, max(0.0, composite_score)), 2)

            # Risk Tier Classification for Produce
            if composite_score < 25.0:
                tier = "LOW"
                recommendation = "Normal fresh produce storage conditions. Standard ventilation and RH maintained."
            elif composite_score < 50.0:
                tier = "MODERATE"
                recommendation = "Mild transpiration deficit or humidity drift. Verify produce bin air circulation."
            elif composite_score < 75.0:
                tier = "ELEVATED"
                recommendation = "Persistent moisture deficit or warming drift. Inspect produce container dew points and prepare cooling adjustment."
            else:
                tier = "CRITICAL"
                recommendation = "Severe produce freeze damage or mold saturation risk detected. Immediate pallet inspection required."

            explanation = (
                f"Produce AI risk assessed at {composite_score:.1f}/100 ({tier}). "
                f"Thermal: {thermal_risk:.1f}, Anomaly: {anomaly_risk:.1f}, Respiration Q10: {kinetics_risk:.1f}, "
                f"Moisture/Mold: {produce_humidity_risk:.1f}."
            )
        else:
            # -------------------------------------------------------------
            # VACCINES & BIOLOGICS DOMAIN RISK ENGINE
            # -------------------------------------------------------------
            ea = float(profile.get("activation_energy_j_mol", 83144.0))

            # 1. Thermal Deviation Risk
            if temp_min <= current_temp <= temp_max:
                span = max(temp_max - temp_min, 1.0)
                dist_from_mid = abs(current_temp - (temp_min + temp_max) / 2.0)
                thermal_risk = (dist_from_mid / (span / 2.0)) * 15.0
            elif current_temp > temp_max:
                excess = current_temp - temp_max
                thermal_risk = min(100.0, 20.0 + excess * 20.0)
            else: # current_temp < temp_min
                deficit = temp_min - current_temp
                if current_temp <= 0.0 and temp_min >= 0.0:
                    thermal_risk = 100.0 # Catastrophic WHO freezing rule
                else:
                    thermal_risk = min(100.0, 30.0 + deficit * 25.0)

            # 2. Anomaly Risk
            anomaly_risk = min(100.0, max(0.0, hst_score * 100.0))

            # 3. Drift Risk
            drift_ratio = cusum_stat / max(cusum_h, 0.5)
            drift_risk = min(100.0, drift_ratio * 50.0)

            # 4. Arrhenius Kinetics Degradation
            temp_k = current_temp + 273.15
            ref_temp_k = ref_temp + 273.15
            try:
                arrhenius_factor = math.exp((ea / CompositeRiskScorer.R_GAS_CONSTANT) * (1.0 / ref_temp_k - 1.0 / temp_k))
                if arrhenius_factor <= 1.0:
                    kinetics_risk = 5.0
                else:
                    kinetics_risk = min(100.0, 10.0 + math.log(arrhenius_factor) * 35.0)
            except Exception:
                kinetics_risk = 50.0

            # 5. Security & Shock Penalty
            security_penalty = 35.0 if is_flat_copied else 0.0
            shock_penalty = 25.0 if shock_g > 2.5 else 0.0

            composite_score = (
                0.40 * thermal_risk +
                0.25 * anomaly_risk +
                0.20 * drift_risk +
                0.15 * kinetics_risk +
                security_penalty +
                shock_penalty
            )
            if current_temp <= 0.0 and temp_min >= 0.0:
                composite_score = max(composite_score, 55.0)
            composite_score = round(min(100.0, max(0.0, composite_score)), 2)

            # Risk Tier Classification for Vaccines
            if composite_score < 25.0:
                tier = "LOW"
                recommendation = "Normal operating parameters. Continue standard scheduled biologics monitoring."
            elif composite_score < 50.0:
                tier = "MODERATE"
                recommendation = "Mild temperature variance or drift detected. Verify active cooling airflow."
            elif composite_score < 75.0:
                tier = "ELEVATED"
                recommendation = "Persistent drift or anomalous readings. Inspect cargo compartment and prepare contingency transfer."
            else:
                tier = "CRITICAL"
                recommendation = "Severe thermal excursions or biologics freeze risk detected. Immediate operational intervention required."

            explanation = (
                f"Vaccine AI risk assessed at {composite_score:.1f}/100 ({tier}). "
                f"Thermal risk: {thermal_risk:.1f}, Anomaly: {anomaly_risk:.1f}, Drift: {drift_risk:.1f}, Kinetics Ea: {kinetics_risk:.1f}."
            )

        factors = {
            "thermal_risk": round(thermal_risk, 2),
            "anomaly_risk": round(anomaly_risk, 2),
            "drift_risk": round(drift_risk, 2),
            "kinetics_risk": round(kinetics_risk, 2),
            "security_penalty": round(security_penalty, 2),
        }
        if is_produce and current_humidity is not None:
            factors["humidity_transpiration_risk"] = round(produce_humidity_risk, 2)

        return {
            "composite_score": composite_score,
            "tier": tier,
            "cargo_type": "produce" if is_produce else "vaccine",
            "factors": factors,
            "explanation": explanation,
            "recommendation": recommendation,
            "label": ADVISORY_LABEL,
        }
