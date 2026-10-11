import { WebSocketServer, createWebSocketStream } from 'ws';
import type { Server as HttpServer } from 'node:http';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { ingestTelemetryBatch } from './telemetryService';

const aedesModule = require('aedes');
const AedesClass = aedesModule.Aedes || aedesModule;

export const mqttEvents = new EventEmitter();

let aedesBroker: any = null;
let tcpServerInstance: net.Server | null = null;
let connectedClientCount = 0;
let ingestedBatchCount = 0;

export interface MqttBrokerStatus {
  active: boolean;
  connectedClients: number;
  totalBatchesIngested: number;
  wsPath: string;
  tcpPort?: number;
}

export function getMqttBrokerStatus(): MqttBrokerStatus {
  return {
    active: aedesBroker !== null,
    connectedClients: connectedClientCount,
    totalBatchesIngested: ingestedBatchCount,
    wsPath: '/mqtt',
    tcpPort: tcpServerInstance ? (tcpServerInstance.address() as any)?.port : undefined,
  };
}

/**
 * Initializes the embedded Aedes MQTT broker on both:
 * 1. WebSockets attached to the Express HTTP server (for devtunnels & remote laptops over WSS/WS)
 * 2. Native TCP server (port 1883) for local / hardware clients
 */
export async function setupMqttBroker(httpServer: HttpServer): Promise<any> {
  if (aedesBroker) {
    return aedesBroker;
  }

  // Create Aedes broker instance
  const aedes = typeof AedesClass.createBroker === 'function'
    ? await AedesClass.createBroker()
    : new AedesClass();

  aedesBroker = aedes;

  // 1. MQTT over WebSockets
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost';
      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const parsedUrl = new URL(request.url || '', `${protocol}://${host}`);
      const pathname = parsedUrl.pathname;

      // Allow /mqtt, /ws, or root / (many MQTT over WS clients default to root)
      if (pathname === '/mqtt' || pathname === '/ws' || pathname === '/') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (err: any) {
      console.warn('[MQTT WS Upgrade Error]:', err.message);
    }
  });

  wss.on('connection', (ws) => {
    const stream = createWebSocketStream(ws);
    aedes.handle(stream);
  });

  // 2. Standard MQTT over TCP (port 1883 or MQTT_PORT env)
  const tcpPort = Number(process.env.MQTT_PORT) || 1883;
  try {
    const tcpServer = net.createServer((socket) => aedes.handle(socket));
    tcpServer.listen(tcpPort, () => {
      console.log(`[MQTT Broker] Native TCP listening on port ${tcpPort}`);
    });
    tcpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[MQTT Broker] TCP port ${tcpPort} already in use. Operating over WebSockets.`);
      } else {
        console.warn('[MQTT Broker] TCP server error:', err.message);
      }
    });
    tcpServerInstance = tcpServer;
  } catch (err: any) {
    console.warn('[MQTT Broker] Could not bind TCP socket:', err.message);
  }

  // 3. Client connection tracking
  aedes.on('client', (client: any) => {
    connectedClientCount++;
    console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'anonymous'} (Active: ${connectedClientCount})`);
  });

  aedes.on('clientDisconnect', (client: any) => {
    connectedClientCount = Math.max(0, connectedClientCount - 1);
    console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'anonymous'} (Active: ${connectedClientCount})`);
  });

  // 4. Ingest telemetry from published packets
  aedes.on('publish', async (packet: any, client: any) => {
    if (!packet || !packet.topic) return;
    if (packet.topic.startsWith('$SYS')) return;
    if (!client) return; // Ignore internal broker publishes

    const topic = packet.topic;

    // Check if topic is a telemetry ingestion topic
    if (
      topic === 'frostledger/telemetry' ||
      topic.startsWith('devices/') ||
      topic.includes('telemetry') ||
      topic.includes('sensor')
    ) {
      try {
        const payloadString = packet.payload.toString('utf8');
        const telemetryData = JSON.parse(payloadString);

        console.log(`[MQTT Broker] Ingesting telemetry on topic '${topic}' (device: ${telemetryData.device_id}, seq: ${telemetryData.sequence_no})`);

        const result = await ingestTelemetryBatch(telemetryData);
        ingestedBatchCount++;

        console.log(`[MQTT Broker] Ingested batch #${result.sequence_no} for shipment ${result.shipment_id} successfully (batch_id: ${result.batch_id})`);

        // Emit local Node event
        mqttEvents.emit('telemetry', result);

        // Publish live broadcast and acknowledgment back to MQTT clients
        const ackPayload = Buffer.from(
          JSON.stringify({
            status: 'ok',
            batch_id: result.batch_id,
            sequence_no: result.sequence_no,
            shipment_id: result.shipment_id,
            device_id: result.device_id,
            received_at: result.received_at,
          })
        );

        aedes.publish(
          {
            cmd: 'publish',
            topic: `frostledger/telemetry/ack/${telemetryData.device_id}`,
            payload: ackPayload,
            qos: 0,
            retain: false,
            dup: false,
          },
          () => {}
        );

        // Broadcast to live topic
        aedes.publish(
          {
            cmd: 'publish',
            topic: `frostledger/telemetry/live`,
            payload: ackPayload,
            qos: 0,
            retain: false,
            dup: false,
          },
          () => {}
        );
      } catch (err: any) {
        console.error(`[MQTT Broker] Failed to ingest telemetry on topic '${topic}':`, err.message);

        // Publish error feedback to client
        const errPayload = Buffer.from(
          JSON.stringify({
            status: 'error',
            error: err.message,
            code: err.code || 'INGESTION_ERROR',
          })
        );
        aedes.publish(
          {
            cmd: 'publish',
            topic: `frostledger/telemetry/error`,
            payload: errPayload,
            qos: 0,
            retain: false,
            dup: false,
          },
          () => {}
        );
      }
    }
  });

  console.log('[MQTT Broker] Embedded Aedes broker initialized on WebSockets (/mqtt)');
  return aedes;
}
