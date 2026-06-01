// Helper para llamar onCall functions en el emulador via HTTP directo.
// Usa el Auth emulator REST API para obtener ID tokens sin necesitar credenciales GCP.
import { EMULATOR } from './setup';

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FAKE_API_KEY = 'fake-api-key';

// Crea un usuario de prueba en el Auth emulator y devuelve su ID token.
// Si el usuario ya existe, hace sign-in directamente.
export async function getEmulatorIdToken(uid: string): Promise<string> {
  const email = `${uid}@test-emulator.internal`;
  const password = 'test-password-emulator-123';

  // Intentar sign-up
  const signUpRes = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (signUpRes.ok) {
    const data = (await signUpRes.json()) as { idToken: string };
    return data.idToken;
  }

  // Si ya existe, sign-in
  const signInRes = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!signInRes.ok) {
    throw new Error(
      `Auth emulator error al obtener token para ${uid}: ${signInRes.status} ${await signInRes.text()}`,
    );
  }

  const data = (await signInRes.json()) as { idToken: string };
  return data.idToken;
}

// Llama a una onCall function via HTTP en el emulador.
// Respuesta exitosa: { result: T }
// Respuesta error:   { error: { status: string, message: string } }
export async function callOnCall<T = unknown>(
  functionName: string,
  data: unknown,
  idToken?: string,
): Promise<{
  status: number;
  body: { result?: T; error?: { status: string; message: string } };
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${EMULATOR.functionsBase}/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });

  const body = await res.json();
  return { status: res.status, body };
}
