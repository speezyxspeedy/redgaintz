import pytest

from pipeline.validate import DataValidationError, validate_power_point_payload


def test_point_response_uses_feature_contract_and_daily_units() -> None:
    payload = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [78.2, 20.2, 300]},
        "properties": {
            "parameter": {"PRECTOTCORR": {"20240101": 1.2, "20240102": -999}}
        },
        "header": {"fill_value": -999},
        "parameters": {"PRECTOTCORR": {"units": "mm/day"}},
    }

    validate_power_point_payload(payload)


def test_point_response_rejects_wrong_units() -> None:
    payload = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [78.2, 20.2]},
        "properties": {"parameter": {"PRECTOTCORR": {"20240101": 1.2}}},
        "header": {"fill_value": -999},
        "parameters": {"PRECTOTCORR": {"units": "inches"}},
    }

    with pytest.raises(DataValidationError, match="units must be mm/day"):
        validate_power_point_payload(payload)
