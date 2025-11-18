#include <WiFi.h>
#include <Wire.h>

#ifndef MOTOR_I2C_SDA_PIN
#define MOTOR_I2C_SDA_PIN 6
#endif

#ifndef MOTOR_I2C_SCL_PIN
#define MOTOR_I2C_SCL_PIN 7
#endif

#ifndef MOTOR_I2C_CLOCK_HZ
#define MOTOR_I2C_CLOCK_HZ 400000UL
#endif

constexpr uint8_t BRAILLE_DOT_COUNT = 6;
constexpr uint8_t BRAILLE_DOT_ADDRESSES[BRAILLE_DOT_COUNT] = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06};

constexpr uint8_t MOTOR_CMD_PLAY_PATTERN = 0x01;
constexpr uint8_t MOTOR_CMD_STOP         = 0x02;
constexpr uint8_t MOTOR_FRAME_SIZE       = 10;
constexpr uint8_t MOTOR_MAX_PATTERN_LEN  = 8;
constexpr uint8_t DEFAULT_WAVEFORM_ID    = 47;
constexpr uint8_t DEFAULT_PATTERN_LEN    = 1;
constexpr uint16_t BRAILLE_PATTERN_HOLD_MS = 1000;

const char* apSsid     = "OFBG_AP";
const char* apPassword = "12345678";       // 8자 이상
const int   TCP_PORT   = 8888;

WiFiServer  server(TCP_PORT);
WiFiClient  client;
bool        clientConnected = false;

uint8_t inputBuffer[1024];
size_t  inputBufferIndex = 0;

bool motorBusReady = false;
bool motorActiveState[BRAILLE_DOT_COUNT] = { false, false, false, false, false, false };

struct MotorStatusFrame {
    uint8_t statusBits;
    uint8_t buttonState;
    uint8_t lastError;
    uint8_t lastPatternLen;
};

bool motorSendCommand(uint8_t address, uint8_t cmd, const uint8_t* payload, uint8_t len) {
    if (!motorBusReady) {
        Serial.println("[WARN] Motor bus not initialized");
        return false;
    }

    if (cmd == MOTOR_CMD_PLAY_PATTERN) {
        if (len == 0 || len > MOTOR_MAX_PATTERN_LEN) {
            Serial.printf("[ERROR] Invalid play pattern length %u for address 0x%02X\n", len, address);
            return false;
        }
    } else {
        len = 0;
    }

    uint8_t frame[MOTOR_FRAME_SIZE] = {0};
    frame[0] = cmd;
    frame[1] = len;

    if (len > 0 && payload == nullptr) {
        Serial.println("[ERROR] Payload is null");
        return false;
    }

    for (uint8_t i = 0; i < len; ++i) {
        frame[2 + i] = payload[i];
    }

    Wire.beginTransmission(address);
    Wire.write(frame, MOTOR_FRAME_SIZE);
    int err = Wire.endTransmission();
    if (err != 0) {
        Serial.printf("[ERROR] I2C write failed addr=0x%02X err=%d\n", address, err);
        return false;
    }

    return true;
}

bool motorReadStatus(uint8_t address, MotorStatusFrame& status) {
    if (!motorBusReady) return false;

    const uint8_t expectedBytes = sizeof(MotorStatusFrame);
    uint8_t received = Wire.requestFrom(address, expectedBytes);
    if (received != expectedBytes) {
        Serial.printf("[WARN] Status read failed addr=0x%02X received=%u\n", address, received);
        return false;
    }

    status.statusBits     = Wire.read();
    status.buttonState    = Wire.read();
    status.lastError      = Wire.read();
    status.lastPatternLen = Wire.read();
    return true;
}

bool motorPlayPattern(uint8_t dotIndex, const uint8_t* pattern, uint8_t len) {
    if (dotIndex >= BRAILLE_DOT_COUNT) return false;
    return motorSendCommand(BRAILLE_DOT_ADDRESSES[dotIndex], MOTOR_CMD_PLAY_PATTERN, pattern, len);
}

bool motorStop(uint8_t dotIndex) {
    if (dotIndex >= BRAILLE_DOT_COUNT) return false;
    return motorSendCommand(BRAILLE_DOT_ADDRESSES[dotIndex], MOTOR_CMD_STOP, nullptr, 0);
}

void stopAllMotors(bool force = false) {
    for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
        if (force || motorActiveState[i]) {
            if (motorStop(i)) {
                motorActiveState[i] = false;
            }
        }
    }
}

void applyBraillePattern(uint8_t dotsByte) {
    const uint8_t pattern[DEFAULT_PATTERN_LEN] = { DEFAULT_WAVEFORM_ID };

    for (uint8_t dot = 0; dot < BRAILLE_DOT_COUNT; ++dot) {
        bool shouldActivate = (dotsByte & (1U << dot)) != 0;

        if (shouldActivate) {
            if (motorPlayPattern(dot, pattern, DEFAULT_PATTERN_LEN)) {
                motorActiveState[dot] = true;
            }
        } else if (motorActiveState[dot]) {
            if (motorStop(dot)) {
                motorActiveState[dot] = false;
            }
        }
    }
}

