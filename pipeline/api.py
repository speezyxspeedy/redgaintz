from __future__ import annotations

import json
import os
import re
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from requests import RequestException

from pipeline.adapters.base import ProviderError
from pipeline.boundaries import ROOT, load_region
from pipeline.run import BOUNDARY_VERSION, run_analysis

app = FastAPI(title="TERRASCAN API", version="0.1.0")
RUN_ID_PATTERN = re.compile(r"^run-\d{8}-[a-f0-9]{12}$")
ARTIFACTS_DIR = ROOT / "artifacts"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


class InvestigationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str
    boundary_version: str
    dataset_id: str
    variable: str
    start: date
    end: date
    aggregation: str = "annual_total"


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exception: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": "invalid_request",
            "message": "The investigation request does not match the API contract.",
            "details": {
                "issues": [
                    {
                        "location": [str(part) for part in error["loc"]],
                        "message": error["msg"],
                        "type": error["type"],
                    }
                    for error in exception.errors()
                ]
            },
        },
    )


@app.exception_handler(HTTPException)
async def http_error_handler(
    _request: Request, exception: HTTPException
) -> JSONResponse:
    detail = exception.detail
    if isinstance(detail, dict) and "error" in detail and "message" in detail:
        content = detail
    else:
        content = {
            "error": "http_error",
            "message": str(detail),
        }
    return JSONResponse(status_code=exception.status_code, content=content)


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/regions")
def regions() -> dict[str, Any]:
    registry = _read_json(ROOT / "config" / "regions.json")
    return {
        "boundary_version": registry["boundary_version"],
        "default_region_id": registry["default_region_id"],
        "regions": registry["regions"],
        "district_analysis_note": registry["district_analysis_note"],
    }


@app.get("/api/datasets")
def datasets() -> dict[str, Any]:
    registry = _read_json(ROOT / "config" / "datasets.json")
    return {
        "supported_dataset_id": registry["supported_dataset_id"],
        "datasets": registry["datasets"],
    }


@app.get("/api/investigations")
def investigations() -> dict[str, Any]:
    index = ARTIFACTS_DIR / "index.json"
    return _read_json(index) if index.exists() else {"runs": []}


@app.get("/api/investigations/{run_id}")
def investigation_result(run_id: str) -> dict[str, Any]:
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_run_id",
                "message": "Run ID has an invalid format.",
            },
        )
    path = ARTIFACTS_DIR / run_id / "result.json"
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Analysis run was not found."},
        )
    return _read_json(path)


@app.post("/api/investigations", status_code=201)
def create_investigation(request: InvestigationRequest) -> dict[str, Any]:
    dataset_registry = _read_json(ROOT / "config" / "datasets.json")
    dataset_id = dataset_registry["supported_dataset_id"]
    dataset = next(
        item
        for item in dataset_registry["datasets"]
        if item["dataset_id"] == dataset_id
    )
    if request.dataset_id != dataset_id or request.variable != dataset["variable"]:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unsupported_dataset",
                "message": "Only the verified NASA POWER rainfall dataset is enabled.",
            },
        )
    if request.boundary_version != BOUNDARY_VERSION:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unsupported_boundary_version",
                "message": "The requested boundary version is not supported.",
            },
        )
    if request.region_id != "IN-MH-VID":
        registry = _read_json(ROOT / "config" / "regions.json")
        known_districts = {
            district["region_id"]
            for region in registry["regions"]
            for district in region["districts"]
        }
        error = (
            {
                "error": "unsupported_region_scale",
                "message": "NASA POWER is too coarse for district-level analysis.",
            }
            if request.region_id in known_districts
            else {
                "error": "unsupported_region",
                "message": "The requested region ID is not in the registry.",
            }
        )
        raise HTTPException(status_code=422, detail=error)
    try:
        load_region(request.region_id, request.boundary_version)
    except ValueError as exception:
        raise HTTPException(
            status_code=422,
            detail={"error": "unsupported_region", "message": str(exception)},
        ) from exception
    try:
        return run_analysis(
            region_id=request.region_id,
            boundary_version=request.boundary_version,
            start=request.start,
            end=request.end,
            aggregation=request.aggregation,
        )
    except (RequestException, ProviderError) as exception:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "provider_unavailable",
                "message": f"NASA POWER request failed: {exception}",
            },
        ) from exception
    except ValueError as exception:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_analysis", "message": str(exception)},
        ) from exception
