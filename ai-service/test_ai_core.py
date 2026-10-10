import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from config import ADVISORY_LABEL, MODEL_VERSION
from main import app
from db import AiDatabaseClient
from service import AiService
from learner import ShipmentLearner

client = TestClient(app)

def create_sample_reading(timestamp_dt: datetime, temp: float, humidity: float = 55.0, shock: float = 0.0, speed: float = 40.0):
    return {
        "timestamp": timestamp_dt.isoformat(),
        "temperature": temp,
        "humidity": humidity,
        "shock_events": [{"magnitude_g": shock, "timestamp": timestamp_dt.isoformat()}] if shock > 0 else [],
        "gps": {
            "lat": 37.7749,
            "lon": -122.4194,
            "speed": speed,
            "time_utc": timestamp_dt.isoformat(),
        },
    }

def test_health_check_advisory_label():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["label"] == ADVISORY_LABEL

def test_warmup_phase_suppresses_alerts():
    """
    PRD: First N readings only train the model with warmup_status = 'warming_up' without raising alerts.
    """
    learner = ShipmentLearner(
        shipment_id="ship_warmup_01",
        profile={"temp_min_c": 2.0, "temp_max_c": 8.0, "humidity_min_pct": 30.0, "humidity_max_pct": 70.0},
        warmup_samples=10,
    )

    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)
    for i in range(10):
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=5.0)
        insights = learner.process_reading(reading, batch_id=f"batch_{i}")
        assert learner.warmup_status == "warming_up"
        assert len(insights) == 0, "No alerts during warmup"

    # Reading 11 is now active
    reading_11 = create_sample_reading(base_time + timedelta(minutes=10), temp=5.0)
    learner.process_reading(reading_11, batch_id="batch_11")
    assert learner.warmup_status == "active"

def test_normal_simulation_produces_no_warnings():
    """
    PRD: Normal simulation: warm-up completes, very few/no warnings.
    """
    learner = ShipmentLearner(
        shipment_id="ship_normal_01",
        profile={"temp_min_c": 2.0, "temp_max_c": 8.0},
        warmup_samples=5,
    )
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    all_insights = []
    # 20 readings with normal small noise around 5.0C
    import math
    for i in range(20):
        noise = 0.2 * math.sin(i)
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=5.0 + noise)
        insights = learner.process_reading(reading, batch_id=f"batch_{i}")
        all_insights.extend(insights)

    # In normal conditions, no warnings or critical alerts should be raised
    warning_insights = [ins for ins in all_insights if ins["severity"] in ["warning", "critical"]]
    assert len(warning_insights) == 0

def test_temperature_spike_triggers_warning_with_explanation():
    """
    PRD: Spike simulation produces advisory warnings with plain-language explanations.
    """
    learner = ShipmentLearner(
        shipment_id="ship_spike_01",
        profile={"temp_min_c": 2.0, "temp_max_c": 8.0},
        warmup_samples=5,
    )
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    # Warmup with 5 normal readings
    for i in range(5):
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=4.5)
        learner.process_reading(reading, batch_id=f"batch_{i}")

    # Sudden jump from 4.5C to 9.5C in 1 minute
    spike_reading = create_sample_reading(base_time + timedelta(minutes=5), temp=9.5)
    insights = learner.process_reading(spike_reading, batch_id="batch_spike")

    assert len(insights) > 0
    spike_ins = insights[0]
    assert spike_ins["severity"] in ["warning", "critical"]
    assert "Rapid temperature jump detected" in spike_ins["explanation"]
    assert spike_ins["label"] == ADVISORY_LABEL
    assert spike_ins["kind"] == "anomaly"

