/**
 * Arogya AI — Deterministic Reference Range Checker
 * Path: backend/services/referenceRangeChecker.mjs
 * 
 * Compares laboratory and vital values against reference bounds:
 * - Status: 'low' | 'normal' | 'high' | 'unknown'
 * - Range Priority: Prefers laboratory range printed on the report.
 *   Uses configured fallback only when report range is unavailable.
 * - Range Source Tag: 'report' | 'configured_fallback' | 'unavailable'
 * - Unit Preservation: Never silently converts units. Marks unknown if incompatible.
 * - Strictly non-diagnostic wording:
 *   "Outside configured reference range — physician review recommended."
 */

export const CONFIG_FALLBACK_RANGES = {
  hemoglobin: {
    canonical_name: 'Hemoglobin',
    low: 12.0,
    high: 16.0,
    unit: 'g/dL',
    aliases: ['hb', 'hgb', 'haemoglobin']
  },
  glucose: {
    canonical_name: 'Blood Glucose',
    low: 70.0,
    high: 100.0,
    unit: 'mg/dL',
    aliases: ['fasting blood glucose', 'fbs', 'blood glucose', 'blood sugar', 'fasting blood sugar', 'rbs', 'random blood glucose']
  },
  creatinine: {
    canonical_name: 'Serum Creatinine',
    low: 0.6,
    high: 1.3,
    unit: 'mg/dL',
    aliases: ['serum creatinine', 'creat']
  },
  platelets: {
    canonical_name: 'Platelet Count',
    low: 150000,
    high: 450000,
    unit: '/uL',
    aliases: ['platelet count', 'plt', 'platelets', '/cumm']
  },
  wbc: {
    canonical_name: 'Total Leukocyte Count (WBC)',
    low: 4000,
    high: 11000,
    unit: '/uL',
    aliases: ['total leukocyte count', 'wbc count', 'tlc', 'white blood cells', 'leukocytes']
  },
  temperature_f: {
    canonical_name: 'Temperature',
    low: 97.0,
    high: 99.0,
    unit: '°F',
    aliases: ['temp', 'body temperature', 'temperature']
  },
  temperature_c: {
    canonical_name: 'Temperature',
    low: 36.5,
    high: 37.5,
    unit: '°C',
    aliases: ['temp c', 'temperature c']
  },
  systolic_bp: {
    canonical_name: 'Systolic Blood Pressure',
    low: 90,
    high: 120,
    unit: 'mmHg',
    aliases: ['systolic', 'sys bp', 'systolic bp']
  },
  diastolic_bp: {
    canonical_name: 'Diastolic Blood Pressure',
    low: 60,
    high: 80,
    unit: 'mmHg',
    aliases: ['diastolic', 'dia bp', 'diastolic bp']
  },
  pulse_rate: {
    canonical_name: 'Pulse Rate',
    low: 60,
    high: 100,
    unit: 'bpm',
    aliases: ['pulse', 'heart rate', 'hr']
  },
  spo2: {
    canonical_name: 'SpO2',
    low: 95,
    high: 100,
    unit: '%',
    aliases: ['oxygen saturation', 'oxygen']
  }
};

/**
 * Normalizes measurement units for comparison
 */
export function normalizeUnit(unit = '') {
  const u = String(unit).trim().toLowerCase();
  if (['g/dl', 'gm/dl', 'g/100ml', 'gm/100ml'].includes(u)) return 'g/dL';
  if (['mg/dl', 'mg/100ml'].includes(u)) return 'mg/dL';
  if (['/ul', '/cumm', '/mm3', 'cells/ul', 'cells/cumm'].includes(u)) return '/uL';
  if (['mmhg', 'mm hg'].includes(u)) return 'mmHg';
  if (['°f', 'deg f', 'f'].includes(u)) return '°F';
  if (['°c', 'deg c', 'c'].includes(u)) return '°C';
  if (['bpm', '/min', 'beats/min'].includes(u)) return 'bpm';
  if (['%', 'percent'].includes(u)) return '%';
  return unit.trim();
}

