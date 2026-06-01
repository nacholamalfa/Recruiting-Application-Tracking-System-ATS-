import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Application } from '@ats/shared-types';
import {
  UpdateApplicationStageService,
  ApplicationNotFoundError,
} from '../updateApplicationService';

vi.mock('../../core/firebaseAdmin', () => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({ email: 'test@example.com' }),
  },
}));

const makeApplication = (
  overrides: Partial<Application> = {},
): Application => ({
  id: 'app-1',
  jobId: 'job-1',
  candidateId: 'cand-1',
  stage: 'applied',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  stageUpdatedAt: new Date(),
  ...overrides,
});

const mockRepo = {
  findById: vi.fn(),
  update: vi.fn(),
  findByJobId: vi.fn(),
  findByCandidateAndJob: vi.fn(),
  create: vi.fn(),
  addStageHistoryEntry: vi.fn(),
};

// Regresión: verifica las reglas de negocio críticas de cambio de stage
// que no deben romperse en ningún release.
describe('UpdateApplicationStageService — regresión de reglas de negocio', () => {
  let service: UpdateApplicationStageService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.addStageHistoryEntry.mockResolvedValue(undefined);
    mockRepo.update.mockResolvedValue(undefined);
    service = new UpdateApplicationStageService(mockRepo as any);
  });

  it('stage hired → status hired', async () => {
    mockRepo.findById.mockResolvedValue(makeApplication());
    await service.updateStage(
      { applicationId: 'app-1', stage: 'hired' },
      'uid',
    );
    expect(mockRepo.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: 'hired' }),
    );
  });

  it('stage rejected → status rejected', async () => {
    mockRepo.findById.mockResolvedValue(makeApplication());
    await service.updateStage(
      {
        applicationId: 'app-1',
        stage: 'rejected',
        rejectionReason: 'No aplica',
      },
      'uid',
    );
    expect(mockRepo.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: 'rejected' }),
    );
  });

  it('stage withdrawn → status withdrawn', async () => {
    mockRepo.findById.mockResolvedValue(makeApplication());
    await service.updateStage(
      { applicationId: 'app-1', stage: 'withdrawn' },
      'uid',
    );
    expect(mockRepo.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: 'withdrawn' }),
    );
  });

  it('stages activos del pipeline mantienen status active', async () => {
    const activeStages = [
      'screening',
      'cv_submitted',
      'interview_1_scheduled',
      'offer_sent',
    ] as const;

    for (const stage of activeStages) {
      vi.clearAllMocks();
      mockRepo.findById.mockResolvedValue(makeApplication());
      mockRepo.update.mockResolvedValue(undefined);
      mockRepo.addStageHistoryEntry.mockResolvedValue(undefined);

      await service.updateStage({ applicationId: 'app-1', stage }, 'uid');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ status: 'active' }),
      );
    }
  });

  it('postulación inexistente lanza ApplicationNotFoundError', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      service.updateStage(
        { applicationId: 'no-existe', stage: 'screening' },
        'uid',
      ),
    ).rejects.toThrow(ApplicationNotFoundError);
  });

  it('siempre registra historial de stage al hacer un cambio', async () => {
    mockRepo.findById.mockResolvedValue(makeApplication());
    await service.updateStage(
      { applicationId: 'app-1', stage: 'screening' },
      'uid',
    );
    expect(mockRepo.addStageHistoryEntry).toHaveBeenCalledOnce();
  });
});
