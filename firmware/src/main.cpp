#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

/**
 * FrostLedger ESP-32 Cold-Chain Telemetry Node Firmware (v2.5.0-esp32)
 *
 * Supports dual-transport telemetry ingestion into FrostLedger:
 *   1. USB Web Serial Bridge (115200 baud newline-delimited JSON -> Chrome/Edge Web Serial in FrostLedger UI)
 *   2. Wi-Fi HTTP POST Gateway -> http://<BACKEND_HOST>:3001/esp32/ingest
 *
 * Sensor configuration:
 *   - DHT22 / DHT11 on GPIO 4 (gracefully falls back to onboard calibrated simulation if sensor pin is floating/unattached)
 */

#define DHT_PIN 4
#define DHT_TYPE DHT22
#define TELEMETRY_INTERVAL_MS 5000

// Configure Wi-Fi credentials & FrostLedger Backend IP for wireless mode:
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BACKEND_INGEST_URL = "http://192.168.1.100:3001/esp32/ingest";

const char* DEVICE_ID = "dev-esp32-001";
const char* SHIPMENT_ID = "shipment-vax-amoy-001";
const char* FIRMWARE_VERSION = "v2.5.0-esp32";

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastTelemetryMs = 0;
uint32_t packetCounter = 0;

void connectWiFiNonBlocking() {
  if (String(WIFI_SSID) == "YOUR_WIFI_SSID" || String(WIFI_SSID).length() == 0) {
    return; // Running in USB Web Serial mode until Wi-Fi SSID is set
  }
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 4000) {
    delay(200);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  dht.begin();

  Serial.println("{\"event\":\"boot\",\"device_id\":\"dev-esp32-001\",\"firmware\":\"v2.5.0-esp32\",\"status\":\"initialized\"}");
  connectWiFiNonBlocking();
}

void loop() {
  unsigned long now = millis();
  if (now - lastTelemetryMs < TELEMETRY_INTERVAL_MS) {
    delay(50);
    return;
  }
  lastTelemetryMs = now;
  packetCounter++;

  // 1. Read DHT22 sensor (with fallback if sensor is not wired to GPIO 4)
  float tempC = dht.readTemperature();
  float humidityPct = dht.readHumidity();
  bool sensorAttached = !isnan(tempC) && !isnan(humidityPct);

  if (!sensorAttached) {
    // Smooth cold-chain baseline around 4.2°C and 48.5% RH
    float phase = (float)(packetCounter % 60) * 0.1047f;
    tempC = 4.20f + sin(phase) * 0.35f;
    humidityPct = 48.5f + cos(phase) * 1.8f;
  }

  // 2. Construct JSON telemetry payload
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["shipment_id"] = SHIPMENT_ID;
  doc["sequence_hint"] = packetCounter;
  doc["temperature"] = serialized(String(tempC, 2));
  doc["humidity"] = serialized(String(humidityPct, 1));
  doc["shock_g"] = 0.10;
  doc["tilt_deg"] = 1.5;
  doc["door_open"] = false;
  doc["battery_pct"] = 96;
  doc["sensor_attached"] = sensorAttached;
  doc["firmware_version"] = FIRMWARE_VERSION;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // 3. Emit over USB Serial (115200 baud) for FrostLedger Browser Web Serial Bridge
  Serial.println(jsonPayload);

  // 4. If Wi-Fi is connected, also POST directly to FrostLedger Backend (/esp32/ingest)
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_INGEST_URL);
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(jsonPayload);
    http.end();
  }
}
