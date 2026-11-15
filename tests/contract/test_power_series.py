from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

import pipeline.adapters.power as power
from pipeline.adapters.base import ProviderError


def _chunk(start: str, end: str, values: dict[str, float], *, longitude: float = 78.0):
    payload = {
        "type": "FeatureCollection",
        "header": {
            "fill_value": -999,
            "start": start.replace("-", ""),
            "end": end.replace("-", ""),
        },
        "parameters": {"PRECTOTCORR": {"units": "mm/day"}},
        "features": [
            {
                "geometry": {"type": "Point", "coordinates": [longitude, 20.0]},
                "properties": {"parameter": {"PRECTOTCORR": values}},
            }
        ],
    }
    return SimpleNamespace(
        payload=payload,
        sha256=("a" if start.startswith("2020") else "b") * 64,
        raw_path=Path(f"{start}.json"),
        sidecar_path=Path(f"{start}.sidecar.json"),
        metadata={
            "dataset_version": "POWER API v2.10.3; source MERRA2",
            "units": "mm/day",
            "accessed_at": "2026-01-01T00:00:00+00:00",
            "request_params": {"start": start, "end": end},
        },
    )


def test_regional_series_splits_requests_and_merges_same_grid(monkeypatch, tmp_path) -> None:
    chunks = [
        _chunk("2020-12-30", "2020-12-31", {"20201230": 1.0, "20201231": 2.0}),
        _chunk("2021-01-01", "2021-01-02", {"20210101": 3.0, "20210102": 4.0}),
    ]
    requested = []

    def fake_fetch(start, end, bbox, *, raw_dir, session=None):
        requested.append((start, end))
        return chunks[len(requested) - 1]

    monkeypatch.setattr(power, "fetch_region", fake_fetch)
    result = power.fetch_region_series(
        date(2020, 12, 30),
        date(2021, 1, 2),
        (75.0, 18.0, 81.0, 22.0),
        raw_dir=tmp_path,
    )

    assert requested == [
        (date(2020, 12, 30), date(2020, 12, 31)),
        (date(2021, 1, 1), date(2021, 1, 2)),
    ]
    assert result.metadata["request_params"]["chunks"] == 2
    assert result.metadata["raw_sha256_algorithm"].startswith("SHA-256 of ordered")
    assert result.payload["features"][0]["properties"]["parameter"]["PRECTOTCORR"] == {
        "20201230": 1.0,
        "20201231": 2.0,
        "20210101": 3.0,
        "20210102": 4.0,
    }


def test_regional_series_rejects_grid_changes_between_chunks(monkeypatch, tmp_path) -> None:
    chunks = [
        _chunk("2020-12-30", "2020-12-31", {"20201230": 1.0}),
        _chunk(
            "2021-01-01",
            "2021-01-02",
            {"20210101": 3.0},
            longitude=79.0,
        ),
    ]
    calls = iter(chunks)
    monkeypatch.setattr(
        power, "fetch_region", lambda *args, **kwargs: next(calls)
    )

    with pytest.raises(ProviderError, match="different regional grid"):
        power.fetch_region_series(
            date(2020, 12, 30),
            date(2021, 1, 2),
            (75.0, 18.0, 81.0, 22.0),
            raw_dir=tmp_path,
        )
