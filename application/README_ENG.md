# Voice-Text Chat Simulator with Braille Support

A comprehensive Android chat application that simulates conversations between voice users and text users, featuring advanced speech recognition, text-to-speech, and braille input/output capabilities. Designed with accessibility in mind, this app supports multiple input methods including voice, text, and braille.

## 🌟 Key Features

### 🎤 Advanced Voice Processing
- **Real-time Speech Recognition**: Convert speech to text using Android's SpeechRecognizer
- **Advanced STT Processing**: Comprehensive status feedback and error handling
- **Status Management**: Visual feedback for all speech recognition states
- **Automatic Retry**: Smart retry logic for failed recognition attempts

### 📝 Multiple Input Methods
- **Text Input**: Traditional keyboard input with send functionality
- **Voice Input**: Tap-to-speak with real-time recognition
- **Braille Input**: 6-dot braille grid for tactile input
- **Input Mode Switching**: Seamless switching between input methods

### 🔊 Text-to-Speech Integration
- **Automatic TTS**: Text messages are automatically played back as speech
- **Real-time Feedback**: Immediate audio feedback for braille input
- **Language Support**: Configurable TTS language settings

### 🔤 Braille Support
- **liblouis Integration**: Professional-grade braille translation using liblouis-java
- **Bidirectional Conversion**: Text ↔ Braille conversion in both directions
- **Multiple Braille Tables**: Support for various braille table formats
- **Interactive Braille Input**: 6-dot braille grid for direct braille input
- **Real-time Translation**: Instant braille translation and audio feedback
- **Braille Transmitter**: Dedicated WiFi braille pattern transmission module

### 📶 WiFi Communication
- **GATT-Compatible Protocol**: WiFi implementation using BLE GATT message structure
- **Real-time Braille Transmission**: 4-byte header + data binary protocol for instant dot transmission
- **Message Types**: DOT_PATTERN, WORD_SEPARATOR, SENTENCE_SEPARATOR, BRAILLE_SEPARATOR, TEXT_MESSAGE, SETTINGS, IMAGE_DATA
- **Text Message Support**: Compressed text and braille message transmission
- **User Settings**: Speed, mode, and configuration transmission
- **Image Reception**: Handwriting image reception and OCR processing support
- **Unified Message Manager**: Centralized communication management for WiFi connections

### 🎨 Modern UI/UX
- **Jetpack Compose**: Built with the latest Android UI toolkit
- **Material Design 3**: Modern, accessible design system
- **Responsive Layout**: Optimized for various screen sizes
- **Accessibility Features**: Enhanced accessibility for users with visual impairments
- **Haptic Feedback**: Tactile feedback for braille input

### 📷 OCR Support (NEW!)
- **ML Kit Text Recognition**: Google ML Kit for handwriting recognition
- **Image Reception**: Receive handwriting images from web visualizer
- **Real-time Processing**: Process images and convert to text
- **Multi-language Support**: Numbers, alphabets, and Japanese characters

## 🚀 How It Works

### Voice User Mode
1. Toggle to "Voice User" mode
2. Tap the microphone button to start speech recognition
3. Speak your message clearly
4. Real-time status feedback shows recognition progress:
   - **Starting**: Initializing speech recognition
   - **Ready**: Ready to listen for speech
   - **Listening**: Actively listening to your voice
   - **Processing**: Converting speech to text
   - **Success**: Speech successfully recognized
   - **Error**: Recognition issues with helpful error messages
5. Recognized text appears as a blue message bubble
6. Braille translation is automatically generated and displayed

### Text User Mode
1. Toggle to "Text User" mode
2. Type your message in the text field
3. Tap the send button
4. Text appears as a gray message bubble
5. Message is automatically played back using TTS

### Braille Input Mode
1. Toggle to "Braille Input" mode
2. Use the 6-dot braille grid to input characters:
   - Touch dots 1-6 to create braille patterns
   - Visual feedback shows active dots
   - Complete pattern by tapping "Complete" button
3. Real-time character recognition and audio feedback
4. Seamless integration with chat system

### WiFi Connection
1. Enter server IP address and port (default: 8888)
2. Tap "연결" to connect to WiFi server (web visualizer or ESP32)
3. Select transmission mode:
   - **Braille Mode**: Send braille patterns directly
   - **Text Mode**: Send text messages (converted to braille)
4. Real-time communication:
   - Braille patterns are transmitted automatically
   - Text messages are converted and sent
   - Settings can be transmitted
   - Images can be received and processed with OCR
5. Monitor connection status in the UI

## 🛠️ Technical Architecture

### Core Technologies
- **Platform**: Android API 30+ (Android 11+)
- **Language**: Kotlin 2.0.21
- **UI Framework**: Jetpack Compose with Material Design 3
- **Architecture**: MVVM with StateFlow and Coroutines
- **Build System**: Gradle 8.10.1

### Key Libraries
- **liblouis-java**: 5.1.0 - Professional braille translation
- **JNA**: 5.17.0 - Native library access for liblouis
- **AndroidX Compose BOM**: 2024.09.00 - Latest Compose components
- **Lifecycle**: 2.7.0 - ViewModel and state management
- **Google ML Kit**: 16.0.1 - Text recognition (OCR)
- **Gson**: 2.10.1 - JSON serialization
- **Kotlin Coroutines**: 1.7.3 - Asynchronous programming

