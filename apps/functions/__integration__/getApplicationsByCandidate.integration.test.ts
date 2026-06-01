import { describe, it, expect } from 'vitest';
import { callOnCall, getEmulatorIdToken } from './onCallHelper';

describe('getApplicationsByCandidate (EP-06) — integración onCall', () => {
  it('TC-GAC-03 candidato sin postulaciones → resultado vacío []', async () => {
    const idToken = await getEmulatorIdToken('test-candidate-oncall');

    const { status, body } = await callOnCall<unknown[]>(
      'getApplicationsByCandidate',
      { candidateId: 'test-candidate-oncall' },
      idToken,
    );

    expect(status).toBe(200);
    expect(Array.isArray(body.result)).toBe(true);
    expect(body.result).toHaveLength(0);
  });

  it('TC-GAC-04 candidateId ausente → error invalid-argument', async () => {
    const idToken = await getEmulatorIdToken('test-candidate-oncall');

    const { body } = await callOnCall(
      'getApplicationsByCandidate',
      {},
      idToken,
    );

    expect(body.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('TC-GAC-05 candidateId vacío → error invalid-argument', async () => {
    const idToken = await getEmulatorIdToken('test-candidate-oncall');

    const { body } = await callOnCall(
      'getApplicationsByCandidate',
      { candidateId: '' },
      idToken,
    );

    expect(body.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('TC-GAC-06 sin auth → error unauthenticated', async () => {
    const { body } = await callOnCall(
      'getApplicationsByCandidate',
      { candidateId: 'test-candidate-oncall' },
    );

    expect(body.error?.status).toBe('UNAUTHENTICATED');
  });
});
