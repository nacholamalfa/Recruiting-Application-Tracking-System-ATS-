import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDb, authHeader, functionUrl, DEV_TOKENS } from './setup';

// F-08 — Gestión de posiciones (CP-GP-01 a CP-GP-04)
// Cubre: createJob, updatePosition, updatePositionStatus, listOpenJobs

const VALID_JOB_PAYLOAD = {
  title: 'Desarrollador Full Stack Integ',
  department: 'Tecnología',
  seniority: 'semi-senior',
  location: 'remote',
  description: 'Posición de integración para tests.',
  skills: [{ name: 'TypeScript', type: 'mandatory', weight: 1, yearsOfExperience: 2 }],
  responsabilities: ['Desarrollar features'],
  benefits: ['Trabajo remoto'],
  hiringManagerId: 'manager-integ',
};

describe('Gestión de posiciones (F-08) — integración HTTP', () => {
  let db: ReturnType<typeof getTestDb>;
  let createdJobId: string | null = null;

  afterEach(async () => {
    if (createdJobId) {
      db = getTestDb();
      await db.collection('jobs').doc(createdJobId).delete();
      createdJobId = null;
    }
  });

  // CP-GP-01 — Crear posición exitosamente
  it('CP-GP-01 TC crear posición válida → 200 con jobId', async () => {
    const res = await fetch(functionUrl('createJob'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify(VALID_JOB_PAYLOAD),
    });

    const body = await res.json();
    expect(res.status, `createJob error: ${JSON.stringify(body)}`).toBe(200);
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);

    createdJobId = body.id;

    // Verificar que aparece en Firestore
    db = getTestDb();
    const snap = await db.collection('jobs').doc(createdJobId!).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.status).toBe('draft');
  });

  // CP-GP-01 / F-01 — Posición publicada aparece en tablero público (listOpenJobs)
  it('CP-TP-01 posición con status=open aparece en listOpenJobs sin auth', async () => {
    db = getTestDb();
    const jobId = 'integ-open-job-tablero';
    await db.collection('jobs').doc(jobId).set({
      ...VALID_JOB_PAYLOAD,
      id: jobId,
      status: 'open',
      slug: 'dev-full-stack-integ-tablero',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const res = await fetch(functionUrl('listOpenJobs'));

      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ id: string }>;
      expect(Array.isArray(body)).toBe(true);
      const found = body.some((j) => j.id === jobId);
      expect(found).toBe(true);
    } finally {
      await db.collection('jobs').doc(jobId).delete();
    }
  });

  // CP-TP-03 — Posición cerrada NO aparece en listOpenJobs
  it('CP-TP-03 posición con status=closed no aparece en listOpenJobs', async () => {
    db = getTestDb();
    const jobId = 'integ-closed-job-tablero';
    await db.collection('jobs').doc(jobId).set({
      ...VALID_JOB_PAYLOAD,
      id: jobId,
      status: 'closed',
      slug: 'dev-full-stack-integ-closed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const res = await fetch(functionUrl('listOpenJobs'));

      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ id: string }>;
      const found = body.some((j) => j.id === jobId);
      expect(found).toBe(false);
    } finally {
      await db.collection('jobs').doc(jobId).delete();
    }
  });

  // CP-GP-02 — Editar posición existente
  describe('CP-GP-02 editar posición existente → cambios reflejados en Firestore', () => {
    const jobId = 'integ-job-to-edit';

    beforeEach(async () => {
      db = getTestDb();
      await db.collection('jobs').doc(jobId).set({
        ...VALID_JOB_PAYLOAD,
        id: jobId,
        status: 'draft',
        slug: 'dev-full-stack-to-edit',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await db.collection('jobs').doc(jobId).delete();
    });

    it('CP-GP-02', async () => {
      const res = await fetch(functionUrl('updatePosition'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.recruiter),
        },
        body: JSON.stringify({
          id: jobId,
          title: 'Título Actualizado',
        }),
      });

      expect(res.status).toBe(200);

      const snap = await db.collection('jobs').doc(jobId).get();
      expect(snap.data()?.title).toBe('Título Actualizado');
    });
  });

  // CP-GP-03 — Cerrar posición → no aparece en tablero
  describe('CP-GP-03 cerrar posición → status closed en Firestore', () => {
    const jobId = 'integ-job-to-close';

    beforeEach(async () => {
      db = getTestDb();
      await db.collection('jobs').doc(jobId).set({
        ...VALID_JOB_PAYLOAD,
        id: jobId,
        status: 'open',
        slug: 'dev-full-stack-to-close',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await db.collection('jobs').doc(jobId).delete();
    });

    it('CP-GP-03', async () => {
      const res = await fetch(functionUrl('updatePositionStatus'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.recruiter),
        },
        body: JSON.stringify({ id: jobId, status: 'closed' }),
      });

      expect(res.status).toBe(200);

      const snap = await db.collection('jobs').doc(jobId).get();
      expect(snap.data()?.status).toBe('closed');
    });
  });

  // CP-GP-04 — Crear sin campos obligatorios → 400
  it('CP-GP-04 crear posición sin campos obligatorios → 400', async () => {
    const res = await fetch(functionUrl('createJob'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(DEV_TOKENS.recruiter),
      },
      body: JSON.stringify({ title: 'Solo título' }),
    });

    expect(res.status).toBe(400);
  });

  // Sin auth
  it('sin token → 401 en createJob', async () => {
    const res = await fetch(functionUrl('createJob'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_JOB_PAYLOAD),
    });

    expect(res.status).toBe(401);
  });
});
