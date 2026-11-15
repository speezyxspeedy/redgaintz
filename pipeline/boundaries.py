from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
REGIONS_PATH = ROOT / "config" / "regions.json"


class UnknownRegionError(ValueError):
    """A region ID or boundary version is not in the checked-in registry."""


def load_region(region_id: str, boundary_version: str) -> dict[str, Any]:
    registry = json.loads(REGIONS_PATH.read_text(encoding="utf-8"))
    region = next(
        (item for item in registry["regions"] if item["region_id"] == region_id),
        None,
    )
    if region is None:
        raise UnknownRegionError(f"Unknown registered region ID: {region_id}")
    if boundary_version != registry["boundary_version"]:
        raise UnknownRegionError(
            f"Unsupported boundary version {boundary_version!r}; "
            f"expected {registry['boundary_version']!r}."
        )
    path = ROOT / region["boundary_file"]
    feature = json.loads(path.read_text(encoding="utf-8"))
    geometry = feature.get("geometry")
    if not geometry:
        raise UnknownRegionError(f"Registered boundary file is invalid: {path.name}")
    return {
        "region_id": region["region_id"],
        "boundary_version": boundary_version,
        "name": region["name"],
        "level": region["level"],
        "geometry": geometry,
    }


def load_district_features() -> list[dict[str, Any]]:
    display = ROOT / "boundaries" / "IN-MH-VID.display.geojson"
    payload = json.loads(display.read_text(encoding="utf-8"))
    return [
        item
        for item in payload["features"]
        if item.get("properties", {}).get("level") == "district"
    ]


def validate_boundary_files() -> None:
    registry = json.loads(REGIONS_PATH.read_text(encoding="utf-8"))
    region = load_region(registry["default_region_id"], registry["boundary_version"])
    polygon = shape(region["geometry"])
    if polygon.is_empty or not polygon.is_valid:
        raise UnknownRegionError("The registered full Vidarbha boundary is invalid.")
