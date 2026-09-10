/**
 * Arogya AI — OpenAI Medical Report Information Extraction Layer
 * Path: backend/services/medicalReportExtractor.mjs
 * 
 * Extracts structured medical data strictly matching the required schema:
 * - patient { name, age, sex }
 * - vitals [ { name, value, unit, reference_low, reference_high } ]
 * - laboratory_results [ { test_name, value, unit, reference_low, reference_high } ]
 * - medications [ { name, dose, frequency } ]
 * - diagnoses_mentioned_in_report [ string ] (explicitly written in document only)
 * - investigations [ string ]
 * - report_date (string or null)
 * 
 * Strict Safety Rules:
 * - INFORMATION EXTRACTION ONLY; zero diagnosis or prescription generation.
 * - Zero hallucination: unmentioned fields remain null or [].
 * - Preserves deterministic fallback if OPENAI_API_KEY is unset or network fails.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_EXTRACTION_PROMPT = `You are a medical document information extraction assistant for Arogya AI (Ministry of Ayush / AIIA).
Your task is to parse OCR/extracted text from a medical report into a structured JSON object.

RULES:
1. STRICT INFORMATION EXTRACTION ONLY:
   Extract ONLY data that is explicitly written in the report text.
   Do NOT generate, infer, or guess diseases or diagnoses.
   Do NOT convert abnormal laboratory values into diagnoses (e.g. if Hemoglobin is low, do NOT add "Anemia").
   "diagnoses_mentioned_in_report" must contain ONLY diagnoses or impressions explicitly written by the physician/lab in the document.
   Do NOT invent or extrapolate numbers, dates, or names.

2. STRICT SCHEMA CONFORMANCE:
   You must return a JSON object with this exact schema:
   {
     "patient": {
       "name": string | null,
       "age": number | string | null,
       "sex": string | null
     },
     "vitals": [
       {
         "name": string,
         "value": number | string | null,
         "unit": string,
         "reference_low": number | null,
         "reference_high": number | null
       }
     ],
     "laboratory_results": [
       {
         "test_name": string,
         "value": number | null,
         "unit": string,
         "reference_low": number | null,
         "reference_high": number | null
       }
     ],
     "medications": [
       {
         "name": string,
         "dose": string,
         "frequency": string
       }
     ],
     "diagnoses_mentioned_in_report": string[],
     "investigations": string[],
     "report_date": string | null
   }

3. NULL SAFETY:
   If any field is absent or not explicitly stated in the document, set it to null (or [] for arrays).`;

/**
 * Validates and normalizes structured extraction payload
 */
export function sanitizeReportExtraction(data = {}) {
  const patient = {
    name: data.patient?.name ? String(data.patient.name).trim() : null,
    age: data.patient?.age !== undefined && data.patient?.age !== null ? String(data.patient.age).trim() : null,
    sex: data.patient?.sex ? String(data.patient.sex).trim() : null
  };

  const vitals = Array.isArray(data.vitals)
    ? data.vitals
        .filter((v) => v && v.name)
        .map((v) => ({
          name: String(v.name).trim(),
          value: v.value !== undefined && v.value !== null ? v.value : null,
          unit: v.unit ? String(v.unit).trim() : '',
          reference_low: v.reference_low !== undefined && v.reference_low !== null && !isNaN(Number(v.reference_low)) ? Number(v.reference_low) : null,
          reference_high: v.reference_high !== undefined && v.reference_high !== null && !isNaN(Number(v.reference_high)) ? Number(v.reference_high) : null
        }))
    : [];

  const laboratory_results = Array.isArray(data.laboratory_results)
    ? data.laboratory_results
        .filter((l) => l && l.test_name)
        .map((l) => {
          let numVal = null;
          if (l.value !== null && l.value !== undefined && !isNaN(Number(l.value))) {
            numVal = Number(l.value);
          }
          return {
            test_name: String(l.test_name).trim(),
            value: numVal,
            unit: l.unit ? String(l.unit).trim() : '',
            reference_low: l.reference_low !== undefined && l.reference_low !== null && !isNaN(Number(l.reference_low)) ? Number(l.reference_low) : null,
            reference_high: l.reference_high !== undefined && l.reference_high !== null && !isNaN(Number(l.reference_high)) ? Number(l.reference_high) : null
          };
        })
    : [];

  const medications = Array.isArray(data.medications)
    ? data.medications
        .filter((m) => m && m.name)
        .map((m) => ({
          name: String(m.name).trim(),
          dose: m.dose ? String(m.dose).trim() : '',
          frequency: m.frequency ? String(m.frequency).trim() : ''
        }))
    : [];

  const diagnoses_mentioned_in_report = Array.isArray(data.diagnoses_mentioned_in_report)
    ? data.diagnoses_mentioned_in_report.map((d) => String(d).trim()).filter(Boolean)
    : [];

  const investigations = Array.isArray(data.investigations)
    ? data.investigations.map((i) => String(i).trim()).filter(Boolean)
    : [];

  const report_date = data.report_date ? String(data.report_date).trim() : null;

  return {
    patient,
    vitals,
    laboratory_results,
    medications,
    diagnoses_mentioned_in_report,
    investigations,
    report_date
  };
}

