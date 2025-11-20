# OFBGlove Wearable Device

`wearable/` 폴더는 ESP32 기반 점자 장갑 펌웨어와 모터 프로토콜 문서를 포함합니다. ESP32는 WiFi TCP 서버(AP 모드)를 열고 Android 애플리케이션의 `WifiConnectionCard`와 직접 통신합니다.

---

## 📂 폴더 구성

```
wearable/
├── esp_server.ino         # ESP32 AP + TCP 서버 + 모터 제어 펌웨어
├── motor_protocol.md      # I2C 모터 명령/프레임 스펙
└── README.md              # 현재 문서
```

> 과거에 사용하던 `esp32_tcp_server`, `python_wifi_server.py` 등 레거시 파일은 이 저장소에 포함되어 있지 않습니다.

---

## 🚀 빠른 시작

1. **Arduino IDE + ESP32 보드 패키지 설치**
   - Board Manager URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Board: `ESP32 Dev Module`

2. **코드 열기 및 설정**
   - `wearable/esp_server.ino`를 열고 필요하면 아래 값을 수정합니다.
     ```cpp
     const char* apSsid = "OFBG_AP";
     const char* apPassword = "12345678";
     const int   TCP_PORT   = 8888;
     ```
   - SDA/SCL 핀은 기본적으로 GPIO 6/7, I2C 속도 400 kHz로 설정되어 있습니다.

3. **업로드 & 시리얼 모니터 확인**
   - Baud rate: `115200`
   - 부팅 후 AP SSID/IP, 모터 초기화 로그가 출력됩니다.

4. **Android 앱 연결**
   - 앱 실행 → `WifiConnectionCard`에서 ESP32 AP에 연결된 후 표시되는 IP를 입력 → Connect.
   - Chat 화면에서 음성/점자 메시지를 보내면 ESP32가 패턴을 수신해 진동 모듈에 전송합니다.

---

## ⚙️ 펌웨어 개요 (`esp_server.ino`)

| 요소 | 설명 |
| --- | --- |
| **네트워크** | ESP32가 AP + TCP 서버(포트 8888)로 동작. 단일 클라이언트(Android 앱) 접속을 처리합니다. |
| **프로토콜** | GATT 호환 4바이트 헤더(타입/길이/체크섬) + payload 구조를 사용합니다. |
| **핵심 메시지** | `MSG_WORD_SEQUENCE (0x08)`, `MSG_CLEAR`, `WORD_SEPARATOR`, `SENTENCE_SEPARATOR`, `MSG_CONFIG_SET/GET/RESET`. |
| **설정 관리** | `VibrationConfig` 구조체로 waveformId, patternLength, holdDuration, intervalDuration, intensity, speed, mode, flags를 저장하고 `MSG_CONFIG_SET (0x0A)` payload로 갱신합니다. |
| **피드백** | `MSG_PATTERN_COMPLETE (0x03)` 메시지로 버튼/센서 입력을 앱에 다시 전달합니다. |
| **모터 버스** | I2C(SDA 6 / SCL 7 / 400 kHz), 모듈 주소 0x01~0x06. `MOTOR_CMD_PLAY_PATTERN`으로 파형 재생, `MOTOR_CMD_STOP`으로 정지. |

자세한 필드 설명은 소스 상단의 상수와 `motor_protocol.md`를 참고하세요.

---

## 🔌 통신 흐름

```
Android App (client)
    ↓  MSG_WORD_SEQUENCE / MSG_CONFIG_SET ...
ESP32 esp_server.ino  (AP + TCP server)
    ↓  MOTOR_CMD_PLAY_PATTERN
I2C Motor Modules (0x01~0x06)
```

- 앱은 점자 텍스트를 바이트 패턴으로 묶어 `MSG_WORD_SEQUENCE`를 전송합니다.
- ESP32는 패턴을 분리해 활성화된 점에 대응하는 모듈로 파형을 전송합니다.
- 단어/문장 구분자, 클리어 명령 등도 동일한 헤더/페이로드 구조를 사용합니다.
- `MSG_CONFIG_GET (0x0B)` 요청을 받으면 현재 `VibrationConfig`를 payload(11 bytes)로 되돌려 줍니다.

---

## 🛠️ 개발/디버깅 팁

- **시리얼 콘솔**: `Serial.println` 로그로 연결 상태, 설정 변경, 모터 에러 등을 확인할 수 있습니다.
- **모터 상태 로깅**: `SERIAL_DEBUG_MOTOR_STATUS` 플래그가 활성화되어 있어 각 모듈의 statusBits/buttonState를 주기적으로 출력합니다.
- **연결 문제**: 앱이 연결되지 않을 경우 AP SSID/암호, 포트(8888) 차단 여부, Android 측 WiFi 연결 상태를 먼저 확인하세요.
- **지속적인 테스트**: Chat 화면의 `LearningScreen`, `SettingsScreen` 버튼을 사용하면 동일한 메시지를 반복 전송하거나 `MSG_CONFIG_SET`을 빠르게 튜닝할 수 있습니다.

---

## 📚 참고 문서

- `motor_protocol.md` – I2C 모터 프레임과 명령 정의
- `../protocol.md` – 전체 메시지 헤더/타입/예시
- `../application/BLE_GATT_ARCHITECTURE.md`
- `../application/WIFI_PROTOTYPE_PROTOCOL.md`
- `../application/SIMPLE_BRAILLE_DOT_PROTOCOL.md`

필수 사항이 아닌 BLE/레거시 서버 구현은 현재 저장소에 포함되어 있지 않으므로, 별도 실험이 필요하면 프로젝트 문서를 참고하여 직접 작성해야 합니다.
