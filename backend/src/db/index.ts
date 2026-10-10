import { Pool, QueryResult } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import dotenv from 'dotenv';

dotenv.config();

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  isPGlite?: boolean;
}

let activeClient: DbClient | null = null;
let pgliteInstance: PGlite | null = null;
let pgPoolInstance: Pool | null = null;

export async function getDbClient(overrideUrl?: string): Promise<DbClient> {
  if (activeClient) {
    return activeClient;
  }

  const dbUrl = overrideUrl || process.env.DATABASE_URL;

  // If a real PostgreSQL connection string is supplied and not running in self-contained test mode
  if (dbUrl && !process.env.USE_PGLITE) {
    try {
      const pool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000,
      });

      // Probe connection
      const testRes = await pool.query('SELECT 1');
      if (testRes) {
        pgPoolInstance = pool;
        activeClient = {
          async query<T = any>(sql: string, params?: any[]) {
            const res: QueryResult = await pool.query(sql, params);
            return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
          },
          async exec(sql: string) {
            await pool.query(sql);
          },
          async close() {
            await pool.end();
            activeClient = null;
          },
          isPGlite: false,
        };
        return activeClient;
      }
    } catch {
      // Fall through to PGlite if connection fails (e.g. offline testing/development)
    }
  }

  // Use embedded PGlite (Real PostgreSQL 16 WebAssembly engine)
  if (!pgliteInstance) {
    pgliteInstance = new PGlite();
  }

  activeClient = {
    async query<T = any>(sql: string, params?: any[]) {
      const res = await pgliteInstance!.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rows?.length ?? 0 };
    },
    async exec(sql: string) {
      await pgliteInstance!.exec(sql);
    },
    async close() {
      if (pgliteInstance) {
        await pgliteInstance.close();
        pgliteInstance = null;
      }
      activeClient = null;
    },
    isPGlite: true,
  };

  return activeClient;
}

export function setTestDbClient(client: DbClient | null) {
  activeClient = client;
}
