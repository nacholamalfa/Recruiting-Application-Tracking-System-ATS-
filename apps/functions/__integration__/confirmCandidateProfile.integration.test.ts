import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authHeader, functionUrl, DEV_TOKENS, getTestDb } from './setup';
import {
  FIXTURE_IDS,
  FIXTURE_PROFILE,
  seedLinkedFixture,
  seedMismatchFixture,
  cleanLinkedFixture,
  cleanMismatchFixture,
} from './fixtures';

// EP-11: confirmCandidateProfile — PATCH
const FN_URL = functionUrl('confirmCandidateProfile');

const VALID_PROFILE = {
  firstName: FIXTURE_PROFILE.firstName,
  lastName: FIXTURE_PROFILE.lastName,
  email: FIXTURE_PROFILE.email,
  phone: FIXTURE_PROFILE.phone,
};

describe('confirmCandidateProfile (EP-11) — integración HTTP', () => {
  describe('TC-CCP-01 confirmación exitosa → 200', () => {
    beforeEach(seedLinkedFixture);
    afterEach(cleanLinkedFixture);

    it('TC-CCP-01', async () => {
      const res = await fetch(FN_URL, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({
          candidateId: FIXTURE_IDS.candidateId,
          applicationId: FIXTURE_IDS.applicationId,
          profile: VALID_PROFILE,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('candidateId', FIXTURE_IDS.candidateId);
      expect(body).toHaveProperty('profileStatus', 'completed');
    });
  });

  it('TC-CCP-02 candidateId ausente → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.candidate),
      },
      body: JSON.stringify({ profile: VALID_PROFILE }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-CCP-03 profile ausente → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.candidate),
      },
      body: JSON.stringify({ candidateId: 'any-candidate-id' }),
    });

    expect(res.status).toBe(400);
  });

  describe('TC-CCP-04 application pertenece a otro candidato → 403', () => {
    beforeEach(async () => {
      await seedLinkedFixture();
      await seedMismatchFixture();
    });
    afterEach(async () => {
      await cleanLinkedFixture();
      await cleanMismatchFixture();
    });

    it('TC-CCP-04', async () => {
      const res = await fetch(FN_URL, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({
          candidateId: FIXTURE_IDS.mismatchCandidateId,
          applicationId: FIXTURE_IDS.applicationId,
          profile: VALID_PROFILE,
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('TC-CCP-05 candidato no existe → 404', () => {
    it('TC-CCP-05', async () => {
      const res = await fetch(FN_URL, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({
          candidateId: 'candidato-inexistente-xyz',
          profile: VALID_PROFILE,
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('TC-CCP-06 application no existe → 404', () => {
    beforeEach(seedLinkedFixture);
    afterEach(cleanLinkedFixture);

    it('TC-CCP-06', async () => {
      const res = await fetch(FN_URL, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({
          candidateId: FIXTURE_IDS.candidateId,
          applicationId: 'application-inexistente-xyz',
          profile: VALID_PROFILE,
        }),
      });

      // El servicio busca la application y lanza not-found si no existe
      expect(res.status).toBe(404);
    });
  });

  it('TC-CCP-07 sin token → 401', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId: 'any',
        profile: VALID_PROFILE,
      }),
    });

    expect(res.status).toBe(401);
  });

  it('TC-CCP-08 método GET → 405', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: authHeader(DEV_TOKENS.candidate),
    });

    expect(res.status).toBe(405);
  });
});
