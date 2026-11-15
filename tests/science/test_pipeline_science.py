from datetime import date, timedelta

import numpy as np
import pytest
from shapely.geometry import mapping, Polygon

from pipeline.aggregate import aggregate_periods
from pipeline.mask import region_daily_mean
from pipeline.normalise import normalise_power_payload
from pipeline.trend import mann_kendall_sen


def test_normalise_keeps_fill_and_negative_rainfall_missing_and_flags_extremes() -> None:
    payload = {
        "type": "FeatureCollection",
        "header": {"fill_value": -999},
        "parameters": {"PRECTOTCORR": {"units": "mm/day"}},
        "features": [
            {
                "geometry": {"type": "Point", "coordinates": [77.0, 20.0]},
                "properties": {
                    "parameter": {
                        "PRECTOTCORR": {
                            "20200101": 2.0,
                            "20200102": -999,
                            "20200103": -1.0,
                            "20200104": 1501.0,
                        }
                    }
                },
            }
        ],
    }

    result = normalise_power_payload(payload)

    assert result["cells"][0]["values"] == {
        "20200101": 2.0,
        "20200102": None,
        "20200103": None,
        "20200104": 1501.0,
    }
    assert result["extreme_observation_count"] == 1
    assert len(result["warnings"]) == 2


def test_region_mask_uses_cosine_weighted_mean_and_completeness_threshold() -> None:
    normalized = {
        "cells": [
            {
                "longitude": 0.0,
                "latitude": 0.0,
                "values": {"20200101": 10.0, "20200102": None},
            },
            {
                "longitude": 1.0,
                "latitude": 60.0,
                "values": {"20200101": 20.0, "20200102": 8.0},
            },
        ]
    }
    polygon = mapping(Polygon([(-1, -1), (2, -1), (2, 61), (-1, 61)]))

    result = region_daily_mean(normalized, polygon, minimum_cell_fraction=0.8)
    observations = result["observations"]

    assert observations[0]["value"] == pytest.approx((10 + 20 * 0.5) / 1.5)
    assert observations[0]["cell_count"] == 2
    assert observations[1]["value"] is None
    assert observations[1]["valid_fraction"] == 0.5


def test_annual_and_jjas_aggregation_preserve_incomplete_period_as_null() -> None:
    observations = []
    day = date(2020, 1, 1)
    while day.year == 2020:
        observations.append(
            {
                "time": day.strftime("%Y%m%d"),
                "value": (
                    None
                    if date(2020, 6, 1) <= day <= date(2020, 6, 25)
                    else 1.0
                ),
                "cell_count": (
                    0
                    if date(2020, 6, 1) <= day <= date(2020, 6, 25)
                    else 2
                ),
            }
        )
        day += timedelta(days=1)
    daily = {"observations": observations}

    annual = aggregate_periods(
        daily, date(2020, 1, 1), date(2020, 12, 31), aggregation="annual_total"
    )[0]
    jjas = aggregate_periods(
        daily, date(2020, 1, 1), date(2020, 12, 31), aggregation="jjas_total"
    )[0]

    assert annual["value"] == pytest.approx(341.0)
    assert annual["valid_fraction"] == pytest.approx(341 / 366)
    assert jjas["value"] is None
    assert jjas["valid_fraction"] < 0.8


@pytest.mark.parametrize(
    ("values", "direction"),
    [
        ([1, 2, 3, 4, 5], "increasing"),
        ([5, 4, 3, 2, 1], "decreasing"),
        ([3, 3, 3, 3, 3], "no_significant_trend"),
    ],
)
def test_mann_kendall_sen_known_answers(values: list[float], direction: str) -> None:
    result = mann_kendall_sen([2000, 2001, 2002, 2003, 2004], values)

    assert result["direction"] == direction
    assert result["sample_count"] == 5
    assert len(result["sen_slope_ci95"]) == 2
    assert result["ols_slope"] == pytest.approx(result["sen_slope"])


def test_trend_excludes_missing_years_without_interpolation() -> None:
    result = mann_kendall_sen(
        [2000, 2001, 2002, 2003], [1.0, None, 3.0, 4.0]
    )

    assert result["sample_count"] == 3
    assert result["missing_years_excluded"] == 1
    assert result["sen_slope"] == pytest.approx(1.0)
    assert result["lag1_autocorrelation"] is None


def test_mann_kendall_null_noise_false_positive_rate_is_near_alpha() -> None:
    years = list(range(1981, 2011))
    significant_runs = 0
    for seed in range(100):
        noise = np.random.default_rng(seed).normal(size=len(years))
        significant_runs += mann_kendall_sen(years, noise.tolist())["significant"]

    assert 1 <= significant_runs <= 11


def test_autocorrelated_no_trend_series_sets_lag1_diagnostic() -> None:
    rng = np.random.default_rng(7)
    values = np.zeros(80)
    innovations = rng.normal(size=80)
    for index in range(1, len(values)):
        values[index] = 0.85 * values[index - 1] + innovations[index]

    result = mann_kendall_sen(list(range(1941, 2021)), values.tolist())

    assert result["lag1_autocorrelation"] is not None
    assert result["lag1_autocorrelation_flag"] is True


def test_missing_block_is_excluded_and_step_change_is_detected() -> None:
    years = list(range(2000, 2040))
    values = [
        None if 2010 <= year <= 2017 else (0.0 if year < 2020 else 10.0)
        for year in years
    ]

    result = mann_kendall_sen(years, values)

    assert result["missing_years_excluded"] == 8
    assert result["sample_count"] == 32
    assert result["direction"] == "increasing"