/**
 * Verifies whether two units are clinically equivalent
 */
export function areUnitsCompatible(unitA = '', unitB = '') {
  if (!unitA || !unitB) return false;
  return normalizeUnit(unitA).toLowerCase() === normalizeUnit(unitB).toLowerCase();
}

/**
 * Evaluates a single numeric value against reference bounds.
 * 
 * @param {Object} item
 * @param {string} item.test_name
 * @param {number|string|null} item.value
 * @param {string} item.unit
 * @param {number|null} [item.reference_low]
 * @param {number|null} [item.reference_high]
 * @returns {Object} Evaluated result
 */
export function evaluateSingleMetric(item = {}) {
  const testName = String(item.test_name || item.name || 'Unknown Parameter').trim();
  const rawVal = item.value;
  const originalUnit = item.unit ? String(item.unit).trim() : '';

  // 1. Handle Null or Missing Value
  if (rawVal === null || rawVal === undefined || rawVal === '') {
    return {
      test_name: testName,
      value: null,
      unit: originalUnit,
      status: 'unknown',
      reference_low: item.reference_low ?? null,
      reference_high: item.reference_high ?? null,
      range_source: 'unavailable',
      message: 'Value is missing or unavailable. Physician review recommended.',
      flagged: false
    };
  }

  // 2. Special handling for Blood Pressure string format (e.g. "150/95")
  if (typeof rawVal === 'string' && /^\d{2,3}\s*\/\s*\d{2,3}$/.test(rawVal.trim())) {
    const [sysStr, diaStr] = rawVal.split('/').map((s) => s.trim());
    const sys = Number(sysStr);
    const dia = Number(diaStr);

    let bpStatus = 'normal';
    let bpMessage = 'Within configured reference range.';

    if (sys > 120 || dia > 80) {
      bpStatus = 'high';
      bpMessage = 'Outside configured reference range — physician review recommended.';
    } else if (sys < 90 || dia < 60) {
      bpStatus = 'low';
      bpMessage = 'Outside configured reference range — physician review recommended.';
    }

    return {
      test_name: testName,
      value: rawVal,
      unit: originalUnit || 'mmHg',
      status: bpStatus,
      reference_low: 90,
      reference_high: 120,
      range_source: 'configured_fallback',
      message: bpMessage,
      flagged: bpStatus !== 'normal'
    };
  }

  // 3. Numerical Validation
  const numVal = Number(rawVal);
  if (isNaN(numVal)) {
    return {
      test_name: testName,
      value: rawVal,
      unit: originalUnit,
      status: 'unknown',
      reference_low: item.reference_low ?? null,
      reference_high: item.reference_high ?? null,
      range_source: 'unavailable',
      message: `Value '${rawVal}' is non-numeric and cannot be compared. Physician review recommended.`,
      flagged: false
    };
  }

  // Physiological negativity check
  if (numVal < 0) {
    return {
      test_name: testName,
      value: numVal,
      unit: originalUnit,
      status: 'unknown',
      reference_low: item.reference_low ?? null,
      reference_high: item.reference_high ?? null,
      range_source: 'unavailable',
      message: `Observed value ${numVal} is non-physiological / invalid. Physician review recommended.`,
      flagged: false
    };
  }

  // 4. Determine Reference Bounds & Priority
  let refLow = item.reference_low !== undefined && item.reference_low !== null ? Number(item.reference_low) : null;
  let refHigh = item.reference_high !== undefined && item.reference_high !== null ? Number(item.reference_high) : null;
  let rangeSource = 'unavailable';
  let expectedUnit = originalUnit;

  if (refLow !== null || refHigh !== null) {
    // Priority 1: Reference range printed on the report
    rangeSource = 'report';
  } else {
    // Priority 2: Configured fallback ranges
    const matchedConfig = lookupFallbackConfig(testName, originalUnit);
    if (matchedConfig) {
      refLow = matchedConfig.low;
      refHigh = matchedConfig.high;
      expectedUnit = matchedConfig.unit;
      rangeSource = 'configured_fallback';
    }
  }

  // 5. Unit Compatibility Validation
  if (rangeSource === 'configured_fallback' && originalUnit && expectedUnit) {
    if (!areUnitsCompatible(originalUnit, expectedUnit)) {
      return {
        test_name: testName,
        value: numVal,
        unit: originalUnit,
        status: 'unknown',
        reference_low: refLow,
        reference_high: refHigh,
        range_source: rangeSource,
        message: 'Unable to reliably compare value because the unit/reference information is insufficient.',
        flagged: false
      };
    }
  }

  // 6. Handle Unavailable Reference Ranges
  if (refLow === null && refHigh === null) {
    return {
      test_name: testName,
      value: numVal,
      unit: originalUnit,
      status: 'unknown',
      reference_low: null,
      reference_high: null,
      range_source: 'unavailable',
      message: 'Unable to reliably compare value because the unit/reference information is insufficient.',
      flagged: false
    };
  }

  // 7. Deterministic Bound Comparison
  let status = 'normal';
  let message = 'Within configured reference range.';
  let flagged = false;

  if (refLow !== null && numVal < refLow) {
    status = 'low';
    message = 'Outside configured reference range — physician review recommended.';
    flagged = true;
  } else if (refHigh !== null && numVal > refHigh) {
    status = 'high';
    message = 'Outside configured reference range — physician review recommended.';
    flagged = true;
  }

  return {
    test_name: testName,
    value: numVal,
    unit: originalUnit || expectedUnit,
    status,
    reference_low: refLow,
    reference_high: refHigh,
    range_source: rangeSource,
    message,
    flagged
  };
}

