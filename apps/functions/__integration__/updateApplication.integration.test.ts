import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

const FN_URL = functionUrl('updateApplication');
const COLLECTION = 'applications';

describe('updateApplication (EP-02) — integración HTTP + Firestore', () => {
  let db: ReturnType<typeof getTestDb>;
  const appId = 'integ-ua-app-1';

  beforeEach(async () => {
    db = getTestDb();
    await db.collection(COLLECTION).doc(appId).set({
      jobId: 'job-ua-integ',
      candidateId: 'cand-ua-integ',
      stage: 'applied',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      stageUpdatedAt: new Date(),
    });
  });

  afterEach(async () => {
    await db.collection(COLLECTION).doc(appId).delete();
  });

  it('TC-UA-01 fortalezas válidas → 200 con fortalezas actualizadas', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({
        applicationId: appId,
        fortalezas: ['Liderazgo', 'Comunicación'],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; fortalezas: string[] };
    expect(body.success).toBe(true);
    expect(body.fortalezas).toEqual(['Liderazgo', 'Comunicación']);
  });

  it('TC-UA-02 fortalezas con strings vacíos son filtrados → 200 solo con fortalezas no vacías', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({
        applicationId: appId,
        fortalezas: ['Liderazgo', '', '   '],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; fortalezas: string[] };
    expect(body.success).toBe(true);
    expect(body.fortalezas).toEqual(['Liderazgo']);
  });

  it('TC-UA-03 applicationId ausente → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ fortalezas: ['Liderazgo'] }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UA-04 applicationId vacío → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: '', fortalezas: ['Liderazgo'] }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UA-05 fortalezas no es array → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: appId, fortalezas: 'Liderazgo' }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UA-06 sin token → 401', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: appId,
        fortalezas: ['Liderazgo'],
      }),
    });

    expect(res.status).toBe(401);
  });

  it('TC-UA-07 método POST → 405', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({
        applicationId: appId,
        fortalezas: ['Liderazgo'],
      }),
    });

    expect(res.status).toBe(405);
  });
});
