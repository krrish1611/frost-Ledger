import fs from 'node:fs';
import path from 'node:path';
import { DbClient, getDbClient } from './index';

export async function runMigrations(clientOverride?: DbClient): Promise<string[]> {
  const db = clientOverride || (await getDbClient());

  // Ensure migrations tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  const appliedVersions = (
    await db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version ASC')
  ).rows.map((r) => r.version);

  const appliedNow: string[] = [];

  for (const file of files) {
    if (!appliedVersions.includes(file)) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Execute migration
      try {
        await db.exec(sql);
        await db.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, NOW())', [file]);
        appliedNow.push(file);
        console.log(`[Migration] Applied ${file}`);
      } catch (err) {
        console.error(`[Migration] Error applying ${file}:`, err);
        throw err;
      }
    }
  }

  return appliedNow;
}

if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(`[Migration] Finished. Applied ${applied.length} migrations.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}
