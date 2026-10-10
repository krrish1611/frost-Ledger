import math
import os
import json
import joblib
from typing import Dict, Any, Tuple, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from river.anomaly import HalfSpaceTrees

class BaseCargoModel:
    """Base interface for domain-specific cold chain cargo AI models."""
    cargo_type: str = "generic"

    def extract_features(self, reading: Dict[str, Any], prev_reading: Optional[Dict[str, Any]] = None) -> np.ndarray:
        raise NotImplementedError

    def predict_anomaly(self, features: np.ndarray) -> Tuple[bool, float, str]:
        raise NotImplementedError

    def save(self, filepath: str):
        joblib.dump(self, filepath)

    @classmethod
    def load(cls, filepath: str) -> "BaseCargoModel":
        return joblib.load(filepath)


class VaccineColdChainModel(BaseCargoModel):
    """
    AI Model specifically trained for Vaccines and Biologics (mRNA, Insulin, Monoclonal Antibodies).
    
    Physics & Biology Constraints:
    - Strict 2.0°C to 8.0°C corridor.
    - Freezing (<= 0.0°C) is immediately catastrophic (adjuvant agglomeration & protein denaturation).
    - Arrhenius kinetics: High activation energy (Ea = 83.14 kJ/mol).
    - Mechanical shock > 2.5g introduces shear degradation or glass ampoule micro-fracture risk.
    """
    cargo_type: str = "vaccine"
    R_GAS = 8.3144 # J / (mol * K)
    EA_VACCINE = 83144.0 # J / mol (USP <1160>)
    REF_TEMP_K = 277.15 # 4.0 °C

    def __init__(self, contamination: float = 0.08, n_estimators: int = 120, random_state: int = 42):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.iso_forest = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
        )
        self.streaming_hst = HalfSpaceTrees(
            n_trees=30,
            height=7,
            window_size=60,
            seed=self.random_state,
        )
        self.is_fitted = False
        self.feature_names = [
            "temperature",
            "temp_rate_of_change",
            "freeze_risk_score",
            "heat_excursion_score",
            "shock_magnitude_g",
            "arrhenius_kinetic_factor",
            "speed_kmh",
        ]

    def extract_features(self, reading: Dict[str, Any], prev_reading: Optional[Dict[str, Any]] = None) -> np.ndarray:
        temp = float(reading.get("temperature", 5.0))
        hum = float(reading.get("humidity", 50.0))
        
        # Rate of change
        temp_roc = 0.0
        if prev_reading is not None and "temperature" in prev_reading:
            temp_roc = temp - float(prev_reading["temperature"])

        # Shock
        shock = 0.0
        shock_events = reading.get("shock_events") or []
        if shock_events:
            shock = max(float(s.get("magnitude_g", 0.0)) for s in shock_events)
        elif "shock" in reading:
            shock = float(reading["shock"])

        # Speed
        speed = 0.0
        gps = reading.get("gps")
        if gps and "speed" in gps:
            speed = float(gps["speed"])
        elif "speed" in reading:
            speed = float(reading["speed"])

        # Freezing risk is non-linear: sharp step below 2.0C, extreme below 0.0C
        if temp <= 0.0:
            freeze_score = 100.0 + abs(temp) * 15.0
        elif temp < 2.0:
            freeze_score = (2.0 - temp) * 35.0
        else:
            freeze_score = 0.0

        # Heat excursion
        heat_score = max(0.0, temp - 8.0) * 18.0

        # Arrhenius factor
        temp_k = temp + 273.15
        try:
            arrhenius_factor = math.exp((self.EA_VACCINE / self.R_GAS) * (1.0 / self.REF_TEMP_K - 1.0 / temp_k))
        except OverflowError:
            arrhenius_factor = 25.0

        return np.array([
            temp,
            temp_roc,
            freeze_score,
            heat_score,
            shock,
            min(25.0, arrhenius_factor),
            speed,
        ], dtype=np.float64)

    def fit(self, X: np.ndarray):
        self.iso_forest.fit(X)
        self.is_fitted = True
        # Pre-warm streaming trees
        for row in X[:150]:
            feat_dict = {name: float(val) for name, val in zip(self.feature_names, row)}
            self.streaming_hst.learn_one(feat_dict)
        return self

    def predict_anomaly(self, features: np.ndarray) -> Tuple[bool, float, str]:
        if not self.is_fitted:
            return False, 0.0, "Model not fitted"

        raw_score = self.iso_forest.decision_function(features.reshape(1, -1))[0]
        anomaly_score = float(1.0 / (1.0 + math.exp(raw_score * 4.0)))

        feat_dict = {name: float(val) for name, val in zip(self.feature_names, features)}
        hst_score = float(self.streaming_hst.score_one(feat_dict))
        self.streaming_hst.learn_one(feat_dict)

        combined_score = 0.6 * anomaly_score + 0.4 * hst_score

        temp = features[0]
        freeze_score = features[2]
        shock = features[4]

        # Domain rule overrides:
        if temp <= 0.0:
            combined_score = max(combined_score, 0.95)
            explanation = f"CRITICAL VACCINE ALERT: Sub-zero freezing violation ({temp:.2f}°C). Inactivation risk is catastrophic under WHO biologics standards."
            return True, combined_score, explanation
        elif temp > 8.0:
            combined_score = max(combined_score, 0.70 + min(0.28, (temp - 8.0) * 0.08))
            explanation = f"VACCINE EXCURSION ALERT: Temperature elevated ({temp:.2f}°C > 8.0°C). Accelerated Arrhenius degradation occurring."
            return True, combined_score, explanation
        elif shock > 2.5:
            combined_score = max(combined_score, 0.75)
            explanation = f"VACCINE SHOCK ALERT: High mechanical G-force ({shock:.1f}g) detected. Risk of protein shear stress or vial fracture."
            return True, combined_score, explanation

        is_anomaly = combined_score >= 0.55
        explanation = f"Vaccine model anomaly score: {combined_score:.2f} (Corridor +2.0°C..+8.0°C stable)" if not is_anomaly else f"Vaccine model flagged unusual pattern (score: {combined_score:.2f})"
        return is_anomaly, combined_score, explanation


