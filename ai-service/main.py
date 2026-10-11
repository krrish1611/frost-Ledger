import os
import datetime
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import ADVISORY_LABEL, AI_SERVICE_PORT, MODEL_VERSION
from db import AiDatabaseClient
from service import AiService

db_client = AiDatabaseClient()
ai_service = AiService(db=db_client)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown: checkpoint all active model states
    ai_service.checkpoint_all()

app = FastAPI(
    title="FrostLedger AI Advisory Service",
    description="Online streaming ML anomaly detector and risk forecasting service. Advisory only.",
    version=MODEL_VERSION,
    lifespan=lifespan,
)

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    label: str

class InsightResponse(BaseModel):
    insight_id: str
    shipment_id: str
    kind: str
    score: float
    severity: str
    explanation: str
    input_ref: str
    warmup_status: str
    model_name: str
    model_version: str
    created_at: str
    label: str

class InsightsListResponse(BaseModel):
    shipment_id: str
    count: int
    label: str
    insights: List[InsightResponse]

class ProcessShipmentResponse(BaseModel):
    shipment_id: str
    new_insights_count: int
    label: str
    insights: List[Dict[str, Any]]

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        label=ADVISORY_LABEL,
    )

@app.get("/insights/{shipment_id}", response_model=InsightsListResponse)
def get_shipment_insights(shipment_id: str, limit: int = 50):
    rows = db_client.get_insights(shipment_id, limit=limit)
    insights = []
    for r in rows:
        insights.append(InsightResponse(
            insight_id=r["insight_id"],
            shipment_id=r["shipment_id"],
            kind=r["kind"],
            score=r["score"],
            severity=r["severity"],
            explanation=r["explanation"],
            input_ref=r["input_ref"],
            warmup_status=r["warmup_status"],
            model_name=r["model_name"],
            model_version=r["model_version"],
            created_at=str(r["created_at"]),
            label=ADVISORY_LABEL,
        ))

    return InsightsListResponse(
        shipment_id=shipment_id,
        count=len(insights),
        label=ADVISORY_LABEL,
        insights=insights,
    )

@app.post("/process/{shipment_id}", response_model=ProcessShipmentResponse)
def trigger_process_shipment(shipment_id: str):
    new_insights = ai_service.process_shipment(shipment_id)
    return ProcessShipmentResponse(
        shipment_id=shipment_id,
        new_insights_count=len(new_insights),
        label=ADVISORY_LABEL,
        insights=new_insights,
    )

@app.post("/process-all")
def trigger_process_all():
    results = ai_service.process_all_active()
    total_insights = sum(len(ins) for ins in results.values())
    return {
        "status": "completed",
        "shipments_processed": len(results),
        "total_insights_emitted": total_insights,
        "label": ADVISORY_LABEL,
    }

class RiskFactors(BaseModel):
    thermal_risk: float
    anomaly_risk: float
    drift_risk: float
    kinetics_risk: float
    security_penalty: float

class RiskResponse(BaseModel):
    shipment_id: str
    composite_score: float
    tier: str
    factors: RiskFactors
    explanation: str
    recommendation: str
    evaluated_at: str
    label: str

class NotificationItem(BaseModel):
    notification_id: str
    insight_id: str
    shipment_id: str
    sent_at: str
    status: str
    reason: Optional[str] = None
    label: str

class NotificationsListResponse(BaseModel):
    shipment_id: str
    count: int
    label: str
    notifications: List[NotificationItem]

@app.get("/risk/{shipment_id}", response_model=RiskResponse)
def get_shipment_risk(shipment_id: str):
    data = ai_service.calculate_current_risk(shipment_id)
    return RiskResponse(
        shipment_id=data["shipment_id"],
        composite_score=data["composite_score"],
        tier=data["tier"],
        factors=RiskFactors(**data["factors"]),
        explanation=data["explanation"],
        recommendation=data["recommendation"],
        evaluated_at=data["evaluated_at"],
        label=ADVISORY_LABEL,
    )

@app.get("/notifications/{shipment_id}", response_model=NotificationsListResponse)
def get_shipment_notifications(shipment_id: str, limit: int = 50):
    rows = db_client.get_notifications(shipment_id, limit=limit)
    items = []
    for r in rows:
        items.append(NotificationItem(
            notification_id=r["notification_id"],
            insight_id=r["insight_id"],
            shipment_id=r["shipment_id"],
            sent_at=str(r["sent_at"]),
            status=r["status"],
            reason=r.get("reason"),
            label=ADVISORY_LABEL,
        ))
    return NotificationsListResponse(
        shipment_id=shipment_id,
        count=len(items),
        label=ADVISORY_LABEL,
        notifications=items,
    )

