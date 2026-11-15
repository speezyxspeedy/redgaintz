from datetime import date

from fastapi.testclient import TestClient

from pipeline.api import app

client = TestClient(app)


def test_api_serves_verified_registry_and_empty_or_cached_index() -> None:
    datasets = client.get("/api/datasets")
    runs = client.get("/api/investigations")

    assert datasets.status_code == 200
    assert datasets.json()["supported_dataset_id"] == (
        "NASA_POWER_MERRA2_PRECTOTCORR_DAILY"
    )
    assert runs.status_code == 200
    assert isinstance(runs.json()["runs"], list)


def test_api_rejects_geometry_and_unverified_dataset() -> None:
    response = client.post(
        "/api/investigations",
        json={
            "region_id": "IN-MH-VID",
            "boundary_version": "geoBoundaries-IND-ADM2-76128533-2023-01-19",
            "dataset_id": "unverified",
            "variable": "PRECTOTCORR",
            "start": "2001-01-01",
            "end": "2024-12-31",
            "geometry": {"type": "Polygon", "coordinates": []},
        },
    )

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_request"

    unsupported = client.post(
        "/api/investigations",
        json={
            "region_id": "IN-MH-VID-AKO",
            "boundary_version": "geoBoundaries-IND-ADM2-76128533-2023-01-19",
            "dataset_id": "NASA_POWER_MERRA2_PRECTOTCORR_DAILY",
            "variable": "PRECTOTCORR",
            "start": "2001-01-01",
            "end": "2024-12-31",
        },
    )
    assert unsupported.status_code == 422
    assert unsupported.json()["error"] == "unsupported_region_scale"


def test_api_accepts_registered_region_contract_without_geometry(monkeypatch) -> None:
    calls = []

    def fake_run_analysis(**kwargs):
        calls.append(kwargs)
        return {"run_id": "run-20260101-012345abcdef"}

    monkeypatch.setattr("pipeline.api.run_analysis", fake_run_analysis)
    response = client.post(
        "/api/investigations",
        json={
            "region_id": "IN-MH-VID",
            "boundary_version": "geoBoundaries-IND-ADM2-76128533-2023-01-19",
            "dataset_id": "NASA_POWER_MERRA2_PRECTOTCORR_DAILY",
            "variable": "PRECTOTCORR",
            "start": "2001-01-01",
            "end": "2025-12-31",
            "aggregation": "annual_total",
        },
    )

    assert response.status_code == 201
    assert calls == [
        {
            "region_id": "IN-MH-VID",
            "boundary_version": "geoBoundaries-IND-ADM2-76128533-2023-01-19",
            "start": date(2001, 1, 1),
            "end": date(2025, 12, 31),
            "aggregation": "annual_total",
        }
    ]
