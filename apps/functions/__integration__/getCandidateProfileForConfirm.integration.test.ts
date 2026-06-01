import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authHeader, functionUrl, DEV_TOKENS } from './setup';
import {
  FIXTURE_IDS,
  seedLinkedFixture,
  seedMismatchFixture,
  cleanLinkedFixture,
  cleanMismatchFixture,
} from './fixtures';

// EP-10: getCandidateProfileForConfirmation — GET
const FN_URL = functionUrl('getCandidateProfileForConfirmation');

describe('getCandidateProfileForConfirmation (EP-10) — integración HTTP', () => {
  describe('TC-GPC-01 candidato y application existentes → 200 perfil completo', () => {
    beforeEach(seedLinkedFixture);
    afterEach(cleanLinkedFixture);

    it('TC-GPC-01', async () => {
      const url = new URL(FN_URL);
      url.searchParams.set('candidateId', FIXTURE_IDS.candidateId);
      url.searchParams.set('applicationId', FIXTURE_IDS.applicationId);

      const res = await fetch(url.toString(), {
        headers: authHeader(DEV_TOKENS.candidate),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('candidateId');
      expect(body).toHaveProperty('applicationId');
    });
  });

  it('TC-GPC-02 candidato no existe → 404', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('candidateId', 'candidato-que-no-existe-xyz');
    url.searchParams.set('applicationId', 'app-que-no-existe-xyz');

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.candidate),
    });

    expect(res.status).toBe(404);
  });

  it('TC-GPC-03 application no existe → 404', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('candidateId', 'candidato-sin-app-xyz');
    url.searchParams.set('applicationId', 'app-inexistente-xyz');

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.candidate),
    });

    expect(res.status).toBe(404);
  });

  describe('TC-GPC-04 application pertenece a otro candidato → 403 mismatch', () => {
    const alienAppId = 'fixture-app-alien';

    beforeEach(async () => {
      await seedLinkedFixture();
      // Crear una application cuyo candidateId NO es fixture-candidate-1
      const db = (await import('./setup')).getTestDb();
      await db.collection('applications').doc(alienAppId).set({
        id: alienAppId,
        candidateId: 'some-other-candidate-not-fixture',
        jobId: FIXTURE_IDS.jobId,
        stage: 'applied',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        stageUpdatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await cleanLinkedFixture();
      const db = (await import('./setup')).getTestDb();
      await db.collection('applications').doc(alienAppId).delete();
    });

    it('TC-GPC-04', async () => {
      const url = new URL(FN_URL);
      // candidateId es el fixture real, pero la application pertenece a otro candidato
      url.searchParams.set('candidateId', FIXTURE_IDS.candidateId);
      url.searchParams.set('applicationId', alienAppId);

      const res = await fetch(url.toString(), {
        headers: authHeader(DEV_TOKENS.candidate),
      });

      expect(res.status).toBe(403);
    });
  });

  it('TC-GPC-05 sin token → 401', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('candidateId', 'any');
    url.searchParams.set('applicationId', 'any');

    const res = await fetch(url.toString());

    expect(res.status).toBe(401);
  });
});
