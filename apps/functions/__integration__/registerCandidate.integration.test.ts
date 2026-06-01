import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

const FN_URL = functionUrl('registerCandidate');
const CANDIDATES_COLLECTION = 'candidates';
// dev-candidate token maps to uid 'candidate-dev' in httpAuth.ts
const CANDIDATE_DEV_UID = 'candidate-dev';

describe('registerCandidate (EP-08) — integración HTTP', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.collection(CANDIDATES_COLLECTION).doc(CANDIDATE_DEV_UID).delete();
    // Limpiar candidatos auto-generados de runs anteriores con el email de TC-RC-01
    const snap = await db
      .collection(CANDIDATES_COLLECTION)
      .where('email', '==', 'juan.perez@test.com')
      .get();
    await Promise.all(
      snap.docs.map(async (doc) => {
        const appSnap = await db
          .collection('applications')
          .where('candidateId', '==', doc.id)
          .get();
        await Promise.all(appSnap.docs.map((a) => a.ref.delete()));
        await doc.ref.delete();
      }),
    );
  });

  afterEach(async () => {
    db = getTestDb();
    await db.collection(CANDIDATES_COLLECTION).doc(CANDIDATE_DEV_UID).delete();
    // Limpiar candidato auto-generado por TC-RC-01
    const snap = await db
      .collection(CANDIDATES_COLLECTION)
      .where('email', '==', 'juan.perez@test.com')
      .get();
    await Promise.all(
      snap.docs.map(async (doc) => {
        const appSnap = await db
          .collection('applications')
          .where('candidateId', '==', doc.id)
          .get();
        await Promise.all(appSnap.docs.map((a) => a.ref.delete()));
        await doc.ref.delete();
      }),
    );
  });

  it('TC-RC-01 registro exitoso → 200 con candidateId', async () => {
    db = getTestDb();
    // Asegurarse de que no exista el candidato antes del test
    await db.collection(CANDIDATES_COLLECTION).doc(CANDIDATE_DEV_UID).delete();

    // registerCandidate necesita un jobId existente; sembramos uno
    const jobId = 'integ-job-rc-01';
    await db.collection('jobs').doc(jobId).set({
      title: 'Posición de Prueba RC-01',
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
        body: JSON.stringify({
          jobId,
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan.perez@test.com',
          phone: '099111222',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        candidateId: string;
        applicationId?: string;
      };
      expect(typeof body.candidateId).toBe('string');
      expect(body.candidateId.length).toBeGreaterThan(0);
    } finally {
      await db.collection('jobs').doc(jobId).delete();
    }
  });

  it('TC-RC-02 candidato ya registrado → 409', async () => {
    db = getTestDb();
    const existingEmail = 'juan.perez.rc02@test.com';
    const jobId = 'integ-job-rc-02';
    // El conflicto se detecta por: candidato con mismo email + application activa para ese job
    // El ID de la application es candidateId_encodeURIComponent(jobId)
    const existingCandidateId = 'existing-candidate-rc02';
    const existingAppId = `${existingCandidateId}_${encodeURIComponent(jobId)}`;

    await db.collection(CANDIDATES_COLLECTION).doc(existingCandidateId).set({
      id: existingCandidateId,
      firstName: 'Juan',
      lastName: 'Pérez',
      email: existingEmail,
      phone: '099111222',
      profileStatus: 'completed',
      registrationType: 'specific',
      registrationSource: 'manual',
      cvParseStatus: 'not_required',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection('jobs').doc(jobId).set({
      id: jobId,
      title: 'Posición de Prueba RC-02',
      status: 'open',
      department: 'Tech',
      seniority: 'semi-senior',
      location: 'remote',
      description: 'Job para test de duplicado RC-02.',
      skills: [],
      responsabilities: [],
      benefits: [],
      hiringManagerId: 'manager-dev',
      slug: 'posicion-rc-02',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection('applications').doc(existingAppId).set({
      id: existingAppId,
      jobId,
      candidateId: existingCandidateId,
      stage: 'applied',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      stageUpdatedAt: new Date(),
    });

    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({
          jobId,
          firstName: 'Juan',
          lastName: 'Pérez',
          email: existingEmail, // mismo email que el candidato existente
          phone: '099111222',
        }),
      });

      expect(res.status).toBe(409);
    } finally {
      await db.collection('jobs').doc(jobId).delete();
      await db
        .collection(CANDIDATES_COLLECTION)
        .doc(existingCandidateId)
        .delete();
      await db.collection('applications').doc(existingAppId).delete();
    }
  });

  it('TC-RC-03 payload inválido sin campos obligatorios → 400', async () => {
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

  it('TC-RC-04 sin token → 401', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: 'job-x',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan@test.com',
        phone: '099000000',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('TC-RC-05 método GET → 405', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: authHeader(DEV_TOKENS.candidate),
    });

    expect(res.status).toBe(405);
  });

  it('TC-RC-06 OPTIONS (preflight CORS) → 204', async () => {
    const res = await fetch(FN_URL, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
      },
    });

    expect(res.status).toBe(204);
  });
});
