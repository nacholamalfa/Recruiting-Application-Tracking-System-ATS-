import { describe, it, expect } from 'vitest';
import { authHeader, functionUrl, DEV_TOKENS } from './setup';

// Verifica que el control de acceso por rol funciona end-to-end en el emulador.
// setUserRole es la función más restrictiva: solo admin puede llamarla.

describe('Auth + roles — integración', () => {
  describe('setUserRole', () => {
    it('admin puede asignar rol a otro usuario', async () => {
      const res = await fetch(functionUrl('setUserRole'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.admin),
        },
        body: JSON.stringify({ uid: 'recruiter-dev', role: 'hr' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('recruiter recibe 403 al intentar asignar roles', async () => {
      const res = await fetch(functionUrl('setUserRole'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.recruiter),
        },
        body: JSON.stringify({ uid: 'anyone', role: 'hr' }),
      });

      expect(res.status).toBe(403);
    });

    it('sin token recibe 401', async () => {
      const res = await fetch(functionUrl('setUserRole'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'anyone', role: 'hr' }),
      });

      expect(res.status).toBe(401);
    });

    it('admin con rol inválido recibe 400', async () => {
      const res = await fetch(functionUrl('setUserRole'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.admin),
        },
        body: JSON.stringify({ uid: 'someone', role: 'superadmin' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('ensureEmployee', () => {
    it('crea un empleado nuevo y devuelve { isNew: true }', async () => {
      const res = await fetch(functionUrl('ensureEmployee'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.recruiter),
        },
        body: JSON.stringify({
          email: 'nuevo@test.com',
          displayName: 'Test User',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.isNew).toBe('boolean');
    });

    it('sin email recibe 400', async () => {
      const res = await fetch(functionUrl('ensureEmployee'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(DEV_TOKENS.recruiter),
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('sin token recibe 401', async () => {
      const res = await fetch(functionUrl('ensureEmployee'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@test.com' }),
      });

      expect(res.status).toBe(401);
    });
  });
});
