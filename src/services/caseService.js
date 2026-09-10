/**
 * Arogya AI - Case Service
 * Client API for fetching and managing clinical cases from the Node.js backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Fetch all patient intake cases from the backend.
 */
export async function fetchCases() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching cases`);
    }
    const data = await res.json();
    return data.cases || data;
  } catch (err) {
    console.warn('[CaseService] Backend /api/cases unavailable, using offline state:', err.message);
    return null;
  }
}

/**
 * Fetch a single case by ID or intakeId.
 */
export async function fetchCaseById(caseId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching case ${caseId}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[CaseService] Failed to fetch case ${caseId}:`, err.message);
    return null;
  }
}

/**
 * Initialize a new case on the backend.
 */
export async function createCaseOnBackend(initialData) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialData),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} creating case`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[CaseService] Failed to create case on backend:', err.message);
    return null;
  }
}

/**
 * Update physician clinical notes, diagnosis, and review status.
 */
export async function saveDoctorNotesToBackend(caseId, { notes, provisionalDiagnosis, reviewStatus }) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorNotes: notes,
        provisionalDiagnosis,
        reviewStatus,
      }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} saving doctor notes`);
    }
    const data = await res.json();
    return data.case || data;
  } catch (err) {
    console.warn(`[CaseService] Failed to save doctor notes for ${caseId}:`, err.message);
    return null;
  }
}
