// Fixtures de integración: siembra y limpia conjuntos de datos vinculados
// (candidato + job + application) necesarios para tests de flujo exitoso.
import { getTestDb } from './setup';

export const FIXTURE_IDS = {
  candidateId: 'fixture-candidate-1',
  jobId: 'fixture-job-1',
  applicationId: 'fixture-application-1',
  mismatchCandidateId: 'fixture-candidate-mismatch',
} as const;

export const FIXTURE_PROFILE = {
  firstName: 'Sofia',
  lastName: 'Fixture',
  email: 'sofia.fixture@test.com',
  phone: '+54 11 1111-2222',
  location: 'Buenos Aires',
  technicalSkills: ['TypeScript', 'React'],
} as const;

export async function seedLinkedFixture() {
  const db = getTestDb();

  await db
    .collection('candidates')
    .doc(FIXTURE_IDS.candidateId)
    .set({
      id: FIXTURE_IDS.candidateId,
      firstName: FIXTURE_PROFILE.firstName,
      lastName: FIXTURE_PROFILE.lastName,
      fullName: `${FIXTURE_PROFILE.firstName} ${FIXTURE_PROFILE.lastName}`,
      email: FIXTURE_PROFILE.email,
      phone: FIXTURE_PROFILE.phone,
      location: FIXTURE_PROFILE.location,
      technicalSkills: FIXTURE_PROFILE.technicalSkills,
      profileStatus: 'pending',
      registrationType: 'specific',
      registrationSource: 'cv_upload',
      cvParseStatus: 'done',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  await db.collection('jobs').doc(FIXTURE_IDS.jobId).set({
    id: FIXTURE_IDS.jobId,
    title: 'Dev Full Stack Fixture',
    department: 'Tecnología',
    seniority: 'semi-senior',
    location: 'remote',
    description: 'Job de fixtures para tests de integración.',
    status: 'open',
    skills: [],
    responsabilities: [],
    benefits: [],
    hiringManagerId: 'manager-fixture',
    slug: 'dev-full-stack-fixture',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('applications').doc(FIXTURE_IDS.applicationId).set({
    id: FIXTURE_IDS.applicationId,
    jobId: FIXTURE_IDS.jobId,
    candidateId: FIXTURE_IDS.candidateId,
    stage: 'applied',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    stageUpdatedAt: new Date(),
  });
}

// Siembra una application que pertenece a otro candidato (para tests de mismatch)
export async function seedMismatchFixture() {
  const db = getTestDb();

  await db.collection('candidates').doc(FIXTURE_IDS.mismatchCandidateId).set({
    id: FIXTURE_IDS.mismatchCandidateId,
    firstName: 'Otro',
    lastName: 'Candidato',
    fullName: 'Otro Candidato',
    email: 'otro.mismatch@test.com',
    phone: '+54 11 9999-0000',
    profileStatus: 'pending',
    registrationType: 'specific',
    registrationSource: 'cv_upload',
    cvParseStatus: 'done',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function cleanLinkedFixture() {
  const db = getTestDb();
  await Promise.all([
    db.collection('candidates').doc(FIXTURE_IDS.candidateId).delete(),
    db.collection('jobs').doc(FIXTURE_IDS.jobId).delete(),
    db.collection('applications').doc(FIXTURE_IDS.applicationId).delete(),
  ]);
}

export async function cleanMismatchFixture() {
  const db = getTestDb();
  await db
    .collection('candidates')
    .doc(FIXTURE_IDS.mismatchCandidateId)
    .delete();
}
