from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from pipeline.adapters.power import DATASET_ID, VARIABLE, fetch_region_series
from pipeline.aggregate import aggregate_periods
from pipeline.boundaries import load_region
from pipeline.mask import region_daily_mean
from pipeline.normalise import normalise_power_payload
from pipeline.trend import mann_kendall_sen

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
ARTIFACTS_DIR = ROOT / "artifacts"
BOUNDARY_VERSION = "geoBoundaries-IND-ADM2-76128533-2023-01-19"
MIN_TREND_OBSERVATIONS = 24
DATASET_VERSION_FALLBACK = "NASA POWER Daily API; MERRA-2 source"


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, allow_nan=False, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _code_git_sha() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    value = result.stdout.strip()
    return value if len(value) in {40, 64} else None


def _validate_result(result: dict[str, Any]) -> None:
    schema = _read_json(ROOT / "schemas" / "analysis_result.schema.json")
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(result)


def _validate_run_metadata(metadata: dict[str, Any]) -> None:
    schema = _read_json(ROOT / "schemas" / "analysis_run.schema.json")
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(metadata)


def run_analysis(
    *,
    region_id: str,
    boundary_version: str,
    start: date,
    end: date,
    aggregation: str = "annual_total",
    raw_dir: Path = RAW_DIR,
    artifacts_dir: Path = ARTIFACTS_DIR,
) -> dict[str, Any]:
    if region_id != "IN-MH-VID":
        raise ValueError("The supported NASA POWER dataset is region-scale only.")
    if start.year < 1981 or end > date.today() or end < start:
        raise ValueError("NASA POWER analysis dates must be between 1981 and today.")
    if start != date(start.year, 1, 1) or end != date(end.year, 12, 31):
        raise ValueError("Select complete calendar years for annual or JJAS analysis.")
    if aggregation not in {"annual_total", "jjas_total"}:
        raise ValueError(f"Unsupported aggregation: {aggregation}")

    region = load_region(region_id, boundary_version)
    from shapely.geometry import shape

    polygon = shape(region["geometry"])
    artifact = fetch_region_series(start, end, polygon.bounds, raw_dir=raw_dir)
    normalized = normalise_power_payload(artifact.payload)
    daily = region_daily_mean(normalized, region["geometry"])
    observations = aggregate_periods(
        daily, start, end, aggregation=aggregation, minimum_completeness=0.8
    )

    valid = [item for item in observations if item["value"] is not None]
    trend = None
    if len(valid) >= MIN_TREND_OBSERVATIONS:
        trend = mann_kendall_sen(
            [item["time"] for item in observations],
            [item["value"] for item in observations],
        )
    else:
        trend = {
            "status": "insufficient_data",
            "sample_count": len(valid),
            "required_observations": MIN_TREND_OBSERVATIONS,
            "message": (
                "At least 24 complete annual/seasonal observations are required "
                "for the trend test."
            ),
        }

    dataset_version = artifact.metadata.get(
        "dataset_version", DATASET_VERSION_FALLBACK
    )
    identity = "|".join(
        [
            artifact.sha256,
            region_id,
            boundary_version,
            DATASET_ID,
            start.isoformat(),
            end.isoformat(),
            aggregation,
        ]
    )
    run_suffix = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:12]
    run_id = f"run-{datetime.now(timezone.utc):%Y%m%d}-{run_suffix}"
    code_sha = _code_git_sha()
    metadata = {
        "run_id": run_id,
        "dataset_id": DATASET_ID,
        "dataset_version": dataset_version,
        "access_date": artifact.metadata["accessed_at"],
        "data_origin": "live",
        "raw_sha256": artifact.sha256,
        "raw_sha256_algorithm": artifact.metadata["raw_sha256_algorithm"],
        "raw_sources": artifact.metadata["raw_sources"],
        "code_git_sha": code_sha,
        "request_params": artifact.metadata["request_params"],
    }
    _validate_run_metadata(metadata)
    units = "mm/year" if aggregation == "annual_total" else "mm"
    result = {
        "run_id": run_id,
        "region_id": region_id,
        "boundary_version": boundary_version,
        "dataset_id": DATASET_ID,
        "dataset_version": dataset_version,
        "variable": VARIABLE,
        "units": units,
        "aggregation": aggregation,
        "observations": observations,
        "trend": trend,
        "findings": (
            "A statistically significant increasing trend was detected."
            if trend.get("direction") == "increasing"
            else "A statistically significant decreasing trend was detected."
            if trend.get("direction") == "decreasing"
            else "No statistically significant trend was detected."
            if trend.get("direction") == "no_significant_trend"
            else "There is insufficient complete data to test a trend."
        ),
        "provenance": {
            **metadata,
            "raw_units": "mm/day",
            "temporal_completeness_threshold": 0.8,
            "spatial_method": daily["spatial_method"],
            "grid_cells_in_region": daily["cell_count_total"],
            "extreme_observation_count": normalized["extreme_observation_count"],
            "data_quality_warnings": normalized["warnings"],
            "source": "NASA POWER Daily Regional API, source MERRA-2",
        },
        "limitations": [
            "NASA POWER's approximately 0.5 degree by 0.625 degree grid is regional scale and cannot support district-level conclusions.",
            "Spatial averages use grid-cell centers covered by the full polygon with cosine(latitude) weights; fractional cell overlap is not computed.",
            "Annual and JJAS values are sums of valid daily precipitation rates; periods below 80% daily completeness remain null.",
            "The Mann-Kendall p-value is not modified for autocorrelation; inspect the reported lag-1 diagnostic.",
            "A statistical trend does not establish cause or predict future conditions.",
        ],
        "attribution": [
            "NASA POWER Daily Regional API; source MERRA-2. Data access date and raw checksum are included in provenance.",
            "Vidarbha district boundaries: geoBoundaries gbOpen India ADM2, ODbL 1.0; see boundaries/boundary-manifest.json.",
        ],
    }
    _validate_result(result)

    run_directory = artifacts_dir / run_id
    _write_json(run_directory / "run.json", metadata)
    _write_json(run_directory / "result.json", result)
    index_path = artifacts_dir / "index.json"
    index = _read_json(index_path) if index_path.exists() else {"runs": []}
    runs = [entry for entry in index.get("runs", []) if entry.get("run_id") != run_id]
    runs.insert(
        0,
        {
            "run_id": run_id,
            "result": f"{run_id}/result.json",
            "region_id": region_id,
            "boundary_version": boundary_version,
            "dataset_id": DATASET_ID,
            "access_date": metadata["access_date"],
            "data_origin": "live",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "aggregation": aggregation,
        },
    )
    _write_json(index_path, {"runs": runs})
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Run real NASA POWER Vidarbha trend analysis.")
    parser.add_argument("--region", default="IN-MH-VID")
    parser.add_argument("--start-year", type=int, default=2001)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--aggregation", choices=["annual_total", "jjas_total"], default="annual_total")
    args = parser.parse_args()
    result = run_analysis(
        region_id=args.region,
        boundary_version=BOUNDARY_VERSION,
        start=date(args.start_year, 1, 1),
        end=date(args.end_year, 12, 31),
        aggregation=args.aggregation,
    )
    print(
        json.dumps(
            {
                "run_id": result["run_id"],
                "run_path": f"artifacts/{result['run_id']}/result.json",
                "data_origin": result["provenance"]["data_origin"],
                "raw_sha256": result["provenance"]["raw_sha256"],
                "trend": result["trend"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
