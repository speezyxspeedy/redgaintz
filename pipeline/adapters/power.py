from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import requests

from pipeline.adapters.base import ProviderError, RawDataArtifact

DATASET_ID = "NASA_POWER_MERRA2_PRECTOTCORR_DAILY"
VARIABLE = "PRECTOTCORR"
DEFAULT_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily"
MAX_REQUEST_DAYS = 366


@dataclass(frozen=True)
class RegionalSeriesArtifact:
    payload: dict[str, Any]
    sha256: str
    metadata: dict[str, Any]
    source_artifacts: tuple[RawDataArtifact, ...]


def _date_param(value: date) -> str:
    return value.strftime("%Y%m%d")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _fetch(
    endpoint: str,
    params: dict[str, str],
    *,
    raw_dir: Path,
    session: requests.Session | None = None,
    timeout: tuple[float, float] = (10, 180),
    attempts: int = 4,
) -> RawDataArtifact:
    base_url = os.getenv("POWER_API_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    url = f"{base_url}/{endpoint}"
    client = session or requests.Session()
    response: requests.Response | None = None
    last_error: Exception | None = None

    for attempt in range(attempts):
        try:
            response = client.get(url, params=params, timeout=timeout)
            if response.status_code == 429 or response.status_code >= 500:
                if attempt + 1 < attempts:
                    time.sleep(2**attempt)
                    continue
            response.raise_for_status()
            break
        except requests.RequestException as exc:
            last_error = exc
            if attempt + 1 == attempts or (
                response is not None
                and response.status_code < 500
                and response.status_code != 429
            ):
                detail = (
                    response.text[:1000].strip()
                    if response is not None and response.text
                    else str(exc)
                )
                raise ProviderError(
                    f"NASA POWER request failed (HTTP "
                    f"{response.status_code if response is not None else 'unknown'}): "
                    f"{detail}"
                ) from exc
            time.sleep(2**attempt)
    else:
        raise ProviderError(f"NASA POWER request failed: {last_error}")

    if response is None:
        raise ProviderError("NASA POWER request did not return a response.")
    content = response.content
    checksum = _sha256(content)
    try:
        payload = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProviderError("NASA POWER returned invalid JSON.") from exc
    if not isinstance(payload, dict):
        raise ProviderError("NASA POWER returned an unsupported JSON response.")

    accessed_at = datetime.now(timezone.utc).isoformat()
    request_params = {key: value for key, value in params.items()}
    name = (
        f"NASA_POWER_{endpoint}_{request_params.get('start', 'unknown')}_"
        f"{request_params.get('end', 'unknown')}_{checksum[:12]}"
    )
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / f"{name}.json"
    sidecar_path = raw_dir / f"{name}.sidecar.json"
    raw_path.write_bytes(content)

    api_info = payload.get("header", {}).get("api", {})
    sources = payload.get("header", {}).get("sources", [])
    metadata = {
        "dataset_id": DATASET_ID,
        "provider": "NASA POWER",
        "dataset_version": f"POWER API {api_info.get('version', '[VERIFY]')}; source {','.join(sources) or '[VERIFY]'}",
        "variable": VARIABLE,
        "units": payload.get("parameters", {}).get(VARIABLE, {}).get("units", "[VERIFY]"),
        "accessed_at": accessed_at,
        "raw_sha256": checksum,
        "request_params": request_params,
        "request_url": response.url,
        "time_standard": payload.get("header", {}).get("time_standard"),
    }
    sidecar_path.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return RawDataArtifact(raw_path, sidecar_path, checksum, payload, metadata)


def fetch_region(
    start: date,
    end: date,
    bbox: tuple[float, float, float, float],
    *,
    raw_dir: Path,
    session: requests.Session | None = None,
) -> RawDataArtifact:
    if end < start:
        raise ValueError("NASA POWER end date must not precede start date.")
    if (end - start).days + 1 > MAX_REQUEST_DAYS:
        raise ValueError(
            f"NASA POWER regional requests are limited to {MAX_REQUEST_DAYS} days; "
            "use fetch_region_series for longer analyses."
        )
    west, south, east, north = bbox
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("NASA POWER regional bounds must be valid EPSG:4326 coordinates.")

    params = {
        "parameters": VARIABLE,
        "community": "AG",
        "longitude-min": f"{west:.6f}",
        "latitude-min": f"{south:.6f}",
        "longitude-max": f"{east:.6f}",
        "latitude-max": f"{north:.6f}",
        "start": _date_param(start),
        "end": _date_param(end),
        "format": "JSON",
        "time-standard": "UTC",
    }
    return _fetch("regional", params, raw_dir=raw_dir, session=session)


def fetch_region_series(
    start: date,
    end: date,
    bbox: tuple[float, float, float, float],
    *,
    raw_dir: Path,
    session: requests.Session | None = None,
) -> RegionalSeriesArtifact:
    from pipeline.validate import validate_power_payload

    if end < start:
        raise ValueError("NASA POWER end date must not precede start date.")

    chunks: list[RawDataArtifact] = []
    chunk_start = start
    while chunk_start <= end:
        chunk_end = min(
            end,
            date(chunk_start.year, 12, 31),
            date.fromordinal(chunk_start.toordinal() + MAX_REQUEST_DAYS - 1),
        )
        chunks.append(
            fetch_region(
                chunk_start,
                chunk_end,
                bbox,
                raw_dir=raw_dir,
                session=session,
            )
        )
        chunk_start = date.fromordinal(chunk_end.toordinal() + 1)

    first = chunks[0]
    validate_power_payload(first.payload)
    first_by_coordinate: dict[tuple[float, float], dict[str, Any]] = {}
    for feature in first.payload["features"]:
        coordinate = tuple(feature["geometry"]["coordinates"][:2])
        first_by_coordinate[coordinate] = {
            "geometry": feature["geometry"],
            "properties": {"parameter": {VARIABLE: {}}},
        }

    expected_coordinates = set(first_by_coordinate)
    versions = set()
    all_sources = []
    for chunk in chunks:
        validate_power_payload(chunk.payload)
        if chunk.payload["header"].get("fill_value") != first.payload["header"].get(
            "fill_value"
        ):
            raise ProviderError("NASA POWER changed fill values between time chunks.")
        if chunk.metadata["units"] != first.metadata["units"]:
            raise ProviderError("NASA POWER changed units between time chunks.")
        versions.add(chunk.metadata["dataset_version"])
        chunk_coordinates: set[tuple[float, float]] = set()
        for feature in chunk.payload["features"]:
            coordinate = tuple(feature["geometry"]["coordinates"][:2])
            chunk_coordinates.add(coordinate)
            target = first_by_coordinate.get(coordinate)
            if target is None:
                raise ProviderError(
                    "NASA POWER returned a different regional grid between time chunks."
                )
            target_values = target["properties"]["parameter"][VARIABLE]
            source_values = feature["properties"]["parameter"][VARIABLE]
            if target_values.keys() & source_values.keys():
                raise ProviderError(
                    "NASA POWER returned duplicate cell/date observations across chunks."
                )
            target_values.update(source_values)
        if chunk_coordinates != expected_coordinates:
            raise ProviderError(
                "NASA POWER returned incomplete regional grid cells between time chunks."
            )
        all_sources.append(
            {
                "file": chunk.raw_path.name,
                "sidecar": chunk.sidecar_path.name,
                "sha256": chunk.sha256,
                "request_params": chunk.metadata["request_params"],
                "accessed_at": chunk.metadata["accessed_at"],
            }
        )
    if len(versions) != 1:
        raise ProviderError("NASA POWER source/API version changed between time chunks.")

    payload = dict(first.payload)
    payload["header"] = {
        **first.payload["header"],
        "start": _date_param(start),
        "end": _date_param(end),
    }
    payload["features"] = [
        {
            "type": "Feature",
            "geometry": value["geometry"],
            "properties": value["properties"],
        }
        for _, value in sorted(first_by_coordinate.items())
    ]
    source_hashes = [chunk.sha256 for chunk in chunks]
    combined_sha256 = (
        source_hashes[0]
        if len(source_hashes) == 1
        else _sha256("".join(source_hashes).encode("ascii"))
    )
    metadata = {
        "dataset_id": DATASET_ID,
        "provider": "NASA POWER",
        "dataset_version": next(iter(versions)),
        "variable": VARIABLE,
        "units": first.metadata["units"],
        "accessed_at": max(chunk.metadata["accessed_at"] for chunk in chunks),
        "raw_sha256": combined_sha256,
        "raw_sha256_algorithm": (
            "single source-file SHA-256"
            if len(source_hashes) == 1
            else "SHA-256 of ordered source-file SHA-256 hex digests"
        ),
        "raw_sources": all_sources,
        "request_params": {
            "start": _date_param(start),
            "end": _date_param(end),
            "chunks": len(chunks),
        },
    }
    return RegionalSeriesArtifact(payload, combined_sha256, metadata, tuple(chunks))


def fetch_point(
    start: date,
    end: date,
    latitude: float,
    longitude: float,
    *,
    raw_dir: Path,
    session: requests.Session | None = None,
) -> RawDataArtifact:
    if end < start:
        raise ValueError("NASA POWER end date must not precede start date.")
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("NASA POWER point must be within EPSG:4326 coordinate bounds.")
    params = {
        "parameters": VARIABLE,
        "community": "AG",
        "longitude": f"{longitude:.6f}",
        "latitude": f"{latitude:.6f}",
        "start": _date_param(start),
        "end": _date_param(end),
        "format": "JSON",
        "time-standard": "UTC",
    }
    return _fetch("point", params, raw_dir=raw_dir, session=session)
