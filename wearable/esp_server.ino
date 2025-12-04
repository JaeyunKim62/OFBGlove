#include <WiFi.h>
#include <Wire.h>

#ifndef MOTOR_I2C_SDA_PIN
#define MOTOR_I2C_SDA_PIN 22
#endif

#ifndef MOTOR_I2C_SCL_PIN
#define MOTOR_I2C_SCL_PIN 23
#endif

#ifndef MOTOR_I2C_CLOCK_HZ
#define MOTOR_I2C_CLOCK_HZ 400000UL
#endif

#define SERIAL_DEBUG_MOTOR_STATUS

constexpr uint8_t BRAILLE_DOT_COUNT = 6;
constexpr uint8_t BRAILLE_DOT_ADDRESSES[BRAILLE_DOT_COUNT] = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06};

constexpr uint8_t MOTOR_CMD_PLAY_PATTERN = 0x01;
constexpr uint8_t MOTOR_CMD_STOP         = 0x02;
constexpr uint8_t MOTOR_FRAME_SIZE       = 10;
constexpr uint8_t MOTOR_MAX_PATTERN_LEN  = 8;
constexpr uint8_t DEFAULT_WAVEFORM_ID    = 47;
constexpr uint8_t DEFAULT_PATTERN_LEN    = 1;
constexpr uint16_t BRAILLE_PATTERN_HOLD_MS = 1000;

const char* apSsid     = "OFBG_AP7";
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

enum MessageType : uint8_t {
    MSG_WORD_SEQUENCE      = 0x08,
    MSG_CLEAR              = 0x04,
    MSG_WORD_SEPARATOR     = 0x05,
    MSG_SENTENCE_SEPARATOR = 0x06,  
    MSG_BRAILLE_SEPARATOR  = 0x07,
    MSG_PATTERN_COMPLETE   = 0x03,
    MSG_CONFIG_SET        = 0x0A,  // 설정 변경
    MSG_CONFIG_GET         = 0x0B,  // 설정 조회
    MSG_CONFIG_RESET       = 0x0C   // 설정 초기화
};

struct VibrationConfig {
    uint8_t waveformId;        // 진동 패턴 ID (0-255)
    uint8_t patternLength;     // 패턴 길이 (1-8)
    uint16_t holdDuration;     // 점자 패턴 유지 시간 (ms)
    uint16_t intervalDuration; // 패턴 사이 간격 (ms)
    uint16_t dotMode; // 점 모드 (0=CELL/동시, 1=DOT_BY_DOT/순차)
    uint16_t dotInterval; // 점 사이 간격 (ms)
    uint8_t intensity;         // 진동 세기 (0-100, 실제 적용은 waveformId로)
    uint8_t speed;             // 속도 모드 (0=SLOW, 1=NORMAL, 2=FAST)
    uint8_t mode;              // 동작 모드 (0=NORMAL, 1=TEST, 2=DEBUG)
    uint8_t flags;             // 기타 플래그
};

VibrationConfig currentConfig = {
    .waveformId = DEFAULT_WAVEFORM_ID,
    .patternLength = DEFAULT_PATTERN_LEN,
    .holdDuration = BRAILLE_PATTERN_HOLD_MS,
    .intervalDuration = 200,
    .dotMode = 0, // CELL
    .dotInterval = 100,
    .intensity = 100,
    .speed = 1,  // NORMAL
    .mode = 0,   // NORMAL
    .flags = 0x00
};

const uint16_t SPEED_HOLD_MS[3] = {1500, 1000, 500};      // SLOW, NORMAL, FAST
const uint16_t SPEED_INTERVAL_MS[3] = {2500, 1500, 1000};    // SLOW, NORMAL, FAST

// ========== 설정 적용 함수 ==========
void applyConfig() {
    // 속도에 따른 hold duration 업데이트
    currentConfig.holdDuration = SPEED_HOLD_MS[currentConfig.speed];
    currentConfig.intervalDuration = SPEED_INTERVAL_MS[currentConfig.speed];
    
    Serial.printf("[CONFIG] Applied: waveform=%d speed=%d mode=%d hold=%dms\n",
                  currentConfig.waveformId, currentConfig.speed, 
                  currentConfig.mode, currentConfig.holdDuration);
}

