import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

const FN_URL = functionUrl('getApplicationsByJob');
const JOBS_COLLECTION = 'jobs';
const APPS_COLLECTION = 'applications';

describe('getApplicationsByJob — integración HTTP + Firestore', () => {
  let db: ReturnType<typeof getTestDb>;
  const jobId = 'integ-job-1';
  const appId = 'integ-app-for-job-1';

  beforeEach(async () => {
    db = getTestDb();
    await db.collection(JOBS_COLLECTION).doc(jobId).set({
      title: 'Dev Test',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection(APPS_COLLECTION).doc(appId).set({
      jobId,
      candidateId: 'cand-integ',
      candidateName: 'Test Candidato',
      candidateEmail: 'test@integ.com',
      stage: 'applied',
      status: 'active',
      fitScore: 80,
      createdAt: new Date(),
      updatedAt: new Date(),
      stageUpdatedAt: new Date(),
    });
  });

  afterEach(async () => {
    await db.collection(JOBS_COLLECTION).doc(jobId).delete();
    await db.collection(APPS_COLLECTION).doc(appId).delete();
  });

  it('devuelve 200 con array de postulaciones para un job existente', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('jobId', jobId);

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it('devuelve 400 cuando falta jobId', async () => {
    const res = await fetch(FN_URL, {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(400);
  });

  it('devuelve 401 sin token', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('jobId', jobId);

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

  it('TC-GAJ-03 orderBy=fitScore&orderDirection=desc devuelve array ordenado descendente', async () => {
    const appId2 = 'integ-app-for-job-2';
    db = getTestDb();
    await db.collection(APPS_COLLECTION).doc(appId2).set({
      jobId,
      candidateId: 'cand-integ-2',
      candidateName: 'Segundo Candidato',
      candidateEmail: 'second@integ.com',
      stage: 'applied',
      status: 'active',
      fitScore: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      stageUpdatedAt: new Date(),
    });

    try {
      const url = new URL(FN_URL);
      url.searchParams.set('jobId', jobId);
      url.searchParams.set('orderBy', 'fitScore');
      url.searchParams.set('orderDirection', 'desc');

      const res = await fetch(url.toString(), {
        headers: authHeader(DEV_TOKENS.recruiter),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ fitScore?: number }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);

      const scores = body.map((a) => a.fitScore ?? 0);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    } finally {
      await db.collection(APPS_COLLECTION).doc(appId2).delete();
    }
  });

  it('TC-GAJ-04 limit=1 devuelve array de máximo 1 elemento', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('jobId', jobId);
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(1);
  });

  it('TC-GAJ-06 jobId vacío → 400', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('jobId', '');

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(400);
  });

  it('TC-GAJ-07 jobId no existe → 404', async () => {
    const url = new URL(FN_URL);
    url.searchParams.set('jobId', 'no-existe-xyz-99');

    const res = await fetch(url.toString(), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(404);
  });
});
