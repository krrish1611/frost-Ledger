import { ProfileParameters, SensorReading } from './index';

export const UNIVERSAL_GAS_CONSTANT_R = 8.314472; // J / (mol * K)
export const STANDARD_ACTIVATION_ENERGY_EA = 83144.72; // J / mol (USP default)
export const KELVIN_OFFSET = 273.15;

export interface TimedReading {
  timestamp: string; // ISO 8601 UTC
  temperature: number; // Celsius
}

export interface MktResult {
  mktCelsius: number;
  mktKelvin: number;
  totalDurationHours: number;
  intervalCount: number;
}

export interface ShelfLifeResult {
  referenceShelfLifeHours: number;
  consumedHours: number;
  consumedFraction: number;
  remainingLifeHours: number;
  isDepleted: boolean;
  mktCelsius: number;
}

export interface DeterministicViolation {
  type: 'thermal_excursion_high' | 'thermal_excursion_low' | 'humidity_excursion' | 'shock_breach' | 'shelf_life_depleted';
  severity: 'warning' | 'critical';
  value: number;
  limit: number;
  timestamp: string;
  message: string;
}

/**
 * Computes time-weighted Mean Kinetic Temperature (MKT) according to USP <1160> / Arrhenius formulation.
 * Handles uneven sampling intervals and offline connectivity gaps.
 * Each interval duration dt_i is calculated from the time elapsed since the previous reading.
 * If only a single reading is provided, a default nominal interval (e.g. 1 hour) is assumed.
 */
export function calculateMKT(
  readings: TimedReading[],
  activationEnergyJmol: number = STANDARD_ACTIVATION_ENERGY_EA
): MktResult {
  if (!readings || readings.length === 0) {
    throw new Error('Cannot calculate MKT on empty readings');
  }

  // Sort readings chronologically
  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const deltaHOverR = activationEnergyJmol / UNIVERSAL_GAS_CONSTANT_R;

  // Single reading case
  if (sorted.length === 1) {
    const kelvin = sorted[0].temperature + KELVIN_OFFSET;
    return {
      mktCelsius: Number(sorted[0].temperature.toFixed(4)),
      mktKelvin: Number(kelvin.toFixed(4)),
      totalDurationHours: 1.0,
      intervalCount: 1,
    };
  }

  let totalDurationSeconds = 0;
  let weightedExpSum = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const prevMs = new Date(prev.timestamp).getTime();
    const currMs = new Date(curr.timestamp).getTime();
    const dtSeconds = Math.max((currMs - prevMs) / 1000, 1.0); // At least 1 second

    // Use current reading temperature (or trapezoidal interval temperature)
    const tempKelvin = curr.temperature + KELVIN_OFFSET;
    const expFactor = Math.exp(-deltaHOverR / tempKelvin);

    totalDurationSeconds += dtSeconds;
    weightedExpSum += dtSeconds * expFactor;
  }

  const averageExpFactor = weightedExpSum / totalDurationSeconds;
  const mktKelvin = deltaHOverR / -Math.log(averageExpFactor);
  const mktCelsius = mktKelvin - KELVIN_OFFSET;

  return {
    mktCelsius: Number(mktCelsius.toFixed(4)),
    mktKelvin: Number(mktKelvin.toFixed(4)),
    totalDurationHours: Number((totalDurationSeconds / 3600).toFixed(4)),
    intervalCount: sorted.length - 1,
  };
}

/**
 * Calculates consumed shelf-life fraction and remaining shelf life using Arrhenius kinetic decay.
 * Remaining shelf life = reference shelf life minus accumulated consumed life,
 * where each interval consumes duration divided by shelf life at that interval's temperature.
 */
