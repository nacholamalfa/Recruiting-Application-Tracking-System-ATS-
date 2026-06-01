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
});
