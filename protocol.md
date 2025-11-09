# OFBGlove 통신 프로토콜

OFBGlove 시스템의 모든 통신 프로토콜을 통합 정리한 문서입니다.

## 📋 목차

- [프로토콜 개요](#프로토콜-개요)
- [통신 구조](#통신-구조)
- [메시지 구조](#메시지-구조)
- [메시지 타입 참조표](#메시지-타입-참조표)
- [클라이언트별 사용 메시지](#클라이언트별-사용-메시지)
- [프로토콜 사용 예시](#프로토콜-사용-예시)
- [WebSocket 프로토콜](#websocket-프로토콜)

---

## 프로토콜 개요

OFBGlove 시스템은 **GATT 호환 바이너리 프로토콜**을 사용하여 통신합니다. 프로토콜은 BLE GATT 메시지 구조를 기반으로 하여, WiFi와 BLE 간 전환이 용이하도록 설계되었습니다.

### 주요 특징

- **GATT 호환**: BLE GATT 메시지 구조 기반
- **바이너리 프로토콜**: 효율적인 데이터 전송
- **체크섬 검증**: 데이터 무결성 보장
- **Little Endian**: 데이터 길이 필드

---

## 통신 구조

### 1. Android 앱 ↔ ESP32

```
Android 앱 (클라이언트) ←→ ESP32 (서버, 포트 8888)
```

- **ESP32**: 서버 역할 (WiFi TCP 서버, 포트 8888)
- **Android 앱**: 클라이언트 역할 (ESP32에 연결)
- **통신 방향**:
  - 앱 → ESP32: 점자 시퀀스 전송 (진동 출력)
  - ESP32 → 앱: 점자 패턴 전송 (텍스트 변환)

### 2. Android 앱 ↔ 웹 비주얼라이저

```
Android 앱 (클라이언트) ←→ 웹 비주얼라이저 (서버, 포트 8888)
```

- **웹 비주얼라이저**: 서버 역할 (WiFi TCP 서버, 포트 8888)
- **Android 앱**: 클라이언트 역할 (웹 서버에 연결)
- **통신 방향**:
  - 앱 → 웹: 점자 시퀀스 전송 (시각화)
  - 웹 → 앱: 점자 패턴/이미지 전송 (OCR 처리)

### 3. 웹 비주얼라이저 아키텍처

웹 비주얼라이저는 **TCP 서버**와 **WebSocket 서버**를 통합하여 서로 다른 클라이언트 타입을 지원합니다:

```
ESP32/Android 앱          웹 브라우저
    ↓                        ↓
TCP 서버 (8888)      WebSocket 서버 (8889)
    ↓ (바이너리)              ↓ (JSON)
    └──────┬──────────────────┘
           ↓
    브리지 (프로토콜 변환)
    - 바이너리 ↔ JSON
    - 메모리 내 변환 (네트워크 오버헤드 없음)
```

**TCP와 WebSocket 분리 이유:**
1. **서로 다른 클라이언트 타입**: ESP32/Android는 바이너리, 웹 브라우저는 JSON
2. **프로토콜 변환 브리지**: TCP ↔ WebSocket 간 자동 변환
3. **각 클라이언트의 최적 프로토콜 사용**: 효율성과 웹 표준 준수

---

## 메시지 구조

### 기본 구조

모든 메시지는 다음 구조를 따릅니다:

```
[헤더 4바이트][데이터 N바이트]
```

### 헤더 구조 (4바이트, Little Endian)

| 바이트 | 필드 | 설명 | 크기 |
|--------|------|------|------|
| 0 | Message Type | 메시지 타입 | 1바이트 |
| 1-2 | Data Length | 데이터 길이 (Little Endian) | 2바이트 |
| 3 | Checksum | 체크섬 (XOR) | 1바이트 |

### 데이터 구조

- 데이터 길이는 헤더의 `Data Length` 필드에 명시
- 데이터는 헤더 바로 다음부터 시작
- 최대 데이터 길이: 65535 바이트 (Short 최대값)

### 체크섬 계산

```kotlin
fun calculateChecksum(data: ByteArray): Byte {
    var checksum = 0
    for (byte in data) {
        checksum = checksum xor (byte.toInt() and 0xFF)
    }
    return checksum.toByte()
}
```

체크섬은 데이터 바이트들의 XOR 연산 결과입니다.

---

## 메시지 타입 참조표

### 송신 메시지 (클라이언트 → 서버)

| 타입 | 값 | 이름 | 데이터 구조 | 설명 |
|------|-----|------|-------------|------|
| `0x01` | DOT_PATTERN | `[dotIndex(1)]` | 개별 점 터치 이벤트 (ESP32에서 사용) |
| `0x02` | DOT_RELEASE | `[dotIndex(1)]` | 점 릴리즈 이벤트 (ESP32에서 사용) |
| `0x03` | PATTERN_COMPLETE | `[dotsByte(1)]` | 단일 패턴 완성 (ESP32/웹 → 앱) |
| `0x04` | CLEAR | `[0x00]` | 점자 상태 초기화 |
| `0x05` | WORD_SEPARATOR | `[0x00]` | 단어 구분자 (공백) |
| `0x06` | SENTENCE_SEPARATOR | `[0x00]` | 문장 구분자 |
| `0x07` | BRAILLE_SEPARATOR | `[0x00]` | 점자 구분자 (개별 점자 모드) |
| `0x08` | BRAILLE_SEQUENCE | `[개수(1)][패턴1(1)][패턴2(1)]...` | 점자 시퀀스 전송 (앱 → ESP32/웹) ⭐ |
| `0x10` | TEXT_MESSAGE | `[텍스트 길이][텍스트][점자 길이][점자]` | 텍스트 메시지 |
| `0x20` | SETTINGS | `[속도][모드][플래그]` | 설정 |
| `0x30` | IMAGE_DATA | `[이미지 크기(4)][이미지 데이터(N)]` | 이미지 데이터 (필담 OCR용) |

### 수신 메시지 (서버 → 클라이언트)

| 타입 | 값 | 이름 | 데이터 구조 | 설명 |
|------|-----|------|-------------|------|
| `0x81` | STATUS_UPDATE | `[상태 정보]` | 상태 업데이트 |
| `0x82` | MESSAGE_RECEIVED | `[확인 정보]` | 메시지 수신 확인 |
| `0x83` | SETTINGS_UPDATED | `[설정 정보]` | 설정 업데이트 확인 |

---

## 클라이언트별 사용 메시지

### Android 앱

**송신 (앱 → ESP32/웹):**
- **`BRAILLE_SEQUENCE` (0x08)**: 점자 패턴을 전송하는 유일한 방식
  - 여러 패턴을 한 번에 전송
  - 데이터: `[패턴 개수(1)][패턴1(1)][패턴2(1)]...`
- 기타: `CLEAR`, `WORD_SEPARATOR`, `SENTENCE_SEPARATOR`, `TEXT_MESSAGE`, `SETTINGS`

**수신 (ESP32/웹 → 앱):**
- **`PATTERN_COMPLETE` (0x03)**: ESP32/웹에서 입력한 점자 패턴
- **`IMAGE_DATA` (0x30)**: 웹 비주얼라이저로부터 받은 필담 이미지
- 기타: `STATUS_UPDATE`, `MESSAGE_RECEIVED`, `SETTINGS_UPDATED`

### ESP32

**송신 (ESP32 → 앱):**
- **`PATTERN_COMPLETE` (0x03)**: 사용자가 입력한 점자 패턴
- 선택사항: `DOT_PATTERN` (0x01), `DOT_RELEASE` (0x02)
- 기타: `WORD_SEPARATOR`, `SENTENCE_SEPARATOR`, `STATUS_UPDATE`

**수신 (앱 → ESP32):**
- **`BRAILLE_SEQUENCE` (0x08)**: 앱에서 전송한 점자 시퀀스
  - 시퀀스를 개별 패턴으로 분해하여 순차적으로 진동 모터에 출력
- 기타: `CLEAR`, `WORD_SEPARATOR`, `SENTENCE_SEPARATOR`, `TEXT_MESSAGE`, `SETTINGS`

### 웹 비주얼라이저

**TCP 서버 (포트 8888):**
- **수신**: ESP32/Android 앱으로부터 바이너리 메시지 수신
- **송신**: 바이너리 메시지를 ESP32/Android 앱에 전송

**WebSocket 서버 (포트 8889):**
- **수신**: 웹 브라우저로부터 JSON 메시지 수신
- **송신**: JSON 메시지를 웹 브라우저에 전송

**프로토콜 변환:**
- TCP 바이너리 ↔ WebSocket JSON 자동 변환
- 변환은 메모리 내에서만 발생 (네트워크 오버헤드 없음)

---

## 프로토콜 사용 예시

### 예시 1: Android 앱 → ESP32 (BRAILLE_SEQUENCE)

```
메시지: "AB" 시퀀스 (A=0x01, B=0x03)
헤더: [0x08, 0x03, 0x00, 0x02]  // 타입=0x08, 길이=3, 체크섬=0x02
데이터: [0x02, 0x01, 0x03]      // 개수=2, 패턴1=A(0x01), 패턴2=B(0x03)
전체: [0x08, 0x03, 0x00, 0x02, 0x02, 0x01, 0x03]

ESP32 처리:
1. 시퀀스 수신
2. 패턴 개수 확인 (2개)
3. 첫 번째 패턴 (A, 0x01) → 진동 모터 출력
4. 두 번째 패턴 (B, 0x03) → 진동 모터 출력
```

### 예시 2: ESP32 → Android 앱 (PATTERN_COMPLETE)

```
메시지: "A" (점 1 활성 = 0x01)
헤더: [0x03, 0x01, 0x00, 0x01]  // 타입=0x03, 길이=1, 체크섬=0x01
데이터: [0x01]
전체: [0x03, 0x01, 0x00, 0x01, 0x01]

앱 처리:
1. PATTERN_COMPLETE 수신
2. 점자 패턴 (0x01) → 텍스트 "A"로 변환
3. 채팅 메시지로 표시 또는 처리
```

### 예시 3: 단어 구분자

```
헤더: [0x05, 0x01, 0x00, 0x00]  // 타입=0x05, 길이=1, 체크섬=0x00
데이터: [0x00]
전체: [0x05, 0x01, 0x00, 0x00, 0x00]
```

### 예시 4: "hello" 시퀀스 전송

```
1. CLEAR (0x04) - 점자 초기화
   헤더: [0x04, 0x01, 0x00, 0x00]
   데이터: [0x00]
   전체: [0x04, 0x01, 0x00, 0x00, 0x00]

2. BRAILLE_SEQUENCE (0x08) - "hello" 점자 패턴 시퀀스
   헤더: [0x08, 0x06, 0x00, checksum]  // 길이=6 (개수1 + 패턴5)
   데이터: [0x05, 0x23, 0x19, 0x13, 0x13, 0x1D]  // 개수=5, h,e,l,l,o
   전체: [0x08, 0x06, 0x00, checksum, 0x05, 0x23, 0x19, 0x13, 0x13, 0x1D]

3. SENTENCE_SEPARATOR (0x06) - 문장 구분
   헤더: [0x06, 0x01, 0x00, 0x00]
   데이터: [0x00]
   전체: [0x06, 0x01, 0x00, 0x00, 0x00]
```

---

## 점자 패턴 인코딩

### 6개 점을 1바이트로 압축

각 점자 패턴은 6개 점을 1바이트로 압축합니다:

```
Bit 0: 점 1 (LSB)
Bit 1: 점 2
Bit 2: 점 3
Bit 3: 점 4
Bit 4: 점 5
Bit 5: 점 6 (MSB)
```

**예시:**
- `0x01` (0b00000001) = 점 1만 활성
- `0x31` (0b00110001) = 점 1, 4, 5 활성
- `0x3F` (0b00111111) = 모든 점 활성

### 점자 패턴 예시

| 문자 | 점자 패턴 | 바이너리 | Hex |
|------|-----------|---------|-----|
| A | 점 1 | 000001 | 0x01 |
| B | 점 1,2 | 000011 | 0x03 |
| C | 점 1,4 | 001001 | 0x09 |
| D | 점 1,4,5 | 00110001 | 0x31 |
| 공백 | 없음 | 000000 | 0x00 |

---

## WebSocket 프로토콜

웹 비주얼라이저는 WebSocket을 통해 웹 브라우저와 통신합니다.

### 포트

- **WebSocket 서버**: 8889
- **프로토콜**: JSON 메시지 (WebSocket 표준)

### 메시지 타입

#### 수신 (서버 → 클라이언트)

**`braille_pattern`**: 점자 패턴 수신
```json
{
  "type": "braille_pattern",
  "pattern": [true, false, false, true, true, false],
  "binary": "100110",
  "character": "D",
  "source": "esp32" | "web" | "demo",
  "timestamp": 1234567890
}
```

**`word_separator`**, **`sentence_separator`**, **`braille_separator`**: 구분자 메시지
```json
{
  "type": "word_separator",
  "timestamp": 1234567890
}
```

**`server_log`**: 서버 로그
```json
{
  "type": "server_log",
  "level": "info" | "warning" | "error" | "success",
  "message": "로그 메시지",
  "data": {}
}
```

**`status`**: 서버 상태 응답
```json
{
  "type": "status",
  "tcpClients": 2,
  "wsClients": 1,
  "uptime": 3600
}
```

**`clients`**: 클라이언트 목록 응답
```json
{
  "type": "clients",
  "clients": [
    {
      "id": "client-1",
      "type": "tcp",
      "address": "192.168.1.100"
    }
  ]
}
```

#### 송신 (클라이언트 → 서버)

**`dot_pattern`**: 점자 패턴 전송
```json
{
  "type": "dot_pattern",
  "dotsByte": 49  // 0x31 = 점 1,4,5 활성
}
```

**`image_data`**: 이미지 데이터 전송 (필담 OCR용)
```json
{
  "type": "image_data",
  "image": [255, 255, 255, ...]  // 이미지 바이트 배열
}
```

**`get_status`**: 서버 상태 요청
```json
{
  "type": "get_status"
}
```

**`get_clients`**: 클라이언트 목록 요청
```json
{
  "type": "get_clients"
}
```

### 통신 흐름 예시

**Android 앱 → 웹 브라우저:**
```
Android 앱
  ↓ [BRAILLE_SEQUENCE: 0x08 0x03 0x00 0x02 0x02 0x01 0x03]
  // "AB" 시퀀스 (개수=2, A=0x01, B=0x03)
TCP 서버 (파싱)
  ↓ [메모리 내 변환 - 시퀀스를 개별 패턴으로 분해]
  ↓ [JSON: {"type":"braille_pattern",...}]
WebSocket 서버 (브로드캐스트)
  ↓
웹 브라우저 (실시간 시각화)
```

**웹 브라우저 → Android 앱/ESP32:**
```
웹 브라우저
  ↓ [JSON: {"type":"dot_pattern","dotsByte":49}]
WebSocket 서버 (파싱)
  ↓ [메모리 내 변환]
  ↓ [바이너리: 0x03 0x01 0x00 0x31 0x31]
  // PATTERN_COMPLETE로 변환
TCP 서버 (브로드캐스트)
  ↓
Android 앱 / ESP32
```

---

## 참고 문서

- [ESP32와 앱 통신 상세 문서](wearable/ESP_APP_COMMUNICATION.md)
- [Android 앱 README](application/README.md) - WiFi 통신 프로토콜 섹션
- [웹 비주얼라이저 README](web_visualizer/README.md) - 통신 프로토콜 섹션
- [ESP32 README](wearable/README.md) - 통신 프로토콜 섹션

---

## 버전 정보

- **프로토콜 버전**: 1.0
- **최종 업데이트**: 2024
- **호환성**: GATT 기반, BLE와 WiFi 간 전환 가능

