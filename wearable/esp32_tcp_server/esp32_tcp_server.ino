/*
 * ESP32 TCP Braille Server
 * ESP_APP_COMMUNICATION.md Protocol Implementation
 * 
 * Features:
 * - WiFi Connection
 * - TCP Server (Port 8888)
 * - Braille Pattern Receive and Output
 * - Braille Input and Transmission
 * - Image Data Transmission
 */

#include <WiFi.h>
#include <WiFiServer.h>
#include <WiFiClient.h>

// ==================== Configuration ====================
// WiFi Settings (Modify according to your environment)
const char* ssid = "teamwork_room";
const char* password = "87654321";

// TCP Server Port
const int TCP_PORT = 8888;

// Braille Output Pins (Modify according to your hardware)
const int BRAILLE_PINS[6] = {2, 4, 5, 18, 19, 21};

// Braille Input Pins (Touch sensors or buttons)
const int INPUT_PINS[6] = {14, 15, 16, 17, 25, 26};

// Button Pins (Next, Enter)
const int BUTTON_NEXT = 32;      // Word separator (space)
const int BUTTON_ENTER = 33;     // Sentence separator (newline)

// ==================== Message Type Definitions ====================
// App -> ESP
#define MSG_WORD_SEQUENCE       0x03
#define MSG_CLEAR               0x04
#define MSG_WORD_SEPARATOR      0x05
#define MSG_SENTENCE_SEPARATOR  0x06
#define MSG_BRAILLE_SEPARATOR   0x07

// ESP -> App
#define MSG_DOT_PATTERN         0x01
#define MSG_IMAGE_DATA          0x30

// ==================== Global Variables ====================
WiFiServer server(TCP_PORT);
WiFiClient client;
bool clientConnected = false;

// Braille State
bool brailleDots[6] = {false, false, false, false, false, false};
bool lastInputState[6] = {false, false, false, false, false, false};
bool lastButtonNext = false;
bool lastButtonEnter = false;

// Input Buffer
uint8_t inputBuffer[1024];
size_t inputBufferIndex = 0;

// ==================== Checksum Calculation ====================
uint8_t calculateChecksum(uint8_t* data, size_t length) {
    uint8_t checksum = 0;
    for (size_t i = 0; i < length; i++) {
        checksum ^= data[i];
    }
    return checksum;
}

// ==================== Message Creation and Transmission ====================
void sendMessage(uint8_t messageType, uint8_t* data, size_t dataLength) {
    if (!clientConnected || !client.connected()) {
        return;
    }
    
    // Create Header
    uint8_t header[4];
    header[0] = messageType;                    // Message Type
    header[1] = (uint8_t)(dataLength & 0xFF);   // Data Length (Little Endian, LSB)
    header[2] = (uint8_t)((dataLength >> 8) & 0xFF); // Data Length (Little Endian, MSB)
    
    // Calculate Checksum (Header 3 bytes + Data)
    uint8_t checksumData[3 + dataLength];
    checksumData[0] = header[0];
    checksumData[1] = header[1];
    checksumData[2] = header[2];
    for (size_t i = 0; i < dataLength; i++) {
        checksumData[3 + i] = data[i];
    }
    header[3] = calculateChecksum(checksumData, 3 + dataLength);
    
    // Send Header
    client.write(header, 4);
    
    // Send Data
    if (dataLength > 0) {
        client.write(data, dataLength);
    }
    
    client.flush();
    
    Serial.printf("[TX] Type: 0x%02X, Length: %d\n", messageType, dataLength);
}

// Send DOT_PATTERN (ESP -> App)
void sendDotPattern(uint8_t dotsByte) {
    uint8_t data[1] = {dotsByte};
    sendMessage(MSG_DOT_PATTERN, data, 1);
    Serial.printf("[TX] DOT_PATTERN: 0x%02X\n", dotsByte);
}

// Send WORD_SEPARATOR (ESP -> App)
void sendWordSeparator() {
    uint8_t data[1] = {0x00};
    sendMessage(MSG_WORD_SEPARATOR, data, 1);
    Serial.println("[TX] WORD_SEPARATOR");
}

// Send SENTENCE_SEPARATOR (ESP -> App)
void sendSentenceSeparator() {
    uint8_t data[1] = {0x00};
    sendMessage(MSG_SENTENCE_SEPARATOR, data, 1);
    Serial.println("[TX] SENTENCE_SEPARATOR");
}

// Send IMAGE_DATA (ESP -> App)
void sendImageData(uint8_t* imageBytes, size_t imageLength) {
    sendMessage(MSG_IMAGE_DATA, imageBytes, imageLength);
    Serial.printf("[TX] IMAGE_DATA: %d bytes\n", imageLength);
}

