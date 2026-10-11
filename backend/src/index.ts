import dotenv from 'dotenv';
import http from 'node:http';
import { createApp } from './app';
import { runMigrations } from './db/migrate';
import { runSeed } from './db/seed';
import { setupMqttBroker } from './services/mqttBroker';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
  try {
    console.log('[Bootstrap] Running database migrations...');
    await runMigrations();

    console.log('[Bootstrap] Running database seed...');
    await runSeed();

    const app = createApp();
    const server = http.createServer(app);

    console.log('[Bootstrap] Initializing embedded MQTT broker (WebSockets + TCP)...');
    await setupMqttBroker(server);

    server.listen(PORT, () => {
      console.log(`[FrostLedger Backend] HTTP Server is running on port ${PORT}`);
      console.log(`[FrostLedger Backend] MQTT Broker WebSocket active at ws://localhost:${PORT}/mqtt`);
      console.log(`[FrostLedger Backend] Devtunnel MQTT URL: wss://4zxl3477-3001.inc1.devtunnels.ms/mqtt`);
    });
  } catch (err) {
    console.error('[Bootstrap] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}
