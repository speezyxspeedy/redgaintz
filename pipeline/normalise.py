from __future__ import annotations

from typing import Any

from pipeline.adapters.power import VARIABLE
from pipeline.validate import validate_power_payload

IMPLAUSIBLE_RAINFALL_MM_DAY = 1500.0


def normalise_power_payload(payload: dict[str, Any]) -> dict[str, Any]:
    validate_power_payload(payload)
    fill_value = float(payload["header"]["fill_value"])
    cells = []
    warnings: list[str] = []
    extreme_count = 0
    for feature in payload["features"]:
        longitude, latitude = feature["geometry"]["coordinates"][:2]
        source_values = feature["properties"]["parameter"][VARIABLE]
        values: dict[str, float | None] = {}
        for day, raw_value in source_values.items():
            if raw_value is None or float(raw_value) == fill_value:
                values[day] = None
            elif float(raw_value) < 0:
                values[day] = None
                warnings.append(f"Negative precipitation flagged as missing for {day}.")
            else:
                value = float(raw_value)
                if value > IMPLAUSIBLE_RAINFALL_MM_DAY:
                    extreme_count += 1
                values[day] = value
        cells.append(
            {
                "longitude": float(longitude),
                "latitude": float(latitude),
                "values": values,
            }
        )

    if extreme_count:
        warnings.append(
            f"{extreme_count} precipitation observations exceed "
            f"{IMPLAUSIBLE_RAINFALL_MM_DAY:g} mm/day and were flagged, not removed."
        )
    return {
        "variable": VARIABLE,
        "source_units": "mm/day",
        "fill_value": fill_value,
        "cells": cells,
        "warnings": warnings,
        "extreme_observation_count": extreme_count,
    }
