import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from './setup';

const COLLECTION = 'applications';

describe('Firestore — lectura/escritura con emulador', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  it('escribe y lee un documento correctamente', async () => {
    const docRef = db.collection(COLLECTION).doc('integ-test-app-1');
    await docRef.set({
      jobId: 'job-test',
      candidateId: 'cand-test',
      stage: 'applied',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      stageUpdatedAt: new Date(),
    });

    const snap = await docRef.get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.stage).toBe('applied');

    await docRef.delete();
  });

  it('devuelve null al leer un documento inexistente', async () => {
    const snap = await db.collection(COLLECTION).doc('no-existe-xyz').get();
    expect(snap.exists).toBe(false);
  });

  it('actualiza un campo sin sobrescribir el documento completo', async () => {
    const docRef = db.collection(COLLECTION).doc('integ-test-update-1');
    await docRef.set({ stage: 'applied', status: 'active', jobId: 'j1' });

    await docRef.update({ stage: 'screening' });

    const snap = await docRef.get();
    expect(snap.data()?.stage).toBe('screening');
    expect(snap.data()?.jobId).toBe('j1');

    await docRef.delete();
  });
});
