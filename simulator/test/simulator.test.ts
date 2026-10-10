import { describe, it, expect } from 'vitest';
import { DeviceSimulator } from '../src/index';
import { verifyEd25519Signature, computeBatchHash } from '@frostledger/shared';

describe('Device Simulator Scenarios', () => {
  it('Scenario normal: generates valid sequential signed batches with smooth metrics', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-normal' });
    const batches = sim.generateScenarioBatches('normal', 5);

    expect(batches.length).toBe(5);
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      expect(b.sequence_no).toBe(i + 1);
      // Verify hash
      const expectedHash = computeBatchHash({
        device_id: b.device_id,
        shipment_id: b.shipment_id,
        sequence_no: b.sequence_no,
        prev_hash: b.prev_hash,
        payload: b.payload,
      });
      expect(b.hash).toBe(expectedHash);
      // Verify signature
      expect(verifyEd25519Signature(b.hash, b.signature, sim.getPublicKey())).toBe(true);
      // Verify temperature within 4.0 - 5.5
      expect(b.payload.readings[0].temperature).toBeGreaterThanOrEqual(4.0);
      expect(b.payload.readings[0].temperature).toBeLessThanOrEqual(6.0);
    }
  });

  it('Scenario spike: introduces sudden severe excursion', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-spike' });
    const batches = sim.generateScenarioBatches('spike', 5);

    expect(batches.length).toBe(5);
    expect(batches[0].payload.readings[0].temperature).toBe(4.5);
    expect(batches[4].payload.readings[0].temperature).toBe(19.8);
  });

  it('Scenario slow_drift: generates progressively rising temperatures', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-drift' });
    const batches = sim.generateScenarioBatches('slow_drift', 5);

    for (let i = 1; i < batches.length; i++) {
      expect(batches[i].payload.readings[0].temperature).toBeGreaterThan(
        batches[i - 1].payload.readings[0].temperature
      );
    }
  });

  it('Scenario door_open: produces shock events with thermal rise', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-door' });
    const batches = sim.generateScenarioBatches('door_open', 6);

    const doorBatch = batches[4];
    expect(doorBatch.payload.readings[0].shock_events?.length).toBeGreaterThan(0);
    expect(doorBatch.payload.readings[0].temperature).toBeGreaterThan(10);
  });

  it('Scenario flat_copied: keeps readings completely frozen', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-flat' });
    const batches = sim.generateScenarioBatches('flat_copied', 4);

    const firstTemp = batches[0].payload.readings[0].temperature;
    for (const b of batches) {
      expect(b.payload.readings[0].temperature).toBe(firstTemp);
    }
  });

  it('Scenario gps_jump: produces coordinates jump with impossible speed', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-gps' });
    const batches = sim.generateScenarioBatches('gps_jump', 6);

    const jumpedBatch = batches[4];
    expect(jumpedBatch.payload.readings[0].gps?.speed).toBeGreaterThan(1000);
  });

  it('Scenario replay: includes duplicate prior sequence', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-replay' });
    const batches = sim.generateScenarioBatches('replay');

    expect(batches.length).toBe(3);
    expect(batches[2].sequence_no).toBe(1); // Replayed sequence 1
  });

  it('Scenario unsigned: generates corrupted signature', () => {
    const sim = new DeviceSimulator({ deviceId: 'dev-sim-unsigned' });
    const batches = sim.generateScenarioBatches('unsigned');

    expect(batches.length).toBe(1);
    expect(verifyEd25519Signature(batches[0].hash, batches[0].signature, sim.getPublicKey())).toBe(false);
  });
});
