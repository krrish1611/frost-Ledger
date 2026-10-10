import os

DATABASE_URL_AI = os.environ.get(
    "DATABASE_URL_AI",
    "postgresql://ai_service_role:ai_service_password@localhost:5432/frostledger"
)
AI_SERVICE_PORT = int(os.environ.get("AI_SERVICE_PORT", 8000))
WARMUP_SAMPLES = int(os.environ.get("WARMUP_SAMPLES", 30))
CHECKPOINT_INTERVAL = int(os.environ.get("CHECKPOINT_INTERVAL", 5))
MODEL_VERSION = "v1.0.0"
ADVISORY_LABEL = "AI-generated, advisory"
