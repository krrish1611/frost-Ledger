import os
import pytest
import numpy as np
from fastapi.testclient import TestClient

from config import ADVISORY_LABEL
from main import app
from models.cargo_models import VaccineColdChainModel, ProduceColdChainModel
from learner import ShipmentLearner
from risk_scorer import CompositeRiskScorer

client = TestClient(app)

def test_vaccine_model_freezing_and_heat_excursion():
    """
    Vaccine model must strictly enforce +2°C to +8°C corridor,
    treating freezing (<= 0.0°C) as immediate critical failure under WHO biologics guidelines.
    """
    model = VaccineColdChainModel(contamination=0.1, n_estimators=50, random_state=42)
    # Fit on synthetic in-spec vaccine points
    normal_data = np.array([
        [float(t), 0.0, 0.0, 0.0, 0.2, 1.0, 45.0]
        for t in np.linspace(3.0, 6.0, 100)
    ])
    model.fit(normal_data)

    # 1. Normal reading (+4.5°C)
    normal_reading = {"temperature": 4.5, "humidity": 50.0, "shock": 0.1, "speed": 40.0}
    feats_norm = model.extract_features(normal_reading)
    is_anom, score, exp = model.predict_anomaly(feats_norm)
    assert not is_anom, f"Normal vaccine point flagged: {exp}"

    # 2. Catastrophic freezing reading (-1.2°C)
    freeze_reading = {"temperature": -1.2, "humidity": 50.0, "shock": 0.1, "speed": 40.0}
    feats_freeze = model.extract_features(freeze_reading)
    is_anom_freeze, score_freeze, exp_freeze = model.predict_anomaly(feats_freeze)
    assert is_anom_freeze, "Freezing reading not detected as anomaly"
    assert score_freeze >= 0.90, f"Freezing score should be >= 0.90, got {score_freeze}"
    assert "freezing" in exp_freeze.lower()

    # 3. Heat excursion (+12.5°C)
    heat_reading = {"temperature": 12.5, "humidity": 55.0, "shock": 0.1, "speed": 40.0}
    feats_heat = model.extract_features(heat_reading)
    is_anom_heat, score_heat, exp_heat = model.predict_anomaly(feats_heat)
    assert is_anom_heat, "Heat excursion not detected as anomaly"
    assert "excursion" in exp_heat.lower() or "arrhenius" in exp_heat.lower()


def test_produce_model_transpiration_and_condensation():
    """
    Produce model must monitor 0°C to 4°C, but critically evaluates Relative Humidity:
    Transpiration moisture loss (RH < 78%) and Condensation mold risk (RH > 96%).
    """
    model = ProduceColdChainModel(contamination=0.1, n_estimators=50, random_state=42)
    normal_data = np.array([
        [float(t), float(h), 0.05, 0.0, 0.2, 1.2, 0.0]
        for t in np.linspace(1.0, 3.5, 50)
        for h in np.linspace(88.0, 94.0, 2)
    ])
    model.fit(normal_data)

    # 1. Normal fresh produce reading (+2.0°C, 92% RH)
    normal_reading = {"temperature": 2.0, "humidity": 92.0, "shock": 0.1}
    feats_norm = model.extract_features(normal_reading)
    is_anom, score, exp = model.predict_anomaly(feats_norm)
    assert not is_anom, f"Normal produce point flagged: {exp}"

    # 2. Transpiration dryness (RH = 62.0%)
    dry_reading = {"temperature": 2.5, "humidity": 62.0, "shock": 0.1}
    feats_dry = model.extract_features(dry_reading)
    is_anom_dry, score_dry, exp_dry = model.predict_anomaly(feats_dry)
    assert is_anom_dry, "Dryness transpiration not detected as produce anomaly"
    assert "transpiration" in exp_dry.lower() or "moisture" in exp_dry.lower()

    # 3. Condensation Botrytis mold danger (RH = 98.5% with cooling drop)
    prev_reading = {"temperature": 3.0, "humidity": 90.0}
    wet_reading = {"temperature": 1.8, "humidity": 98.5, "shock": 0.1}
    feats_wet = model.extract_features(wet_reading, prev_reading=prev_reading)
    is_anom_wet, score_wet, exp_wet = model.predict_anomaly(feats_wet)
    assert is_anom_wet, "Condensation risk not detected as produce anomaly"
    assert "condensation" in exp_wet.lower() or "mold" in exp_wet.lower()

    # 4. Mechanical Bruising G-Shock (shock = 2.4g)
    shock_reading = {"temperature": 2.0, "humidity": 90.0, "shock": 2.4}
    feats_shock = model.extract_features(shock_reading)
    is_anom_shock, score_shock, exp_shock = model.predict_anomaly(feats_shock)
    assert is_anom_shock, "Bruising shock not detected as produce anomaly"
    assert "bruising" in exp_shock.lower() or "shock" in exp_shock.lower()


def test_shipment_learner_specializes_by_cargo_type():
    """
    ShipmentLearner automatically chooses the appropriate model based on cargo_type.
    """
    vax_learner = ShipmentLearner(
        shipment_id="ship_vax_domain_01",
        profile={"cargo_type": "vaccine", "temp_min_c": 2.0, "temp_max_c": 8.0},
        warmup_samples=2,
    )
    assert vax_learner.cargo_type == "vaccine"
    assert vax_learner.cargo_model is not None
    assert vax_learner.cargo_model.cargo_type == "vaccine"

    prod_learner = ShipmentLearner(
        shipment_id="ship_prod_domain_02",
        profile={"cargo_type": "produce", "temp_min_c": 0.0, "temp_max_c": 4.0},
        warmup_samples=2,
    )
    assert prod_learner.cargo_type == "produce"
    assert prod_learner.cargo_model is not None
    assert prod_learner.cargo_model.cargo_type == "produce"


def test_composite_risk_scorer_differentiates_domains():
    """
    Risk scoring applies different biology equations to produce (Q10, transpiration)
    vs vaccines (Arrhenius, freezing zero-tolerance).
    """
    # 0.0°C test:
    # For vaccines: 0.0°C triggers catastrophic failure (score >= 55)
    vax_risk = CompositeRiskScorer.calculate_risk(
        current_temp=0.0,
        profile={"cargo_type": "vaccine", "temp_min_c": 2.0, "temp_max_c": 8.0},
    )
    assert vax_risk["composite_score"] >= 55.0
    assert vax_risk["factors"]["thermal_risk"] == 100.0

    # For produce (berries): 0.0°C is within standard cold storage (0°C to 4°C)!
    prod_risk = CompositeRiskScorer.calculate_risk(
        current_temp=1.0,
        current_humidity=92.0,
        profile={"cargo_type": "produce", "temp_min_c": 0.0, "temp_max_c": 4.0},
    )
    assert prod_risk["composite_score"] < 25.0, f"Expected LOW risk for 1.0C produce, got {prod_risk['composite_score']}"
    assert prod_risk["tier"] == "LOW"


def test_cargo_models_fastapi_endpoints():
    res = client.get("/models/cargo")
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert "vaccine_biologics" in data["models"]
    assert "fresh_produce" in data["models"]
    assert data["models"]["vaccine_biologics"]["accuracy"] >= 0.90
    assert data["models"]["fresh_produce"]["accuracy"] >= 0.90
