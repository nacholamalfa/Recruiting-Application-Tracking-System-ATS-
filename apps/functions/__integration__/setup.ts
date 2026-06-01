import { afterAll, beforeAll } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Tokens de desarrollo para el emulador (ver core/httpAuth.ts)
export const DEV_TOKENS = {
  admin: 'dev-admin',
  recruiter: 'dev-recruiter',
  hiringManager: 'dev-hiring-manager',
  candidate: 'dev-candidate',
} as const;

export const EMULATOR = {
  functionsBase: 'http://127.0.0.1:5001/ats-tema-ort/us-central1',
  firestoreHost: '127.0.0.1',
  firestorePort: 8080,
} as const;

let app: ReturnType<typeof initializeApp>;

beforeAll(() => {
  process.env['FIRESTORE_EMULATOR_HOST'] =
    `${EMULATOR.firestoreHost}:${EMULATOR.firestorePort}`;
  process.env['FUNCTIONS_EMULATOR'] = 'true';
  process.env['GCLOUD_PROJECT'] = 'ats-tema-ort';

  if (!getApps().length) {
    app = initializeApp({ projectId: 'ats-tema-ort' });
  }
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

export function getTestDb() {
  return getFirestore();
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function functionUrl(name: string) {
  return `${EMULATOR.functionsBase}/${name}`;
}
