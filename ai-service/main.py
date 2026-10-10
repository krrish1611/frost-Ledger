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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=AI_SERVICE_PORT, reload=True)
