// Tokens de desarrollo reconocidos por el emulador (core/httpAuth.ts)
export const DEV_TOKENS = {
  admin: 'dev-admin',
  recruiter: 'dev-recruiter',
  hiringManager: 'dev-hiring-manager',
  candidate: 'dev-candidate',
} as const;

export const FUNCTIONS_BASE = 'http://127.0.0.1:5001/ats-tema-ort/us-central1';

export function functionUrl(name: string) {
  return `${FUNCTIONS_BASE}/${name}`;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
