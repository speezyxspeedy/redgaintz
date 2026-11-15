# Decision 0001: Start with a region-scale NASA POWER precipitation MVP

- Status: accepted for the initial implementation.
- NASA POWER's official Daily Regional endpoint is publicly accessible and returns `PRECTOTCORR` in `mm/day` with source `MERRA2`.
- The response grid is too coarse for district claims. Districts are boundary overlays only; analysis is enabled only for `IN-MH-VID`.
- GPM IMERG and other Earthdata products remain `[VERIFY]` until their official collection/variable/units and authenticated retrieval are validated.
- Missing values remain missing. No synthetic display result is allowed.
- The provided workspace has no `.git`; output provenance records `code_git_sha: null` rather than inventing a hash.
