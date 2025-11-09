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

ESP32는 **GATT 호환 바이너리 프로토콜**을 사용하여 Android 앱과 WiFi를 통해 통신합니다. 프로토콜은 BLE GATT 메시지 구조를 기반으로 하여, BLE 통신으로의 전환이 용이하도록 설계되었습니다.

### 통신 구조

```
Android 앱 (클라이언트) ←→ ESP32 (서버, 포트 8888)
```

- **ESP32**: 서버 역할 (WiFi TCP 서버, 포트 8888)
- **Android 앱**: 클라이언트 역할 (ESP32에 연결)

### 메시지 구조

모든 메시지는 다음 구조를 따릅니다:

```
[헤더 4바이트][데이터 N바이트]
```

**헤더 구조 (Little Endian):**
- **바이트 0**: 메시지 타입 (1바이트)
- **바이트 1-2**: 데이터 길이 (2바이트, Little Endian)
- **바이트 3**: 체크섬 (1바이트, XOR)

**체크섬 계산:**
- 데이터 바이트들을 XOR 연산하여 계산
- 헤더의 메시지 타입, 데이터 길이, 데이터를 포함하여 검증

### 수신 메시지 타입 (Android 앱 → ESP32)

#### 점자 메시지

**`0x08` - BRAILLE_SEQUENCE**
- **용도**: 점자 시퀀스 수신 (Android 앱에서 점자 패턴을 전송하는 유일한 방식)
- **데이터**: `[패턴 개수(1바이트)][패턴1(1바이트)][패턴2(1바이트)]...`
- **설명**:
  - 첫 바이트: 패턴 개수 (최대 255개)
  - 이후 바이트들: 각 패턴 (6개 점을 1바이트로 압축)
    - Bit 0: 점 1, Bit 1: 점 2, ..., Bit 5: 점 6
    - 예: `0x31` (00110001) = 점 1, 4, 5 활성
  - ESP32는 시퀀스를 받아 각 패턴을 순차적으로 진동 모터로 출력
- **처리 방법**: 시퀀스를 개별 패턴으로 분해하여 각 패턴을 순차적으로 처리

#### 기타 메시지

**`0x04` - CLEAR**: 점자 상태 초기화
**`0x05` - WORD_SEPARATOR**: 단어 구분자 (공백)
**`0x06` - SENTENCE_SEPARATOR**: 문장 구분자
**`0x07` - BRAILLE_SEPARATOR**: 점자 구분자
**`0x10` - TEXT_MESSAGE**: 텍스트 메시지
**`0x20` - SETTINGS**: 설정 (속도, 모드 등)

### 송신 메시지 타입 (ESP32 → Android 앱)

#### 점자 메시지

**`0x03` - PATTERN_COMPLETE**
- **용도**: 단일 패턴 완성 전송 (ESP32에서 입력한 점자 패턴을 앱으로 전송)
- **데이터**: `[dotsByte(1바이트)]`
- **설명**: 
  - 6개 점을 1바이트로 압축 (Bit 0: 점 1, Bit 1: 점 2, ..., Bit 5: 점 6)
  - 예: `0x31` (00110001) = 점 1, 4, 5 활성
  - ESP32에서 사용자가 점자를 입력하면 이 메시지로 앱에 전송
- **사용 예시**: ESP32 장갑에서 점자 입력 → 앱으로 패턴 전송

**`0x01` - DOT_PATTERN**
- **용도**: 개별 점 터치 이벤트 전송
- **데이터**: `[dotIndex(1바이트)]` (0-5)
- **설명**: 단일 점의 터치 이벤트를 실시간으로 전송 (선택사항)

**`0x02` - DOT_RELEASE**
- **용도**: 점 릴리즈 이벤트 전송
- **데이터**: `[dotIndex(1바이트)]` (0-5)
- **설명**: 단일 점의 릴리즈 이벤트를 실시간으로 전송 (선택사항)

#### 상태 및 확인 메시지

**`0x81` - STATUS_UPDATE**
- **용도**: 상태 업데이트
- **데이터**: 상태 정보
- **설명**: ESP32의 상태 변경 알림 (연결 상태, 에러 등)

**`0x82` - MESSAGE_RECEIVED**
- **용도**: 메시지 수신 확인
- **데이터**: 확인 정보
- **설명**: 메시지 수신 확인 응답

**`0x83` - SETTINGS_UPDATED**
- **용도**: 설정 업데이트 확인
- **데이터**: 설정 정보
- **설명**: 설정 변경 확인 응답

### 프로토콜 사용 예시

#### 예시 1: BRAILLE_SEQUENCE 수신 및 처리
```
Android 앱 → ESP32:
메시지: "AB" 시퀀스
헤더: [0x08, 0x03, 0x00, 0x02]  // 타입=0x08, 길이=3, 체크섬=0x02
데이터: [0x02, 0x01, 0x03]      // 개수=2, 패턴1=A(0x01), 패턴2=B(0x03)
전체: [0x08, 0x03, 0x00, 0x02, 0x02, 0x01, 0x03]

ESP32 처리:
1. 시퀀스 수신
2. 패턴 개수 확인 (2개)
3. 첫 번째 패턴 (A, 0x01) → 진동 모터 출력
4. 두 번째 패턴 (B, 0x03) → 진동 모터 출력
```

#### 예시 2: 점자 패턴 전송 (PATTERN_COMPLETE)
```
ESP32 → Android 앱:
메시지: "A" (점 1 활성 = 0x01)
헤더: [0x03, 0x01, 0x00, 0x01]  // 타입=0x03, 길이=1, 체크섬=0x01
데이터: [0x01]
전체: [0x03, 0x01, 0x00, 0x01, 0x01]
```

#### 예시 3: 상태 업데이트 전송
```
ESP32 → Android 앱:
헤더: [0x81, 0x01, 0x00, 0x80]  // 타입=0x81, 길이=1, 체크섬=0x80
데이터: [0x01]                  // 상태: 연결됨
전체: [0x81, 0x01, 0x00, 0x80, 0x01]
```

### 점자 패턴 처리

#### 수신 처리 (Android 앱 → ESP32)

ESP32는 `BRAILLE_SEQUENCE`를 수신하면:

1. **시퀀스 파싱**: 패턴 개수와 각 패턴 추출
2. **순차 처리**: 각 패턴을 순차적으로 진동 모터에 출력
3. **타이밍 제어**: 패턴 간 적절한 지연 시간 적용
4. **상태 피드백**: 처리 완료 시 Android 앱에 상태 업데이트 전송

#### 송신 처리 (ESP32 → Android 앱)

ESP32에서 사용자가 점자를 입력하면:

1. **점자 입력 감지**: 사용자가 점자 패턴 입력 (6개 점)
2. **패턴 압축**: 6개 점을 1바이트로 압축
3. **메시지 전송**: `PATTERN_COMPLETE` (0x03) 메시지로 Android 앱에 전송
4. **앱 처리**: 앱에서 점자 패턴을 받아 텍스트로 변환하거나 처리

**양방향 통신 흐름:**
- **앱 → ESP32**: 음성 인식 결과를 점자 시퀀스로 전송 → ESP32에서 진동 출력
- **ESP32 → 앱**: 사용자가 점자 입력 → 앱에서 텍스트 변환 및 처리

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
