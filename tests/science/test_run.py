import hashlib
import json
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace

from shapely.geometry import mapping, Polygon

import pipeline.run as analysis_run


def _daily_payload(start_year: int, end_year: int) -> dict:
    dates: dict[str, float] = {}
    for year in range(start_year, end_year + 1):
        day = date(year, 1, 1)
        end = date(year + 1, 1, 1)
        while day < end:
            dates[day.strftime("%Y%m%d")] = float(year - start_year + 1)
            day += timedelta(days=1)
    return {
        "type": "FeatureCollection",
        "header": {
            "fill_value": -999,
            "api": {"version": "v2.10.3"},
            "sources": ["MERRA2"],
        },
        "parameters": {"PRECTOTCORR": {"units": "mm/day"}},
        "features": [
            {
                "geometry": {"type": "Point", "coordinates": [0.5, 0.5]},
                "properties": {"parameter": {"PRECTOTCORR": dates}},
            }
        ],
    }


def test_run_analysis_validates_and_persists_a_provenance_complete_result(
    tmp_path: Path, monkeypatch
) -> None:
    raw_bytes = b"real-response-placeholder-for-tested-pipeline"
    payload = _daily_payload(2001, 2024)
    accessed_at = "2026-01-01T00:00:00+00:00"
    request_params = {"start": "20010101", "end": "20241231"}
    artifact = SimpleNamespace(
        sha256=hashlib.sha256(raw_bytes).hexdigest(),
        payload=payload,
        metadata={
            "dataset_version": "POWER API v2.10.3; source MERRA2",
            "accessed_at": accessed_at,
            "request_params": request_params,
            "raw_sha256_algorithm": "single source-file SHA-256",
            "raw_sources": [
                {
                    "file": "response.json",
                    "sidecar": "response.sidecar.json",
                    "sha256": hashlib.sha256(raw_bytes).hexdigest(),
                    "request_params": request_params,
                    "accessed_at": accessed_at,
                }
            ],
        },
    )
    polygon = mapping(Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]))
    monkeypatch.setattr(
        analysis_run,
        "load_region",
        lambda *_args: {
            "region_id": "IN-MH-VID",
            "boundary_version": analysis_run.BOUNDARY_VERSION,
            "name": "Vidarbha",
            "level": "region",
            "geometry": polygon,
        },
    )
    monkeypatch.setattr(
        analysis_run,
        "fetch_region_series",
        lambda *args, **kwargs: artifact,
    )

    result = analysis_run.run_analysis(
        region_id="IN-MH-VID",
        boundary_version=analysis_run.BOUNDARY_VERSION,
        start=date(2001, 1, 1),
        end=date(2024, 12, 31),
        raw_dir=tmp_path / "raw",
        artifacts_dir=tmp_path / "artifacts",
    )

    result_path = (
        tmp_path / "artifacts" / result["run_id"] / "result.json"
    )
    index = json.loads((tmp_path / "artifacts" / "index.json").read_text())
    assert result_path.is_file()
    assert result["provenance"]["data_origin"] == "live"
    assert result["provenance"]["raw_sha256"] == artifact.sha256
    assert result["trend"]["direction"] == "increasing"
    assert index["runs"][0]["run_id"] == result["run_id"]
