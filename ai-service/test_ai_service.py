import pytest
from main import app, ADVISORY_LABEL
from fastapi.testclient import TestClient

client = TestClient(app)

def test_health_check_advisory_label():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["label"] == ADVISORY_LABEL
    assert "timestamp" in data