// ==================== Message Reception and Processing ====================
bool parseMessage() {
    if (inputBufferIndex < 4) {
        return false; // Header not complete yet
    }
    
    uint8_t messageType = inputBuffer[0];
    uint16_t dataLength = inputBuffer[1] | (inputBuffer[2] << 8); // Little Endian
    uint8_t receivedChecksum = inputBuffer[3];
    
    // Check if entire message is received
    if (inputBufferIndex < (4 + dataLength)) {
        return false; // Data not complete yet
    }
    
    // Verify Checksum
    uint8_t calculatedChecksum = calculateChecksum(inputBuffer, 3 + dataLength);
    if (calculatedChecksum != receivedChecksum) {
        Serial.printf("[ERROR] Checksum mismatch! Expected: 0x%02X, Received: 0x%02X\n", 
                      calculatedChecksum, receivedChecksum);
        // Clear buffer
        inputBufferIndex = 0;
        return false;
    }
    
    // Extract Data
    uint8_t* data = (inputBufferIndex > 4) ? &inputBuffer[4] : nullptr;
    
    // Process Message
    handleReceivedMessage(messageType, data, dataLength);
    
    // Remove processed message from buffer
    size_t messageSize = 4 + dataLength;
    if (inputBufferIndex > messageSize) {
        // Move remaining data forward
        memmove(inputBuffer, &inputBuffer[messageSize], inputBufferIndex - messageSize);
        inputBufferIndex -= messageSize;
    } else {
        inputBufferIndex = 0;
    }
    
    return true;
}

void handleReceivedMessage(uint8_t messageType, uint8_t* data, size_t dataLength) {
    Serial.printf("[RX] Type: 0x%02X, Length: %d\n", messageType, dataLength);
    
    switch (messageType) {
        case MSG_WORD_SEQUENCE:
            // Process braille pattern sequence
            handleWordSequence(data, dataLength);
            break;
            
        case MSG_CLEAR:
            // Clear braille
            handleClear();
            break;
            
        case MSG_WORD_SEPARATOR:
            // Process word separator
            handleWordSeparator();
            break;
            
        case MSG_SENTENCE_SEPARATOR:
            // Process sentence separator
            handleSentenceSeparator();
            break;
            
        case MSG_BRAILLE_SEPARATOR:
            // Process braille separator
            handleBrailleSeparator();
            break;
            
        default:
            Serial.printf("[WARNING] Unknown message type: 0x%02X\n", messageType);
            break;
    }
}

void handleWordSequence(uint8_t* data, size_t dataLength) {
    Serial.printf("[RX] WORD_SEQUENCE: %d bytes\n", dataLength);
    
    // Output each braille pattern sequentially
    for (size_t i = 0; i < dataLength; i++) {
        uint8_t dotsByte = data[i];
        setBraillePattern(dotsByte);
        updateBrailleDisplay();
        
        // Optional delay between braille patterns
        if (i < dataLength - 1) {
            delay(100); // 100ms delay
        }
    }
}

void handleClear() {
    Serial.println("[RX] CLEAR");
    // Clear all braille dots
    for (int i = 0; i < 6; i++) {
        brailleDots[i] = false;
    }
    updateBrailleDisplay();
}

void handleWordSeparator() {
    Serial.println("[RX] WORD_SEPARATOR");
    // Process word separator (e.g., short delay)
    delay(200);
    handleClear();
}

void handleSentenceSeparator() {
    Serial.println("[RX] SENTENCE_SEPARATOR");
    // Process sentence separator (e.g., long delay)
    delay(500);
    handleClear();
}

void handleBrailleSeparator() {
    Serial.println("[RX] BRAILLE_SEPARATOR");
    // Process braille separator
    delay(100);
    handleClear();
}

// ==================== Braille Output ====================
void setBraillePattern(uint8_t dotsByte) {
    // Set each dot state using bitmask
    // Bit 0: Dot 1 (LSB)
    // Bit 1: Dot 2
    // Bit 2: Dot 3
    // Bit 3: Dot 4
    // Bit 4: Dot 5
    // Bit 5: Dot 6 (MSB)
    for (int i = 0; i < 6; i++) {
        brailleDots[i] = (dotsByte >> i) & 0x01;
    }
}

void updateBrailleDisplay() {
    for (int i = 0; i < 6; i++) {
        digitalWrite(BRAILLE_PINS[i], brailleDots[i] ? HIGH : LOW);
    }
}

