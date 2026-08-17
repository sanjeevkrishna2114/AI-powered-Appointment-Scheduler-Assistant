const DEPARTMENT_MAP: Record<string, string> = {
  // Existing
  dentist: "Dentistry",
  dental: "Dentistry",
  cardiology: "Cardiology",
  cardiologist: "Cardiology",
  ent: "ENT",
  physiotherapy: "Physiotherapy",
  physio: "Physiotherapy",
  general: "General Medicine",

  orthopedics: "Orthopedics",
  ortho: "Orthopedics",
  orthopedist: "Orthopedics",
  pediatrics: "Pediatrics",
  pediatrician: "Pediatrics",
  peds: "Pediatrics",
  neurology: "Neurology",
  neurologist: "Neurology",
  neuro: "Neurology",
  oncology: "Oncology",
  oncologist: "Oncology",
  cancer: "Oncology",
  gynecology: "Gynecology",
  gynaecology: "Gynecology",
  obgyn: "Obstetrics & Gynecology",
  obstetrics: "Obstetrics & Gynecology",
  gynecologist: "Gynecology",
  dermatology: "Dermatology",
  dermatologist: "Dermatology",
  derma: "Dermatology",
  skin: "Dermatology",
  psychiatry: "Psychiatry",
  psychiatrist: "Psychiatry",
  psychology: "Psychology",
  psychologist: "Psychology",
  ophthalmology: "Ophthalmology",
  ophthalmologist: "Ophthalmology",
  eye: "Ophthalmology",
  optometry: "Optometry",
  optometrist: "Optometry",
  urology: "Urology",
  urologist: "Urology",
  endocrinology: "Endocrinology",
  endocrinologist: "Endocrinology",
  gastroenterology: "Gastroenterology",
  gastroenterologist: "Gastroenterology",
  gastro: "Gastroenterology",
  pulmonology: "Pulmonology",
  pulmonologist: "Pulmonology",
  lungs: "Pulmonology",
  rheumatology: "Rheumatology",
  rheumatologist: "Rheumatology",
  nephrology: "Nephrology",
  nephrologist: "Nephrology",
  kidney: "Nephrology",
  radiology: "Radiology",
  radiologist: "Radiology",
  xray: "Radiology",
  mri: "Radiology",
  pathology: "Pathology",
  pathologist: "Pathology",
  blood: "Pathology",
  lab: "Pathology",
  surgery: "General Surgery",
  surgeon: "General Surgery",
  emergency: "Emergency Medicine",
  er: "Emergency Medicine",
  icu: "Intensive Care Unit"
};

export function normalizeDepartment(raw: string | null): { value: string | null; confidence: number } {
  if (!raw) return { value: null, confidence: 0 };
  
  const key = raw.trim().toLowerCase();
  
  // Exact or direct map match
  if (DEPARTMENT_MAP[key]) {
      return { value: DEPARTMENT_MAP[key], confidence: 1.0 };
  }

  // Simple fuzzy fallback (e.g. check if it's a substring)
  // For a real app, use fastest-levenshtein or fuse.js
  for (const [map_key, map_val] of Object.entries(DEPARTMENT_MAP)) {
      if (key.includes(map_key) || map_key.includes(key)) {
           // fuzzy fallback — flag lower confidence if only a fuzzy match was found
          return { value: map_val, confidence: 0.6 }; 
      }
  }

  // no match found -> treat as unknown, don't guess
  return { value: null, confidence: 0 }; 
}
