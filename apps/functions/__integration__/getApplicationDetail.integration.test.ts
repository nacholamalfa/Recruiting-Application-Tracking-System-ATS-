import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { callOnCall, getEmulatorIdToken } from './onCallHelper';
import {
  FIXTURE_IDS,
  seedLinkedFixture,
  cleanLinkedFixture,
} from './fixtures';

describe('getApplicationDetail (EP-07) — integración onCall', () => {
  describe('TC-GAD-01 application existente con candidato y job → 200 ApplicationDetailDTO', () => {
    beforeEach(seedLinkedFixture);
    afterEach(cleanLinkedFixture);

    it('TC-GAD-01', async () => {
      const idToken = await getEmulatorIdToken('test-recruiter-oncall');

      const { status, body } = await callOnCall(
        'getApplicationDetail',
        { applicationId: FIXTURE_IDS.applicationId },
        idToken,
      );

      expect(status).toBe(200);
      expect(body.result).toHaveProperty('id', FIXTURE_IDS.applicationId);
      expect(body.result).toHaveProperty('candidate');
      expect(body.result).toHaveProperty('job');
    });
  });

  it('TC-GAD-02 applicationId no existe → error not-found', async () => {
    const idToken = await getEmulatorIdToken('test-recruiter-oncall');

    const { body } = await callOnCall(
      'getApplicationDetail',
      { applicationId: 'application-que-no-existe-xyz' },
      idToken,
    );

    expect(body.error?.status).toBe('NOT_FOUND');
  });

  it('TC-GAD-03 applicationId ausente → error invalid-argument', async () => {
    const idToken = await getEmulatorIdToken('test-recruiter-oncall');

    const { body } = await callOnCall(
      'getApplicationDetail',
      {},
      idToken,
    );

    expect(body.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('TC-GAD-04 applicationId vacío → error invalid-argument', async () => {
    const idToken = await getEmulatorIdToken('test-recruiter-oncall');

    const { body } = await callOnCall(
      'getApplicationDetail',
      { applicationId: '' },
      idToken,
    );

    expect(body.error?.status).toBe('INVALID_ARGUMENT');
  });

  it('TC-GAD-05 sin auth → error unauthenticated', async () => {
    const { body } = await callOnCall(
      'getApplicationDetail',
      { applicationId: 'any-id' },
    );

    expect(body.error?.status).toBe('UNAUTHENTICATED');
  });
});
