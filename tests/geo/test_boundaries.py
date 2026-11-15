import json
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
BOUNDARIES = ROOT / "boundaries"


def _feature(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_vidarbha_has_valid_full_resolution_region_and_11_districts() -> None:
    region = _feature(BOUNDARIES / "IN-MH-VID.full.geojson")
    districts = [
        _feature(path)
        for path in sorted(BOUNDARIES.glob("IN-MH-VID-*.full.geojson"))
    ]

    assert len(districts) == 11
    assert shape(region["geometry"]).is_valid
    assert all(shape(item["geometry"]).is_valid for item in districts)
    assert {
        item["properties"]["name"] for item in districts
    } == {
        "Akola",
        "Amravati",
        "Buldhana",
        "Washim",
        "Yavatmal",
        "Bhandara",
        "Chandrapur",
        "Gadchiroli",
        "Gondia",
        "Nagpur",
        "Wardha",
    }
    assert {item["properties"]["region_id"] for item in districts} == {
        item["properties"]["region_id"] for item in _feature(
            BOUNDARIES / "IN-MH-VID.display.geojson"
        )["features"] if item["properties"]["level"] == "district"
    }


def test_vidarbha_polygon_is_union_of_registered_districts() -> None:
    region = shape(_feature(BOUNDARIES / "IN-MH-VID.full.geojson")["geometry"])
    districts = [
        shape(_feature(path)["geometry"])
        for path in sorted(BOUNDARIES.glob("IN-MH-VID-*.full.geojson"))
    ]
    union = unary_union(districts)

    assert region.symmetric_difference(union).area < 1e-10
    assert sum(district.area for district in districts) - union.area < (
        region.area * 1e-8
    )
