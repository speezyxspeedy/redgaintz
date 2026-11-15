from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def _season_bounds(year: int, aggregation: str) -> tuple[date, date]:
    if aggregation == "annual_total":
        return date(year, 1, 1), date(year, 12, 31)
    if aggregation == "jjas_total":
        return date(year, 6, 1), date(year, 9, 30)
    raise ValueError(f"Unsupported temporal aggregation: {aggregation}")


def aggregate_periods(
    daily: dict[str, Any],
    start: date,
    end: date,
    *,
    aggregation: str = "annual_total",
    minimum_completeness: float = 0.8,
) -> list[dict[str, Any]]:
    if start > end:
        raise ValueError("Analysis end date must not precede start date.")
    if start != date(start.year, 1, 1) or end != date(end.year, 12, 31):
        raise ValueError("Annual and JJAS analyses require complete calendar-year date bounds.")
    if not 0 < minimum_completeness <= 1:
        raise ValueError("Minimum completeness must be in (0, 1].")

    daily_by_date = {
        date.fromisoformat(f"{item['time'][:4]}-{item['time'][4:6]}-{item['time'][6:8]}"): item
        for item in daily["observations"]
    }
    results = []
    for year in range(start.year, end.year + 1):
        period_start, period_end = _season_bounds(year, aggregation)
        expected_days = [
            period_start + timedelta(days=index)
            for index in range((period_end - period_start).days + 1)
        ]
        values = [
            daily_by_date.get(day, {}).get("value")
            for day in expected_days
        ]
        valid_values = [float(value) for value in values if value is not None]
        completeness = len(valid_values) / len(expected_days)
        available_cells = [
            daily_by_date.get(day, {}).get("cell_count", 0)
            for day, value in zip(expected_days, values)
            if value is not None
        ]
        total = None
        if completeness >= minimum_completeness:
            total = sum(valid_values)
        results.append(
            {
                "time": year,
                "value": total,
                "valid_fraction": completeness,
                "cell_count": min(available_cells) if available_cells else 0,
            }
        )
    return results
