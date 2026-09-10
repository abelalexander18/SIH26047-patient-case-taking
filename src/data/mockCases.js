/**
 * Centralized Mock Clinical Cases Database for Arogya AI
 * Indian Healthcare Context (ABDM & DPDP Act 2023 Aligned)
 * 
 * Safety & Clinical Principles:
 * 1. AI outputs are strictly assistive; the physician remains the final clinical decision maker.
 * 2. Red flags highlight potential safety concerns requiring prompt review; they are never disease diagnoses.
 * 3. Missing information is explicitly marked as "Not reported".
 * 4. Lab parameters are labeled as "Within reference range" or "Outside reference range", never disease claims.
 */

export const MOCK_DOCTOR_PROFILE = {
  id: 'DOC-IND-0482',
  name: 'Dr. Ananya Sharma',
  qualifications: 'MBBS, MD (General Medicine)',
  designation: 'Senior Consultant Physician',
  department: 'General Medicine & OPD Triage',
  hospital: 'Arogya AI Integrated District Hospital, New Delhi',
  nmcRegistration: 'NMC/DMC-84920',
  opdRoom: 'Room 104, OPD Block B',
};

export const MOCK_CASES = [
  {
    id: 'case-94021',
    intakeId: 'MED-94021',
    patient: {
      name: 'Ramesh Kumar',
      age: 34,
      gender: 'Male',
      phone: '+91 98765 43210',
      abhaId: '91-4920-8201-9482',
      bloodGroup: 'B+',
      location: 'Indirapuram, Ghaziabad (NCR)',
      emergencyContact: 'Sunita Kumar (Spouse) - +91 98765 43211',
    },
    intakeTime: 'Today, 10:15 AM',
    timestamp: '2026-09-10T10:15:00',
    status: 'Interview Completed',
    reviewStatus: 'Needs Review', // 'Needs Review' | 'Reviewed' | 'Accepted'
    triageCategory: 'Priority Review',
    chiefComplaint: 'High fever, shivering chills and persistent body ache for 3 days',
    
    // Safety-critical Red Flags (NON-DIAGNOSTIC clinical alerts)
    hasRedFlags: true,
    redFlags: [
      {
        id: 'rf-1',
        title: 'Potential red flag detected — requires prompt review',
        severity: 'high',
        description: 'High-grade fever (>102°F) accompanied by rigorous chills and multiple episodes of persistent vomiting with oral fluid intolerance.',
        category: 'Systemic / Hydration Concern',
        clinicalGuidance: 'Physician prompt evaluation advised to assess hydration status, hematocrit, and rule out acute infection.',
      }
    ],

    // AI Clinical Summary
    aiSummary: {
      title: 'AI Clinical Intake Summary',
      chiefComplaint: 'Acute onset febrile illness with rigors and generalised myalgia for 72 hours.',
      hpiChronology: 'Symptoms began 3 days ago following sudden weather change. Fever is continuous with evening spikes, accompanied by severe body aches and 3 episodes of bilious vomiting since yesterday.',
      severity: 'Severe (patient reports unable to perform daily activities and severe fatigue).',
      associatedSymptoms: 'Headache, chills, nausea, vomiting, loss of appetite. Patient explicitly denies chest pain, cough, shortness of breath, or rash.',
      currentMedications: 'Tab Dolo-650 (Paracetamol) taken SOS (2 doses taken yesterday with transient fever reduction).',
      relevantMedicalHistory: 'Not reported (patient denied known chronic comorbidities).',
      allergies: 'No known drug allergies reported.',
      uploadedReports: 'CBC Haemogram Report (PDF attached; Hemoglobin 8.5 g/dL [Outside reference range], Platelets 2.1 Lakh/µL [Within reference range]).',
      disclaimer: 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.',
    },

    // Structured Clinical History (Missing data strictly marked "Not reported")
    structuredHistory: {
      chiefComplaint: 'Fever with chills and body ache (Duration: 3 days)',
      historyOfPresentIllness: '34-year-old male presenting with acute fever for 3 days. Patient describes sudden onset chills and shivering, associated with dull headache and severe muscle pain. Had 3 episodes of vomiting in past 24 hours. Oral intake mildly impaired due to nausea.',
      pastMedicalHistory: 'Not reported',
      currentMedications: 'Paracetamol 650mg SOS',
      allergies: 'No known drug allergies (NKDA)',
      familyHistory: 'Not reported',
      personalSocialHistory: 'Non-smoker, sedentary office worker, denies recent international travel.',
      reviewOfSystems: {
        constitutional: 'High fever, rigors, fatigue, weakness',
        respiratory: 'No cough, no dyspnea (normal breathing)',
        gastrointestinal: 'Nausea, multiple episodes of vomiting, anorexia. No abdominal distension.',
        cardiovascular: 'Not reported',
        neurological: 'Dull generalized headache; no neck stiffness, no confusion.',
        musculoskeletal: 'Significant generalized myalgia and backache',
        dermatological: 'No petechiae, no rash reported',
      },
      investigations: 'Complete Blood Count (CBC) uploaded today.',
    },

    // Original verbatim conversation transcript
    messages: [
      {
        id: 'msg-1',
        sender: 'ai',
        text: "Namaste! I'm your Arogya AI clinical assistant. I'm here to understand your symptoms and prepare a structured pre-consultation report for your consulting doctor / OPD physician. What symptoms are you experiencing today?",
        timestamp: '10:04 AM',
      },
      {
        id: 'msg-2',
        sender: 'patient',
        text: 'I have severe fever since 3 days with shivering chills and heavy body ache.',
        timestamp: '10:06 AM',
      },
      {
        id: 'msg-3',
        sender: 'ai',
        text: 'Noted regarding the fever and chills. When did this fever first start, and is it continuous or does it spike at specific times of day?',
        timestamp: '10:06 AM',
      },
      {
        id: 'msg-4',
        sender: 'patient',
        text: 'Past 2 to 3 days. It stays almost continuous, especially high in late evenings.',
        timestamp: '10:08 AM',
      },
      {
        id: 'msg-5',
        sender: 'ai',
        text: 'On a scale of mild, moderate, to severe, how intense is your discomfort right now? Does it hinder your daily work or sleep?',
        timestamp: '10:08 AM',
      },
      {
        id: 'msg-6',
        sender: 'patient',
        text: 'Severe (unable to work / rest needed)',
        timestamp: '10:09 AM',
      },
      {
        id: 'msg-7',
        sender: 'ai',
        text: 'Are you noticing any accompanying symptoms such as high fever (>100°F), vomiting, loose motions, dizziness, loss of appetite, or breathing difficulty?',
        timestamp: '10:09 AM',
      },
      {
        id: 'msg-8',
        sender: 'patient',
        text: 'High fever with shivering and vomiting 3 times since yesterday. Cannot eat properly.',
        timestamp: '10:11 AM',
      },
      {
        id: 'msg-9',
        sender: 'ai',
        text: 'Have you taken any medications like Dolo-650, Paracetamol, Pantocid/acidity tablets, or home remedies (kadha)? Any relief observed?',
        timestamp: '10:11 AM',
      },
      {
        id: 'msg-10',
        sender: 'patient',
        text: 'Took Paracetamol / Dolo-650 (temporary relief for 3-4 hours, then fever returns).',
        timestamp: '10:12 AM',
      },
      {
        id: 'msg-11',
        sender: 'ai',
        text: 'Do you have any existing medical conditions like Diabetes (Sugar), Hypertension (BP), Thyroid, or any drug allergies (e.g., Penicillin)? You may also upload your latest lab reports or prescription slip.',
        timestamp: '10:12 AM',
      },
      {
        id: 'msg-12',
        sender: 'patient',
        text: 'No prior conditions or allergies. I have uploaded my blood report from local lab.',
        timestamp: '10:14 AM',
      },
      {
        id: 'msg-13',
        sender: 'ai',
        text: "I've successfully received and processed your medical report: \"CBC_Haemogram_Report.pdf\" (1.4 MB). I've attached it to your intake packet for your physician.",
        timestamp: '10:14 AM',
        attachedFile: {
          id: 'rep-94021-1',
          name: 'CBC_Haemogram_Report.pdf',
          size: '1.4 MB',
          type: 'application/pdf',
          uploadedAt: '10:14 AM',
        }
      },
      {
        id: 'msg-14',
        sender: 'ai',
        text: "Dhanyavaad (Thank you). Your complete clinical intake has been compiled according to ABDM clinical standards. Your consulting doctor will review this summary before your consultation.",
        timestamp: '10:15 AM',
      }
    ],

    // Uploaded medical reports & OCR lab extraction
    reports: [
      {
        id: 'rep-94021-1',
        name: 'CBC_Haemogram_Report.pdf',
        type: 'application/pdf',
        size: '1.4 MB',
        uploadedAt: '10:14 AM',
        status: 'Extracted (Mock OCR Verification)',
        documentCategory: 'Hematology / Complete Blood Count',
        laboratory: 'Dr. Lal / SRL Diagnostics Partner (ABDM Linked)',
        extractedData: [
          {
            parameter: 'Hemoglobin (Hb)',
            value: '8.5 g/dL',
            referenceRange: '13.0 - 17.0 g/dL',
            status: 'Outside reference range',
            clinicalNote: 'Moderate microcytic hypochromic anemia',
          },
          {
            parameter: 'Total Leukocyte Count (WBC)',
            value: '11,800 /µL',
            referenceRange: '4,000 - 11,000 /µL',
            status: 'Outside reference range',
            clinicalNote: 'Mild leukocytosis, suggests acute inflammatory/infective response',
          },
          {
            parameter: 'Platelet Count',
            value: '2.1 Lakh/µL',
            referenceRange: '1.5 - 4.5 Lakh/µL',
            status: 'Within reference range',
            clinicalNote: 'Normal platelet count',
          },
          {
            parameter: 'Packed Cell Volume (PCV)',
            value: '28.2 %',
            referenceRange: '40.0 - 50.0 %',
            status: 'Outside reference range',
            clinicalNote: 'Low hematocrit level',
          }
        ]
      }
    ],

    doctorNotes: '',
    provisionalDiagnosis: '',
    reviewedAt: null,
  },

  {
    id: 'case-81204',
    intakeId: 'MED-81204',
    patient: {
      name: 'Priya Sharma',
      age: 28,
      gender: 'Female',
      phone: '+91 98111 22334',
      abhaId: '91-3829-1092-8812',
      bloodGroup: 'O+',
      location: 'South Extension, New Delhi',
      emergencyContact: 'Rohit Sharma (Brother) - +91 98111 22335',
    },
    intakeTime: 'Today, 09:40 AM',
    timestamp: '2026-09-10T09:40:00',
    status: 'Interview Completed',
    reviewStatus: 'Needs Review',
    triageCategory: 'Routine Review',
    chiefComplaint: 'Unilateral pulsating headache with light sensitivity for 24 hours',
    
    hasRedFlags: false,
    redFlags: [],

    aiSummary: {
      title: 'AI Clinical Intake Summary',
      chiefComplaint: 'Throbbing hemicranial headache associated with photophobia for 1 day.',
      hpiChronology: 'Patient describes acute left-sided throbbing head pain that started yesterday afternoon after prolonged screen work. Accompanied by mild nausea and visual glare sensitivity.',
      severity: 'Moderate (pain score 6/10, manages with darkened room and rest).',
      associatedSymptoms: 'Mild nausea, photophobia, phonophobia. Explicitly denies vomiting, fever, neck stiffness, or motor weakness.',
      currentMedications: 'Took Tab Paracetamol 500mg with minimal relief.',
      relevantMedicalHistory: 'History of episodic tension/migraine headaches over past 2 years.',
      allergies: 'No known drug allergies reported.',
      uploadedReports: 'No outside records uploaded.',
      disclaimer: 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.',
    },

    structuredHistory: {
      chiefComplaint: 'Left-sided severe headache and photophobia (Duration: 1 day)',
      historyOfPresentIllness: '28-year-old female complaining of acute left frontal-temporal pulsating headache for past 24 hours. Aggravated by bright light and loud sounds. Accompanied by nausea without frank vomiting.',
      pastMedicalHistory: 'Recurrent episodic headaches since 2024 (infrequent, self-limiting).',
      currentMedications: 'Paracetamol 500mg SOS',
      allergies: 'No known drug allergies reported',
      familyHistory: 'Mother reportedly has history of recurrent migraines.',
      personalSocialHistory: 'Software engineer, high screen exposure (>10 hours/day), irregular sleep schedule.',
      reviewOfSystems: {
        constitutional: 'Fatigue, mild malaise; no fever or chills.',
        respiratory: 'Not reported',
        gastrointestinal: 'Mild nausea, no vomiting, normal bowel movements.',
        cardiovascular: 'Not reported',
        neurological: 'Unilateral temporal headache, photophobia. No visual aura, no motor or sensory focal deficits.',
        musculoskeletal: 'Cervical and shoulder tightness noted.',
        dermatological: 'Not reported',
      },
      investigations: 'Not reported (No prior imaging uploaded)',
    },

    messages: [
      {
        id: 'msg-201',
        sender: 'ai',
        text: "Namaste! I'm your Arogya AI clinical assistant. What symptoms are you experiencing today?",
        timestamp: '09:32 AM',
      },
      {
        id: 'msg-202',
        sender: 'patient',
        text: 'I have intense one-sided headache with nausea and light sensitivity since yesterday.',
        timestamp: '09:33 AM',
      },
      {
        id: 'msg-203',
        sender: 'ai',
        text: 'I understand you are experiencing head pain. When did the headache begin, and is it accompanied by nausea or sensitivity to bright light?',
        timestamp: '09:34 AM',
      },
      {
        id: 'msg-204',
        sender: 'patient',
        text: 'Started yesterday afternoon. Pain throbs on left side and hurts when looking at phone or lights.',
        timestamp: '09:35 AM',
      },
      {
        id: 'msg-205',
        sender: 'ai',
        text: 'On a scale of mild, moderate, to severe, how intense is your discomfort right now? Does it hinder your daily work or sleep?',
        timestamp: '09:36 AM',
      },
      {
        id: 'msg-206',
        sender: 'patient',
        text: 'Moderate (noticeable discomfort, had to take half-day leave).',
        timestamp: '09:37 AM',
      },
      {
        id: 'msg-207',
        sender: 'ai',
        text: 'Are you noticing any accompanying symptoms such as high fever (>100°F), vomiting, loose motions, dizziness, loss of appetite, or breathing difficulty?',
        timestamp: '09:37 AM',
      },
      {
        id: 'msg-208',
        sender: 'patient',
        text: 'No fever or vomiting. Just nausea and feeling tired.',
        timestamp: '09:38 AM',
      },
      {
        id: 'msg-209',
        sender: 'ai',
        text: 'Do you have any existing medical conditions like Diabetes, Hypertension, Thyroid, or any drug allergies?',
        timestamp: '09:39 AM',
      },
      {
        id: 'msg-210',
        sender: 'patient',
        text: 'No prior conditions or allergies. I get these headaches once in a few months.',
        timestamp: '09:39 AM',
      },
      {
        id: 'msg-211',
        sender: 'ai',
        text: "Dhanyavaad. Your clinical intake has been compiled according to ABDM clinical standards. Your consulting doctor will review this summary before your consultation.",
        timestamp: '09:40 AM',
      }
    ],

    reports: [],
    doctorNotes: '',
    provisionalDiagnosis: '',
    reviewedAt: null,
  },

  {
    id: 'case-63119',
    intakeId: 'MED-63119',
    patient: {
      name: 'Vikram Singh',
      age: 56,
      gender: 'Male',
      phone: '+91 99887 76655',
      abhaId: '91-5821-9940-1284',
      bloodGroup: 'A+',
      location: 'Noida Sector 62, Uttar Pradesh',
      emergencyContact: 'Rajesh Singh (Son) - +91 99887 76656',
    },
    intakeTime: 'Today, 08:50 AM',
    timestamp: '2026-09-10T08:50:00',
    status: 'Interview Completed',
    reviewStatus: 'Needs Review',
    triageCategory: 'Priority Review',
    chiefComplaint: 'Persistent dry cough for 10 days with mild chest tightness and hypertension history',
    
    hasRedFlags: true,
    redFlags: [
      {
        id: 'rf-2',
        title: 'Potential red flag detected — requires prompt review',
        severity: 'high',
        description: 'Persistent nocturnal cough (>10 days) with chest tightness in a 56-year-old hypertensive patient.',
        category: 'Cardiorespiratory Screening',
        clinicalGuidance: 'Physician review needed to auscultate lung fields, assess ACE-inhibitor/ARB side effect vs early cardiac/bronchial etiology.',
      }
    ],

    aiSummary: {
      title: 'AI Clinical Intake Summary',
      chiefComplaint: 'Subacute dry paroxysmal cough with exertional chest tightness for 10 days.',
      hpiChronology: '56-year-old hypertensive male reports dry irritative cough, especially worse at night. Mentions mild retrosternal tightness upon climbing stairs. Denies hemoptysis or wheezing.',
      severity: 'Moderate to severe disturbance of nocturnal sleep.',
      associatedSymptoms: 'Exertional chest heaviness, sleep disruption. Denies high fever, purulent sputum, or orthopnea.',
      currentMedications: 'Tab Telmisartan 40mg + Amlodipine 5mg OD (Hypertension medication, compliant for 3 years).',
      relevantMedicalHistory: 'Essential Hypertension (diagnosed 2021).',
      allergies: 'Reported mild allergy to Sulfa drugs (rash in past).',
      uploadedReports: 'Digital Chest X-Ray PA view uploaded (Impression: Mild bronchovascular prominence, no consolidation).',
      disclaimer: 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.',
    },

    structuredHistory: {
      chiefComplaint: 'Persistent dry cough and mild chest tightness (Duration: 10 days)',
      historyOfPresentIllness: '56-year-old male with known hypertension presenting with persistent non-productive cough for 10 days. Cough is predominantly dry, troublesome at nighttime, interfering with sleep. Patient also reports intermittent mild heaviness in chest during brisk walking.',
      pastMedicalHistory: 'Hypertension under regular medical management since 2021.',
      currentMedications: 'Tab Telmisartan 40mg + Amlodipine 5mg once daily in morning.',
      allergies: 'Sulfa drugs (causes cutaneous erythematous rash).',
      familyHistory: 'Father had coronary artery disease at age 62.',
      personalSocialHistory: 'Former smoker (quit 8 years ago; 10 pack-year history). Occasional alcohol intake.',
      reviewOfSystems: {
        constitutional: 'No fever, no weight loss, reports daytime fatigue due to poor sleep.',
        respiratory: 'Frequent dry hacking cough. No hemoptysis, no purulent sputum.',
        gastrointestinal: 'Not reported',
        cardiovascular: 'Mild retrosternal heaviness on exertion; no pedal edema, no palpitations.',
        neurological: 'Not reported',
        musculoskeletal: 'Not reported',
        dermatological: 'History of sulfa drug rash.',
      },
      investigations: 'Chest X-Ray PA View uploaded (attached below).',
    },

    messages: [
      {
        id: 'msg-301',
        sender: 'ai',
        text: "Namaste! I'm your Arogya AI clinical assistant. What symptoms are you experiencing today?",
        timestamp: '08:41 AM',
      },
      {
        id: 'msg-302',
        sender: 'patient',
        text: 'I have dry cough for more than 1 week with tightness in chest while walking fast.',
        timestamp: '08:42 AM',
      },
      {
        id: 'msg-303',
        sender: 'ai',
        text: 'Understood. When did the cough or cold begin, and is it a dry cough or with phlegm/mucus?',
        timestamp: '08:43 AM',
      },
      {
        id: 'msg-304',
        sender: 'patient',
        text: 'Dry cough without phlegm. Started about 10 days ago, especially bad at night.',
        timestamp: '08:44 AM',
      },
      {
        id: 'msg-305',
        sender: 'ai',
        text: 'On a scale of mild, moderate, to severe, how intense is your discomfort right now? Does it hinder your daily work or sleep?',
        timestamp: '08:45 AM',
      },
      {
        id: 'msg-306',
        sender: 'patient',
        text: 'Moderate. It disturbs my sleep completely at night.',
        timestamp: '08:46 AM',
      },
      {
        id: 'msg-307',
        sender: 'ai',
        text: 'Do you have any existing medical conditions like Diabetes, Hypertension, or drug allergies?',
        timestamp: '08:47 AM',
      },
      {
        id: 'msg-308',
        sender: 'patient',
        text: 'I have High BP (taking Telmisartan daily) and allergic to Sulfa medicine. I uploaded my chest X-ray.',
        timestamp: '08:48 AM',
      },
      {
        id: 'msg-309',
        sender: 'ai',
        text: "I've successfully received your medical report: \"Chest_XRay_Digital_PA.png\" (3.2 MB) and attached it for your doctor.",
        timestamp: '08:49 AM',
        attachedFile: {
          id: 'rep-63119-1',
          name: 'Chest_XRay_Digital_PA.png',
          size: '3.2 MB',
          type: 'image/png',
          uploadedAt: '08:49 AM',
        }
      },
      {
        id: 'msg-310',
        sender: 'ai',
        text: "Dhanyavaad. Your complete clinical intake has been compiled according to ABDM clinical standards. Your consulting doctor will review this summary before your consultation.",
        timestamp: '08:50 AM',
      }
    ],

    reports: [
      {
        id: 'rep-63119-1',
        name: 'Chest_XRay_Digital_PA.png',
        type: 'image/png',
        size: '3.2 MB',
        uploadedAt: '08:49 AM',
        status: 'Extracted (Mock Radiology Verification)',
        documentCategory: 'Diagnostic Imaging / Digital Radiography',
        laboratory: 'Apex Diagnostic Centre (Noida)',
        extractedData: [
          {
            parameter: 'Lung Parenchyma',
            value: 'Mild prominent bronchovascular markings',
            referenceRange: 'Clear lung fields bilaterally',
            status: 'Outside reference range',
            clinicalNote: 'Peribronchial thickening without focal alveolar consolidation',
          },
          {
            parameter: 'Cardiothoracic Ratio (CTR)',
            value: '0.48 (Normal cardiac size)',
            referenceRange: '< 0.50',
            status: 'Within reference range',
            clinicalNote: 'Cardiac silhouette within normal limits',
          },
          {
            parameter: 'Costophrenic Angles',
            value: 'Sharp & clear bilaterally',
            referenceRange: 'Sharp bilaterally',
            status: 'Within reference range',
            clinicalNote: 'No pleural effusion seen',
          }
        ]
      }
    ],

    doctorNotes: '',
    provisionalDiagnosis: '',
    reviewedAt: null,
  },

  {
    id: 'case-52018',
    intakeId: 'MED-52018',
    patient: {
      name: 'Sunita Patel',
      age: 42,
      gender: 'Female',
      phone: '+91 97234 56789',
      abhaId: '91-2940-1923-4491',
      bloodGroup: 'B+',
      location: 'Vasant Kunj, New Delhi',
      emergencyContact: 'Kishore Patel (Spouse) - +91 97234 56780',
    },
    intakeTime: 'Yesterday, 04:30 PM',
    timestamp: '2026-09-09T16:30:00',
    status: 'Interview Completed',
    reviewStatus: 'Reviewed',
    triageCategory: 'Routine Review',
    chiefComplaint: 'Epigastric burning, acid reflux, post-prandial bloating for 5 days',
    
    hasRedFlags: false,
    redFlags: [],

    aiSummary: {
      title: 'AI Clinical Intake Summary',
      chiefComplaint: 'Dyspepsia with retrosternal burning and post-meal fullness for 5 days.',
      hpiChronology: '42-year-old female reports worsening burning sensation in upper abdomen and retrosternal area after meals, particularly post dinner. Reports sour belching and bloating.',
      severity: 'Mild to moderate, aggravated by spicy foods.',
      associatedSymptoms: 'Sour regurgitation, bloating. Denies hematemesis, melena, weight loss, dysphagia, or radiation to back.',
      currentMedications: 'Metformin 500mg BD for Type 2 Diabetes; took Gelusil antacid suspension with temporary relief.',
      relevantMedicalHistory: 'Type 2 Diabetes Mellitus (HbA1c 7.1% last month).',
      allergies: 'No known drug allergies reported.',
      uploadedReports: 'Recent Fasting Blood Sugar lab slip uploaded (FBS 134 mg/dL [Outside reference range]).',
      disclaimer: 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.',
    },

    structuredHistory: {
      chiefComplaint: 'Epigastric burning, acidity and bloating (Duration: 5 days)',
      historyOfPresentIllness: '42-year-old female presents with gastric discomfort and burning sensation in epigastric region radiating upwards. Symptoms prominent 1-2 hours post meals and when lying down flat. No history of early satiety or unintentional weight loss.',
      pastMedicalHistory: 'Type 2 Diabetes Mellitus for 4 years on oral hypoglycemics.',
      currentMedications: 'Tab Metformin 500mg twice daily with meals.',
      allergies: 'No known drug allergies reported',
      familyHistory: 'Not reported',
      personalSocialHistory: 'Non-smoker, homemaker, reports increased domestic stress over past month.',
      reviewOfSystems: {
        constitutional: 'No fever, normal energy levels.',
        respiratory: 'Not reported',
        gastrointestinal: 'Epigastric tenderness on self-palpation, acid reflux, bloating. Normal bowel habits.',
        cardiovascular: 'No chest pressure or palpitations.',
        neurological: 'Not reported',
        musculoskeletal: 'Not reported',
        dermatological: 'Not reported',
      },
      investigations: 'Fasting Blood Glucose report uploaded.',
    },

    messages: [
      {
        id: 'msg-401',
        sender: 'ai',
        text: "Namaste! I'm your Arogya AI clinical assistant. What symptoms are you experiencing today?",
        timestamp: '04:22 PM',
      },
      {
        id: 'msg-402',
        sender: 'patient',
        text: 'I have bad acidity, gas and burning in chest and stomach since last week.',
        timestamp: '04:23 PM',
      },
      {
        id: 'msg-403',
        sender: 'ai',
        text: 'Noted regarding your gastric discomfort. Did this start after eating specific food, and are you experiencing burning sensation or nausea?',
        timestamp: '04:24 PM',
      },
      {
        id: 'msg-404',
        sender: 'patient',
        text: 'Yes, burning sensation especially after dinner and when lying down.',
        timestamp: '04:25 PM',
      },
      {
        id: 'msg-405',
        sender: 'ai',
        text: 'Do you have any existing medical conditions like Diabetes (Sugar), Hypertension (BP), Thyroid, or drug allergies?',
        timestamp: '04:26 PM',
      },
      {
        id: 'msg-406',
        sender: 'patient',
        text: 'I have Sugar (Type 2 Diabetes, taking Metformin 500mg). No drug allergies.',
        timestamp: '04:27 PM',
      },
      {
        id: 'msg-407',
        sender: 'ai',
        text: "Dhanyavaad. Your clinical intake has been compiled according to ABDM clinical standards. Your consulting doctor will review this summary before your consultation.",
        timestamp: '04:30 PM',
      }
    ],

    reports: [
      {
        id: 'rep-52018-1',
        name: 'Blood_Glucose_FBS_Slip.pdf',
        type: 'application/pdf',
        size: '640 KB',
        uploadedAt: '04:28 PM',
        status: 'Extracted (Mock OCR Verification)',
        documentCategory: 'Biochemistry / Glycemic Profile',
        laboratory: 'PathCare Diagnostic Labs',
        extractedData: [
          {
            parameter: 'Fasting Blood Glucose (FBS)',
            value: '134 mg/dL',
            referenceRange: '70 - 100 mg/dL',
            status: 'Outside reference range',
            clinicalNote: 'Impaired fasting glucose in known diabetic',
          },
          {
            parameter: 'Post-Prandial Glucose (PPBS)',
            value: '172 mg/dL',
            referenceRange: '< 140 mg/dL',
            status: 'Outside reference range',
            clinicalNote: 'Above non-diabetic target range',
          }
        ]
      }
    ],

    doctorNotes: 'Advised lifestyle modification: small frequent meals, avoid lying down within 2 hours of dinner. Prescribed PPI (Pantoprazole 40mg OD AC) for 2 weeks.',
    provisionalDiagnosis: 'Gastroesophageal Reflux Disease (GERD) with Non-Ulcer Dyspepsia; Type 2 DM (Suboptimal control)',
    reviewedAt: 'Yesterday, 05:15 PM by Dr. Ananya Sharma',
  }
];
