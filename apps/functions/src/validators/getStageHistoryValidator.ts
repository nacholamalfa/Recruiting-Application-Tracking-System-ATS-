import { HttpsError } from 'firebase-functions/v2/https';

export function validateGetStageHistoryPayload(
  query: Partial<{ applicationId: string }>,
): asserts query is { applicationId: string } {
  if (
    !query.applicationId ||
    typeof query.applicationId !== 'string' ||
    query.applicationId.trim().length === 0
  ) {
    throw new HttpsError(
      'invalid-argument',
      'El identificador de la postulación (applicationId) es obligatorio.',
    );
  }
}
