import { describe, it, expect } from 'vitest';
import { authHeader, functionUrl, DEV_TOKENS } from './setup';

describe('Next.js → Cloud Functions — comunicación HTTP', () => {
  it('healthCheck responde 200 con token válido', async () => {
    const res = await fetch(functionUrl('healthCheck'), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(200);
  });

  it('getApplicationsByJob devuelve 400 cuando falta jobId', async () => {
    const res = await fetch(functionUrl('getApplicationsByJob'), {
      headers: authHeader(DEV_TOKENS.recruiter),
    });

    expect(res.status).toBe(400);
  });

  it('getApplicationsByJob devuelve 401 sin token', async () => {
    const url = new URL(functionUrl('getApplicationsByJob'));
    url.searchParams.set('jobId', 'cualquier-job');

    const res = await fetch(url.toString());

    expect(res.status).toBe(401);
  });

  it('updateApplicationStage devuelve 401 sin encabezado Authorization', async () => {
    const res = await fetch(functionUrl('updateApplicationStage'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: 'x', stage: 'screening' }),
    });

    expect(res.status).toBe(401);
  });
});
