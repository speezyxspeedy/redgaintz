from __future__ import annotations

import math
from typing import Any

from shapely.geometry import Point, shape


class SpatialMaskError(ValueError):
    """The registered study polygon cannot be matched to provider cells."""


def region_daily_mean(
    normalized: dict[str, Any],
    region_geometry: dict[str, Any],
    *,
    minimum_cell_fraction: float = 0.8,
) -> dict[str, Any]:
    polygon = shape(region_geometry)
    if polygon.is_empty or not polygon.is_valid:
        raise SpatialMaskError("Registered full-resolution region geometry is invalid.")

    selected = []
    for cell in normalized["cells"]:
        point = Point(cell["longitude"], cell["latitude"])
        if polygon.covers(point):
            weight = math.cos(math.radians(cell["latitude"]))
            if weight > 0:
                selected.append((cell, weight))
    if not selected:
        raise SpatialMaskError(
            "NASA POWER returned no grid-cell centers inside the registered region."
        )

    days = sorted(
        {
            day
            for cell, _ in selected
            for day in cell["values"]
        }
    )
    observations = []
    for day in days:
        valid = [
            (cell["values"][day], weight)
            for cell, weight in selected
            if day in cell["values"] and cell["values"][day] is not None
        ]
        fraction = len(valid) / len(selected)
        value = None
        if valid and fraction >= minimum_cell_fraction:
            total_weight = sum(weight for _, weight in valid)
            value = sum(float(item) * weight for item, weight in valid) / total_weight
        observations.append(
            {
                "time": day,
                "value": value,
                "valid_fraction": fraction,
                "cell_count": len(valid) if value is not None else 0,
            }
        )
    return {
        "observations": observations,
        "cell_count_total": len(selected),
        "spatial_method": "grid-cell center covered by full polygon; cosine(latitude) weighted mean",
    }
