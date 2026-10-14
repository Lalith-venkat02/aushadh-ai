import pytest
from fastapi.testclient import TestClient
from main import app, find_alternatives

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_alternatives_matcher():
    # Test that catalog matching logic works
    result = find_alternatives("Atorvastatin 10mg")
    assert result is not None
    assert "best_alternative" in result
    assert "cheapest_alternative" in result