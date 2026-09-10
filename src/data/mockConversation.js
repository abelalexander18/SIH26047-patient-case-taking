/**
 * Clinical Dialogue Configuration for Arogya AI (Indian Healthcare Context)
 * ABDM & DPDP Compliant Pre-Consultation Patient Intake.
 */

export const INITIAL_AI_MESSAGE = {
  id: 'ai-initial-1',
  sender: 'ai',
  text: "Namaste! I'm your Arogya AI clinical assistant. I'm here to understand your symptoms and prepare a structured pre-consultation report for your consulting doctor / OPD physician. What symptoms are you experiencing today?",
  timestamp: 'Just now',
  chips: [
    "Fever with chills & body ache",
    "Severe headache & dizziness",
    "Acidity, gas & stomach upset",
    "Persistent cough & sore throat",
    "BP or Blood Sugar checkup",
    "Joint & body pain"
  ]
};

export const CLINICAL_STAGES = [
  {
    stage: 1,
    title: "Chief Complaint",
    progress: 15,
    prompt: "What primary symptoms are bothering you?",
    nextQuestion: (userText) => {
      const lower = userText.toLowerCase();
      if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('chill') || lower.includes('dengue') || lower.includes('malaria')) {
        return "Noted regarding the fever and chills. When did this fever first start, and is it continuous or does it spike at specific times of day?";
      }
      if (lower.includes('headache') || lower.includes('sir dard') || lower.includes('migraine')) {
        return "I understand you are experiencing head pain. When did the headache begin, and is it accompanied by nausea or sensitivity to bright light?";
      }
      if (lower.includes('acidity') || lower.includes('gas') || lower.includes('stomach') || lower.includes('pet') || lower.includes('vomit') || lower.includes('nausea')) {
        return "Noted regarding your gastric discomfort. Did this start after eating specific food, and are you experiencing burning sensation or nausea?";
      }
      if (lower.includes('cough') || lower.includes('cold') || lower.includes('throat') || lower.includes('khansi')) {
        return "Understood. When did the cough or cold begin, and is it a dry cough or with phlegm/mucus?";
      }
      return "Thank you for sharing that. When did you first notice these symptoms, and have they been constant or coming and going?";
    },
    quickReplies: [
      "Started since morning",
      "Past 2 to 3 days",
      "About a week ago",
      "After weather change / rain",
      "Comes and goes intermittently"
    ]
  },
  {
    stage: 2,
    title: "Onset & Duration",
    progress: 35,
    prompt: "When did you first notice these symptoms?",
    nextQuestion: () => {
      return "On a scale of mild, moderate, to severe, how intense is your discomfort right now? Does it hinder your daily work or sleep?";
    },
    quickReplies: [
      "Mild (manageable, able to work)",
      "Moderate (noticeable discomfort)",
      "Severe (unable to work / rest needed)",
      "Continuous dull body ache",
      "High intensity with weakness"
    ]
  },
  {
    stage: 3,
    title: "Severity & Character",
    progress: 55,
    prompt: "How severe are your symptoms right now?",
    nextQuestion: () => {
      return "Are you noticing any accompanying symptoms such as high fever (>100°F), vomiting, loose motions, dizziness, loss of appetite, or breathing difficulty?";
    },
    quickReplies: [
      "High fever with shivering",
      "Nausea & loss of appetite",
      "Severe fatigue & body pain",
      "Breathing tightness or wheezing",
      "No other associated symptoms"
    ]
  },
  {
    stage: 4,
    title: "Associated Symptoms",
    progress: 75,
    prompt: "Any other symptoms to note for your doctor?",
    nextQuestion: () => {
      return "Have you taken any medications like Dolo-650, Paracetamol, Pantocid/acidity tablets, or home remedies (kadha)? Any relief observed?";
    },
    quickReplies: [
      "Took Paracetamol / Dolo-650 (temporary relief)",
      "Took Antacid / Pantoprazole",
      "Rest and warm water / kadha only",
      "No medicine taken yet",
      "Under existing doctor's prescription"
    ]
  },
  {
    stage: 5,
    title: "Medical History & Allergies",
    progress: 90,
    prompt: "Medical history and current medications",
    nextQuestion: () => {
      return "Do you have any existing medical conditions like Diabetes (Sugar), Hypertension (BP), Thyroid, or any drug allergies (e.g., Penicillin, Sulfa)? You may also upload your latest lab reports or prescription slip.";
    },
    quickReplies: [
      "No prior conditions or allergies",
      "Hypertension (taking daily BP tablets)",
      "Type 2 Diabetes (on Metformin / diet)",
      "Have uploaded prescription / lab report",
      "Everything noted, ready for doctor summary"
    ]
  },
  {
    stage: 6,
    title: "Review & OPD Summary",
    progress: 100,
    prompt: "Finalizing clinical intake",
    nextQuestion: () => {
      return "Dhanyavaad (Thank you). Your complete clinical intake has been compiled following ABDM clinical record formats. Your consulting doctor will review this summary before your consultation.";
    },
    quickReplies: [
      "End Interview & View Summary"
    ]
  }
];

export const INDIAN_CLINICAL_STANDARDS = {
  regulatory: "Designed following ABDM & DPDP Guidelines (Prototype)",
  dishaCompliant: false,
  abhaEnabled: false,
  emergencyHelpline: "112 / 108",
  ambulanceHelpline: "108",
  medicalAuthority: "National Health Authority (NHA) Guidelines",
};