def test_slow_drift_triggers_cusum_drift_warning():
    """
    PRD: Slow drift simulation produces advisory warnings with plain-language explanations.
    """
    learner = ShipmentLearner(
        shipment_id="ship_drift_01",
        profile={"temp_min_c": 2.0, "temp_max_c": 8.0},
        warmup_samples=5,
    )
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    # Warm up at 5.0C
    for i in range(5):
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=5.0)
        learner.process_reading(reading, batch_id=f"batch_{i}")

    # Slow persistent drift upwards (+0.4C each minute)
    drift_insights = []
    curr_temp = 5.0
    for i in range(5, 20):
        curr_temp += 0.4
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=curr_temp)
        ins = learner.process_reading(reading, batch_id=f"batch_{i}")
        drift_insights.extend(ins)

    cusum_insights = [i for i in drift_insights if i["model_name"] == "cusum_drift_detector"]
    assert len(cusum_insights) > 0
    assert "drift detected in temperature" in cusum_insights[0]["explanation"].lower()
    assert cusum_insights[0]["label"] == ADVISORY_LABEL

def test_flat_copied_readings_triggers_spoofing_warning():
    """
    PRD: Flat-copied simulations produce advisory warnings with plain-language explanations.
    """
    learner = ShipmentLearner(
        shipment_id="ship_flat_01",
        profile={"temp_min_c": 2.0, "temp_max_c": 8.0},
        warmup_samples=5,
    )
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    # Warmup
    for i in range(5):
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=5.0 + 0.1 * i)
        learner.process_reading(reading, batch_id=f"batch_{i}")

    # 5 consecutive identical readings (exactly 5.2000C, 60.00% RH)
    flat_insights = []
    for i in range(5, 11):
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=5.2, humidity=60.0)
        ins = learner.process_reading(reading, batch_id=f"batch_{i}")
        flat_insights.extend(ins)

    spoof_insights = [i for i in flat_insights if i["kind"] == "spoofing"]
    assert len(spoof_insights) > 0
    assert "Flat / copied sensor readings detected" in spoof_insights[0]["explanation"]
    assert spoof_insights[0]["label"] == ADVISORY_LABEL

def test_known_event_downweighting_door_open():
    """
    PRD: Downweight samples during door-open or high shock events.
    """
    learner = ShipmentLearner(
        shipment_id="ship_door_01",
        profile={"temp_min_c": 2.0, "temp_max_c": 8.0},
        warmup_samples=5,
    )
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    for i in range(5):
        reading = create_sample_reading(base_time + timedelta(minutes=i), temp=5.0)
        learner.process_reading(reading, batch_id=f"batch_{i}")

    # Sudden temperature bump during a planned door-open event
    reading = create_sample_reading(base_time + timedelta(minutes=6), temp=8.5)
    events = [{"type": "door_open", "magnitude": 1.0, "timestamp": reading["timestamp"]}]

    insights = learner.process_reading(reading, batch_id="batch_door", events=events)
    # False alarm suppressed due to planned door open event
    assert len(insights) == 0

