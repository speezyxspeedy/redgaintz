from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from shapely.geometry import shape

from pipeline.adapters.power import fetch_point
from pipeline.boundaries import load_region
from pipeline.validate import validate_power_point_payload

ROOT = Path(__file__).resolve().parents[1]
BOUNDARY_VERSION = "geoBoundaries-IND-ADM2-76128533-2023-01-19"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch at least 30 consecutive days of real NASA POWER rainfall."
    )
    parser.add_argument("--start", required=True, type=date.fromisoformat)
    parser.add_argument("--end", required=True, type=date.fromisoformat)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "raw")
    args = parser.parse_args()
    if (args.end - args.start).days < 29:
        parser.error("Choose at least 30 consecutive calendar days.")

    region = load_region("IN-MH-VID", BOUNDARY_VERSION)
    point = shape(region["geometry"]).representative_point()
    artifact = fetch_point(
        args.start,
        args.end,
        point.y,
        point.x,
        raw_dir=args.output_dir,
    )
    validate_power_point_payload(artifact.payload)
    values = artifact.payload["properties"]["parameter"]["PRECTOTCORR"]
    fill_value = artifact.payload["header"]["fill_value"]
    valid = [
        value
        for value in values.values()
        if value is not None and value != fill_value and value >= 0
    ]
    fraction = len(valid) / max(1, len(values))
    if fraction < 0.8:
        raise RuntimeError(
            f"NASA POWER returned only {fraction:.1%} non-null daily observations; "
            "the AC-DATA-1 threshold is 80%."
        )
    print(
        json.dumps(
            {
                "provider": "NASA POWER",
                "dataset_id": artifact.metadata["dataset_id"],
                "variable": "PRECTOTCORR",
                "units": artifact.metadata["units"],
                "start": args.start.isoformat(),
                "end": args.end.isoformat(),
                "non_null_fraction": fraction,
                "raw_file": str(artifact.raw_path),
                "sidecar": str(artifact.sidecar_path),
                "sha256": artifact.sha256,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
