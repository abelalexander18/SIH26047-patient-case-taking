"""
Unit tests for the Abnormal Medical-Value Detection Component.
Tests verify:
- Low, Normal, High status determinations
- Configurable reference ranges
- Unit storage and unit compatibility enforcement
- Missing reference bounds handling
- Invalid numeric strings and null value handling
- Strict non-diagnostic wording compliance
"""

import pytest
from abnormality_detector import (
    evaluate_value,
    evaluate_report_values,
    ValueStatus,
    ValueEvaluationInput
)


# =====================================================================
# 1. CORE RANGE COMPARISON (Low, Normal, High)
# =====================================================================

def test_value_below_reference_range_low():
    # User example: value = 10.2, ref_low = 12.0, ref_high = 16.0
    item = {
        "test_name": "Hemoglobin",
        "value": 10.2,
        "unit": "g/dL",
        "reference_low": 12.0,
        "reference_high": 16.0
    }
    result = evaluate_value(item)
    assert result["status"] == "low"
    assert result["flagged"] is True
    assert result["value"] == 10.2
    assert result["unit"] == "g/dL"
    assert "below the configured reference range" in result["message"]
    assert "Physician review recommended" in result["message"]
    # Never diagnose disease
    assert "anemia" not in result["message"].lower()


def test_value_within_reference_range_normal():
    item = {
        "test_name": "Hemoglobin",
        "value": 13.8,
        "unit": "g/dL",
        "reference_low": 12.0,
        "reference_high": 16.0
    }
    result = evaluate_value(item)
    assert result["status"] == "normal"
    assert result["flagged"] is False
    assert result["value"] == 13.8
    assert "within the configured reference range" in result["message"]


def test_value_above_reference_range_high():
    item = {
        "test_name": "Fasting Blood Glucose",
        "value": 145.0,
        "unit": "mg/dL",
        "reference_low": 70.0,
        "reference_high": 100.0
    }
    result = evaluate_value(item)
    assert result["status"] == "high"
    assert result["flagged"] is True
    assert result["value"] == 145.0
    assert "above the configured reference range" in result["message"]
    assert "Physician review recommended" in result["message"]
    # Never diagnose disease
    assert "diabetes" not in result["message"].lower()


# =====================================================================
# 2. CONFIGURABLE REFERENCE RANGES
# =====================================================================

def test_custom_runtime_reference_ranges():
    # Hospital/demographic specific custom range (e.g. pediatric reference range)
    pediatric_ranges = {
        "hemoglobin": {
            "canonical_name": "Hemoglobin",
            "reference_low": 11.0,
            "reference_high": 14.0,
            "unit": "g/dL"
        }
    }
    # 10.5 is low
    res_low = evaluate_value({"test_name": "Hemoglobin", "value": 10.5, "unit": "g/dL"}, custom_config=pediatric_ranges)
    assert res_low["status"] == "low"

    # 11.5 is normal under pediatric range
    res_norm = evaluate_value({"test_name": "Hemoglobin", "value": 11.5, "unit": "g/dL"}, custom_config=pediatric_ranges)
    assert res_norm["status"] == "normal"


def test_default_config_lookup_when_bounds_omitted():
    # Test name "Serum Creatinine" defaults: low=0.6, high=1.3, unit=mg/dL
    item = {
        "test_name": "Serum Creatinine",
        "value": 2.2,
        "unit": "mg/dL"
    }
    result = evaluate_value(item)
    assert result["status"] == "high"
    assert result["reference_low"] == 0.6
    assert result["reference_high"] == 1.3


# =====================================================================
# 3. PARTIAL BOUNDS (Only High or Only Low)
# =====================================================================

def test_partial_range_upper_bound_only():
    # Test with only upper bound (e.g. Total Cholesterol < 200)
    item_normal = {"test_name": "Total Cholesterol", "value": 180, "unit": "mg/dL", "reference_high": 200.0}
    res_normal = evaluate_value(item_normal)
    assert res_normal["status"] == "normal"

    item_high = {"test_name": "Total Cholesterol", "value": 240, "unit": "mg/dL", "reference_high": 200.0}
    res_high = evaluate_value(item_high)
    assert res_high["status"] == "high"


def test_partial_range_lower_bound_only():
    # Test with only lower bound (e.g. HDL > 40.0)
    item_normal = {"test_name": "HDL Cholesterol", "value": 48, "unit": "mg/dL", "reference_low": 40.0}
    res_normal = evaluate_value(item_normal)
    assert res_normal["status"] == "normal"

    item_low = {"test_name": "HDL Cholesterol", "value": 32, "unit": "mg/dL", "reference_low": 40.0}
    res_low = evaluate_value(item_low)
    assert res_low["status"] == "low"


# =====================================================================
# 4. UNIT COMPATIBILITY SAFETY ENFORCEMENT
# =====================================================================