def test_checkpoint_and_restart_resumption_no_duplicates():
    """
    PRD: Stop/restart AI service mid-shipment resumes from checkpointed state with zero duplicate insights.
    """
    mock_db = AiDatabaseClient(use_mock=True)
    service1 = AiService(db=mock_db)

    shipment_id = "ship_resume_01"
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    # Insert batches into mock db
    for i in range(10):
        mock_db.mock_batches.append({
            "batch_id": f"batch_{i}",
            "shipment_id": shipment_id,
            "device_id": "dev_01",
            "sequence_no": i + 1,
            "prev_hash": "0" * 64,
            "hash": f"hash_{i}",
            "payload": {"readings": [create_sample_reading(base_time + timedelta(minutes=i), temp=4.0)]},
            "received_at": (base_time + timedelta(minutes=i)).isoformat(),
        })

    # Process first 10 batches with warmup_samples=5
    service1.process_shipment(shipment_id, warmup_samples=5)
    saved_state = mock_db.get_model_state(shipment_id)
    assert saved_state is not None
    assert saved_state["last_batch_id"] == "batch_9"
    assert saved_state["state"]["sample_count"] == 10

    # Simulate stopping service 1 and starting service 2 (new process)
    service2 = AiService(db=mock_db)

    # Add 5 more batches (10 to 14) with a spike at batch 12
    for i in range(10, 15):
        temp = 9.8 if i == 12 else 4.0
        mock_db.mock_batches.append({
            "batch_id": f"batch_{i}",
            "shipment_id": shipment_id,
            "device_id": "dev_01",
            "sequence_no": i + 1,
            "prev_hash": f"hash_{i-1}",
            "hash": f"hash_{i}",
            "payload": {"readings": [create_sample_reading(base_time + timedelta(minutes=i), temp=temp)]},
            "received_at": (base_time + timedelta(minutes=i)).isoformat(),
        })

    new_insights = service2.process_shipment(shipment_id)
    # Check that it did NOT reprocess batches 0-9
    reprocessed_input_refs = [ins["input_ref"] for ins in new_insights]
    for i in range(10):
        assert f"batch_{i}" not in reprocessed_input_refs, f"Batch {i} should not be reprocessed"

    # It caught the spike in batch 12
    assert "batch_12" in reprocessed_input_refs

def test_two_simultaneous_shipments_maintain_isolated_states():
    """
    PRD: Two simultaneous shipments maintain strictly isolated model states.
    """
    mock_db = AiDatabaseClient(use_mock=True)
    service = AiService(db=mock_db)

    ship_A = "ship_A_chilled"
    ship_B = "ship_B_frozen"
    base_time = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    # Ship A target is 4.0C; Ship B target is -20.0C
    mock_db.mock_batches.append({
        "batch_id": "batch_A_0",
        "shipment_id": ship_A,
        "device_id": "dev_A",
        "sequence_no": 1,
        "prev_hash": "0" * 64,
        "hash": "hash_A_0",
        "payload": {"readings": [create_sample_reading(base_time, temp=4.0)]},
        "received_at": base_time.isoformat(),
    })
    mock_db.mock_batches.append({
        "batch_id": "batch_B_0",
        "shipment_id": ship_B,
        "device_id": "dev_B",
        "sequence_no": 1,
        "prev_hash": "0" * 64,
        "hash": "hash_B_0",
        "payload": {"readings": [create_sample_reading(base_time, temp=-20.0)]},
        "received_at": base_time.isoformat(),
    })

    service.process_shipment(ship_A, profile={"temp_min_c": 2.0, "temp_max_c": 8.0}, warmup_samples=1)
    service.process_shipment(ship_B, profile={"temp_min_c": -25.0, "temp_max_c": -15.0}, warmup_samples=1)

    learner_A = service.learners[ship_A]
    learner_B = service.learners[ship_B]

    assert learner_A.temp_cusum.mu > 0.0
    assert learner_B.temp_cusum.mu < 0.0
    assert learner_A.shipment_id == ship_A
    assert learner_B.shipment_id == ship_B

def test_database_client_enforces_read_only_on_official_tables():
    """
    PRD: The AI service must only authenticate as ai_service_role and never attempt writes to official tables.
    """
    db_client = AiDatabaseClient(use_mock=True)

    with pytest.raises(PermissionError) as exc_info:
        db_client._verify_query_safety("INSERT INTO shipments (shipment_id) VALUES ('fake')")
    assert "Attempted write operation on official immutable table 'shipments'" in str(exc_info.value)

    with pytest.raises(PermissionError) as exc_info:
        db_client._verify_query_safety("UPDATE batches SET hash = 'tampered'")
    assert "Attempted write operation on official immutable table 'batches'" in str(exc_info.value)

    with pytest.raises(PermissionError) as exc_info:
        db_client._verify_query_safety("DELETE FROM alerts WHERE alert_id = '123'")
    assert "Attempted write operation on official immutable table 'alerts'" in str(exc_info.value)
