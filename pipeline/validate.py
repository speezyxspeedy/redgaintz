from __future__ import annotations

import math
from typing import Any

from pipeline.adapters.power import VARIABLE


class DataValidationError(ValueError):
    """The provider response does not satisfy the registered data contract."""


def validate_power_point_payload(payload: dict[str, Any]) -> None:
    if payload.get("type") != "Feature":
        raise DataValidationError("NASA POWER point response is not a GeoJSON Feature.")
    validate_power_payload(
        {
            **payload,
            "type": "FeatureCollection",
            "features": [
                {
                    "geometry": payload.get("geometry"),
                    "properties": payload.get("properties"),
                }
            ],
        }
    )


def validate_power_payload(payload: dict[str, Any]) -> None:
    if payload.get("type") != "FeatureCollection":
        raise DataValidationError("NASA POWER response is not a GeoJSON FeatureCollection.")
    features = payload.get("features")
    if not isinstance(features, list) or not features:
        raise DataValidationError("NASA POWER returned no regional grid cells.")

    variable = payload.get("parameters", {}).get(VARIABLE, {})
    if variable.get("units") != "mm/day":
        raise DataValidationError(
            f"NASA POWER {VARIABLE} units must be mm/day; received {variable.get('units')!r}."
        )
    fill_value = payload.get("header", {}).get("fill_value")
    if not isinstance(fill_value, (int, float)):
        raise DataValidationError("NASA POWER response does not declare its fill value.")

    seen_cells: set[tuple[float, float]] = set()
    seen_observations: set[tuple[float, float, str]] = set()
    for feature in features:
        geometry = feature.get("geometry", {})
        coordinates = geometry.get("coordinates")
        if geometry.get("type") != "Point" or not isinstance(coordinates, list) or len(coordinates) < 2:
            raise DataValidationError("NASA POWER regional cells must be point geometries.")
        longitude, latitude = coordinates[:2]
        if not (
            isinstance(longitude, (int, float))
            and isinstance(latitude, (int, float))
            and math.isfinite(longitude)
            and math.isfinite(latitude)
            and -180 <= longitude <= 180
            and -90 <= latitude <= 90
        ):
            raise DataValidationError("NASA POWER returned an invalid grid-cell coordinate.")

        cell = (float(longitude), float(latitude))
        if cell in seen_cells:
            raise DataValidationError(f"NASA POWER returned a duplicate grid cell: {cell}.")
        seen_cells.add(cell)
        values = (
            feature.get("properties", {})
            .get("parameter", {})
            .get(VARIABLE)
        )
        if not isinstance(values, dict):
            raise DataValidationError(f"NASA POWER grid cell is missing {VARIABLE} values.")
        for day, value in values.items():
            observation = (cell[0], cell[1], day)
            if observation in seen_observations:
                raise DataValidationError(
                    f"NASA POWER returned a duplicate observation for cell/date {observation}."
                )
            seen_observations.add(observation)
            if not isinstance(day, str) or len(day) != 8 or not day.isdigit():
                raise DataValidationError(f"NASA POWER returned invalid date key {day!r}.")
            if value is not None and not (
                isinstance(value, (int, float)) and math.isfinite(value)
            ):
                raise DataValidationError(
                    f"NASA POWER returned a non-numeric {VARIABLE} observation."
                )
            if value == fill_value or value is None:
                continue
            if value < 0:
                continue
