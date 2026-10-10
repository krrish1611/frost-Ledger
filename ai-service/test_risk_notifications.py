import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from config import ADVISORY_LABEL
from main import app
from db import AiDatabaseClient
from service import AiService
from risk_scorer import CompositeRiskScorer
from notifier import NotificationService

client = TestClient(app)

def test_composite_risk_normal_temperature():
    profile = {
        "temp_min_c": 2.0,
        "temp_max_c": 8.0,
        "ref_temp_c": 4.0,
        "activation_energy_j_mol": 83144.0,
    }
    result = CompositeRiskScorer.calculate_risk(
        current_temp=5.0,
        profile=profile,
        hst_score=0.1,
        cusum_stat=0.1,
    )
    assert result["tier"] == "LOW"
    assert result["composite_score"] < 25.0
    assert result["label"] == ADVISORY_LABEL
    assert result["factors"]["thermal_risk"] < 15.0

def test_composite_risk_high_thermal_excursion():
    profile = {
        "temp_min_c": 2.0,
        "temp_max_c": 8.0,
        "ref_temp_c": 4.0,
        "activation_energy_j_mol": 83144.0,
    }
    result = CompositeRiskScorer.calculate_risk(
        current_temp=15.0,
        profile=profile,
        hst_score=0.9,
        cusum_stat=4.0,
    )
    assert result["tier"] == "CRITICAL"
    assert result["composite_score"] > 75.0
    assert result["factors"]["thermal_risk"] > 80.0
    assert "CRITICAL" in result["explanation"]

def test_composite_risk_freezing_hazard():
    profile = {
        "temp_min_c": 2.0,
        "temp_max_c": 8.0,
        "ref_temp_c": 4.0,
        "activation_energy_j_mol": 83144.0,
    }
    result = CompositeRiskScorer.calculate_risk(
        current_temp=-1.5,
        profile=profile,
        hst_score=0.5,
    )
    assert result["factors"]["thermal_risk"] > 50.0
    assert result["tier"] in ["ELEVATED", "CRITICAL"]

def test_composite_risk_security_penalty():
    profile = {"temp_min_c": 2.0, "temp_max_c": 8.0}
    normal = CompositeRiskScorer.calculate_risk(5.0, profile, is_flat_copied=False)
    spoofed = CompositeRiskScorer.calculate_risk(5.0, profile, is_flat_copied=True)
    assert spoofed["composite_score"] > normal["composite_score"]
    assert spoofed["factors"]["security_penalty"] == 35.0

def test_notification_suppressed_when_email_disabled():
    mock_db = AiDatabaseClient(use_mock=True)
    notifier = NotificationService(db=mock_db)

    shipment = {"shipment_id": "ship_notif_01", "ai_email_enabled": False}
    insight = {
        "insight_id": "ins_01",
        "shipment_id": "ship_notif_01",
        "severity": "critical",
        "explanation": "Temperature spike",
    }

    result = notifier.dispatch_notification(insight, shipment)
    assert result["status"] == "suppressed"
    assert "ai_email_enabled is false" in result["reason"]

def test_notification_dispatched_when_email_enabled():
    mock_db = AiDatabaseClient(use_mock=True)
    notifier = NotificationService(db=mock_db)

    shipment = {"shipment_id": "ship_notif_02", "ai_email_enabled": True}
    insight = {
        "insight_id": "ins_02",
        "shipment_id": "ship_notif_02",
        "severity": "critical",
        "explanation": "Temperature spike detected",
    }

    result = notifier.dispatch_notification(insight, shipment)
    assert result["status"] == "sent"
    assert result["reason"] == "dispatched"
    assert result["label"] == ADVISORY_LABEL

    # Check notification logged in db
    records = mock_db.get_notifications("ship_notif_02")
    assert len(records) == 1
    assert records[0]["status"] == "sent"

def test_notification_debouncing_quiet_period():
    mock_db = AiDatabaseClient(use_mock=True)
    notifier = NotificationService(db=mock_db, quiet_period_minutes=15)

    shipment = {"shipment_id": "ship_notif_03", "ai_email_enabled": True}
    insight_1 = {
        "insight_id": "ins_03_a",
        "shipment_id": "ship_notif_03",
        "severity": "critical",
        "explanation": "Initial critical spike",
    }
    insight_2 = {
        "insight_id": "ins_03_b",
        "shipment_id": "ship_notif_03",
        "severity": "critical",
        "explanation": "Second critical spike 2 minutes later",
    }

    res_1 = notifier.dispatch_notification(insight_1, shipment)
    assert res_1["status"] == "sent"

    res_2 = notifier.dispatch_notification(insight_2, shipment)
    assert res_2["status"] == "suppressed"
    assert "quiet_period_active" in res_2["reason"]

def test_notification_hourly_rate_limit():
    mock_db = AiDatabaseClient(use_mock=True)
    # Quiet period 0 so only rate limit applies
    notifier = NotificationService(db=mock_db, quiet_period_minutes=0, max_per_hour=3)

    shipment = {"shipment_id": "ship_notif_04", "ai_email_enabled": True}

    for i in range(3):
        ins = {
            "insight_id": f"ins_04_{i}",
            "shipment_id": "ship_notif_04",
            "severity": "warning",
            "explanation": f"Warning {i}",
        }
        res = notifier.dispatch_notification(ins, shipment)
        assert res["status"] == "sent"

    # 4th notification should exceed hourly cap
    ins_4 = {
        "insight_id": "ins_04_4",
        "shipment_id": "ship_notif_04",
        "severity": "warning",
        "explanation": "Warning 4",
    }
    res_4 = notifier.dispatch_notification(ins_4, shipment)
    assert res_4["status"] == "suppressed"
    assert "rate_limit_exceeded" in res_4["reason"]

def test_api_risk_and_notifications_endpoints():
    res_risk = client.get("/risk/shipment_test_endpoint")
    assert res_risk.status_code == 200
    data_risk = res_risk.json()
    assert data_risk["shipment_id"] == "shipment_test_endpoint"
    assert data_risk["label"] == ADVISORY_LABEL
    assert "composite_score" in data_risk
    assert "tier" in data_risk
    assert "thermal_risk" in data_risk["factors"]

    res_notif = client.get("/notifications/shipment_test_endpoint")
    assert res_notif.status_code == 200
    data_notif = res_notif.json()
    assert data_notif["shipment_id"] == "shipment_test_endpoint"
    assert data_notif["label"] == ADVISORY_LABEL
    assert isinstance(data_notif["notifications"], list)
