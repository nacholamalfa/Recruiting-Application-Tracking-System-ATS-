import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

const FN_URL = functionUrl('updateApplicationStage');
const COLLECTION = 'applications';

describe('updateApplicationStage — integración HTTP + Firestore', () => {
  let db: ReturnType<typeof getTestDb>;
  const appId = 'integ-stage-app-1';

  beforeEach(async () => {
    db = getTestDb();
    await db.collection(COLLECTION).doc(appId).set({
      jobId: 'job-integ',
      candidateId: 'cand-integ',
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

  it('actualiza el stage en Firestore y devuelve { ok: true }', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: appId, stage: 'screening' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const snap = await db.collection(COLLECTION).doc(appId).get();
    expect(snap.data()?.stage).toBe('screening');
    expect(snap.data()?.status).toBe('active');
  });

  it('devuelve 401 sin token de autorización', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: appId, stage: 'screening' }),
    });

    expect(res.status).toBe(401);
  });

  it('devuelve 404 cuando la postulación no existe', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: 'no-existe', stage: 'screening' }),
    });

    expect(res.status).toBe(404);
  });

  it('devuelve 405 para método GET', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(405);
  });

  it('setea status hired cuando stage es hired', async () => {
    await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: appId, stage: 'hired' }),
    });

    const snap = await db.collection(COLLECTION).doc(appId).get();
    expect(snap.data()?.stage).toBe('hired');
    expect(snap.data()?.status).toBe('hired');
  });

  it('TC-UAS-02 stage rejected con rejectionReason → 200 y Firestore actualizado', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({
        applicationId: appId,
        stage: 'rejected',
        rejectionReason: 'No cumple los requisitos mínimos.',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const snap = await db.collection(COLLECTION).doc(appId).get();
    expect(snap.data()?.stage).toBe('rejected');
    expect(snap.data()?.status).toBe('rejected');
    expect(snap.data()?.rejectionReason).toBe('No cumple los requisitos mínimos.');
  });

  it('TC-UAS-03 stage rejected SIN rejectionReason → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: appId, stage: 'rejected' }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UAS-04 stage inválido → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: appId, stage: 'stage_inexistente' }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UAS-05 applicationId ausente en body → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ stage: 'screening' }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UAS-06 stage ausente → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ applicationId: appId }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-UAS-11 notes opcional → 200 y Firestore tiene notes', async () => {
    const res = await fetch(FN_URL, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({
        applicationId: appId,
        stage: 'screening',
        notes: 'Candidato prometedor, revisar CV con detalle.',
      }),
    });

    expect(res.status).toBe(200);

    const snap = await db.collection(COLLECTION).doc(appId).get();
    expect(snap.data()?.notes).toBe('Candidato prometedor, revisar CV con detalle.');
  });
});