@app.post("/checkpoint")
def trigger_checkpoint():
    ai_service.checkpoint_all()
    return {
        "status": "checkpointed",
        "label": ADVISORY_LABEL,
    }

from evaluator import OfflineMlEvaluator
evaluator = OfflineMlEvaluator(db=db_client)

class EvaluationRecord(BaseModel):
    evaluation_id: str
    model_name: str
    model_version: str
    precision: float
    recall: float
    false_alert_rate: float
    avg_lead_time_seconds: float
    dataset_name: str
    created_at: str
    label: str

class EvaluationsListResponse(BaseModel):
    count: int
    label: str
    evaluations: List[EvaluationRecord]

@app.post("/evaluate")
def trigger_offline_evaluation(dataset_name: Optional[str] = "coldchain_synthetic_benchmark_v1"):
    results = evaluator.run_evaluation(dataset_name=dataset_name or "coldchain_synthetic_benchmark_v1")
    return results

@app.get("/evaluations", response_model=EvaluationsListResponse)
def get_evaluations(limit: int = 50):
    rows = db_client.get_evaluations(limit=limit)
    items = []
    for r in rows:
        items.append(EvaluationRecord(
            evaluation_id=r["evaluation_id"],
            model_name=r["model_name"],
            model_version=r["model_version"],
            precision=float(r["precision"]),
            recall=float(r["recall"]),
            false_alert_rate=float(r["false_alert_rate"]),
            avg_lead_time_seconds=float(r["avg_lead_time_seconds"]),
            dataset_name=r["dataset_name"],
            created_at=str(r["created_at"]),
            label=ADVISORY_LABEL,
        ))
    return EvaluationsListResponse(
        count=len(items),
        label=ADVISORY_LABEL,
        evaluations=items,
    )

import json

@app.get("/models/cargo")
def get_cargo_models_metadata():
    """
    Returns metadata, training metrics, and biological constraints for both
    specialized AI models: Vaccine/Biologics and Fresh Produce (Fruits & Vegetables).
    """
    trained_dir = os.path.join(os.path.dirname(__file__), "models", "trained")
    summary_path = os.path.join(trained_dir, "training_summary.json")
    if os.path.exists(summary_path):
        with open(summary_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["label"] = ADVISORY_LABEL
            return data
    return {
        "status": "not_trained",
        "message": "Run /train/cargo or python train_cargo_models.py to train models.",
        "label": ADVISORY_LABEL,
    }

@app.post("/train/cargo")
def trigger_cargo_models_training():
    """
    Triggers separate retraining for both Vaccine and Produce AI models.
    """
    from train_cargo_models import train_and_evaluate
    summary = train_and_evaluate()
    return {
        "status": "completed",
        "label": ADVISORY_LABEL,
        "summary": summary,
    }

from gemini_analyzer import GeminiRootCauseAnalyzer

gemini_analyzer = GeminiRootCauseAnalyzer()

class DiagnoseRequest(BaseModel):
    cargo_type: Optional[str] = "pharma-vaccine"
    profile_name: Optional[str] = "Cold Chain Cargo"
    temp_min_c: Optional[float] = 2.0
    temp_max_c: Optional[float] = 8.0
    current_temp: Optional[float] = 4.2
    current_humidity: Optional[float] = 50.0
    anomaly_kind: Optional[str] = "thermal_excursion_high"
    anomaly_score: Optional[float] = 0.85
    severity: Optional[str] = "warning"
    recent_readings: Optional[List[Dict[str, Any]]] = None

@app.api_route("/diagnose/{shipment_id}", methods=["GET", "POST"])
def get_gemini_diagnosis(shipment_id: str, payload: Optional[DiagnoseRequest] = None):
    """
    Invokes Google Gemini to diagnose an anomaly/incident on a cold chain shipment.
    Strictly advisory.
    """
    if payload is None:
        payload = DiagnoseRequest()
    return gemini_analyzer.diagnose_excursion(
        shipment_id=shipment_id,
        cargo_type=payload.cargo_type or "pharma-vaccine",
        profile_name=payload.profile_name or "Cold Chain Cargo",
        temp_min_c=payload.temp_min_c if payload.temp_min_c is not None else 2.0,
        temp_max_c=payload.temp_max_c if payload.temp_max_c is not None else 8.0,
        current_temp=payload.current_temp if payload.current_temp is not None else 4.2,
        current_humidity=payload.current_humidity if payload.current_humidity is not None else 50.0,
        anomaly_kind=payload.anomaly_kind or "thermal_excursion_high",
        anomaly_score=payload.anomaly_score if payload.anomaly_score is not None else 0.85,
        severity=payload.severity or "warning",
        recent_readings=payload.recent_readings,
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=AI_SERVICE_PORT, reload=True)
