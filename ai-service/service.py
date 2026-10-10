import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid

from config import MODEL_VERSION, CHECKPOINT_INTERVAL, ADVISORY_LABEL
from db import AiDatabaseClient
from learner import ShipmentLearner
from risk_scorer import CompositeRiskScorer
from notifier import NotificationService

logger = logging.getLogger("ai_service")

class AiService:
    """
    Core AI Engine Service coordinating streaming inference, composite risk scoring,
    state persistence, and notification dispatch.
    Operates strictly in advisory mode.
    """

    def __init__(self, db: Optional[AiDatabaseClient] = None):
        self.db = db or AiDatabaseClient()
        self.learners: Dict[str, ShipmentLearner] = {}
        self.notifier = NotificationService(db=self.db)

    def get_or_load_learner(
        self,
        shipment_id: str,
        profile: Optional[Dict[str, Any]] = None,
        warmup_samples: Optional[int] = None,
    ) -> ShipmentLearner:
        """
        Retrieves in-memory learner or restores from ai_model_state checkpoint.
        """
        if shipment_id in self.learners:
            return self.learners[shipment_id]

        saved = self.db.get_model_state(shipment_id, MODEL_VERSION)
        if saved and saved.get("state"):
            state_data = saved["state"]
            if isinstance(state_data, str):
                import json
                state_data = json.loads(state_data)
            learner = ShipmentLearner.from_dict(state_data)
            logger.info(f"Restored learner state for shipment {shipment_id} (count: {learner.sample_count})")
        else:
            kwargs = {}
            if warmup_samples is not None:
                kwargs["warmup_samples"] = warmup_samples
            learner = ShipmentLearner(shipment_id, profile=profile, **kwargs)
            logger.info(f"Initialized new learner for shipment {shipment_id}")

        self.learners[shipment_id] = learner
        return learner

    def calculate_current_risk(self, shipment_id: str) -> Dict[str, Any]:
        """
        Calculates composite risk score and factors breakdown for a shipment.
        """
        learner = self.get_or_load_learner(shipment_id)
        current_temp = learner.rate_of_change.last_temp
        if current_temp is None:
            # Fallback to center of profile
            current_temp = (learner.profile.get("temp_min_c", 2.0) + learner.profile.get("temp_max_c", 8.0)) / 2.0

        # Check latest HST score
        hst_score = 0.0
        if learner.rate_of_change.last_humidity is not None:
            hst_features = {
                "temperature": current_temp,
                "humidity": learner.rate_of_change.last_humidity,
                "shock": 0.0,
                "speed": 0.0,
            }
            hst_score = learner.hst.model.score_one(hst_features)

        cusum_stat = max(learner.temp_cusum.s_pos, learner.temp_cusum.s_neg)
        cusum_h = learner.temp_cusum.h
        is_flat = False
        if len(learner.rules.recent_temps) >= learner.rules.flat_window_size:
            is_flat = (max(learner.rules.recent_temps) - min(learner.rules.recent_temps)) < 1e-4

        risk_data = CompositeRiskScorer.calculate_risk(
            current_temp=current_temp,
            profile=learner.profile,
            hst_score=hst_score,
            cusum_stat=cusum_stat,
            cusum_h=cusum_h,
            is_flat_copied=is_flat,
        )
        risk_data["shipment_id"] = shipment_id
        risk_data["evaluated_at"] = datetime.now(timezone.utc).isoformat()
        return risk_data

    def process_shipment(
        self,
        shipment_id: str,
        profile: Optional[Dict[str, Any]] = None,
        warmup_samples: Optional[int] = None,
        shipment_info: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Processes all unprocessed batches for a shipment, emitting advisory insights
        and dispatching notifications.
        """
        learner = self.get_or_load_learner(shipment_id, profile=profile, warmup_samples=warmup_samples)

        if shipment_info is None:
            shipment_info = {"shipment_id": shipment_id, "ai_email_enabled": True}

        batches = self.db.get_shipment_batches(shipment_id)
        events = self.db.get_shipment_events(shipment_id)

        if learner.last_batch_id:
            batch_ids = [b["batch_id"] for b in batches]
            if learner.last_batch_id in batch_ids:
                idx = batch_ids.index(learner.last_batch_id)
                batches = batches[idx + 1:]

        new_insights: List[Dict[str, Any]] = []
        batch_counter = 0

        for batch in batches:
            batch_id = batch["batch_id"]
            payload = batch.get("payload", {})
            readings = payload.get("readings", [])

            for reading in readings:
                insights = learner.process_reading(reading, batch_id=batch_id, events=events)

                # If active, evaluate composite risk score
                if learner.warmup_status == "active":
                    risk_assessment = self.calculate_current_risk(shipment_id)
                    if risk_assessment["composite_score"] >= 50.0:
                        severity = "critical" if risk_assessment["tier"] == "CRITICAL" else "warning"
                        risk_insight = {
                            "insight_id": f"ins_{uuid.uuid4().hex[:16]}",
                            "shipment_id": shipment_id,
                            "kind": "risk",
                            "score": round(risk_assessment["composite_score"] / 100.0, 4),
                            "severity": severity,
                            "explanation": f"Elevated Composite Risk ({risk_assessment['tier']}): {risk_assessment['explanation']}",
                            "input_ref": batch_id,
                            "warmup_status": "active",
                            "model_name": "composite_risk_scorer",
                            "model_version": MODEL_VERSION,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "label": ADVISORY_LABEL,
                        }
                        insights.append(risk_insight)

                for ins in insights:
                    self.db.insert_insight(ins)
                    new_insights.append(ins)
                    # Trigger notification dispatch evaluation
                    self.notifier.dispatch_notification(ins, shipment_info)

            batch_counter += 1
            if batch_counter % CHECKPOINT_INTERVAL == 0:
                self.db.save_model_state(
                    shipment_id,
                    MODEL_VERSION,
                    learner.to_dict(),
                    last_batch_id=batch_id,
                )

        if batches:
            last_processed_id = batches[-1]["batch_id"]
            self.db.save_model_state(
                shipment_id,
                MODEL_VERSION,
                learner.to_dict(),
                last_batch_id=last_processed_id,
            )

        return new_insights

    def process_all_active(self) -> Dict[str, List[Dict[str, Any]]]:
        active_shipments = self.db.get_active_shipments()
        results: Dict[str, List[Dict[str, Any]]] = {}

        for s in active_shipments:
            s_id = s["shipment_id"]
            prof = s.get("parameters", {})
            insights = self.process_shipment(s_id, profile=prof, shipment_info=s)
            results[s_id] = insights

        return results

    def checkpoint_all(self):
        for shipment_id, learner in self.learners.items():
            self.db.save_model_state(
                shipment_id,
                MODEL_VERSION,
                learner.to_dict(),
                last_batch_id=learner.last_batch_id,
            )
        logger.info(f"Checkpointed {len(self.learners)} active shipment learners.")