### Project Structure
```
app/src/main/java/com/example/chatting_app/
├── MainActivity.kt              # App entry point with permission handling
├── ChatScreen.kt               # Main chat UI composable
├── ChatViewModel.kt            # Business logic and state management
├── ChatMessage.kt              # Message data class
├── BrailleConverter.kt         # Braille conversion wrapper
├── BrailleConverterJava.kt     # liblouis-java integration
├── BrailleInputGrid.kt         # 6-dot braille input UI
├── BrailleInputManager.kt      # Braille input logic
├── BraillePatternConverter.kt  # Braille pattern recognition
├── network/
│   ├── UnifiedMessageManager.kt # Centralized WiFi message management
│   ├── WifiClient.kt            # WiFi client implementation
│   ├── WifiMessageProtocol.kt   # GATT-compatible protocol
│   ├── WifiBrailleTransmitter.kt # Braille pattern transmitter
│   ├── WifiTextTransmitter.kt   # Text message transmitter
│   └── WifiSettingsTransmitter.kt # Settings transmitter
├── ocr/
│   └── TextRecognizerManager.kt # ML Kit OCR integration
└── ui/theme/                   # Material Design 3 theming
```

## 📱 Setup and Installation

### Prerequisites
- Android Studio (latest version)
- Android SDK 35
- Android device with API 30+ (Android 11+)
- Microphone access
- Internet connection for TTS
- ESP32 development board (for WiFi prototype testing)

### Installation Steps
1. Clone the repository
2. Open in Android Studio
3. Sync Gradle files
4. Build and run

### WiFi Server Setup
**Option 1: Web Visualizer Server**
1. Start the web visualizer server (see web_visualizer/README.md)
2. Note the server IP address (usually shown in the web interface)
3. Use this IP address and port 8888 in the Android app

**Option 2: ESP32 Server**
1. Install Arduino IDE with ESP32 support
2. Open `esp32_wifi_server.ino` in Arduino IDE (in wearable/ folder)
3. Update WiFi credentials in the code
4. Upload the code to your ESP32
5. Note the IP address displayed in Serial Monitor
6. Use this IP address and port 8888 in the Android app

### Required Permissions
- `RECORD_AUDIO`: For speech recognition functionality
- `INTERNET`: For TTS engine access and WiFi communication
- `ACCESS_NETWORK_STATE`: For network state checking
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`: For BLE communication (optional)
- `VIBRATE`: For haptic feedback

## 🎯 Current Implementation Status

### ✅ Completed Features
- [x] Advanced speech recognition with status management
- [x] Text-to-speech integration
- [x] liblouis-java braille translation
- [x] 6-dot braille input grid
- [x] Real-time braille pattern recognition
- [x] Interactive braille input with audio feedback
- [x] WiFi communication with GATT-compatible protocol
- [x] Unified message management system
- [x] Image reception and OCR processing
- [x] Modern Material Design 3 UI
- [x] MVVM architecture with StateFlow
- [x] Comprehensive error handling
- [x] Runtime permission management

### 🔄 In Progress
- [ ] Braille table optimization
- [ ] Enhanced accessibility features
- [ ] Performance optimizations

### 📋 Planned Features
- [ ] Message persistence with Room Database
- [ ] Multiple language support
- [ ] Voice message playback
- [ ] Advanced braille table management
- [ ] Dark mode support
- [ ] Export/import chat history
- [ ] BLE communication integration
- [ ] Enhanced OCR accuracy improvements

## 🧪 Testing

### Unit Tests
- ViewModel business logic testing
- Braille conversion testing
- Pattern recognition testing

### UI Tests
- Compose component testing
- Braille input interaction testing
- Accessibility testing

### Integration Tests
- End-to-end chat flow testing
- Voice recognition testing
- TTS functionality testing

## 📚 Documentation

- [Development Instructions](DEVELOPMENT_INSTRUCTIONS.md) - Comprehensive development guide
- [Braille Input Implementation](BRAILLE_INPUT_IMPLEMENTATION.md) - Detailed braille feature documentation
- [BLE GATT Architecture](BLE_GATT_ARCHITECTURE.md) - BLE communication architecture
- [WiFi Prototype Protocol](WIFI_PROTOTYPE_PROTOCOL.md) - WiFi communication protocol details
- [Simple Braille Dot Protocol](SIMPLE_BRAILLE_DOT_PROTOCOL.md) - Basic braille communication protocol

## 🔧 Development

### Building the Project
```bash
# Debug build
./gradlew assembleDebug

# Release build
./gradlew assembleRelease

# Run tests
./gradlew test
```

### Code Style
- Follow Kotlin coding conventions
- Apply Compose guidelines
- Use Material Design 3 components
- Maintain MVVM architecture principles

## 📚 Documentation

- [Development Instructions](DEVELOPMENT_INSTRUCTIONS.md) - Comprehensive development guide
- [Braille Input Implementation](BRAILLE_INPUT_IMPLEMENTATION.md) - Detailed braille feature documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project uses the following open-source libraries:
- **liblouis**: LGPL 2.1
- **JNA**: Apache 2.0
- **AndroidX**: Apache 2.0

## 🆘 Support

For issues and questions:
1. Check the documentation files
2. Review the development instructions
3. Open an issue on GitHub

---

**Note**: This app is designed with accessibility in mind and supports multiple input methods to accommodate users with different needs and preferences.
