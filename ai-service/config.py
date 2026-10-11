import os

# Helper to automatically load environment variables from .env if present
def _load_env_file():
    candidates = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
    ]
    for env_path in candidates:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

_load_env_file()

DATABASE_URL_AI = os.environ.get(
    "DATABASE_URL_AI",
    "postgresql://ai_service_role:ai_service_password@localhost:5432/frostledger"
)
AI_SERVICE_PORT = int(os.environ.get("AI_SERVICE_PORT", 8000))
WARMUP_SAMPLES = int(os.environ.get("WARMUP_SAMPLES", 30))
CHECKPOINT_INTERVAL = int(os.environ.get("CHECKPOINT_INTERVAL", 5))
MODEL_VERSION = "v1.0.0"
ADVISORY_LABEL = "AI-generated, advisory"

# Google Gemini API configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
