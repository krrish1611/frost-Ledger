import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

from config import MODEL_VERSION, ADVISORY_LABEL
from db import AiDatabaseClient
from learner import ShipmentLearner

class OfflineMlEvaluator:
    """
    Offline ML Evaluation & Shadow Validation Engine.
    Benchmarks the online streaming ML detector against gold-standard offline models
    (Isolation Forest, Local Outlier Factor) on multi-scenario synthetic cold chain telemetry.
    Computes precision, recall, false alert rate, and early warning lead time.
    """

    def __init__(self, db: AiDatabaseClient):
        self.db = db

    @staticmethod
    def generate_benchmark_dataset() -> List[Dict[str, Any]]:
        """
        Synthesizes a standardized cold-chain benchmark containing distinct shipments:
        normal, spike, slow_drift, flat_copied, and door_open scenarios.
        """
        dataset: List[Dict[str, Any]] = []
        base_time = datetime(2026, 10, 10, 8, 0, 0, tzinfo=timezone.utc)

        # Shipment 1: Normal operations (80 readings, 2.0C - 8.0C target, y_true = 0)
        for i in range(80):
            t = base_time + timedelta(minutes=i)
            dataset.append({
                "shipment_id": "ship_bench_normal",
                "step": i,
                "timestamp": t.isoformat(),
                "temperature": round(4.5 + 0.3 * math.sin(i), 2),
                "humidity": round(50.0 + 2.0 * math.cos(i), 1),
                "shock": 0.0,
                "speed": 45.0,
                "events": [],
                "y_true": 0,
                "scenario": "normal",
            })

        # Shipment 2: Sudden temperature spike (20 normal, 15 spike excursion readings)
        for i in range(35):
            t = base_time + timedelta(minutes=i)
            is_spike = i >= 20
            temp = 16.0 + 0.5 * math.sin(i) if is_spike else 4.5 + 0.2 * math.sin(i)
            dataset.append({
                "shipment_id": "ship_bench_spike",
                "step": i,
                "timestamp": t.isoformat(),
                "temperature": round(temp, 2),
                "humidity": round(65.0 if is_spike else 52.0, 1),
                "shock": 0.0,
                "speed": 40.0,
                "events": [],
                "y_true": 1 if is_spike else 0,
                "scenario": "spike",
            })

        # Shipment 3: Gradual upward drift (20 normal, 35 drift readings at +0.15C/min)
        # Drift starts at step 20; hard 8.0C breach occurs at step 44!
        for i in range(55):
            t = base_time + timedelta(minutes=i)
            if i < 20:
                temp = 4.5 + 0.2 * math.cos(i)
                is_anomaly = 0
                is_hard_breach = False
            else:
                drift_step = i - 20
                temp = 4.5 + drift_step * 0.15
                is_anomaly = 1 if drift_step >= 5 else 0 # Statistical drift detected early
                is_hard_breach = temp > 8.0

            dataset.append({
                "shipment_id": "ship_bench_drift",
                "step": i,
                "timestamp": t.isoformat(),
                "temperature": round(temp, 2),
                "humidity": round(55.0, 1),
                "shock": 0.0,
                "speed": 35.0,
                "events": [],
                "y_true": is_anomaly,
                "scenario": "slow_drift",
                "hard_breach": is_hard_breach,
            })

        # Shipment 4: Flat / copied sensor readings (20 normal, 15 identical pings)
        for i in range(35):
            t = base_time + timedelta(minutes=i)
            is_flat = i >= 20
            temp = 5.20 if is_flat else round(4.6 + 0.2 * math.sin(i), 2)
            hum = 60.0 if is_flat else round(52.0 + math.cos(i), 1)
            dataset.append({
                "shipment_id": "ship_bench_flat",
                "step": i,
                "timestamp": t.isoformat(),
                "temperature": temp,
                "humidity": hum,
                "shock": 0.0,
                "speed": 45.0,
                "events": [],
                "y_true": 1 if (is_flat and (i - 20) >= 4) else 0,
                "scenario": "flat_copied",
            })

        # Shipment 5: Planned door-open event (20 normal, 3 door-open readings)
        for i in range(25):
            t = base_time + timedelta(minutes=i)
            is_door_open = (15 <= i <= 17)
            temp = 8.5 if is_door_open else round(4.8 + 0.2 * math.sin(i), 2)
            ev = [{"type": "door_open", "magnitude": 1.0, "timestamp": t.isoformat()}] if is_door_open else []
            dataset.append({
                "shipment_id": "ship_bench_door",
                "step": i,
                "timestamp": t.isoformat(),
                "temperature": temp,
                "humidity": 65.0 if is_door_open else 52.0,
                "shock": 0.0,
                "speed": 0.0 if is_door_open else 40.0,
                "events": ev,
                "y_true": 0, # Known event downweighted: not an unexpected anomaly
                "scenario": "door_open",
            })

        return dataset

    def run_evaluation(self, dataset_name: str = "coldchain_synthetic_benchmark_v1") -> Dict[str, Any]:
        data = self.generate_benchmark_dataset()
        y_true = np.array([d["y_true"] for d in data])
        n_samples = len(data)

        # ----------------------------------------------------
        # 1. Evaluate Online Streaming Model (per-shipment instance)
        # ----------------------------------------------------
        learners: Dict[str, ShipmentLearner] = {}
        online_preds = []
        drift_first_alert_time: float = None
        drift_hard_breach_time: float = None

        for d in data:
            s_id = d["shipment_id"]
            if s_id not in learners:
                learners[s_id] = ShipmentLearner(
                    shipment_id=s_id,
                    profile={"temp_min_c": 2.0, "temp_max_c": 8.0, "ref_temp_c": 4.0},
                    warmup_samples=10,
                )
            learner = learners[s_id]

            reading = {
                "timestamp": d["timestamp"],
                "temperature": d["temperature"],
                "humidity": d["humidity"],
                "shock_events": [{"magnitude_g": d["shock"], "timestamp": d["timestamp"]}] if d["shock"] > 0 else [],
                "gps": {"speed": d["speed"]},
            }
            insights = learner.process_reading(reading, batch_id=f"bench_{d['step']}", events=d["events"])
            has_warning = any(ins["severity"] in ["warning", "critical"] for ins in insights)
            online_preds.append(1 if has_warning else 0)

            # Measure lead time during drift scenario
            if d.get("scenario") == "slow_drift":
                if has_warning and drift_first_alert_time is None:
                    drift_first_alert_time = d["step"] * 60.0
                if d.get("hard_breach") and drift_hard_breach_time is None:
                    drift_hard_breach_time = d["step"] * 60.0

        online_lead_time = 0.0
        if drift_first_alert_time is not None and drift_hard_breach_time is not None:
            online_lead_time = max(0.0, drift_hard_breach_time - drift_first_alert_time)

        # ----------------------------------------------------
        # 2. Evaluate Offline Scikit-Learn Isolation Forest
        # ----------------------------------------------------
        feature_matrix = np.array([
            [d["temperature"], d["humidity"], d["shock"], d["speed"]]
            for d in data
        ])

        # Train on normal baseline samples (first 50 samples)
        X_train = feature_matrix[:50]
        iso_forest = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
        iso_forest.fit(X_train)
        iso_raw = iso_forest.predict(feature_matrix)
        iso_preds = (iso_raw == -1).astype(int)

        # ----------------------------------------------------
        # 3. Evaluate Offline Scikit-Learn Local Outlier Factor
        # ----------------------------------------------------
        lof = LocalOutlierFactor(n_neighbors=20, contamination=0.1, novelty=True)
        lof.fit(X_train)
        lof_raw = lof.predict(feature_matrix)
        lof_preds = (lof_raw == -1).astype(int)

        # ----------------------------------------------------
        # Compute Performance Metrics Helper
        # ----------------------------------------------------
        def calculate_metrics(preds: np.ndarray, lead_time_sec: float) -> Dict[str, float]:
            tp = int(np.sum((preds == 1) & (y_true == 1)))
            fp = int(np.sum((preds == 1) & (y_true == 0)))
            fn = int(np.sum((preds == 0) & (y_true == 1)))
            tn = int(np.sum((preds == 0) & (y_true == 0)))

            precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
            far = fp / (fp + tn) if (fp + tn) > 0 else 0.0

            return {
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "false_alert_rate": round(far, 4),
                "avg_lead_time_seconds": round(lead_time_sec, 1),
            }

        online_metrics = calculate_metrics(np.array(online_preds), online_lead_time)
        iso_metrics = calculate_metrics(iso_preds, 0.0) # Offline batch has no streaming lead time
        lof_metrics = calculate_metrics(lof_preds, 0.0)

        # ----------------------------------------------------
        # Persist Runs into ai_evaluations Table
        # ----------------------------------------------------
        evaluations_to_save = [
            ("online_streaming_hst_cusum", online_metrics),
            ("offline_isolation_forest", iso_metrics),
            ("offline_local_outlier_factor", lof_metrics),
        ]

        now_iso = datetime.now(timezone.utc).isoformat()
        records_saved = []

        for model_name, m in evaluations_to_save:
            eval_record = {
                "evaluation_id": f"eval_{uuid.uuid4().hex[:16]}",
                "model_name": model_name,
                "model_version": MODEL_VERSION,
                "precision": m["precision"],
                "recall": m["recall"],
                "false_alert_rate": m["false_alert_rate"],
                "avg_lead_time_seconds": m["avg_lead_time_seconds"],
                "dataset_name": dataset_name,
                "created_at": now_iso,
                "label": ADVISORY_LABEL,
            }
            self.db.insert_evaluation(eval_record)
            records_saved.append(eval_record)

        return {
            "dataset_name": dataset_name,
            "total_samples": n_samples,
            "models": {
                "online_streaming_hst_cusum": online_metrics,
                "offline_isolation_forest": iso_metrics,
                "offline_local_outlier_factor": lof_metrics,
            },
            "evaluations": records_saved,
            "label": ADVISORY_LABEL,
        }
