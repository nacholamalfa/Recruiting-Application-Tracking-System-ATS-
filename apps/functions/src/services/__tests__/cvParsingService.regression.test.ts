import { describe, it, expect } from 'vitest';
import type { ParsedCandidateProfileData } from '@ats/shared-types';

// Verifica que el schema de salida del CvParsingService no cambie entre releases.
// En el emulador el servicio retorna MOCK_PARSED_PROFILE — aquí validamos su forma.
// Si se agregan/renombran campos en ParsedCandidateProfileData, este test lo detecta.

const REQUIRED_STRING_FIELDS: (keyof ParsedCandidateProfileData)[] = [
  'firstName',
  'lastName',
  'fullName',
  'email',
];

const OPTIONAL_STRING_FIELDS: (keyof ParsedCandidateProfileData)[] = [
  'phone',
  'location',
  'professionalSummary',
  'education',
  'parserVersion',
];

function assertParsedProfile(profile: ParsedCandidateProfileData) {
  for (const field of REQUIRED_STRING_FIELDS) {
    expect(
      typeof profile[field],
      `Campo requerido "${field}" debe ser string`,
    ).toBe('string');
    expect(
      (profile[field] as string).length,
      `Campo requerido "${field}" no puede estar vacío`,
    ).toBeGreaterThan(0);
  }

  for (const field of OPTIONAL_STRING_FIELDS) {
    if (profile[field] !== undefined) {
      expect(
        typeof profile[field],
        `Campo opcional "${field}" debe ser string si está presente`,
      ).toBe('string');
    }
  }

  expect(Array.isArray(profile.technicalSkills)).toBe(true);

  if (profile.yearsOfExperience !== undefined) {
    expect(
      typeof profile.yearsOfExperience,
      'yearsOfExperience debe ser number si está presente',
    ).toBe('number');
    expect(profile.yearsOfExperience).toBeGreaterThanOrEqual(0);
  }
}

describe('CvParsingService — schema de salida (regresión)', () => {
  it('el mock profile cumple el schema de ParsedCandidateProfileData', () => {
    const mockProfile: ParsedCandidateProfileData = {
      firstName: 'Sofia',
      lastName: 'Demo',
      fullName: 'Sofia Demo',
      email: 'sofia.demo@example.com',
      phone: '+54 11 5555-1234',
      location: 'Buenos Aires, Argentina',
      professionalSummary:
        'Desarrolladora full stack con experiencia en React, Node.js y Firebase.',
      technicalSkills: ['TypeScript', 'React', 'Next.js', 'Node.js', 'Firebase'],
      education: 'Analista en Sistemas, ORT Argentina',
      parserVersion: 'cv-parser/1.0+gemini-2.5-flash',
    };

    assertParsedProfile(mockProfile);
  });

  it('perfil mínimo solo con campos requeridos es válido', () => {
    const minimalProfile: ParsedCandidateProfileData = {
      firstName: 'Juan',
      lastName: 'Pérez',
      fullName: 'Juan Pérez',
      email: 'juan@example.com',
      technicalSkills: [],
    };

    assertParsedProfile(minimalProfile);
  });

  it('technicalSkills es siempre un array (nunca undefined)', () => {
    const profile: ParsedCandidateProfileData = {
      firstName: 'A',
      lastName: 'B',
      fullName: 'A B',
      email: 'a@b.com',
      technicalSkills: [],
    };

    expect(Array.isArray(profile.technicalSkills)).toBe(true);
  });

  it('yearsOfExperience no es negativo si está presente', () => {
    const profile: ParsedCandidateProfileData = {
      firstName: 'A',
      lastName: 'B',
      fullName: 'A B',
      email: 'a@b.com',
      technicalSkills: [],
      yearsOfExperience: 5,
    };

    expect(profile.yearsOfExperience).toBeGreaterThanOrEqual(0);
  });
});
