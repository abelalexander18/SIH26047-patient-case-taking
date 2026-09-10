"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Abnormal Medical-Value Detection Component: Evaluation Logic

Compares numerical laboratory/vital metrics against configured reference bounds.
Strictly non-diagnostic: outputs status (low, normal, high, unknown) and neutral wording.
"""

from typing import Union, Dict, Any, List, Optional
from abnormality_detector.schemas import (
    ValueEvaluationInput,
    ValueEvaluationResult,
    ValueStatus
)
from abnormality_detector.config import (
    are_units_compatible,
    get_default_reference,
    normalize_unit,
    DEFAULT_REFERENCE_RANGES
)

STANDARD_DISCLAIMER = (
    "Non-diagnostic observation. Value evaluated solely against configured reference range. "
    "Does not constitute a medical diagnosis or disease identification."
)


class AbnormalValueDetector:
    """
    Evaluates individual and batch medical report values against configured reference ranges.
    """

    def __init__(self, default_config: Optional[Dict[str, Dict[str, Any]]] = None):
        # Configurable reference ranges dictionary
        self.config: Dict[str, Dict[str, Any]] = (
            default_config if default_config is not None else DEFAULT_REFERENCE_RANGES
        )

    def evaluate(
        self,
        item: Union[ValueEvaluationInput, Dict[str, Any]],
        custom_config: Optional[Dict[str, Any]] = None
    ) -> ValueEvaluationResult:
        """
        Evaluates a single numerical lab/vital value against a configured reference range.
        Returns ValueEvaluationResult with status: low, normal, high, or unknown.
        """
        # Normalize input to ValueEvaluationInput
        if isinstance(item, dict):
            test_name = str(item.get("test_name") or "Unknown Test").strip()
            raw_val = item.get("value")
            unit = str(item.get("unit") or "").strip()
            ref_low = item.get("reference_low")
            ref_high = item.get("reference_high")
            source = str(item.get("source") or "lab_report").strip()
        elif isinstance(item, ValueEvaluationInput):
            test_name = item.test_name.strip()
            raw_val = item.value
            unit = (item.unit or "").strip()
            ref_low = item.reference_low
            ref_high = item.reference_high
            source = item.source or "lab_report"
        else:
            return ValueEvaluationResult(
                test_name="Invalid Input",
                status=ValueStatus.UNKNOWN,
                message="Input could not be parsed. Physician review recommended.",
                disclaimer=STANDARD_DISCLAIMER
            )

        # 1. Check for null value
        if raw_val is None:
            return ValueEvaluationResult(
                test_name=test_name,
                value=None,
                raw_value=None,
                unit=unit,
                reference_low=ref_low,
                reference_high=ref_high,
                status=ValueStatus.UNKNOWN,
                message="Value is missing or null. Physician review recommended.",
                flagged=False,
                source=source,
                disclaimer=STANDARD_DISCLAIMER
            )

        # 2. Numerical validation
        num_val: Optional[float] = None
        try:
            num_val = float(raw_val)
        except (ValueError, TypeError):
            return ValueEvaluationResult(
                test_name=test_name,
                value=None,
                raw_value=str(raw_val),
                unit=unit,
                reference_low=ref_low,
                reference_high=ref_high,
                status=ValueStatus.UNKNOWN,
                message=f"Value '{raw_val}' is non-numeric and cannot be compared against a numerical reference range. Physician review recommended.",
                flagged=False,
                source=source,
                disclaimer=STANDARD_DISCLAIMER
            )

        # Basic physiological sanity check (negative values for physiological concentrations are invalid)
        if num_val < 0:
            return ValueEvaluationResult(
                test_name=test_name,
                value=num_val,
                raw_value=str(raw_val),
                unit=unit,
                reference_low=ref_low,
                reference_high=ref_high,
                status=ValueStatus.UNKNOWN,
                message=f"Observed value {num_val} is non-physiological / invalid. Physician review recommended.",
                flagged=False,
                source=source,
                disclaimer=STANDARD_DISCLAIMER
            )

        # 3. Determine configured reference bounds and expected unit
        effective_low = float(ref_low) if ref_low is not None else None
        effective_high = float(ref_high) if ref_high is not None else None
        expected_unit = unit

        # Fallback to configured dictionary if ranges not explicitly provided on item
        if effective_low is None and effective_high is None:
            lookup_dict = custom_config if custom_config is not None else self.config
            matched_conf = self._lookup_config(test_name, lookup_dict)
            if matched_conf:
                effective_low = matched_conf.get("reference_low")
                effective_high = matched_conf.get("reference_high")
                expected_unit = matched_conf.get("unit", "")
                if not unit and expected_unit:
                    # If input had no unit, adopt expected unit only if caller omitted it intentionally
                    pass

        # 4. Check unit compatibility
        if expected_unit and unit:
            if not are_units_compatible(unit, expected_unit):
                return ValueEvaluationResult(
                    test_name=test_name,
                    value=num_val,
                    raw_value=str(raw_val),
                    unit=unit,
                    reference_low=effective_low,
                    reference_high=effective_high,
                    status=ValueStatus.UNKNOWN,
                    message=(
                        f"Incompatible units: report specifies '{unit}' while configured reference range expects '{expected_unit}'. "
                        "Comparison halted to prevent clinical error. Physician review recommended."
                    ),
                    flagged=False,
                    source=source,
                    disclaimer=STANDARD_DISCLAIMER
                )
        elif expected_unit and not unit:
            # Report value has no unit, but reference requires one
            return ValueEvaluationResult(
                test_name=test_name,
                value=num_val,
                raw_value=str(raw_val),
                unit="",
                reference_low=effective_low,
                reference_high=effective_high,
                status=ValueStatus.UNKNOWN,
                message=(
                    f"Missing unit: value has no unit specified, while configured reference range expects '{expected_unit}'. "
                    "Comparison omitted for patient safety. Physician review recommended."
                ),
                flagged=False,
                source=source,
                disclaimer=STANDARD_DISCLAIMER
            )

        # 5. Handle missing reference ranges
        if effective_low is None and effective_high is None:
            return ValueEvaluationResult(
                test_name=test_name,
                value=num_val,
                raw_value=str(raw_val),
                unit=unit,
                reference_low=None,
                reference_high=None,
                status=ValueStatus.UNKNOWN,
                message="Configured reference range is missing for this test. Physician review recommended.",
                flagged=False,
                source=source,
                disclaimer=STANDARD_DISCLAIMER
            )

        # 6. Evaluate against bounds
        status = ValueStatus.NORMAL
        flagged = False
        message = "Value is within the configured reference range."

        # Check lower bound
        if effective_low is not None and num_val < effective_low:
            status = ValueStatus.LOW
            flagged = True
            message = "Outside configured reference range (below the configured reference range) - Physician review recommended."
        # Check upper bound
        elif effective_high is not None and num_val > effective_high:
            status = ValueStatus.HIGH
            flagged = True
            message = "Outside configured reference range (above the configured reference range) - Physician review recommended."

        return ValueEvaluationResult(
            test_name=test_name,
            value=num_val,
            raw_value=str(raw_val),
            unit=unit or expected_unit,
            reference_low=effective_low,
            reference_high=effective_high,
            status=status,
            message=message,
            flagged=flagged,
            source=source,
            disclaimer=STANDARD_DISCLAIMER
        )

    def evaluate_all(
        self,
        items: List[Union[ValueEvaluationInput, Dict[str, Any]]],
        custom_config: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Evaluates a batch of report values and returns structured result dictionaries."""
        results: List[Dict[str, Any]] = []
        for item in items:
            res = self.evaluate(item, custom_config=custom_config)
            results.append(res.model_dump())
        return results

    def _lookup_config(self, test_name: str, config_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        query = test_name.strip().lower()
        for k, v in config_dict.items():
            if query == k.lower():
                return v
            if query in [a.lower() for a in v.get("aliases", [])]:
                return v
            if k.lower() in query:
                return v
        return None


# Global singleton instance
_default_detector = AbnormalValueDetector()


def evaluate_value(
    item: Union[ValueEvaluationInput, Dict[str, Any]],
    custom_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Convenience function returning dictionary matching the agreed schema."""
    return _default_detector.evaluate(item, custom_config=custom_config).model_dump()


def evaluate_report_values(
    items: List[Union[ValueEvaluationInput, Dict[str, Any]]],
    custom_config: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Batch evaluation of lab/vital report values."""
    return _default_detector.evaluate_all(items, custom_config=custom_config)
