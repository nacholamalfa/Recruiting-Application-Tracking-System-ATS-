import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

const FN_URL = functionUrl('registerCandidateCV');
const CANDIDATES_COLLECTION = 'candidates';
// dev-candidate token maps to uid 'candidate-dev' in httpAuth.ts
const CANDIDATE_DEV_UID = 'candidate-dev';

describe('registerCandidateCV (EP-09) — integración HTTP', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.collection(CANDIDATES_COLLECTION).doc(CANDIDATE_DEV_UID).set({
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan.perez@test.com',
      phone: '099111222',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    await db.collection(CANDIDATES_COLLECTION).doc(CANDIDATE_DEV_UID).delete();
  });

  it('TC-RCV-01 payload válido con candidato existente → 200', async () => {
    const jobId = 'integ-job-rcv-01';
    db = getTestDb();
    await db.collection('jobs').doc(jobId).set({
      title: 'Posición CV Test',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({ jobId }),
      });

      expect(res.status).toBe(200);
    } finally {
      await db.collection('jobs').doc(jobId).delete();
    }
  });

  it('TC-RCV-02 payload sin jobId → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.candidate),
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('TC-RCV-03 sin token → 401', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-x' }),
    });

    expect(res.status).toBe(401);
  });

  it('TC-RCV-04 método GET → 405', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: authHeader(DEV_TOKENS.candidate),
    });

    expect(res.status).toBe(405);
  });
});
