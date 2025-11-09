# OFBGlove Wearable Device

ESP32 기반 점자 장갑 제어 코드입니다. ESP32는 서버 역할을 하며 Android 앱과 WiFi를 통해 통신합니다.

## 🚀 빠른 시작

### ESP32 코드 업로드

1. **Arduino IDE 설치 및 ESP32 보드 설정**
   - Arduino IDE 설치
   - ESP32 보드 매니저 추가: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - 보드: ESP32 Dev Module 선택

2. **WiFi 서버 코드 업로드**
   ```bash
   # Arduino IDE에서 열기
   esp32_tcp_server/esp32_tcp_server.ino
   ```
   - WiFi SSID와 비밀번호 설정
   - 시리얼 모니터에서 IP 주소 확인 (보통 115200 baud)

3. **BLE 서버 코드 (선택사항)**
   ```bash
   # Arduino IDE에서 열기
   esp32_ble_server.ino
   ```

### Python 서버 (레거시)

**참고**: Python 서버는 레거시이며, 현재는 Node.js 통합 서버(web_visualizer) 사용을 권장합니다.

```bash
# WiFi 서버 실행
python python_wifi_server.py

# WebSocket 서버 실행  
python websocket_server.py
```

## 🔧 주요 구성

### ESP32 역할

ESP32는 **서버** 역할을 하며, Android 앱이 클라이언트로 연결합니다:

```
Android 앱 (클라이언트) ←→ ESP32 (서버, 포트 8888)
```

- **WiFi TCP 서버**: Android 앱으로부터 점자 패턴 수신
- **점자 제어**: 6개 진동 모터 제어
- **BLE 서버** (선택사항): Bluetooth를 통한 통신

### 하드웨어 구성

- **MCU**: ESP32
- **진동 모터**: 6개 (점자 6점에 대응)
- **전원**: USB 또는 배터리
- **통신**: WiFi (TCP), BLE (선택사항)

## 📁 주요 파일

### ESP32 코드
- `esp32_tcp_server/esp32_tcp_server.ino` - WiFi TCP 서버 (Android 앱용)
- `esp32_ble_server.ino` - BLE 서버 (Android 앱용, 선택사항)
- `esp32_web_client.ino` - WiFi 클라이언트 (레거시)

### 레거시 서버 (참고용)
- `python_wifi_server.py` - Python WiFi 서버 (레거시)
- `websocket_server.py` - WebSocket 서버 (레거시)

### 문서
- `ESP_APP_COMMUNICATION.md` - ESP32와 앱 간 통신 상세 문서

## 🔌 통신 프로토콜

### 프로토콜 개요

ESP32는 **GATT 호환 바이너리 프로토콜**을 사용하여 Android 앱과 WiFi를 통해 통신합니다.

### 통신 구조

```
Android 앱 (클라이언트) ←→ ESP32 (서버, 포트 8888)
```

- **ESP32**: 서버 역할 (WiFi TCP 서버, 포트 8888)
- **Android 앱**: 클라이언트 역할 (ESP32에 연결)

### 주요 메시지 타입

**수신 (앱 → ESP32):**
- **`BRAILLE_SEQUENCE` (0x08)**: 점자 시퀀스 수신 (앱에서 점자 패턴을 전송하는 유일한 방식)
  - 시퀀스를 개별 패턴으로 분해하여 순차적으로 진동 모터에 출력

**송신 (ESP32 → 앱):**
- **`PATTERN_COMPLETE` (0x03)**: 사용자가 입력한 점자 패턴 전송
- 선택사항: `DOT_PATTERN` (0x01), `DOT_RELEASE` (0x02)

### 상세 프로토콜 문서

프로토콜의 상세 내용은 다음 문서를 참조하세요:

- **[protocol.md](../protocol.md)**: 통합 프로토콜 문서 (메시지 구조, 모든 메시지 타입, 예시)
- **[ESP_APP_COMMUNICATION.md](./ESP_APP_COMMUNICATION.md)**: ESP32와 앱 간 통신 상세 문서

### BLE 통신 (선택사항)

BLE를 사용하는 경우:
- **GATT 프로토콜**: WiFi와 동일한 메시지 구조 사용
- **BLE 서버**: ESP32가 BLE 서버로 동작
- **Android 앱**: BLE 클라이언트로 연결

BLE와 WiFi는 동일한 프로토콜을 사용하므로 코드 재사용이 용이합니다.

## 🛠️ 개발 가이드

### ESP32 코드 업로드

1. **Arduino IDE 설정**
   - 보드: ESP32 Dev Module
   - Upload Speed: 115200
   - CPU Frequency: 240MHz
   - Flash Frequency: 80MHz
   - Flash Mode: QIO
   - Flash Size: 4MB

2. **WiFi 설정**
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

3. **업로드 및 테스트**
   - 코드 업로드
   - 시리얼 모니터 열기 (115200 baud)
   - IP 주소 확인
   - Android 앱에서 해당 IP 주소로 연결

### 디버깅

- **시리얼 모니터**: ESP32의 디버그 메시지 확인
- **네트워크 스캐너**: ESP32의 IP 주소 확인
- **Android 앱 로그**: 앱 측 통신 상태 확인

## 📚 참고 문서

- [BLE GATT 아키텍처](../docs/BLE_GATT_ARCHITECTURE.md)
- [WiFi 프로토타입 프로토콜](../docs/WIFI_PROTOTYPE_PROTOCOL.md)
- [간단한 점자 점 통신 프로토콜](../docs/SIMPLE_BRAILLE_DOT_PROTOCOL.md)
- [ESP32와 앱 통신 상세 문서](./ESP_APP_COMMUNICATION.md)
