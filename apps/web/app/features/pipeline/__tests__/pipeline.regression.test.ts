import { describe, it, expect } from 'vitest';
import {
  STAGE_KEY_MAP,
  CANDIDATE_STAGE_TO_APP_STAGE,
  STAGE_ORDER,
  buildStageHistory,
} from '../../candidate/utils/candidateProfile.utils';
import type { ApplicationStage } from '@ats/shared-types';

// Verifica que el mapeo bidireccional stage ↔ CandidateStageKey no se rompa
// entre cambios. Este mapeo es la pieza central del flujo de cambio de stage
// en el pipeline (seleccionar el siguiente stage → updateApplicationStage).

describe('Pipeline — mapeo de stages (regresión)', () => {
  it('todos los stages de STAGE_ORDER tienen una entrada en STAGE_KEY_MAP', () => {
    for (const stage of STAGE_ORDER) {
      expect(
        STAGE_KEY_MAP[stage],
        `STAGE_KEY_MAP no tiene entrada para "${stage}"`,
      ).toBeDefined();
    }
  });

  it('CANDIDATE_STAGE_TO_APP_STAGE es inverso de STAGE_KEY_MAP para stages activos', () => {
    const activeStages = STAGE_ORDER.filter(
      (s) => s !== 'rejected' && s !== 'withdrawn',
    );

    for (const stage of activeStages) {
      const key = STAGE_KEY_MAP[stage];
      if (!key) continue;
      const roundTrip = CANDIDATE_STAGE_TO_APP_STAGE[key];
      expect(roundTrip).toBe(stage);
    }
  });

  it('rejected y withdrawn mapean ambos a "descartado" en STAGE_KEY_MAP', () => {
    expect(STAGE_KEY_MAP['rejected']).toBe('descartado');
    expect(STAGE_KEY_MAP['withdrawn']).toBe('descartado');
  });

  it('buildStageHistory marca correctamente el stage actual y los anteriores', () => {
    const history = buildStageHistory('cv_submitted');

    const current = history.find((e) => e.status === 'current');
    const completed = history.filter((e) => e.status === 'completed');
    const pending = history.filter((e) => e.status === 'pending');

    expect(current?.key).toBe('cv_presentado_area');
    expect(completed.length).toBeGreaterThan(0);
    expect(pending.length).toBeGreaterThan(0);
  });

  it('buildStageHistory con "applied" no tiene etapas completadas', () => {
    const history = buildStageHistory('applied');
    const completed = history.filter((e) => e.status === 'completed');
    expect(completed).toHaveLength(0);
  });

  it('buildStageHistory con "hired" no tiene etapas pendientes', () => {
    const history = buildStageHistory('hired');
    const pending = history.filter((e) => e.status === 'pending');
    expect(pending).toHaveLength(0);
  });

  it('STAGE_ORDER no contiene stages terminales (rejected/withdrawn)', () => {
    const terminalStages: ApplicationStage[] = ['rejected', 'withdrawn'];
    for (const terminal of terminalStages) {
      expect(STAGE_ORDER).not.toContain(terminal);
    }
  });
});
