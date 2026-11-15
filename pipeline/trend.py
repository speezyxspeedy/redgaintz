from __future__ import annotations

from collections import Counter
from typing import Sequence

import numpy as np
from scipy import stats


def _lag1_autocorrelation(
    years: np.ndarray, residuals: np.ndarray
) -> float | None:
    consecutive = np.diff(years) == 1
    previous = residuals[:-1][consecutive]
    current = residuals[1:][consecutive]
    if previous.size < 3:
        return None
    if np.std(previous) == 0 or np.std(current) == 0:
        return 0.0
    value = float(np.corrcoef(previous, current)[0, 1])
    return value if np.isfinite(value) else None


def mann_kendall_sen(
    years: Sequence[int | float],
    values: Sequence[float | None],
    *,
    alpha: float = 0.05,
) -> dict[str, object]:
    if len(years) != len(values):
        raise ValueError("Years and values must have equal lengths.")
    if not 0 < alpha < 1:
        raise ValueError("alpha must be between 0 and 1.")

    pairs = [
        (float(year), float(value))
        for year, value in zip(years, values)
        if value is not None and np.isfinite(value) and np.isfinite(year)
    ]
    pairs.sort(key=lambda pair: pair[0])
    x = np.asarray([pair[0] for pair in pairs], dtype=float)
    y = np.asarray([pair[1] for pair in pairs], dtype=float)
    if x.size < 3:
        raise ValueError("At least three non-missing annual observations are required.")
    if np.any(np.diff(x) <= 0):
        raise ValueError("Observation years must be unique and strictly increasing.")

    sample_count = int(y.size)
    score = 0
    for index in range(sample_count - 1):
        score += int(np.sign(y[index + 1 :] - y[index]).sum())

    ties = Counter(y.tolist())
    tie_term = sum(count * (count - 1) * (2 * count + 5) for count in ties.values())
    variance = (
        sample_count * (sample_count - 1) * (2 * sample_count + 5) - tie_term
    ) / 18
    if variance <= 0:
        z_score = 0.0
        p_value = 1.0
    elif score > 0:
        z_score = (score - 1) / np.sqrt(variance)
        p_value = float(2 * stats.norm.sf(abs(z_score)))
    elif score < 0:
        z_score = (score + 1) / np.sqrt(variance)
        p_value = float(2 * stats.norm.sf(abs(z_score)))
    else:
        z_score = 0.0
        p_value = 1.0

    sen = stats.theilslopes(y, x, alpha=1 - alpha)
    ols = stats.linregress(x, y)
    intercept = float(np.median(y - float(sen.slope) * x))
    residuals = y - (float(ols.intercept) + float(ols.slope) * x)
    lag1 = _lag1_autocorrelation(x, residuals)
    autocorrelation_threshold = 2 / np.sqrt(sample_count)
    autocorrelation_flag = (
        lag1 is not None and abs(lag1) > autocorrelation_threshold
    )
    significant = p_value <= alpha
    direction = (
        "increasing"
        if significant and score > 0
        else "decreasing"
        if significant and score < 0
        else "no_significant_trend"
    )
    span_years = float(x[-1] - x[0])
    observed_mean = float(np.mean(y))
    total_change = float(sen.slope) * span_years
    percent_change = (
        total_change / observed_mean * 100 if observed_mean != 0 else None
    )
    return {
        "method": "Mann-Kendall with tie-corrected variance; Sen's slope",
        "sample_count": sample_count,
        "alpha": alpha,
        "mk_score": score,
        "mk_z": float(z_score),
        "p_value": p_value,
        "significant": significant,
        "direction": direction,
        "sen_slope": float(sen.slope),
        "sen_slope_ci95": [float(sen.low_slope), float(sen.high_slope)],
        "sen_intercept": intercept,
        "ols_slope": float(ols.slope),
        "ols_p_value": float(ols.pvalue),
        "lag1_autocorrelation": lag1,
        "lag1_autocorrelation_threshold": float(autocorrelation_threshold),
        "lag1_autocorrelation_flag": bool(autocorrelation_flag),
        "span_years": span_years,
        "total_change": float(total_change),
        "observed_mean": observed_mean,
        "percent_change_of_mean": (
            float(percent_change) if percent_change is not None else None
        ),
        "missing_years_excluded": len(years) - sample_count,
        "interpretation": (
            "Statistical trend only; this result does not establish causation."
        ),
    }
