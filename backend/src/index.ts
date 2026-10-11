import dotenv from 'dotenv';
import { createApp } from './app';
import { runMigrations } from './db/migrate';
import { seedLiveDemoEnvironment } from './db/demoSeed';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
  try {
    process.env.AUTO_PROCESS_INLINE = 'true';
    console.log('[Bootstrap] Running database migrations...');
    await runMigrations();
    await seedLiveDemoEnvironment();

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`[FrostLedger Backend] Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Bootstrap] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}
