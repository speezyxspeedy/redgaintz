# Dataset registry — TERRASCAN

Source of truth for dataset status. All entries verified against official NASA documentation before enabling.

> Updated after analysing the official challenge Resources tab at  
> https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources

---

## Supported (live in app)

| Dataset | Variable | Units | Resolution / Coverage | State |
|---|---|---|---|---|
| NASA POWER Daily, source MERRA-2, API v2.10.3 | `PRECTOTCORR` — Corrected Total Precipitation | `mm/day` | 0.5°×0.625°; daily since 1981-01-01 | **Supported** — region (Vidarbha) only |
| NASA POWER Daily, source MERRA-2, API v2.10.3 | `T2M` — Temperature at 2 m | `°C` | 0.5°×0.625°; daily since 1981-01-01 | **Ready** — adapter reuse; pipeline not yet wired |
| NASA POWER Daily, source MERRA-2, API v2.10.3 | `RH2M` — Relative Humidity at 2 m | `%` | 0.5°×0.625°; daily since 1981-01-01 | **Ready** — adapter reuse; pipeline not yet wired |

---

## Earthdata (require credentials — `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` in `.env`)

| Priority | Dataset/product | Variable | Units | Resolution / coverage | State |
|---|---|---|---|---|---|
| 1 | GPM IMERG V07 Final Daily `GPM_3IMERGDF` V07 (GES DISC) | `precipitation` | `mm/hr` (×24 → mm/day) | 0.1°×0.1°; since 2000-06-01 | Disabled — Earthdata adapter not yet implemented. Best for district-scale (~0.1°). |
| 2 | MERRA-2 Monthly Single-Level `M2TMNXSLV` V5.12.4 concept C1276812859-GES_DISC | `T2M` | `K` (−273.15 → °C) | 0.5°×0.625°; since 1980-01-01 | Disabled — longest temperature record. Adapter not yet implemented. |
| 3 | GLDAS Noah L4 Monthly 0.25° `GLDAS_NOAH025_M` V2.1 concept C1342986036-GES_DISC | `SoilMoi0_10cm_inst` / `Evap_tavg` | `kg/m²` / `kg/m²/s` | 0.25°; since 2000-01-01 | Disabled — soil moisture & evapotranspiration trend. Adapter not yet implemented. |
| 4 | Aqua AIRS L3 Monthly `AIRS3STM` V7.0 concept C1701805662-GES_DISC | `SurfAirTemp_A` | `K` | 1°×1°; 2002-09-01 → 2016-09-30 | Disabled — record ended 2016; too coarse for districts. Region cross-check only. |
| 5 | JPL GRACE/GRACE-FO Mascon `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` concept C3195527175-POCLOUD | `lwe_thickness` | `cm` eq. water | ~0.5°; since 2002-04-01 (gap 2017–2018) | Disabled — total water storage anomaly. Region scale only. Adapter not yet implemented. |

---

## Tools & References (from challenge Resources tab — cross-check / visualisation only, never pipeline source)

| Tool | URL | Use |
|---|---|---|
| Giovanni (NASA GES DISC) | https://giovanni.gsfc.nasa.gov/ | Interactive time-series generation & variable discovery. Cross-check our numbers only. |
| GES DISC Hydrology Time Series | https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series | Hydrological data time-series. |
| AppEEARS | https://appeears.earthdatacloud.nasa.gov/ | Geospatial data access and time-series from multiple federal archives. |
| Climate Data Online (CDO) | https://www.ncei.noaa.gov/cdo-web/ | NOAA global historical weather/climate archive. |
| KNMI Climate Explorer | https://climexp.knmi.nl/ | Scientific climate analysis and visualisation tool. |
| CUAHSI | https://www.cuahsi.org/ | Hydrological data consortium tools. |

---

## Verification log

- **PRECTOTCORR / NASA POWER**: Exercised live API for a point in Vidarbha (2024-01-01→2024-03-01). Response confirmed `Feature` GeoJSON type, units `mm/day`, source `MERRA2`, API version `v2.10.3`. Full regional series run for 2001–2025 completed; real result stored in `artifacts/`.
- **T2M / NASA POWER**: Variable `T2M` confirmed in POWER AG community docs; units `°C`; available from 1981. Not yet wired in pipeline.
- **RH2M / NASA POWER**: Variable `RH2M` confirmed; units `%`; available from 1981. Not yet wired in pipeline.
- **GPM_3IMERGDF V07**: Variable `precipitation`, units `mm/hr` confirmed from GES DISC docs. Resolution 0.1°. Record start 2000-06-01. Earthdata adapter not yet built.
- **M2TMNXSLV V5.12.4**: Variable `T2M`, units `K`. Monthly since 1980-01-01. Concept `C1276812859-GES_DISC`. Earthdata adapter not yet built.
- **GLDAS_NOAH025_M V2.1**: Variables `SoilMoi0_10cm_inst` (kg/m²) and `Evap_tavg` (kg/m²/s). Monthly since 2000-01-01. Concept `C1342986036-GES_DISC`. Earthdata adapter not yet built.
- **AIRS3STM V7.0**: Variable `SurfAirTemp_A`, units `K`. 1°×1°. Record 2002-09-01 → 2016-09-30. Concept `C1701805662-GES_DISC`. Earthdata adapter not yet built.
- **GRACE/GRACE-FO Mascon RL06.3 V4**: Variable `lwe_thickness`, units `cm`. ~0.5° mascon tiles. Record from 2002-04-01 (GRACE mission end ~2017-06; GRACE-FO from ~2018-06). Concept `C3195527175-POCLOUD`. Earthdata adapter not yet built.