// ========== 설정 조회 함수 ==========
void handleConfigGet() {
    if (!clientConnected || !client.connected()) {
        Serial.println("[WARN] No client for config get");
        return;
    }
    
    uint8_t payload[14];
    payload[0] = 0x00;  // response type
    payload[1] = currentConfig.waveformId;
    payload[2] = currentConfig.patternLength;
    payload[3] = currentConfig.holdDuration & 0xFF;
    payload[4] = (currentConfig.holdDuration >> 8) & 0xFF;
    payload[5] = currentConfig.intervalDuration & 0xFF;
    payload[6] = (currentConfig.intervalDuration >> 8) & 0xFF;
    payload[7] = currentConfig.intensity;
    payload[8] = currentConfig.speed;
    payload[9] = currentConfig.mode;
    payload[10] = currentConfig.dotMode;
    payload[11] = currentConfig.dotInterval & 0xFF;
    payload[12] = (currentConfig.dotInterval >> 8) & 0xFF;
    payload[13] = currentConfig.flags;
    
    uint8_t header[4];
    header[0] = MSG_CONFIG_GET;
    header[1] = 14;  // length LSB
    header[2] = 0;   // length MSB
    header[3] = calculateChecksum(payload, 14);

    client.write(header, 4);
    client.write(payload, 14);
    client.flush();
    
    Serial.println("[CONFIG] Config sent to client");
}

// ========== 설정 초기화 ==========
void handleConfigReset() {
    currentConfig.waveformId = DEFAULT_WAVEFORM_ID;
    currentConfig.patternLength = DEFAULT_PATTERN_LEN;
    currentConfig.holdDuration = BRAILLE_PATTERN_HOLD_MS;
    currentConfig.intervalDuration = 200;
    currentConfig.intensity = 100;
    currentConfig.speed = 1;
    currentConfig.mode = 0;
    currentConfig.dotMode = 0;
    currentConfig.dotInterval = 100;
    currentConfig.flags = 0x00;
    applyConfig();
    Serial.println("[CONFIG] Reset to defaults");
}


