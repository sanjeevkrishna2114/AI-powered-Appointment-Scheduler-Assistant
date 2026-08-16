const DEPARTMENT_MAP: Record<string, string> = {
  dentist: "Dentistry",
  dental: "Dentistry",
  cardiology: "Cardiology",
  cardiologist: "Cardiology",
  ent: "ENT",
  physiotherapy: "Physiotherapy",
  physio: "Physiotherapy",
  general: "General Medicine",
  // extend as needed — document this is a known-scope limitation
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
