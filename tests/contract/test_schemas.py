import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = ROOT / "schemas"
BOUNDARY_VERSION = "geoBoundaries-IND-ADM2-76128533-2023-01-19"
DATASET_ID = "NASA_POWER_MERRA2_PRECTOTCORR_DAILY"


def test_contract_schemas_validate_their_examples() -> None:
    examples = {
        "study_region.schema.json": {
            "region_id": "IN-MH-VID",
            "boundary_version": BOUNDARY_VERSION,
            "name": "Vidarbha",
            "level": "region",
        },
        "dataset.schema.json": {
            "dataset_id": DATASET_ID,
            "name": "NASA POWER daily corrected precipitation",
            "provider": "NASA POWER",
            "version": "POWER API v2.10.3; source MERRA2",
            "variable": "PRECTOTCORR",
            "units": "mm/day",
            "temporal_resolution": "daily",
            "spatial_resolution": "regional grid",
            "verified": True,
        },
        "investigation_request.schema.json": {
            "region_id": "IN-MH-VID",
            "boundary_version": BOUNDARY_VERSION,
            "dataset_id": DATASET_ID,
            "variable": "PRECTOTCORR",
            "start": "2001-01-01",
            "end": "2024-12-31",
            "aggregation": "annual_total",
        },
        "analysis_run.schema.json": {
            "run_id": "run-20260101-012345abcdef",
            "dataset_id": DATASET_ID,
            "dataset_version": "POWER API v2.10.3; source MERRA2",
            "access_date": "2026-01-01T00:00:00+00:00",
            "data_origin": "live",
            "raw_sha256": "a" * 64,
            "code_git_sha": None,
            "request_params": {},
        },
        "analysis_result.schema.json": {
            "run_id": "run-20260101-012345abcdef",
            "region_id": "IN-MH-VID",
            "boundary_version": BOUNDARY_VERSION,
            "dataset_id": DATASET_ID,
            "dataset_version": "POWER API v2.10.3; source MERRA2",
            "variable": "PRECTOTCORR",
            "units": "mm/year",
            "aggregation": "annual_total",
            "observations": [
                {"time": 2024, "value": None, "valid_fraction": 0.4, "cell_count": 0}
            ],
            "trend": None,
            "provenance": {
                "run_id": "run-20260101-012345abcdef",
                "dataset_id": DATASET_ID,
                "dataset_version": "POWER API v2.10.3; source MERRA2",
                "access_date": "2026-01-01T00:00:00+00:00",
                "data_origin": "live",
                "raw_sha256": "a" * 64,
                "raw_sha256_algorithm": "single source-file SHA-256",
                "raw_sources": [
                    {
                        "file": "NASA_POWER_regional_20240101_20241231.json",
                        "sidecar": "NASA_POWER_regional_20240101_20241231.sidecar.json",
                        "sha256": "a" * 64,
                        "request_params": {},
                        "accessed_at": "2026-01-01T00:00:00+00:00",
                    }
                ],
                "code_git_sha": None,
                "request_params": {},
            },
            "limitations": [],
            "attribution": [],
        },
        "error.schema.json": {
            "error": "invalid_request",
            "message": "The request does not match the API contract.",
        },
    }

    for schema_name, example in examples.items():
        schema = json.loads((SCHEMAS / schema_name).read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(
            schema, format_checker=FormatChecker()
        ).validate(example)


def test_bundled_real_result_matches_result_and_run_contracts() -> None:
    index = json.loads((ROOT / "artifacts" / "index.json").read_text())
    run = index["runs"][0]
    result = json.loads(
        (ROOT / "artifacts" / run["result"]).read_text(encoding="utf-8")
    )
    run_metadata = json.loads(
        (
            ROOT
            / "artifacts"
            / run["run_id"]
            / "run.json"
        ).read_text(encoding="utf-8")
    )
    result_schema = json.loads(
        (SCHEMAS / "analysis_result.schema.json").read_text(encoding="utf-8")
    )
    run_schema = json.loads(
        (SCHEMAS / "analysis_run.schema.json").read_text(encoding="utf-8")
    )

    Draft202012Validator(
        result_schema, format_checker=FormatChecker()
    ).validate(result)
    Draft202012Validator(run_schema, format_checker=FormatChecker()).validate(
        run_metadata
    )