/**
 * Searches fallback configured ranges by test name and unit hints
 */
function lookupFallbackConfig(testName = '', unitHint = '') {
  const query = testName.trim().toLowerCase();

  // Temperature unit specialization
  if (query.includes('temp')) {
    if (unitHint.toLowerCase().includes('c') || normalizeUnit(unitHint) === '°C') {
      return CONFIG_FALLBACK_RANGES.temperature_c;
    }
    return CONFIG_FALLBACK_RANGES.temperature_f;
  }

  for (const [key, conf] of Object.entries(CONFIG_FALLBACK_RANGES)) {
    if (query === conf.canonical_name.toLowerCase()) return conf;
    if (conf.aliases.some((a) => query.includes(a.toLowerCase()) || a.toLowerCase().includes(query))) {
      return conf;
    }
  }
  return null;
}

/**
 * Evaluates all vitals and laboratory results from a structured medical extraction
 * 
 * @param {Object} structuredData - Structured data containing vitals and laboratory_results
 * @returns {Object} Enriched structured medical report
 */
export function checkAllReferenceRanges(structuredData = {}) {
  const vitals = (structuredData.vitals || []).map((v) => evaluateSingleMetric(v));
  const laboratoryResults = (structuredData.laboratory_results || []).map((l) => evaluateSingleMetric(l));

  const abnormalVitals = vitals.filter((v) => v.status === 'low' || v.status === 'high');
  const abnormalLabs = laboratoryResults.filter((l) => l.status === 'low' || l.status === 'high');
  const totalAbnormal = abnormalVitals.length + abnormalLabs.length;

  return {
    ...structuredData,
    vitals,
    laboratory_results: laboratoryResults,
    abnormal_count: totalAbnormal,
    has_abnormal_values: totalAbnormal > 0,
    disclaimer: 'Non-diagnostic observation. Value evaluated solely against configured reference range. Does not constitute a medical diagnosis or disease identification.'
  };
}
