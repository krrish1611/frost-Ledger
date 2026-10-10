#include <Arduino.h>

/**
 * FrostLedger ESP32 Firmware Skeleton
 * - Wi-Fi + MQTT with TLS
 * - Hardware agnostic: Sensor reading & batch construction
 * - Ed25519 signing
 * - In-order cached synchronization on reconnect
 */

void setup() {
  Serial.begin(115200);
  Serial.println("[FrostLedger Firmware] Initializing ESP32 Device...");
}

void loop() {
  delay(1000);
}
