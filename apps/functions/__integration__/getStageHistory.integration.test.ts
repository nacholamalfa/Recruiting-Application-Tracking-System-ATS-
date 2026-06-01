import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

const FN_URL = functionUrl('getStageHistory');
const COLLECTION = 'applications';

describe('getStageHistory — integración HTTP + Firestore', () => {
  let db: ReturnType<typeof getTestDb>;
  const appId = 'integ-history-app-1';

  beforeEach(async () => {
    db = getTestDb();
    await db.collection(COLLECTION).doc(appId).set({
      jobId: 'job-h',
      candidateId: 'cand-h',
      stage: 'screening',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      stageUpdatedAt: new Date(),
    });
  });

  afterEach(async () => {
    await db.collection(COLLECTION).doc(appId).delete();
  });

  it('devuelve 200 con array de historial para una postulación existente', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('applicationId', appId);

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('devuelve 400 cuando falta applicationId', async () => {
    const res = await fetch(FN_URL, {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(400);
  });

  it('devuelve 404 cuando la postulación no existe', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('applicationId', 'no-existe-xyz');

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(404);
  });

  it('devuelve 401 sin token', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('applicationId', appId);

    const res = await fetch(url.toString());

    expect(res.status).toBe(401);
  });

  it('devuelve 405 para método POST', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(405);
  });
});
