#include <WiFi.h>

const char* apSsid     = "OFBG_AP";
const char* apPassword = "12345678";       // 8자 이상
const int   TCP_PORT   = 8888;

WiFiServer  server(TCP_PORT);
WiFiClient  client;
bool        clientConnected = false;

uint8_t inputBuffer[1024];
size_t  inputBufferIndex = 0;

enum MessageType : uint8_t {
    MSG_WORD_SEQUENCE      = 0x08,
    MSG_CLEAR              = 0x04,
    MSG_WORD_SEPARATOR     = 0x05,
    MSG_SENTENCE_SEPARATOR = 0x06,  
    MSG_BRAILLE_SEPARATOR  = 0x07
};

uint8_t calculateChecksum(const uint8_t* data, size_t len) {
    uint8_t sum = 0;
    for (size_t i = 0; i < len; ++i) sum ^= data[i];
    return sum;
}

void sendPatternFromSerial(uint8_t dotsByte) {
    Serial.printf("[DEBUG] Sending pattern: 0x%02X\n", dotsByte);
    if (!clientConnected || !client.connected()) {
        Serial.println("[WARN] No TCP client connected");
        return;
    }

    uint8_t header[4];
    header[0] = 0x01;           // PATTERN_COMPLETE
    header[1] = 0x01;           // data length LSB
    header[2] = 0x00;           // data length MSB
    header[3] = dotsByte;       // checksum = payload XOR

    uint8_t payload[1] = { dotsByte };

    client.write(header, 4);
    client.write(payload, 1);
    client.flush();

    Serial.printf("[TX] PATTERN_COMPLETE dots=0x%02X checksum=0x%02X\n", dotsByte, header[3]);
}

void handleSerialInput() {
    static String serialBuffer;

    while (Serial.available()) {
        char c = Serial.read();
        if (c == '\n' || c == '\r') {
            if (serialBuffer.length() > 0) {
                serialBuffer.trim();

                char* endPtr = nullptr;
                long value = strtol(serialBuffer.c_str(), &endPtr, 0); // 0 → 10진/16진 자동
                if (*endPtr != '\0' || value < 0 || value > 0xFF) {
                    Serial.printf("[ERROR] Invalid input: %s\n", serialBuffer.c_str());
                } else {
                    sendPatternFromSerial(static_cast<uint8_t>(value));
                }
                serialBuffer = "";
            }
        } else {
            serialBuffer += c;
        }
    }
}

void handleWordSequence(uint8_t* data, size_t len) {
    if (len < 1) {
        Serial.println("[ERROR] WORD_SEQUENCE: Invalid length");
        return;
    }
    uint8_t count = data[0];
    if (len != (1 + count)) {
        Serial.printf("[ERROR] WORD_SEQUENCE: count=%u len=%u\n", count, len);
        return;
    }
    Serial.printf("[RX] BRAILLE_SEQUENCE: %u patterns\n", count);
    for (uint8_t i = 0; i < count; ++i) {
        uint8_t dots = data[1 + i];
        Serial.printf("  pattern[%u]=0x%02X\n", i, dots);
        // TODO: setBraillePattern(dots); updateBrailleDisplay(); etc.
        delay(100);
    }
}

void handleClear()              { Serial.println("[RX] CLEAR"); }
void handleWordSeparator()      { Serial.println("[RX] WORD_SEPARATOR"); }
void handleSentenceSeparator()  { Serial.println("[RX] SENTENCE_SEPARATOR"); }
void handleBrailleSeparator()   { Serial.println("[RX] BRAILLE_SEPARATOR"); }

void handleReceivedMessage(uint8_t type, uint8_t* data, size_t len) {
    Serial.printf("[RX] Type=0x%02X Len=%u\n", type, len);
    switch (type) {
        case MSG_WORD_SEQUENCE:      handleWordSequence(data, len); break;
        case MSG_CLEAR:              handleClear(); break;
        case MSG_WORD_SEPARATOR:     handleWordSeparator(); break;
        case MSG_SENTENCE_SEPARATOR: handleSentenceSeparator(); break;
        case MSG_BRAILLE_SEPARATOR:  handleBrailleSeparator(); break;
        default:                     Serial.printf("[WARN] Unknown type 0x%02X\n", type);
    }
}

bool parseMessage() {
    if (inputBufferIndex < 4) return false;

    uint8_t  type   = inputBuffer[0];
    uint16_t len    = inputBuffer[1] | (inputBuffer[2] << 8);
    uint8_t  recvCs = inputBuffer[3];

    Serial.printf("[DEBUG] Header: type=0x%02X len=%u (0x%02X 0x%02X) recvCs=0x%02X\n",
                  type, len, inputBuffer[1], inputBuffer[2], recvCs);

    if (inputBufferIndex < 4 + len) return false;

    // 디버깅: 페이로드 출력
    if (len > 0) {
        Serial.print("[DEBUG] Payload: ");
        for (uint16_t i = 0; i < len && i < 16; ++i) {  // 최대 16바이트만 출력
            Serial.printf("%02X ", inputBuffer[4 + i]);
        }
        Serial.println();
    }

    uint8_t calcCs = (len > 0) ? calculateChecksum(&inputBuffer[4], len) : 0;
    if (calcCs != recvCs) {
        Serial.printf("[ERROR] Checksum mismatch calc=0x%02X recv=0x%02X\n", calcCs, recvCs);
        // inputBufferIndex = 0;
        // return false;
    }

    uint8_t* payload = (len > 0) ? &inputBuffer[4] : nullptr;
    handleReceivedMessage(type, payload, len);

    size_t msgSize = 4 + len;
    if (inputBufferIndex > msgSize) {
        memmove(inputBuffer, &inputBuffer[msgSize], inputBufferIndex - msgSize);
        inputBufferIndex -= msgSize;
    } else {
        inputBufferIndex = 0;
    }
    return true;
}

void startAccessPoint() {
    WiFi.mode(WIFI_AP);
    if (WiFi.softAP(apSsid, apPassword)) {
        IPAddress ip = WiFi.softAPIP();
        Serial.println("AP started");
        Serial.print("SSID: "); Serial.println(apSsid);
        Serial.print("AP IP: "); Serial.println(ip);
    } else {
        Serial.println("[ERROR] Failed to start AP");
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("==========================");
    Serial.println(" ESP32 AP TCP Receiver");
    Serial.println("==========================");

    startAccessPoint();
    server.begin();
    Serial.printf("TCP server active on %d\n", TCP_PORT);
}

void loop() {
    if (!clientConnected) {
        client = server.available();
        if (client) {
            clientConnected = true;
            inputBufferIndex = 0;
            Serial.println("Client connected");
            Serial.print("Remote: "); Serial.println(client.remoteIP());
        }
        return;
    }

    if (!client.connected()) {
        clientConnected = false;
        client.stop();
        inputBufferIndex = 0;
        Serial.println("Client disconnected");
        return;
    }

    while (client.available()) {
        if (inputBufferIndex < sizeof(inputBuffer)) {
            inputBuffer[inputBufferIndex++] = client.read();
        } else {
            Serial.println("[ERROR] Input buffer overflow");
            inputBufferIndex = 0;
            break;
        }
        while (parseMessage()) { /* keep draining */ }
    }

    handleSerialInput();
}