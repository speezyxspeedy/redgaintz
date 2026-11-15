# Methodology

## Data

The initial supported variable is NASA POWER Daily Regional `PRECTOTCORR` (MERRA-2 source), a daily precipitation rate in `mm/day`. The provider's native coarse cells cover Vidarbha at regional scale only.

NASA POWER limits each daily regional request to 366 days. Longer periods are fetched in separate calendar-year requests. The pipeline rejects chunks if their coordinates, units, fill value, or API/source version differ. Every unmodified response is saved independently. A multi-file result includes each raw response SHA-256 plus a deterministic aggregate fingerprint (SHA-256 of the ordered source checksum strings); that aggregate is not presented as an individual source-file checksum.

## Spatial mask and mean

For each provider grid center, use the full, versioned Vidarbha polygon. Include a point when the polygon covers it. Weight each included cell by `cos(latitude)` and record the cell count and method. This center-in-polygon fallback does not compute fractional polygon overlap and is stated as a limitation.

## Temporal aggregation

For each year, sum valid daily regional means to obtain annual precipitation in `mm/year`-equivalent (sum of daily `mm/day` values); the optional JJAS season sums June–September. Keep source fill values and invalid negatives as missing; do not interpolate. Return a null for a period with less than 80% valid daily coverage.

## Trend

Calculate the tie-corrected Mann-Kendall statistic and two-sided p-value, Sen's median pairwise slope and 95% interval, OLS slope as a cross-check, and lag-1 autocorrelation. Sen slope is in `mm/year` per year. Report the total fitted Sen change over the observed span and percent of the observed mean. Positive lag-1 autocorrelation is flagged; the unmodified MK p-value is not presented as autocorrelation-adjusted.

## Interpretation and limitations

Statistical association is not causation. POWER's coarse grid cannot resolve district-scale rainfall. Periods with incomplete data are missing, and record length/source revisions may affect interpretation. Report sample count, completeness, dataset version, access date, raw checksum, boundary source/version, method, and attribution.