void logMotorStatuses() {
#if defined(SERIAL_DEBUG_MOTOR_STATUS)
    MotorStatusFrame status{};
    for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
        if (motorReadStatus(BRAILLE_DOT_ADDRESSES[i], status)) {
            Serial.printf("[MOTOR] dot=%u status=0x%02X button=%u err=%u len=%u\n",
                          i + 1, status.statusBits, status.buttonState,
                          status.lastError, status.lastPatternLen);
        }
    }
#endif
}

void motorInit() {
    if (motorBusReady) return;

    motorBusReady = Wire.begin(MOTOR_I2C_SDA_PIN, MOTOR_I2C_SCL_PIN, MOTOR_I2C_CLOCK_HZ);
    if (!motorBusReady) {
        Serial.println("[ERROR] Failed to init I2C bus for motors");
        return;
    }

    Wire.setClock(MOTOR_I2C_CLOCK_HZ);
    Serial.printf("[INFO] Motor I2C bus ready (SDA=%d SCL=%d Freq=%lu)\n",
                  MOTOR_I2C_SDA_PIN, MOTOR_I2C_SCL_PIN, MOTOR_I2C_CLOCK_HZ);

    stopAllMotors(true);
}

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
    } else {
        uint8_t header[4];
        header[0] = 0x03;           // PATTERN_COMPLETE
        header[1] = 0x01;           // data length LSB
        header[2] = 0x00;           // data length MSB
        header[3] = dotsByte;       // checksum = payload XOR

        uint8_t payload[1] = { dotsByte };

        client.write(header, 4);
        client.write(payload, 1);
        client.flush();

        Serial.printf("[TX] PATTERN_COMPLETE dots=0x%02X checksum=0x%02X\n", dotsByte, header[3]);
    }

    applyBraillePattern(dotsByte);
    logMotorStatuses();
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
void handleKeyboardTest() {
    static String serialBuffer;
    
    // 키보드에서 점자 점대로 입력받아서 진동 울림
    // cbafed 순으로 123456점
    // 다음 버튼(de(65)) 들어오면 하나의 점자로 만듬
    // 다음 버튼 누르기 전 앞의 점을 누르면 buffer 들어간 점들 취소

    auto getDotOrder = [](char c) -> int {
        if (c == 'c') return 1;
        if (c == 'b') return 2;
        if (c == 'a') return 3;
        if (c == 'f') return 4;
        if (c == 'e') return 5;
        if (c == 'd') return 6;
        return 0;  // 알 수 없는 문자
    };

    while (Serial.available()) {
        char key = Serial.read();

        // 중복 입력 체크: 이미 입력된 점을 다시 누르면 버퍼 초기화
        // if (serialBuffer.indexOf(key) != -1) {
        //     serialBuffer = "";
        //     Serial.println("[INFO] Buffer cleared (duplicate input)");
        // }
        if (key == '\n' || key == '\r') {
            continue;
        }
        if (getDotOrder(key) == 0) {
            serialBuffer = "";
            Serial.println("[INFO] Buffer cleared (invalid input)");
        }
        else {
            serialBuffer += key;
            Serial.println(serialBuffer);
        }
    }
    if (serialBuffer.endsWith("de")) {
        uint8_t dots = 0;
        for (int i = 0; i < serialBuffer.length() - 2; i++) {
            if (serialBuffer[i] == 'c') {
                dots |= 1 << 0;
            } else if (serialBuffer[i] == 'b') {
                dots |= 1 << 1;
            } else if (serialBuffer[i] == 'a') {
                dots |= 1 << 2;
            } else if (serialBuffer[i] == 'f') {
                dots |= 1 << 3;
            } else if (serialBuffer[i] == 'e') {
                dots |= 1 << 4;
            } else if (serialBuffer[i] == 'd') {
                dots |= 1 << 5;
            }
        }
        applyBraillePattern(dots);
        serialBuffer = "";
    }
    // 다음 버튼 누르기 전 앞의 점을 누르면 buffer 들어간 점들 취소
    else if (serialBuffer.length() > 1) {
        char lastchar = serialBuffer[serialBuffer.length() - 1];
        int newOrder = getDotOrder(lastchar);
        
        int existingOrder = getDotOrder(serialBuffer[serialBuffer.length() - 2]);
        if (existingOrder > 0 && newOrder < existingOrder) {
            // 새 점이 기존 점보다 앞에 있으면 버퍼 초기화
            serialBuffer = String(lastchar);
            Serial.println("[INFO] Buffer cleared (earlier dot pressed)");
            Serial.println(serialBuffer);
        }
        // 같은 경우?
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
        applyBraillePattern(dots);
        logMotorStatuses();
        delay(BRAILLE_PATTERN_HOLD_MS);
    }

    stopAllMotors();
}

void handleClear() {
    Serial.println("[RX] CLEAR");
    stopAllMotors();
}
void handleWordSeparator() {
    Serial.println("[RX] WORD_SEPARATOR");
    stopAllMotors();
}
void handleSentenceSeparator()  {
    Serial.println("[RX] SENTENCE_SEPARATOR");
    stopAllMotors();
}
void handleBrailleSeparator()   {
    Serial.println("[RX] BRAILLE_SEPARATOR");
    stopAllMotors();
}

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
    motorInit();
}

void loop() {
    handleKeyboardTest();
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
        stopAllMotors();
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

    // handleSerialInput();
}