class ProduceColdChainModel(BaseCargoModel):
    """
    AI Model specifically trained for Fruits and Vegetables (Fresh Produce, Berries, Greens, Apples).
    
    Physics & Biology Constraints:
    - Temperature range: 0.0°C to 4.0°C (standard berries/produce).
    - Freezing (< -0.5°C) bursts cell walls (loss of turgor, water soaking, decay).
    - Relative Humidity is critical:
      - Transpiration deficit: RH < 80% causes moisture loss, shriveling, and weight loss.
      - Condensation / Dew point: RH > 96% with temperature fluctuations triggers Botrytis (gray mold).
    - Physical Shock > 1.8g causes bruising, tissue browning, and an immediate burst in ethylene (C2H4).
    - Respiration Rate: Biological Q10 coefficient ~ 2.2 (respiration doubles every 10°C).
    """
    cargo_type: str = "produce"
    Q10_FACTOR = 2.2 # Respiration rate doubles per 10°C

    def __init__(self, contamination: float = 0.10, n_estimators: int = 120, random_state: int = 42):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.iso_forest = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
        )
        self.streaming_hst = HalfSpaceTrees(
            n_trees=30,
            height=7,
            window_size=60,
            seed=self.random_state,
        )
        self.is_fitted = False
        self.feature_names = [
            "temperature",
            "humidity",
            "vpd_transpiration_deficit_kpa",
            "condensation_mold_risk",
            "bruising_shock_g",
            "respiration_decay_factor",
            "temp_rate_of_change",
        ]

    @staticmethod
    def calculate_vpd(temp_c: float, humidity_pct: float) -> float:
        """Computes Vapor Pressure Deficit (VPD in kPa) for fresh produce transpiration."""
        es = 0.61078 * math.exp((17.27 * temp_c) / (temp_c + 237.3))
        ea = es * (max(1.0, min(100.0, humidity_pct)) / 100.0)
        return max(0.0, es - ea)

    def extract_features(self, reading: Dict[str, Any], prev_reading: Optional[Dict[str, Any]] = None) -> np.ndarray:
        temp = float(reading.get("temperature", 2.0))
        hum = float(reading.get("humidity", 90.0))

        # Rate of change
        temp_roc = 0.0
        if prev_reading is not None and "temperature" in prev_reading:
            temp_roc = temp - float(prev_reading["temperature"])

        # Shock
        shock = 0.0
        shock_events = reading.get("shock_events") or []
        if shock_events:
            shock = max(float(s.get("magnitude_g", 0.0)) for s in shock_events)
        elif "shock" in reading:
            shock = float(reading["shock"])

        # VPD (Transpiration deficit)
        vpd = self.calculate_vpd(temp, hum)

        # Condensation mold danger
        condensation_risk = 1.0 if (hum > 95.0 and temp_roc < -0.1) else (0.5 if hum > 97.0 else 0.0)

        # Q10 Respiration decay factor
        respiration_factor = math.pow(self.Q10_FACTOR, max(0.0, temp) / 10.0)

        return np.array([
            temp,
            hum,
            vpd,
            condensation_risk,
            shock,
            respiration_factor,
            temp_roc,
        ], dtype=np.float64)

    def fit(self, X: np.ndarray):
        self.iso_forest.fit(X)
        self.is_fitted = True
        # Pre-warm streaming trees
        for row in X[:150]:
            feat_dict = {name: float(val) for name, val in zip(self.feature_names, row)}
            self.streaming_hst.learn_one(feat_dict)
        return self

    def predict_anomaly(self, features: np.ndarray) -> Tuple[bool, float, str]:
        if not self.is_fitted:
            return False, 0.0, "Model not fitted"

        raw_score = self.iso_forest.decision_function(features.reshape(1, -1))[0]
        anomaly_score = float(1.0 / (1.0 + math.exp(raw_score * 3.8)))

        feat_dict = {name: float(val) for name, val in zip(self.feature_names, features)}
        hst_score = float(self.streaming_hst.score_one(feat_dict))
        self.streaming_hst.learn_one(feat_dict)

        combined_score = 0.55 * anomaly_score + 0.45 * hst_score

        temp = features[0]
        hum = features[1]
        vpd = features[2]
        condensation = features[3]
        shock = features[4]

        # Domain produce rules:
        if temp < -0.5:
            combined_score = max(combined_score, 0.90)
            explanation = f"CRITICAL PRODUCE FREEZING: Ice crystallization at {temp:.2f}°C causes cell wall rupture, tissue softening, and collapse."
            return True, combined_score, explanation
        elif hum < 78.0:
            combined_score = max(combined_score, 0.72)
            explanation = f"PRODUCE TRANSPIRATION DEFICIT: Low humidity ({hum:.1f}%, VPD: {vpd:.2f} kPa). Excessive moisture loss, shriveling, and weight loss detected."
            return True, combined_score, explanation
        elif condensation >= 0.8:
            combined_score = max(combined_score, 0.75)
            explanation = f"PRODUCE CONDENSATION RISK: Saturated humidity ({hum:.1f}%) with cooling triggers standing dew. High risk of Botrytis mold growth."
            return True, combined_score, explanation
        elif shock > 1.8:
            combined_score = max(combined_score, 0.78)
            explanation = f"PRODUCE MECHANICAL BRUISING: G-shock {shock:.1f}g exceeds produce threshold (1.8g). Impact causes tissue crushing and ethylene surge."
            return True, combined_score, explanation
        elif temp > 6.0:
            combined_score = max(combined_score, 0.65 + min(0.3, (temp - 6.0) * 0.05))
            explanation = f"PRODUCE RESPIRATION WARNING: Elevated temp ({temp:.2f}°C). Respiration rate accelerated (Q10 ~ 2.2x), reducing remaining shelf-life."
            return True, combined_score, explanation

        is_anomaly = combined_score >= 0.55
        explanation = f"Produce model normal status (score: {combined_score:.2f}, Temp: {temp:.1f}°C, RH: {hum:.1f}%)" if not is_anomaly else f"Produce model anomaly alert (score: {combined_score:.2f})"
        return is_anomaly, combined_score, explanation