// ==================== Braille Input Processing ====================
void handleBrailleInput() {
    bool currentInputState[6];
    bool inputChanged = false;
    uint8_t currentDotsByte = 0;
    
    // Read current input state
    for (int i = 0; i < 6; i++) {
        currentInputState[i] = !digitalRead(INPUT_PINS[i]); // Inverted due to pull-up
        if (currentInputState[i]) {
            currentDotsByte |= (1 << i); // Set bit
        }
        
        // Detect state change
        if (currentInputState[i] != lastInputState[i]) {
            inputChanged = true;
        }
    }
    
    // Check if input is complete (all dots released)
    static unsigned long lastInputTime = 0;
    static uint8_t lastDotsByte = 0;
    const unsigned long INPUT_TIMEOUT = 500; // 500ms
    
    if (inputChanged) {
        lastInputTime = millis();
        lastDotsByte = currentDotsByte;
    }
    
    // Detect input completion (all dots released and timeout elapsed)
    if (currentDotsByte == 0 && lastDotsByte != 0 && 
        (millis() - lastInputTime) > INPUT_TIMEOUT) {
        // Send braille pattern
        sendDotPattern(lastDotsByte);
        Serial.printf("[INPUT] Dot pattern: 0x%02X\n", lastDotsByte);
        lastDotsByte = 0;
    }
    
    // Update state
    for (int i = 0; i < 6; i++) {
        lastInputState[i] = currentInputState[i];
    }
}

// ==================== Button Input Processing ====================
void handleButtonInput() {
    bool currentButtonNext = !digitalRead(BUTTON_NEXT); // Inverted due to pull-up
    bool currentButtonEnter = !digitalRead(BUTTON_ENTER);
    
    // Next button (word separator)
    if (currentButtonNext && !lastButtonNext) {
        sendWordSeparator();
        Serial.println("[INPUT] Next button pressed");
    }
    lastButtonNext = currentButtonNext;
    
    // Enter button (sentence separator)
    if (currentButtonEnter && !lastButtonEnter) {
        sendSentenceSeparator();
        Serial.println("[INPUT] Enter button pressed");
    }
    lastButtonEnter = currentButtonEnter;
}

// ==================== WiFi Connection ====================
void connectToWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }
    
    Serial.print("Connecting to WiFi");
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("WiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println();
        Serial.println("WiFi connection failed");
    }
}

// ==================== Setup ====================
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("========================================");
    Serial.println("ESP32 TCP Braille Server");
    Serial.println("ESP_APP_COMMUNICATION.md Protocol");
    Serial.println("========================================");
    
    // Initialize braille output pins
    for (int i = 0; i < 6; i++) {
        pinMode(BRAILLE_PINS[i], OUTPUT);
        digitalWrite(BRAILLE_PINS[i], LOW);
    }
    
    // Initialize braille input pins (using internal pull-up)
    for (int i = 0; i < 6; i++) {
        pinMode(INPUT_PINS[i], INPUT_PULLUP);
    }
    
    // Initialize button pins
    pinMode(BUTTON_NEXT, INPUT_PULLUP);
    pinMode(BUTTON_ENTER, INPUT_PULLUP);
    
    // Connect to WiFi
    connectToWiFi();
    
    // Start TCP server
    server.begin();
    Serial.printf("TCP server started (Port %d)\n", TCP_PORT);
    Serial.println("Waiting for client connection...");
}

// ==================== Loop ====================
void loop() {
    // Check WiFi connection status
    if (WiFi.status() != WL_CONNECTED) {
        connectToWiFi();
        delay(1000);
        return;
    }
    
    // Check client connection
    if (!clientConnected) {
        client = server.available();
        if (client) {
            clientConnected = true;
            Serial.println("Client connected");
            Serial.print("Client IP: ");
            Serial.println(client.remoteIP());
            inputBufferIndex = 0; // Clear buffer
        }
    } else {
        // Check client connection status
        if (!client.connected()) {
            clientConnected = false;
            Serial.println("Client disconnected");
            inputBufferIndex = 0; // Clear buffer
        } else {
            // Process received data
            while (client.available() > 0) {
                if (inputBufferIndex < sizeof(inputBuffer)) {
                    inputBuffer[inputBufferIndex++] = client.read();
                } else {
                    // Buffer overflow
                    Serial.println("[ERROR] Input buffer overflow!");
                    inputBufferIndex = 0;
                }
                
                // Try to parse message
                while (parseMessage()) {
                    // Continue parsing if message successfully parsed
                }
            }
        }
    }
    
    // Process braille input
    handleBrailleInput();
    
    // Process button input
    handleButtonInput();
    
    delay(10); // Reduce CPU load
}