// ========== 설정 변경 함수 (TCP 메시지) ==========
void handleConfigSet(uint8_t* data, size_t len) {
    if (len < 1) {
        Serial.println("[ERROR] CONFIG_SET: Invalid length");
        return;
    }
    
    uint8_t paramType = data[0];
    
    switch (paramType) {
        case 0x01: // waveformId
            if (len >= 2) {
                currentConfig.waveformId = data[1];
                Serial.printf("[CONFIG] waveformId = %d\n", currentConfig.waveformId);
            }
            break;
        case 0x02: // speed
            if (len >= 2) {
                if (data[1] <= 2) {
                    currentConfig.speed = data[1];
                    applyConfig();
                }
            }
            break;
        case 0x03: // mode
            if (len >= 2) {
                currentConfig.mode = data[1];
                Serial.printf("[CONFIG] mode = %d\n", currentConfig.mode);
            }
            break;
        case 0x04: // intensity (0-100)
            if (len >= 2) {
                currentConfig.intensity = data[1];
                Serial.printf("[CONFIG] intensity = %d\n", currentConfig.intensity);
            }
            break;
        case 0x06: // dotMode (새로 추가)
        if (len >= 2) {
            if (data[1] <= 1) {
                currentConfig.dotMode = data[1];
                Serial.printf("[CONFIG] dotMode = %d (%s)\n", 
                                currentConfig.dotMode,
                                currentConfig.dotMode == 0 ? "CELL" : "DOT_BY_DOT");
            }
        }
        break;
        case 0x07: // dotInterval (새로 추가)
            if (len >= 3) {
                currentConfig.dotInterval = data[1] | (data[2] << 8);
                Serial.printf("[CONFIG] dotInterval = %d ms\n", currentConfig.dotInterval);
            }
            break;
        case 0x05: // 전체 설정 (8 bytes)
            if (len >= 8) {
                currentConfig.waveformId = data[1];
                currentConfig.patternLength = data[2];
                currentConfig.holdDuration = data[3] | (data[4] << 8);
                currentConfig.intervalDuration = data[5] | (data[6] << 8);
                currentConfig.intensity = data[7];
                currentConfig.speed = data[8];
                currentConfig.mode = data[9];
                currentConfig.flags = data[10];
                applyConfig();
                Serial.println("[CONFIG] Full config updated");
            }
            break;
        default:
            Serial.printf("[WARN] Unknown config param: 0x%02X\n", paramType);
    }
}

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
    uint8_t pattern[currentConfig.patternLength];
    for (uint8_t i = 0; i < currentConfig.patternLength; ++i) {
        pattern[i] = currentConfig.waveformId;
    }
    
    if (currentConfig.dotMode == 1) {
        // DOT_BY_DOT 모드: 순차 진동 (시작 시간 기준 간격)
        Serial.printf("[MOTOR] DOT_BY_DOT mode: dots=0x%02X\n", dotsByte);
    
        // 각 점을 dotInterval 간격으로 순차 켜기
        for (uint8_t dot = 0; dot < BRAILLE_DOT_COUNT; ++dot) {
            bool shouldActivate = (dotsByte & (1U << dot)) != 0;
            
            if (shouldActivate) {
                if (motorPlayPattern(dot, pattern, currentConfig.patternLength)) {
                    motorActiveState[dot] = true;
                    Serial.printf("  [DOT %d] ON\n", dot + 1);
                }
                
                // 다음 점까지 간격 (시작 시간 기준)
                // 이 시간 동안 현재 점은 계속 진동 중
                if (dot < BRAILLE_DOT_COUNT - 1) {
                    delay(currentConfig.dotInterval);
                }
            }
        }
        
        // 모든 점을 켠 후, holdDuration만큼 유지
        delay(currentConfig.holdDuration);
        
        // 전체 끄기
        stopAllMotors();

    } else {
        // CELL 모드: 동시 진동 (기존 방식)
        Serial.printf("[MOTOR] CELL mode: dots=0x%02X\n", dotsByte);
        for (uint8_t dot = 0; dot < BRAILLE_DOT_COUNT; ++dot) {
            bool shouldActivate = (dotsByte & (1U << dot)) != 0;
            
            if (shouldActivate) {
                if (motorPlayPattern(dot, pattern, currentConfig.patternLength)) {
                    motorActiveState[dot] = true;
                }
            } else if (motorActiveState[dot]) {
                if (motorStop(dot)) {
                    motorActiveState[dot] = false;
                }
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

    delay(1000);
}

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

void playSequentialVibration() {
    Serial.println("[INFO] Playing sequential vibration (dots 1-6)");
    const uint8_t pattern[DEFAULT_PATTERN_LEN] = { DEFAULT_WAVEFORM_ID };
    const uint16_t VIBRATION_DURATION_MS = 300;  // 각 진동 지속 시간
    const uint16_t VIBRATION_INTERVAL_MS = 200;  // 진동 사이 간격
    
    for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
        Serial.printf("[INFO] Vibrating dot %d\n", i + 1);
        if (motorPlayPattern(i, pattern, DEFAULT_PATTERN_LEN)) {
            motorActiveState[i] = true;
            delay(VIBRATION_DURATION_MS);
            if (motorStop(i)) {
                motorActiveState[i] = false;
            }
            if (i < BRAILLE_DOT_COUNT - 1) {  // 마지막 점이 아니면 간격 추가
                delay(VIBRATION_INTERVAL_MS);
            }
        }
    }
    Serial.println("[INFO] Sequential vibration complete");
}

// 버튼 상태 추적을 위한 변수 추가
uint8_t lastButtonState = 0;
unsigned long lastButtonCheckTime = 0;
const unsigned long BUTTON_CHECK_INTERVAL_MS = 50;  // 50ms마다 체크

// 버튼 상태를 읽고 눌림을 감지하는 함수
// void checkAndSendButtonPress() {
//     if (!motorBusReady || !clientConnected || !client.connected()) {
//         return;
//     }

//     uint8_t currentButtonState = 0;
//     bool anyButtonPressed = false;

//     // 모든 모듈의 버튼 상태 읽기
//     for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
//         MotorStatusFrame status{};
//         if (motorReadStatus(BRAILLE_DOT_ADDRESSES[i], status)) {
//             // buttonState가 0x01이면 눌림, STATUS_BITS의 bit3도 확인 가능
//             if (status.buttonState == 0x01 || (status.statusBits & 0x08) != 0) {
//                 currentButtonState |= (1U << i);  // i번째 비트 설정
//                 anyButtonPressed = true;
//             }
//         }
//     }

//     // 이전 상태와 다르고, 현재 눌린 버튼이 있으면 전송
//     if (currentButtonState != lastButtonState && anyButtonPressed) {
//         sendButtonPressToClient(currentButtonState);
//         lastButtonState = currentButtonState;
//     } else if (currentButtonState == 0 && lastButtonState != 0) {
//         // 모든 버튼이 떼어진 경우 상태 업데이트만
//         lastButtonState = 0;
//     }
// }

// 버튼 눌림을 클라이언트에 전송하는 함수
void sendBraillePatternToClient(uint8_t dotsByte) {
    if (!clientConnected || !client.connected()) {
        Serial.println("[WARN] No TCP client connected for button press");
        return;
    }

    uint8_t header[4];
    header[0] = MSG_PATTERN_COMPLETE;    // 메시지 타입
    header[1] = 0x01;                // data length LSB (1 byte)
    header[2] = 0x00;                // data length MSB
    header[3] = dotsByte;            // checksum = payload XOR

    uint8_t payload[1] = { dotsByte };

    // 한 번에 전송하도록 수정
    uint8_t packet[5];
    packet[0] = header[0];
    packet[1] = header[1];
    packet[2] = header[2];
    packet[3] = header[3];
    packet[4] = payload[0];

    client.write(packet, 5);  // 한 번에 전송
    client.flush();

    Serial.printf("[TX] BUTTON_PRESS dots=0x%02X (", dotsByte);
    for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
        if (dotsByte & (1U << i)) {
            Serial.printf("%d ", i + 1);
        }
    }
    Serial.println(")");
}

