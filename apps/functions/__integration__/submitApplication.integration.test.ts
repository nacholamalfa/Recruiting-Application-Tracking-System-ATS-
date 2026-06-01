import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authHeader, functionUrl, DEV_TOKENS, getTestDb } from './setup';

const FN_URL = functionUrl('submitApplication');

// submitApplication requiere que existan candidato y job en Firestore.
// Estos tests cubren los casos de validación y auth que no dependen de datos sembrados.

describe('submitApplication — integración HTTP', () => {
  it('devuelve 401 sin token', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-x' }),
    });

    expect(res.status).toBe(401);
  });

  it('devuelve 400 cuando falta jobId', async () => {
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

  it('devuelve 404 cuando el candidato no existe en Firestore', async () => {
    // dev-candidate mapea al uid 'candidate-dev' que no tiene registro de candidato
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.candidate),
      },
      body: JSON.stringify({ jobId: 'job-inexistente' }),
    });

    // 404 (candidato no encontrado) o 404 (job no encontrado) según el orden de validación
    expect(res.status).toBe(404);
  });

  it('devuelve 405 para método GET', async () => {
    const res = await fetch(FN_URL, {
      method: 'GET',
      headers: authHeader(DEV_TOKENS.candidate),
    });

    expect(res.status).toBe(405);
  });

  it('TC-SA-03 jobId vacío → 400', async () => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.candidate),
      },
      body: JSON.stringify({ jobId: '' }),
    });

    expect(res.status).toBe(400);
  });

  describe('TC-SA-06 job con status closed → 422', () => {
    let db: ReturnType<typeof getTestDb>;
    const closedJobId = 'integ-job-closed';
    const candidateDevId = 'candidate-dev';

    beforeEach(async () => {
      db = getTestDb();
      await db.collection('jobs').doc(closedJobId).set({
        id: closedJobId,
        title: 'Posición Cerrada',
        status: 'closed',
        department: 'Tech',
        seniority: 'semi-senior',
        location: 'remote',
        description: 'Job cerrado para test.',
        skills: [],
        responsabilities: [],
        benefits: [],
        hiringManagerId: 'manager-dev',
        slug: 'posicion-cerrada',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.collection('candidates').doc(candidateDevId).set({
        id: candidateDevId,
        fullName: 'Candidato Dev',
        email: 'candidate@dev.com',
        phone: '099000000',
        profileStatus: 'completed',
        registrationType: 'specific',
        registrationSource: 'manual',
        cvParseStatus: 'not_required',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await db.collection('jobs').doc(closedJobId).delete();
      await db.collection('candidates').doc(candidateDevId).delete();
    });

    it('devuelve 422 cuando el job está cerrado', async () => {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({ jobId: closedJobId }),
      });

      expect(res.status).toBe(422);
    });
  });

  describe('TC-SA-08 postulación duplicada → 409', () => {
    let db: ReturnType<typeof getTestDb>;
    const openJobId = 'integ-job-open-dup';
    const candidateDevId = 'candidate-dev';
    // El repositorio construye el ID como candidateId_encodeURIComponent(jobId)
    const existingAppId = `${candidateDevId}_${encodeURIComponent(openJobId)}`;

    beforeEach(async () => {
      db = getTestDb();
      await db.collection('jobs').doc(openJobId).set({
        id: openJobId,
        title: 'Posición Abierta',
        status: 'open',
        department: 'Tech',
        seniority: 'semi-senior',
        location: 'remote',
        description: 'Job abierto para test de duplicado.',
        skills: [],
        responsabilities: [],
        benefits: [],
        hiringManagerId: 'manager-dev',
        slug: 'posicion-abierta-dup',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.collection('candidates').doc(candidateDevId).set({
        id: candidateDevId,
        fullName: 'Candidato Dev',
        email: 'candidate@dev.com',
        phone: '099000000',
        profileStatus: 'completed',
        registrationType: 'specific',
        registrationSource: 'manual',
        cvParseStatus: 'not_required',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // ID compuesto: así lo construye applicationRepository.buildApplicationId
      await db.collection('applications').doc(existingAppId).set({
        id: existingAppId,
        jobId: openJobId,
        candidateId: candidateDevId,
        stage: 'applied',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        stageUpdatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await db.collection('jobs').doc(openJobId).delete();
      await db.collection('candidates').doc(candidateDevId).delete();
      await db.collection('applications').doc(existingAppId).delete();
    });

    it('devuelve 409 cuando el candidato ya tiene una postulación activa para ese job', async () => {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.candidate),
        },
        body: JSON.stringify({ jobId: openJobId }),
      });

      expect(res.status).toBe(409);
    });
  });
});
