import bcrypt from 'bcrypt';
import { DbClient, getDbClient } from './index';
import { getUtcTimestamp, generateEd25519KeyPair } from '@frostledger/shared';

export async function runSeed(clientOverride?: DbClient): Promise<void> {
  const db = clientOverride || (await getDbClient());

  console.log('[Seed] Seeding initial data...');

  // 1. Seed Profiles (Idempotent: check existence before insert since profiles are immutable)
  const vaccineParams = {
    name: 'COVID-19 / mRNA Vaccine Cold Chain',
    cargo_type: 'pharma-vaccine',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    ref_temp_c: 5.0,
    ref_shelf_life_hours: 720.0,
    activation_energy_j_mol: 83144.0,
    humidity_min_pct: 20.0,
    humidity_max_pct: 60.0,
    max_shock_g: 3.0,
    max_tilt_degrees: 45.0,
  };

  const produceParams = {
    name: 'Fresh Berries & Perishable Produce',
    cargo_type: 'fresh-produce',
    temp_min_c: 0.0,
    temp_max_c: 4.0,
    ref_temp_c: 2.0,
    ref_shelf_life_hours: 336.0,
    activation_energy_j_mol: 65000.0,
    humidity_min_pct: 80.0,
    humidity_max_pct: 95.0,
    max_shock_g: 5.0,
    max_tilt_degrees: 60.0,
  };

  const existingVaccine = await db.query(
    'SELECT 1 FROM profiles WHERE profile_id = $1 AND version = $2',
    ['profile-vaccine-2-8c', 1]
  );
  if (existingVaccine.rowCount === 0) {
    await db.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-vaccine-2-8c', 1, JSON.stringify(vaccineParams), 'system-seed', getUtcTimestamp()]
    );
    console.log('[Seed] Seeded profile: profile-vaccine-2-8c (v1)');
  }

  const existingProduce = await db.query(
    'SELECT 1 FROM profiles WHERE profile_id = $1 AND version = $2',
    ['profile-produce-0-4c', 1]
  );
  if (existingProduce.rowCount === 0) {
    await db.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-produce-0-4c', 1, JSON.stringify(produceParams), 'system-seed', getUtcTimestamp()]
    );
    console.log('[Seed] Seeded profile: profile-produce-0-4c (v1)');
  }

  // 2. Seed Users
  const adminPasswordHash = await bcrypt.hash('AdminSecurePass123!', 10);
  const operatorPasswordHash = await bcrypt.hash('OperatorPass123!', 10);

  const existingAdmin = await db.query('SELECT 1 FROM users WHERE email = $1', ['admin@coldchain.test']);
  if (existingAdmin.rowCount === 0) {
    await db.query(
      `INSERT INTO users (user_id, org_id, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'usr-admin-0000-0000-000000000001',
        'org-frost-demo',
        'admin@coldchain.test',
        adminPasswordHash,
        'admin',
        getUtcTimestamp(),
      ]
    );
    console.log('[Seed] Seeded admin user: admin@coldchain.test');
  }

  const existingOperator = await db.query('SELECT 1 FROM users WHERE email = $1', ['operator@coldchain.test']);
  if (existingOperator.rowCount === 0) {
    await db.query(
      `INSERT INTO users (user_id, org_id, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'usr-oper-0000-0000-000000000002',
        'org-frost-demo',
        'operator@coldchain.test',
        operatorPasswordHash,
        'operator',
        getUtcTimestamp(),
      ]
    );
    console.log('[Seed] Seeded operator user: operator@coldchain.test');
  }

  // 3. Seed Device
  // Deterministic sample Ed25519 public key for demo
  const sampleKeyPair = generateEd25519KeyPair();
  const existingDevice = await db.query('SELECT 1 FROM devices WHERE device_id = $1', ['dev-esp32-001']);
  if (existingDevice.rowCount === 0) {
    await db.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['dev-esp32-001', 'org-frost-demo', sampleKeyPair.publicKeyHex, 'active', getUtcTimestamp()]
    );
    console.log('[Seed] Seeded device: dev-esp32-001');
  }

  console.log('[Seed] Seeding completed successfully.');
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}
