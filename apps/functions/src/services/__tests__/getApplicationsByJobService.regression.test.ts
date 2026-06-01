import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Application, Job } from '@ats/shared-types';
import {
  GetApplicationsByJobService,
  JobNotFoundError,
} from '../getApplicationsByJobService';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  title: 'Desarrollador Full Stack',
  status: 'open',
  department: 'Tecnología',
  seniority: 'semi-senior',
  location: 'remote',
  description: 'Posición de prueba para tests de regresión.',
  slug: 'dev-full-stack',
  skills: [],
  responsabilities: [],
  benefits: [],
  hiringManagerId: 'manager-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeApplication = (overrides: Partial<Application> = {}): Application => ({
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

const mockAppRepo = { findByJobId: vi.fn(), findById: vi.fn(), update: vi.fn(), create: vi.fn(), findByCandidateAndJob: vi.fn(), addStageHistoryEntry: vi.fn() };
const mockJobRepo = { findById: vi.fn(), findWithFilters: vi.fn(), create: vi.fn(), update: vi.fn(), findBySlug: vi.fn(), listDepartments: vi.fn() };

describe('GetApplicationsByJobService — regresión', () => {
  let service: GetApplicationsByJobService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GetApplicationsByJobService(mockAppRepo as any, mockJobRepo as any);
  });

  it('lanza JobNotFoundError cuando el job no existe', async () => {
    mockJobRepo.findById.mockResolvedValue(null);

    await expect(service.getApplicationsByJob('job-inexistente')).rejects.toThrow(
      JobNotFoundError,
    );
  });

  it('retorna array vacío cuando el job existe pero no tiene postulaciones', async () => {
    mockJobRepo.findById.mockResolvedValue(makeJob());
    mockAppRepo.findByJobId.mockResolvedValue([]);

    const result = await service.getApplicationsByJob('job-1');
    expect(result).toEqual([]);
  });

  it('mapea las postulaciones al DTO con candidateId y stage', async () => {
    mockJobRepo.findById.mockResolvedValue(makeJob());
    mockAppRepo.findByJobId.mockResolvedValue([
      makeApplication({ candidateName: 'Ana García', candidateEmail: 'ana@test.com', fitScore: 90 }),
    ]);

    const result = await service.getApplicationsByJob('job-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'cand-1',
      stage: 'applied',
      status: 'active',
    });
  });

  it('pasa las opciones de query al repositorio sin modificarlas', async () => {
    mockJobRepo.findById.mockResolvedValue(makeJob());
    mockAppRepo.findByJobId.mockResolvedValue([]);

    await service.getApplicationsByJob('job-1', { orderBy: 'fitScore', orderDirection: 'desc', limit: 10 });

    expect(mockAppRepo.findByJobId).toHaveBeenCalledWith('job-1', {
      orderBy: 'fitScore',
      orderDirection: 'desc',
      limit: 10,
    });
  });
});
