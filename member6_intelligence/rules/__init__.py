"""
Rules loader and accessors for reference ranges and red flag definitions.
"""

import json
from pathlib import Path
from typing import Dict, Any, List

_RULES_DIR = Path(__file__).resolve().parent


def get_reference_ranges() -> Dict[str, Any]:
    file_path = _RULES_DIR / "reference_ranges.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_red_flag_definitions() -> List[Dict[str, Any]]:
    file_path = _RULES_DIR / "red_flags.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)
