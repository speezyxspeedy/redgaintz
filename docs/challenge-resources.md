# Challenge Resources Analysis — NASA Space Apps 2026
# "Be An Earth System Trend Detective!"

> Source: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources  
> Analysed: 2026-11-14. All dataset metadata cross-checked against official NASA documentation.

---

## What the Challenge Asks For

The challenge requires a tool that can:
1. **Select** Earth science variables of interest (from satellites or models)
2. **Acquire** data for a chosen region
3. **Visualize** a time-series over a long enough period for statistical analysis
4. **Perform** statistical trend analysis — rate of change, Mann-Kendall test, t-test, or confidence intervals
5. **Determine** significance: *what* is changing, *where*, *how much*, and *whether it is statistically significant*

### Key Quote
> "A response that does both the visualization and the analysis meets the full scope of this challenge."

**TERRASCAN meets all five criteria** using real NASA data with Mann-Kendall + Sen's slope + OLS + lag-1 autocorrelation check.

---

## Datasets — Status Map

### ✅ Implemented & Verified

| Dataset | Variable | Units | Notes |
|---|---|---|---|
| NASA POWER Daily (MERRA-2) | `PRECTOTCORR` | mm/day | Full pipeline + UI + cached 2001–2025 result |

### 🟡 Verified Metadata — Adapter Needed

| Dataset | Variable | Units | Notes |
|---|---|---|---|
| NASA POWER Daily (MERRA-2) | `T2M` Temperature 2m | °C | Same POWER adapter, different parameter string |
| NASA POWER Daily (MERRA-2) | `RH2M` Relative Humidity 2m | % | Same POWER adapter, different parameter string |
| GPM IMERG V07 Final Daily `GPM_3IMERGDF` | `precipitation` | mm/hr (×24=mm/day) | 0.1° — best for district scale; needs Earthdata Login |
| MERRA-2 Monthly `M2TMNXSLV` V5.12.4 | `T2M` | K (−273.15=°C) | Longest temperature record (since 1980); needs Earthdata |
| GLDAS Noah Monthly `GLDAS_NOAH025_M` V2.1 | `SoilMoi0_10cm_inst`, `Evap_tavg` | kg/m², kg/m²/s | Soil moisture + ET; needs Earthdata |
| AIRS L3 Monthly `AIRS3STM` V7.0 | `SurfAirTemp_A` | K | Record ends 2016; 1° too coarse for districts |
| GRACE/GRACE-FO Mascon RL06.3 V4 | `lwe_thickness` | cm | Total water storage anomaly; needs Earthdata |

---

## Tools (Cross-check / Exploration Only — Never Pipeline Source)

| Tool | URL | Use in TERRASCAN |
|---|---|---|
| **Giovanni** | https://giovanni.gsfc.nasa.gov/ | Verify our computed regional means against Giovanni's time-series |
| **GES DISC Hydrology Time Series** | https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series | Alternative time-series source for cross-checking |
| **AppEEARS** | https://appeears.earthdatacloud.nasa.gov/ | Multi-archive geospatial extraction — use for GPM if earthaccess fails |
| **Climate Data Online (CDO)** | https://www.ncei.noaa.gov/cdo-web/ | NOAA historical climate baseline for context |
| **KNMI Climate Explorer** | https://climexp.knmi.nl/ | Scientific climate analysis — use to validate trend direction |

---

## Referenced Satellite Missions & Models

| Mission/Model | Variable Family | Access |
|---|---|---|
| MODIS (Terra/Aqua) | Land surface, vegetation, LST | NASA Earthdata / AppEEARS |
| OMI (Aura) | Ozone, atmospheric trace gases | NASA GES DISC |
| AIRS (Aqua) | Atmospheric temperature, humidity, clouds | NASA GES DISC — `AIRS3STM` |
| GPM | Precipitation | NASA GES DISC — `GPM_3IMERGDF` |
| MERRA-2 | Atmospheric reanalysis (all variables) | NASA GES DISC — `M2TMNXSLV`; also via POWER |
| GLDAS | Land surface hydrology | NASA GES DISC — `GLDAS_NOAH025_M` |
| GRACE/GRACE-FO | Total water storage | NASA PO.DAAC — mascon product |
| SWOT | Surface water elevation | NASA PO.DAAC — not yet in pipeline |
| RADARSAT (RCM) | SAR — land cover, ice, flooding | CSA — not relevant for Vidarbha |

---

## Recommended Next Steps (Priority Order for Remaining Time)

1. **[HIGH] Wire T2M and RH2M into POWER adapter** — reuse existing `power.py` by parameterising variable name; enables 2 more trend variables with zero new API credentials
2. **[HIGH] Add multi-variable selector to UI** — let user pick `PRECTOTCORR` / `T2M` / `RH2M` from the Dataset dropdown; pass variable to pipeline
3. **[MED] Implement GPM IMERG adapter** — highest priority Earthdata dataset; enables district-scale precipitation (0.1° vs POWER's 0.5°)
4. **[MED] Implement MERRA-2 temperature adapter** — longest temperature record (since 1980); complements precipitation trend story
5. **[LOW] Implement GLDAS adapter** — soil moisture + ET cross-checks precipitation trend (water balance story)
6. **[LOW] Implement GRACE/GRACE-FO adapter** — total water storage trend (groundwater depletion narrative for Vidarbha)
7. **[CROSS-CHECK] Use Giovanni** to verify our computed regional mean precipitation matches the Giovanni time-series for one year
