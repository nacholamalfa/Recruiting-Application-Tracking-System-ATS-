import { describe, it, expect } from 'vitest';
import type { Skill } from '@ats/shared-types';
import {
  normalizeSkillName,
  buildCandidateSkillSet,
} from '../skillMatchCalculator';

// Regresión del módulo de cálculo puro de match de skills.
// No tiene dependencias externas — corre sin emuladores ni mocks.

const makeSkill = (name: string, type: Skill['type'] = 'mandatory', weight = 1): Skill => ({
  name,
  type,
  weight,
  yearsOfExperience: 0,
});

describe('skillMatchCalculator — regresión', () => {
  describe('normalizeSkillName', () => {
    it('convierte a lowercase y elimina espacios extremos', () => {
      expect(normalizeSkillName('  React  ')).toBe('react');
      expect(normalizeSkillName('Node.js')).toBe('node.js');
      expect(normalizeSkillName('TypeScript')).toBe('typescript');
    });

    it('no modifica strings ya normalizados', () => {
      expect(normalizeSkillName('react')).toBe('react');
    });
  });

  describe('buildCandidateSkillSet', () => {
    it('construye un Set normalizado de skills', () => {
      const set = buildCandidateSkillSet(['React', 'Node.js', 'TypeScript']);
      expect(set.has('react')).toBe(true);
      expect(set.has('node.js')).toBe(true);
      expect(set.has('typescript')).toBe(true);
    });

    it('filtra valores no-string y cadenas vacías', () => {
      const set = buildCandidateSkillSet(['React', '', null, undefined, 42, 'Node.js']);
      expect(set.size).toBe(2);
      expect(set.has('react')).toBe(true);
      expect(set.has('node.js')).toBe(true);
    });

    it('retorna Set vacío con input vacío', () => {
      expect(buildCandidateSkillSet([]).size).toBe(0);
    });

    it('deduplica skills repetidas', () => {
      const set = buildCandidateSkillSet(['React', 'react', 'REACT']);
      expect(set.size).toBe(1);
    });
  });
});