/**
 * Deterministic Regex Fallback Extractor
 * Operates offline without external network dependency.
 */
export function deterministicReportExtractor(rawText = '') {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  
  // 1. Patient Metadata
  let name = null;
  let age = null;
  let sex = null;
  let report_date = null;

  const nameMatch = rawText.match(/(?:patient(?:\s+name)?|name|ptn\s+name)[\s:=]+([A-Za-z\s.]+?)(?:[\n\r|,;]|$)/i);
  if (nameMatch && !/demo report|hospital/i.test(nameMatch[1])) {
    name = nameMatch[1].trim();
  }

  const ageMatch = rawText.match(/(?:age)[\s:=]+(\d{1,3})/i) || rawText.match(/(\d{1,3})\s*(?:years?\s*old|y\/?o|yr)/i);
  if (ageMatch) {
    age = ageMatch[1].trim();
  }

  const sexMatch = rawText.match(/(?:gender|sex)[\s:=]+(male|female|m|f|other)/i) || rawText.match(/\b(male|female)\b/i);
  if (sexMatch) {
    const s = sexMatch[1].toLowerCase();
    sex = s.startsWith('m') ? 'Male' : s.startsWith('f') ? 'Female' : 'Other';
  }

  const dateMatch = rawText.match(/(?:date)[\s:=]+(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i) || rawText.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/);
  if (dateMatch) {
    report_date = dateMatch[1].trim();
  }

  // 2. Vitals
  const vitals = [];

  // Blood Pressure
  const bpMatch = rawText.match(/(?:blood\s*pressure|bp)[\s:=]+(\d{2,3})\s*[/]\s*(\d{2,3})\s*(mm\s*hg)?/i);
  if (bpMatch) {
    vitals.push({
      name: 'Blood Pressure',
      value: `${bpMatch[1]}/${bpMatch[2]}`,
      unit: 'mmHg',
      reference_low: 90,
      reference_high: 120
    });
  }

  // Temperature
  const tempMatch = rawText.match(/(?:temperature|temp)[\s:=]+(\d{2,3}(?:\.\d+)?)\s*(°?\s*[fc]|deg\s*[fc])?/i);
  if (tempMatch) {
    const unitStr = (tempMatch[2] || '').toLowerCase().includes('c') ? '°C' : '°F';
    vitals.push({
      name: 'Temperature',
      value: Number(tempMatch[1]),
      unit: unitStr,
      reference_low: unitStr === '°C' ? 36.5 : 97.0,
      reference_high: unitStr === '°C' ? 37.5 : 99.0
    });
  }

  // Pulse / Heart Rate
  const pulseMatch = rawText.match(/(?:pulse(?:\s*rate)?|heart\s*rate|hr)[\s:=]+(\d{2,3})\s*(bpm)?/i);
  if (pulseMatch) {
    vitals.push({
      name: 'Pulse Rate',
      value: Number(pulseMatch[1]),
      unit: 'bpm',
      reference_low: 60,
      reference_high: 100
    });
  }

  // SpO2
  const spo2Match = rawText.match(/(?:spo2|oxygen\s*saturation)[\s:=]+(\d{2,3})\s*(%)?/i);
  if (spo2Match) {
    vitals.push({
      name: 'SpO2',
      value: Number(spo2Match[1]),
      unit: '%',
      reference_low: 95,
      reference_high: 100
    });
  }

  // 3. Laboratory Results
  const laboratory_results = [];

  const labPatterns = [
    {
      name: 'Hemoglobin',
      regex: /(?:hemoglobin|hb|hgb)[\s:=]+([0-9]{1,2}(?:\.[0-9]+)?)\s*(g\/dl|gm\/dl)?(?:.*?\(?([0-9]{1,2}(?:\.[0-9]+)?)\s*[-–]\s*([0-9]{1,2}(?:\.[0-9]+)?)\)?)?/i,
      unit: 'g/dL',
      defaultLow: 12.0,
      defaultHigh: 16.0
    },
    {
      name: 'Fasting Blood Glucose',
      regex: /(?:fasting\s*blood\s*(?:sugar|glucose)|fbs|blood\s*glucose|blood\s*sugar|glucose)[\s:=]+([0-9]{2,3}(?:\.[0-9]+)?)\s*(mg\/dl)?(?:.*?\(?([0-9]{2,3}(?:\.[0-9]+)?)\s*[-–]\s*([0-9]{2,3}(?:\.[0-9]+)?)\)?)?/i,
      unit: 'mg/dL',
      defaultLow: 70.0,
      defaultHigh: 100.0
    },
    {
      name: 'Serum Creatinine',
      regex: /(?:serum\s*creatinine|creatinine|creat)[\s:=]+([0-9]{1,2}(?:\.[0-9]+)?)\s*(mg\/dl)?(?:.*?\(?([0-9]{1,2}(?:\.[0-9]+)?)\s*[-–]\s*([0-9]{1,2}(?:\.[0-9]+)?)\)?)?/i,
      unit: 'mg/dL',
      defaultLow: 0.6,
      defaultHigh: 1.3
    },
    {
      name: 'Platelet Count',
      regex: /(?:platelet(?:\s*count)?|plt)[\s:=]+([0-9]+(?:\.[0-9]+)?)\s*(\/ul|\/cumm|lakhs?)?(?:.*?\(?([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)\)?)?/i,
      unit: '/uL',
      defaultLow: 150000,
      defaultHigh: 450000
    },
    {
      name: 'Total Leukocyte Count (WBC)',
      regex: /(?:total\s*leukocyte\s*count|wbc(?:\s*count)?|tlc)[\s:=]+([0-9]+(?:\.[0-9]+)?)\s*(\/ul|\/cumm)?(?:.*?\(?([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)\)?)?/i,
      unit: '/uL',
      defaultLow: 4000,
      defaultHigh: 11000
    }
  ];

  for (const lab of labPatterns) {
    const match = rawText.match(lab.regex);
    if (match) {
      const val = Number(match[1]);
      let refLow = match[3] ? Number(match[3]) : null;
      let refHigh = match[4] ? Number(match[4]) : null;

      laboratory_results.push({
        test_name: lab.name,
        value: val,
        unit: match[2] ? match[2].trim() : lab.unit,
        reference_low: refLow,
        reference_high: refHigh
      });
    }
  }

  // 4. Medications
  const medications = [];
  const medRegex = /(?:medication|rx|prescription|tablet|tab\.?|capsule|cap\.?)[\s:=]+([A-Za-z0-9\s]+?)(?:[\n\r|,;]|$)/gi;
  let medMatch;
  while ((medMatch = medRegex.exec(rawText)) !== null) {
    const fullMedStr = medMatch[1].trim();
    if (fullMedStr && !/laboratory|report|demo/i.test(fullMedStr)) {
      const doseMatch = fullMedStr.match(/(\d+\s*(?:mg|g|mcg|ml))/i);
      const dose = doseMatch ? doseMatch[1] : '';
      const nameOnly = doseMatch ? fullMedStr.replace(doseMatch[0], '').trim() : fullMedStr;
      medications.push({
        name: nameOnly || fullMedStr,
        dose: dose,
        frequency: ''
      });
    }
  }

  // 5. Explicit Diagnoses Mentioned in Report
  const diagnoses_mentioned_in_report = [];
  const diagRegex = /(?:diagnosis|impression|suspecting|condition)[\s:=]+([A-Za-z0-9\s,]+?)(?:[\n\r|;]|$)/gi;
  let diagMatch;
  while ((diagMatch = diagRegex.exec(rawText)) !== null) {
    const diagStr = diagMatch[1].trim();
    if (diagStr && !diagnoses_mentioned_in_report.includes(diagStr)) {
      diagnoses_mentioned_in_report.push(diagStr);
    }
  }

  // 6. Investigations
  const investigations = [];
  if (/ultrasound|u\/s|sonography/i.test(rawText)) investigations.push('Ultrasound (USG)');
  if (/x-ray|radiograph/i.test(rawText)) investigations.push('X-Ray');
  if (/ecg|electrocardiogram/i.test(rawText)) investigations.push('ECG');
  if (/ct\s*scan/i.test(rawText)) investigations.push('CT Scan');

  return sanitizeReportExtraction({
    patient: { name, age, sex },
    vitals,
    laboratory_results,
    medications,
    diagnoses_mentioned_in_report,
    investigations,
    report_date
  });
}

/**
 * Main Medical Report Extraction Function
 * Calls OpenAI structured completion if configured, or falls back seamlessly to deterministic extractor.
 * 
 * @param {string} rawText - Verbatim raw OCR text
 * @returns {Promise<Object>} Clean structured extraction matching requested schema
 */
export async function extractMedicalInformation(rawText = '') {
  if (!rawText || !rawText.trim()) {
    return sanitizeReportExtraction({});
  }

  if (OPENAI_API_KEY && OPENAI_API_KEY.trim()) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_EXTRACTION_PROMPT },
            { role: 'user', content: `DOCUMENT OCR TEXT:\n${rawText}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return sanitizeReportExtraction(parsed);
        }
      }
    } catch (apiErr) {
      console.warn('[MedicalReportExtractor] OpenAI extraction failed, using deterministic parser fallback:', apiErr.message);
    }
  }

  // Robust deterministic fallback
  return deterministicReportExtractor(rawText);
}
