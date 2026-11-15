from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely import transform as transform_geometry
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "raw" / "geoBoundaries-IND-ADM2.geojson"
OUTPUT = ROOT / "boundaries"
CONFIG = ROOT / "config" / "regions.json"
SOURCE_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
    "releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2.geojson"
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def feature(geometry: Any, properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "Feature", "geometry": mapping(geometry), "properties": properties}


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Download the official India ADM2 source to {SOURCE}")

    registry = json.loads(CONFIG.read_text(encoding="utf-8"))
    region = registry["regions"][0]
    boundary_version = registry["boundary_version"]
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    source_features = {
        item["properties"]["shapeName"]: item for item in source["features"]
    }

    district_geometries = []
    district_outputs = []
    for district in region["districts"]:
        source_name = district["source_name"]
        source_feature = source_features.get(source_name)
        if source_feature is None:
            raise ValueError(f"Boundary source has no ADM2 feature named {source_name!r}")

        geometry = shape(source_feature["geometry"])
        if not geometry.is_valid:
            geometry = make_valid(geometry)
        if geometry.is_empty or geometry.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError(f"Invalid polygonal boundary for {source_name!r}")

        properties = {
            "region_id": district["region_id"],
            "boundary_version": boundary_version,
            "name": district["name"],
            "source_name": source_name,
            "division": district["division"],
            "level": "district",
        }
        district_geometries.append(geometry)
        district_outputs.append((district, geometry, properties))
        write_json(
            OUTPUT / f"{district['region_id']}.full.geojson",
            feature(geometry, properties),
        )

    vidarbha = unary_union(district_geometries)
    if not vidarbha.is_valid:
        vidarbha = make_valid(vidarbha)
    if vidarbha.is_empty or vidarbha.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError("The Vidarbha union did not produce a valid polygon.")

    region_properties = {
        "region_id": region["region_id"],
        "boundary_version": boundary_version,
        "name": region["name"],
        "level": "region",
        "district_count": len(region["districts"]),
    }
    full_region_path = OUTPUT / "IN-MH-VID.full.geojson"
    write_json(full_region_path, feature(vidarbha, region_properties))

    display_tolerance_degrees = 0.01
    display_features = [
        feature(
            vidarbha.simplify(display_tolerance_degrees, preserve_topology=True),
            {**region_properties, "display_only": True},
        )
    ]
    for district, geometry, properties in district_outputs:
        display_features.append(
            feature(
                geometry.simplify(display_tolerance_degrees, preserve_topology=True),
                {**properties, "display_only": True},
            )
        )
    display_path = OUTPUT / "IN-MH-VID.display.geojson"
    write_json(
        display_path,
        {"type": "FeatureCollection", "features": display_features},
    )

    equal_area = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)
    area_km2 = transform_geometry(
        vidarbha, equal_area.transform, interleaved=False
    ).area / 1_000_000
    manifest = {
        "boundary_version": boundary_version,
        "region_id": region["region_id"],
        "source": {
            "name": "geoBoundaries gbOpen India ADM2",
            "url": SOURCE_URL,
            "api_metadata_url": "https://www.geoboundaries.org/api/current/gbOpen/IND/ADM2/",
            "license": "Open Data Commons Open Database License 1.0",
            "license_source": "geonode.pathwaysdata.com/layers/geonode",
            "source_data_update_date": "2023-01-19",
            "release_commit": "9469f09",
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
            "sha256": sha256_file(SOURCE),
        },
        "crs": "EPSG:4326",
        "area_calculation_crs": "EPSG:6933",
        "region_area_km2": round(area_km2, 3),
        "source_feature_count": len(source["features"]),
        "districts": [
            {
                "region_id": district["region_id"],
                "name": district["name"],
                "source_name": district["source_name"],
                "file": f"boundaries/{district['region_id']}.full.geojson",
                "sha256": sha256_file(OUTPUT / f"{district['region_id']}.full.geojson"),
            }
            for district in region["districts"]
        ],
        "products": {
            "full_region": {
                "file": "boundaries/IN-MH-VID.full.geojson",
                "sha256": sha256_file(full_region_path),
            },
            "display_only": {
                "file": "boundaries/IN-MH-VID.display.geojson",
                "simplification_tolerance_degrees": display_tolerance_degrees,
                "sha256": sha256_file(display_path),
            },
        },
        "district_list_verification": (
            "Source feature spellings Buldana and Gondiya are mapped to Buldhana "
            "and Gondia. Official Vidarbha division membership remains [VERIFY]."
        ),
    }
    write_json(OUTPUT / "boundary-manifest.json", manifest)
    print(
        f"Prepared {len(district_outputs)} districts; region area "
        f"{area_km2:.3f} km2; source sha256 {manifest['source']['sha256']}"
    )


if __name__ == "__main__":
    main()