void handleButtonToClient() {
    static uint8_t composingMask = 0;
    static uint8_t lastPhysicalMask = 0;
    static unsigned long lastPoll = 0;
    static unsigned long button6PressStartTime = 0;
    static bool button6OnlyPressed = false;
    static bool wasButton6OnlyPressed = false;
    const unsigned long POLL_INTERVAL_MS = 30;
    const unsigned long LONG_PRESS_MS = 1200;
    const uint8_t BUTTON_6_MASK = (1U << 5);

    if (!motorBusReady) return;
    
    unsigned long now = millis();
    if (now - lastPoll < POLL_INTERVAL_MS) return;
    lastPoll = now;

    // 버튼 상태 읽기
    uint8_t currentMask = 0;
    for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
        MotorStatusFrame status{};
        if (!motorReadStatus(BRAILLE_DOT_ADDRESSES[i], status)) continue;
        
        bool pressed = (status.buttonState == 0x01) || ((status.statusBits & 0x08) != 0);
        if (pressed) {
            currentMask |= (1U << i);
        }
    }

    bool button6Pressed = (currentMask & BUTTON_6_MASK) != 0;
    bool otherButtonsPressed = (currentMask & ~BUTTON_6_MASK) != 0;
    button6OnlyPressed = button6Pressed && !otherButtonsPressed;
    bool stateChanged = (currentMask != lastPhysicalMask);
    bool allReleased = (currentMask == 0);

    if (stateChanged) {
        // 점자 입력 (6번 포함 가능)
        if (currentMask != 0 && !button6OnlyPressed) {
            composingMask |= currentMask;
            button6PressStartTime = 0;
            Serial.printf("[BUTTON] Input: mask=0x%02X, composing=0x%02X\n", 
                         currentMask, composingMask);
        }
        // 6번만 단독으로 눌림
        else if (button6OnlyPressed && !wasButton6OnlyPressed) {
            button6PressStartTime = now;
            Serial.println("[BUTTON] Button 6 only (long-press to commit)");
        }
        // 모든 버튼이 떼어짐
        else if (allReleased) {
            button6PressStartTime = 0;
        }
    }

    // 롱클릭 커밋
    if (button6OnlyPressed && button6PressStartTime > 0 && composingMask != 0) {
        unsigned long pressDuration = now - button6PressStartTime;
        if (pressDuration >= LONG_PRESS_MS) {
            Serial.printf("[BUTTON] Long-press commit: mask=0x%02X\n", composingMask);
            sendBraillePatternToClient(composingMask);
            composingMask = 0;
            button6PressStartTime = 0;
        }
    }

    wasButton6OnlyPressed = button6OnlyPressed;
    lastPhysicalMask = currentMask;
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
        if (c == '1') return 7;
        if (c == '2') return 7;
        if (c == '3') return 7;
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
        else if (getDotOrder(key) == 7) {
            uint8_t dots = 0;
            for (int i = 0; i < serialBuffer.length(); i++) {
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

// 버튼 누름 -> 진동 울림
// 입력 방식은 같은 방식
// 각 버튼 누르는 것을 handleKeyboardTest() 처럼 처리
// 종료 조건은 65 버튼 누르면 종료
// 이후 이 버튼에 맞춰서 점자 진동: applyBraillePattern(currentMask);
void handleButtonIOTest() {
    static uint8_t composingMask = 0;     // 현재 조합 중인 점자 패턴
    static uint8_t lastPhysicalMask = 0;  // 직전 물리 버튼 상태
    static unsigned long lastPoll = 0;
    static unsigned long button6PressStartTime = 0;  // 6번 버튼 롱클릭 시작 시간
    static bool button6OnlyPressed = false;  // 6번만 눌려있는지
    static bool wasButton6OnlyPressed = false;
    const unsigned long POLL_INTERVAL_MS = 30;
    const unsigned long LONG_PRESS_MS = 1200;  // 1.2초 롱클릭
    const uint8_t BUTTON_6_MASK = (1U << 5);  // 6번 버튼

    if (!motorBusReady) return;
    
    unsigned long now = millis();
    if (now - lastPoll < POLL_INTERVAL_MS) return;
    lastPoll = now;

    // 1) 물리 버튼 상태 읽기
    uint8_t currentMask = 0;
    for (uint8_t i = 0; i < BRAILLE_DOT_COUNT; ++i) {
        MotorStatusFrame status{};
        if (!motorReadStatus(BRAILLE_DOT_ADDRESSES[i], status)) continue;

        bool pressed = (status.buttonState == 0x01) || ((status.statusBits & 0x08) != 0);
        if (pressed) {
            currentMask |= (1U << i);
        }
    }

    // 2) 6번 버튼 상태 분석
    bool button6Pressed = (currentMask & BUTTON_6_MASK) != 0;
    bool otherButtonsPressed = (currentMask & ~BUTTON_6_MASK) != 0;  // 1-5번 중 하나라도 눌림
    button6OnlyPressed = button6Pressed && !otherButtonsPressed;
    
    bool stateChanged = (currentMask != lastPhysicalMask);
    bool allReleased = (currentMask == 0);

    // 3) 버튼 상태 변화 처리
    if (stateChanged) {
        // 점자 입력 (6번 포함 가능)
        if (currentMask != 0 && !button6OnlyPressed) {
            composingMask |= currentMask;
            button6PressStartTime = 0;  // 롱클릭 타이머 리셋
            Serial.printf("[BUTTON_TEST] Input: mask=0x%02X, composing=0x%02X\n", 
                         currentMask, composingMask);
        }
        // 6번만 단독으로 눌림 → 롱클릭 시작
        else if (button6OnlyPressed && !wasButton6OnlyPressed) {
            button6PressStartTime = now;
            Serial.println("[BUTTON_TEST] Button 6 only (long-press to commit)");
        }
        // 모든 버튼이 떼어짐
        else if (allReleased) {
            button6PressStartTime = 0;  // 롱클릭 타이머 리셋
        }
    }

    // 4) 6번 단독 롱클릭 감지 (커밋)
    if (button6OnlyPressed && button6PressStartTime > 0 && composingMask != 0) {
        unsigned long pressDuration = now - button6PressStartTime;
        
        if (pressDuration >= LONG_PRESS_MS) {
            Serial.printf("[BUTTON_TEST] Long-press commit: mask=0x%02X (held for %lums)\n", 
                         composingMask, pressDuration);
            applyBraillePattern(composingMask);
            composingMask = 0;
            button6PressStartTime = 0;  // 리셋
        }
    }

    wasButton6OnlyPressed = button6OnlyPressed;
    lastPhysicalMask = currentMask;
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
        delay(currentConfig.holdDuration);
        if (i < count - 1) {
            delay(currentConfig.intervalDuration);
        }
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
        case MSG_CONFIG_SET:         handleConfigSet(data, len); break;
        case MSG_CONFIG_GET:         handleConfigGet(); break;
        case MSG_CONFIG_RESET:       handleConfigReset(); break;
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
        delay(1000);
        playSequentialVibration();
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

    motorInit();
    playSequentialVibration();

    startAccessPoint();
    server.begin();
    Serial.printf("TCP server active on %d\n", TCP_PORT);
}

void loop() {
    handleKeyboardTest();
    handleButtonIOTest();
    handleButtonToClient();
    if (!clientConnected) {
        client = server.available();
        if (client) {
            clientConnected = true;
            inputBufferIndex = 0;
            lastButtonState = 0;  // 연결 시 버튼 상태 초기화
            Serial.println("Client connected");
            Serial.print("Remote: "); Serial.println(client.remoteIP());
        }
        return;
    }

    if (!client.connected()) {
        clientConnected = false;
        client.stop();
        inputBufferIndex = 0;
        lastButtonState = 0;  // 연결 해제 시 버튼 상태 초기화
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

    // 주기적으로 버튼 상태 체크
    // unsigned long currentTime = millis();
    // if (currentTime - lastButtonCheckTime >= BUTTON_CHECK_INTERVAL_MS) {
    //     checkAndSendButtonPress();
    //     lastButtonCheckTime = currentTime;
    // }

    // handleSerialInput();
    // handleKeyboardTest();
}