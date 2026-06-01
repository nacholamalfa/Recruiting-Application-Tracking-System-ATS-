import { describe, it, expect } from 'vitest';
import { authHeader, functionUrl, DEV_TOKENS } from './setup';

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
});
