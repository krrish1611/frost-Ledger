import { describe, it, expect } from 'vitest';
import { calculateMKT, calculateRemainingShelfLife, checkThresholds } from '@frostledger/shared';

describe('Worker Deterministic Kinetics Unit Tests', () => {
  it('Evaluates thermal violation and Arrhenius shelf life decay accurately', () => {
    const profile = {
      name: 'Standard Cold Chain',
      cargo_type: 'biologics',
      temp_min_c: 2.0,
      temp_max_c: 8.0,
      ref_temp_c: 4.0,
      ref_shelf_life_hours: 1000.0,
      activation_energy_j_mol: 83144.0,
    };

    const readings = [
      { timestamp: '2026-10-10T00:00:00Z', temperature: 4.0 },
      { timestamp: '2026-10-10T02:00:00Z', temperature: 15.0 }, // Excursion
    ];

    const shelf = calculateRemainingShelfLife(readings, profile);
    expect(shelf.consumedFraction).toBeGreaterThan(0);
    expect(shelf.remainingLifeHours).toBeLessThan(1000.0);

    const violations = checkThresholds(
      { timestamp: '2026-10-10T02:00:00Z', temperature: 15.0, humidity: 45.0 },
      profile
    );

    expect(violations.length).toBe(1);
    expect(violations[0].type).toBe('thermal_excursion_high');
    expect(violations[0].severity).toBe('critical');
  });
});