def test_incompatible_units_rejection():
    # Attempting to compare glucose in "mmol/L" against reference in "mg/dL"
    # Silently comparing 7.2 against 70-100 would be catastrophic
    item = {
        "test_name": "Fasting Blood Glucose",
        "value": 7.2,
        "unit": "mmol/L"
        # Configured reference expects mg/dL
    }
    result = evaluate_value(item)
    assert result["status"] == "unknown"
    assert result["flagged"] is False
    assert "Incompatible units" in result["message"]
    assert "mmol/L" in result["message"]
    assert "mg/dL" in result["message"]


def test_compatible_unit_aliases():
    # "gm/dL" is an alias for "g/dL"
    item = {
        "test_name": "Hemoglobin",
        "value": 14.2,
        "unit": "gm/dL"
    }
    result = evaluate_value(item)
    assert result["status"] == "normal"


def test_missing_unit_when_reference_requires_unit():
    # Providing value without unit when reference expects mg/dL
    item = {
        "test_name": "Serum Creatinine",
        "value": 1.1,
        "unit": ""
    }
    result = evaluate_value(item)
    assert result["status"] == "unknown"
    assert "Missing unit" in result["message"]


# =====================================================================
# 5. MISSING REFERENCE RANGES
# =====================================================================

def test_missing_reference_range_entirely():
    item = {
        "test_name": "Unconfigured Experimental Biomarker",
        "value": 54.0,
        "unit": "ng/mL",
        "reference_low": None,
        "reference_high": None
    }
    result = evaluate_value(item)
    assert result["status"] == "unknown"
    assert "reference range is missing" in result["message"]


# =====================================================================
# 6. INVALID NUMERICAL VALUES & NULLS
# =====================================================================

def test_null_value():
    item = {
        "test_name": "Hemoglobin",
        "value": None,
        "unit": "g/dL",
        "reference_low": 12.0,
        "reference_high": 16.0
    }
    result = evaluate_value(item)
    assert result["status"] == "unknown"
    assert result["value"] is None
    assert "Value is missing or null" in result["message"]


def test_invalid_string_value():
    item = {
        "test_name": "Platelet Count",
        "value": "invalid_reading",
        "unit": "/uL",
        "reference_low": 150000.0,
        "reference_high": 450000.0
    }
    result = evaluate_value(item)
    assert result["status"] == "unknown"
    assert result["value"] is None
    assert result["raw_value"] == "invalid_reading"
    assert "is non-numeric" in result["message"]


def test_negative_impossible_physiological_value():
    item = {
        "test_name": "Hemoglobin",
        "value": -3.5,
        "unit": "g/dL",
        "reference_low": 12.0,
        "reference_high": 16.0
    }
    result = evaluate_value(item)
    assert result["status"] == "unknown"
    assert "non-physiological" in result["message"]


# =====================================================================
# 7. BATCH EVALUATION
# =====================================================================

def test_batch_report_evaluation():
    report_items = [
        {"test_name": "Hemoglobin", "value": 10.2, "unit": "g/dL", "reference_low": 12.0, "reference_high": 16.0},
        {"test_name": "Serum Creatinine", "value": 0.9, "unit": "mg/dL", "reference_low": 0.6, "reference_high": 1.3},
        {"test_name": "Fasting Blood Glucose", "value": 155.0, "unit": "mg/dL", "reference_low": 70.0, "reference_high": 100.0}
    ]
    results = evaluate_report_values(report_items)
    assert len(results) == 3
    assert results[0]["status"] == "low"
    assert results[1]["status"] == "normal"
    assert results[2]["status"] == "high"


# =====================================================================
# 8. NON-DIAGNOSTIC COMPLIANCE
# =====================================================================

def test_strict_non_diagnostic_wording():
    # Test multiple abnormal scenarios to ensure no disease labels are generated
    test_cases = [
        {"test_name": "Hemoglobin", "value": 8.0, "unit": "g/dL", "reference_low": 12.0, "reference_high": 16.0},
        {"test_name": "Fasting Blood Glucose", "value": 280.0, "unit": "mg/dL", "reference_low": 70.0, "reference_high": 100.0},
        {"test_name": "Platelet Count", "value": 40000.0, "unit": "/uL", "reference_low": 150000.0, "reference_high": 450000.0}
    ]
    forbidden_diagnostic_words = ["anemia", "diabetes", "thrombocytopenia", "disease", "syndrome", "diagnosis"]

    for c in test_cases:
        res = evaluate_value(c)
        msg_lower = res["message"].lower()
        for forbidden in forbidden_diagnostic_words:
            assert forbidden not in msg_lower, f"Forbidden diagnostic word '{forbidden}' found in message: {res['message']}"
        assert "Physician review recommended" in res["message"]
        assert "Non-diagnostic observation" in res["disclaimer"]
