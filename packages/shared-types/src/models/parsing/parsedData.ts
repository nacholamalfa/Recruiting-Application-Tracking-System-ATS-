import type { ParsedEducation } from './parsed-education';
import type { ParsedExperience } from './parsed-experience';

/**
 * Forma del JSON estructurado que devuelve el parser de CV (Vertex AI).
 * Es el contrato que persiste `candidates/{id}.parsedData` cuando
 * `cvParseStatus === "done"`.
 */
export interface ParsedCandidateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  workExperience?: ParsedExperience[];
  education?: ParsedEducation[];

  rawText?: string;
  parserVersion?: string;
}
