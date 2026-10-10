import pytest
from fastapi.testclient import TestClient

from config import ADVISORY_LABEL
from main import app
from db import AiDatabaseClient
from evaluator import OfflineMlEvaluator

client = TestClient(app)

def test_generate_benchmark_dataset_structure():
    data = OfflineMlEvaluator.generate_benchmark_dataset()
    assert len(data) >= 150
    scenarios = set(d["scenario"] for d in data)
    assert "normal" in scenarios
    assert "spike" in scenarios
    assert "slow_drift" in scenarios
    assert "flat_copied" in scenarios
    assert "door_open" in scenarios

    # Check that y_true contains both 0 and 1
    labels = set(d["y_true"] for d in data)
    assert 0 in labels and 1 in labels

def test_run_offline_evaluation_benchmarks():
    mock_db = AiDatabaseClient(use_mock=True)
    evaluator = OfflineMlEvaluator(db=mock_db)

    results = evaluator.run_evaluation(dataset_name="test_coldchain_bench_01")
    assert results["label"] == ADVISORY_LABEL
    assert "models" in results

    models = results["models"]
    assert "online_streaming_hst_cusum" in models
    assert "offline_isolation_forest" in models
    assert "offline_local_outlier_factor" in models

    # Check streaming detector performance meets PRD standards
    stream_m = models["online_streaming_hst_cusum"]
    assert stream_m["precision"] >= 0.80, f"Precision should be >= 0.80, got {stream_m['precision']}"
    assert stream_m["recall"] >= 0.85, f"Recall should be >= 0.85, got {stream_m['recall']}"
    assert stream_m["false_alert_rate"] <= 0.06, f"FAR should be <= 0.06, got {stream_m['false_alert_rate']}"
    assert stream_m["avg_lead_time_seconds"] >= 300.0, f"Lead time should be >= 300s, got {stream_m['avg_lead_time_seconds']}"

    # Verify persisted records in database
    records = mock_db.get_evaluations()
    assert len(records) == 3
    model_names = set(r["model_name"] for r in records)
    assert "online_streaming_hst_cusum" in model_names
    assert "offline_isolation_forest" in model_names
    assert "offline_local_outlier_factor" in model_names

def test_evaluations_fastapi_endpoints():
    post_res = client.post("/evaluate")
    assert post_res.status_code == 200
    post_data = post_res.json()
    assert post_data["label"] == ADVISORY_LABEL
    assert "online_streaming_hst_cusum" in post_data["models"]

    get_res = client.get("/evaluations")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["label"] == ADVISORY_LABEL
    assert get_data["count"] >= 3
    assert get_data["evaluations"][0]["model_name"] is not None