export function calculateRemainingShelfLife(
  readings: TimedReading[],
  profile: ProfileParameters
): ShelfLifeResult {
  if (!readings || readings.length === 0) {
    return {
      referenceShelfLifeHours: profile.ref_shelf_life_hours,
      consumedHours: 0,
      consumedFraction: 0,
      remainingLifeHours: profile.ref_shelf_life_hours,
      isDepleted: false,
      mktCelsius: profile.ref_temp_c,
    };
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const ea = profile.activation_energy_j_mol || STANDARD_ACTIVATION_ENERGY_EA;
  const tRefKelvin = profile.ref_temp_c + KELVIN_OFFSET;
  const refShelfLifeHours = profile.ref_shelf_life_hours;

  let totalConsumedFraction = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const dtHours = Math.max((new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3600000, 0);
    const tempKelvin = curr.temperature + KELVIN_OFFSET;

    // Shelf life at temperature T:
    // ShelfLife(T) = refShelfLife * exp( (Ea / R) * (1/T - 1/T_ref) )
    const exponent = (ea / UNIVERSAL_GAS_CONSTANT_R) * (1 / tempKelvin - 1 / tRefKelvin);
    const shelfLifeAtTemp = refShelfLifeHours * Math.exp(exponent);

    // Each interval consumes dt / shelfLifeAtTemp
    const intervalConsumedFraction = dtHours / shelfLifeAtTemp;
    totalConsumedFraction += intervalConsumedFraction;
  }

  const consumedHours = totalConsumedFraction * refShelfLifeHours;
  const remainingLifeHours = Math.max(0, refShelfLifeHours - consumedHours);
  const isDepleted = totalConsumedFraction >= 1.0 || remainingLifeHours <= 0;

  const mkt = calculateMKT(readings, ea);

  return {
    referenceShelfLifeHours: Number(refShelfLifeHours.toFixed(4)),
    consumedHours: Number(consumedHours.toFixed(4)),
    consumedFraction: Number(totalConsumedFraction.toFixed(6)),
    remainingLifeHours: Number(remainingLifeHours.toFixed(4)),
    isDepleted,
    mktCelsius: mkt.mktCelsius,
  };
}

/**
 * Pure threshold checker evaluating a sensor reading against frozen profile parameters.
 */
export function checkThresholds(
  reading: SensorReading,
  profile: ProfileParameters,
  remainingLifeHours?: number
): DeterministicViolation[] {
  const violations: DeterministicViolation[] = [];

  // 1. High Thermal Excursion
  if (reading.temperature > profile.temp_max_c) {
    const delta = reading.temperature - profile.temp_max_c;
    violations.push({
      type: 'thermal_excursion_high',
      severity: delta >= 2.0 ? 'critical' : 'warning',
      value: reading.temperature,
      limit: profile.temp_max_c,
      timestamp: reading.timestamp,
      message: `Temperature ${reading.temperature}°C exceeded upper threshold ${profile.temp_max_c}°C (+${delta.toFixed(2)}°C)`,
    });
  }

  // 2. Low Thermal Excursion
  if (reading.temperature < profile.temp_min_c) {
    const delta = profile.temp_min_c - reading.temperature;
    violations.push({
      type: 'thermal_excursion_low',
      severity: delta >= 2.0 ? 'critical' : 'warning',
      value: reading.temperature,
      limit: profile.temp_min_c,
      timestamp: reading.timestamp,
      message: `Temperature ${reading.temperature}°C fell below lower threshold ${profile.temp_min_c}°C (-${delta.toFixed(2)}°C)`,
    });
  }

  // 3. Humidity Thresholds
  if (profile.humidity_max_pct !== undefined && reading.humidity > profile.humidity_max_pct) {
    violations.push({
      type: 'humidity_excursion',
      severity: 'warning',
      value: reading.humidity,
      limit: profile.humidity_max_pct,
      timestamp: reading.timestamp,
      message: `Humidity ${reading.humidity}% exceeded upper limit ${profile.humidity_max_pct}%`,
    });
  }

  if (profile.humidity_min_pct !== undefined && reading.humidity < profile.humidity_min_pct) {
    violations.push({
      type: 'humidity_excursion',
      severity: 'warning',
      value: reading.humidity,
      limit: profile.humidity_min_pct,
      timestamp: reading.timestamp,
      message: `Humidity ${reading.humidity}% fell below lower limit ${profile.humidity_min_pct}%`,
    });
  }

  // 4. Physical Shock Events
  if (profile.max_shock_g !== undefined && reading.shock_events && reading.shock_events.length > 0) {
    for (const shock of reading.shock_events) {
      if (shock.magnitude_g > profile.max_shock_g) {
        violations.push({
          type: 'shock_breach',
          severity: 'critical',
          value: shock.magnitude_g,
          limit: profile.max_shock_g,
          timestamp: shock.timestamp,
          message: `Physical shock event ${shock.magnitude_g}g exceeded maximum threshold ${profile.max_shock_g}g`,
        });
      }
    }
  }

  // 5. Projected Shelf Life Depletion
  if (remainingLifeHours !== undefined && remainingLifeHours <= 0) {
    violations.push({
      type: 'shelf_life_depleted',
      severity: 'critical',
      value: remainingLifeHours,
      limit: 0,
      timestamp: reading.timestamp,
      message: 'Product shelf life completely consumed under Arrhenius decay modeling',
    });
  }

  return violations;
}
