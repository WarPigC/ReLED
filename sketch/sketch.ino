#include <Arduino.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <HTTPClient.h>
#include <WiFi.h>

#define WIFI_SSID "Aniruddh#5g"
#define WIFI_PASSWORD "EliteApex1101"

#define SERVER_URL "http://192.168.29.155:9000/api/state"

#define LED_PIN 5
#define NUM_LEDS 30
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB

#define POLL_INTERVAL_MS 500

CRGB leds[NUM_LEDS];

struct LEDState {
  String mode;
  uint8_t r, g, b;
  uint8_t brightness;
  uint8_t speed;
} currentState;

uint32_t animTick = 0;

// HEX to rgb values
void parseHexColor(const String &hex, uint8_t &r, uint8_t &g, uint8_t &b) {
  long value = strtol(hex.c_str() + 1, nullptr, 16);
  r = (value >> 16) & 0xFF;
  g = (value >> 8) & 0xFF;
  b = value & 0xFF;
}

bool fetchState() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return false;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.setTimeout(3000);

  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_200) {
    Serial.printf("HTTP GET failed, code: %d\n", httpCode);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload);

  if (err) {
    Serial.printf("JSON parse error: %s\n", err.c_str());
    return false;
  }

  currentState.mode = doc["mode"].as<String>();
  currentState.brightness = doc["brightness"].as<uint8_t>();
  currentState.speed = doc["speed"].as<uint8_t>();

  parseHexColor(doc["color"].as<String>(), currentState.r, currentState.g,
                currentState.b);

  Serial.printf("mode=%s color=#%02X%02X%02X bri=%d spd=%d\n",
                currentState.mode.c_str(), currentState.r, currentState.g,
                currentState.b, currentState.brightness, currentState.speed);
  return true;
}

void renderSolid() {
  CRGB colour(currentState.r, currentState.g, currentState.b);
  fill_solid(leds, NUM_LEDS, colour);
}

void renderRainbow() {
  uint8_t hueShift = animTick * (currentState.speed / 10 + 1);
  fill_rainbow(leds, NUM_LEDS, hueShift, 255 / NUM_LEDS);
}

// Pixels light and fade with colours
void renderPulse() {
  uint8_t bpm = map(currentState.speed, 1, 100, 5, 60);
  uint8_t breath = beatsin8(bpm, 10, 255);
  CRGB colour(currentState.r, currentState.g, currentState.b);
  colour.nscale8(breath);
  fill_solid(leds, NUM_LEDS, colour);
}

// One pixel runs along the strip
void renderChase() {
  uint8_t ticksPerStep = map(currentState.speed, 1, 100, 20, 1);
  uint16_t head = (animTick / ticksPerStep) % NUM_LEDS;
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  for (int i = 0; i < 5; i++) {
    int idx = ((int)head - i + NUM_LEDS) % NUM_LEDS;
    uint8_t fade = 255 - (i * 50);
    leds[idx] =
        CRGB((currentState.r * fade) / 255, (currentState.g * fade) / 255,
             (currentState.b * fade) / 255);
  }
}

// Random pixels light up
void renderSparkle() {
  fadeToBlackBy(leds, NUM_LEDS, 40);
  uint8_t numSparks = map(currentState.speed, 1, 100, 1, 8);
  for (uint8_t i = 0; i < numSparks; i++) {
    uint16_t pos = random16(NUM_LEDS);
    leds[pos] = CRGB(currentState.r, currentState.g, currentState.b);
  }
}

void setup() {
  Serial.begin(115200);

  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS)
      .setCorrection(TypicalLEDStrip);

  FastLED.setBrightness(50);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  Serial.println("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++retries >= 40) {
      Serial.println("\nWiFi timeout");
      ESP.restart();
    }
  }

  Serial.printf("\nConnected IP: %s\n", WiFi.localIP().toString().c_str());

  currentState = {"solid", 255, 140, 0, 128, 50};
}

void loop() {
  static uint32_t lastPoll = 0;

  if (millis() - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = millis();
    fetchState();
  }

  FastLED.setBrightness(currentState.brightness);

  if (currentState.mode == "solid")
    renderSolid();
  else if (currentState.mode == "rainbow")
    renderRainbow();
  else if (currentState.mode == "pulse")
    renderPulse();
  else if (currentState.mode == "chase")
    renderChase();
  else if (currentState.mode == "sparkle")
    renderSparkle();
  else
    renderSolid();

  FastLED.show();

  animTick++;
  delay(16);
}