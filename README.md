# OFBGlove: Open-Finger-Braille Glove 시스템

시청각장애인을 위한 실시간 양방향 독립 소통 지원 웨어러블 촉각 시스템

## 개요

**OFBGlove**는 시청각장애인(Deafblind)을 위한 혁신적인 소통 보조 시스템입니다. 음성과 환경 소리를 실시간 6점 점자 패턴으로 변환하여 촉각 피드백을 제공하며, 양방향 통신을 통해 독립적인 의사소통을 가능하게 합니다.

### 핵심 개념

시청각장애인들은 손가락 점자(finger-braille)와 같은 촉각 소통 방법을 사용하지만, 이는 훈련된 통역자와의 직접적인 신체 접촉이 필요합니다.
또한 기존 단말기 등은 일상생활, 돌아다니면서 사용하기에 손이 묶이는 등 동시에 사용할 수 없다는 큰 제약을 갖고 있습니다.

OFBGlove는 이러한 한계를 극복하기 위해:

- **손가락 끝이 노출된 반장갑 형태의 디자인**: 일상적인 촉각 활동을 방해하지 않으며 상시 사용 가능
- **실시간 감각 대체**: 음성 → 촉각 변환 (<300ms 지연)
- **양방향 통신**: 점자 입력 → 음성 출력 지원
- **독립적 사용**: 전문 통역인 없이도 실시간 독립 사용 가능

---

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                    OFBGlove 시스템                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  음성/환경 소리 입력                                           │
│        ↓                                                     │
│  Sensory Substitution Module (Android App)                   │
│        ├─ STT (Speech-to-Text)                               │
│        ├─ TTB (Text-to-Braille)                              │
│        ├─ 환경 소리 감지                                      │
│        └─ BTT/TTS (Braille-to-Text/Speech)                   │
│        ↓                                                     │
│  통신 계층 (BLE/WiFi)                                         │
│        ├─ BLE: 2-byte 바이너리 프로토콜                        │
│        └─ WiFi: WebSocket 실시간 통신                         │
│        ↓                                                     │
│  Wearable Haptic Module                                      │
│        ├─ ESP32 기반 점자 장갑 (6개 진동 모터, 입력 장치)       │
│        └─ 웹 비주얼라이저 (시연/교육용)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 프로젝트 구조

### 1. `application/` - Android 애플리케이션

**Sensory Substitution Module의 핵심 구현체**

#### 주요 기능
- **음성 인식 (STT)**: 실시간 음성을 텍스트로 변환
- **점자 변환 (TTB/BTT)**: liblouis-java 기반 양방향 변환
  - 6점 점자 시스템 지원
  - 다국어 점자 테이블
  - 실시간 변환 (<10ms)
- **음성 합성 (TTS)**: 변환된 텍스트를 음성으로 변환
- **통신 프로토콜**:
  - **BLE GATT**: 최적화된 2-byte 바이너리 프로토콜
  - **WiFi Socket**: JSON 기반 확장 프로토콜
- **점자 입력**: 6-dot 인터랙티브 그리드
- **UI/UX**: Jetpack Compose + Material Design 3

#### 기술 스택
```yaml
플랫폼: Android 11+ (API 30+)
언어: Kotlin 2.0.21
UI: Jetpack Compose + Material Design 3
아키텍처: MVVM + StateFlow + Coroutines
점자 변환: liblouis-java 5.1.0
통신: BLE GATT, WiFi Socket, WebSocket
```

#### 빠른 시작
```bash
cd application
# Android Studio에서 프로젝트 열기
# Gradle 동기화 후 빌드
# Android 기기에 설치
```

#### 권한 요구사항
- `RECORD_AUDIO`: 음성 인식
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`: BLE 통신
- `INTERNET`, `ACCESS_NETWORK_STATE`: WiFi 통신
- `VIBRATE`: 햅틱 피드백

---

### 2. `web_visualizer/` - 웹 비주얼라이저

**장갑 없이도 시스템을 시연하고 체험할 수 있는 웹 인터페이스**

#### 주요 특징
- **교육/시연 목적**: 물리적 장갑 없이도 완전한 데모 가능
- **실시간 점자 시각화**: 2×3 점자 셀 실시간 표시 (소스별 색상 구분)
- **양방향 통신**: 음성 입력(수신)과 웹 점자 입력(송신) 동시 지원
- **통합 서버**: TCP 서버(8888) + WebSocket 서버(8889) 동시 실행
- **문장 시퀀스 관리**: 입력 문장과 수신 문장 분리 표시
- **재생 제어**: 다양한 재생 모드(고정/원본/적응형) 및 속도 조절
- **TTS 통합**: 영어/한국어 자동 감지 및 음성 출력
- **데이터 수집**: 점자 패턴 통계 및 내보내기 기능
- **장갑 배경**: 점자 입력 영역에 장갑 이미지 배경 표시

#### 기술 스택
```yaml
프레임워크: React 18 + TypeScript
통신: WebSocket (ws://localhost:8889), TCP (localhost:8888)
서버: Node.js (TCP + WebSocket 통합 서버)
스타일링: CSS3 + Responsive Design
빌드 도구: Create React App
TTS: Web Speech API
```

#### 개발 서버 실행
```bash
# 웹 비주얼라이저 실행 (웹 서버 + TCP/WebSocket 서버 동시 실행)
cd web_visualizer
npm install
npm run dev
```

서버가 시작되면:
- **웹 인터페이스**: http://localhost:3000
- **TCP 서버**: localhost:8888 (ESP32/Android 앱용)
- **WebSocket 서버**: ws://localhost:8889 (웹 클라이언트용)

#### 주요 기능
- **실시간 점자 시각화**: 중앙 점자 셀에 현재 패턴 표시 (소스별 색상 구분)
- **문장 시퀀스**: 입력 문장(web)과 수신 문장(esp32/demo) 분리 표시
- **점자 입력**: 6점 점자 그리드로 직접 입력 (버퍼 관리, 자동 커밋)
- **재생 제어**: 문장 재생, 다시듣기, 재생 모드 및 속도 조절
- **단어 반복**: 문장 완성 시 첫 단어 자동 반복 재생
- **TTS 통합**: 단어 커밋 시 자동 음성 출력 (영어/한국어 자동 감지)
- **구분자 최적화**: 단어/문장/점자 구분자별 지연 시간 설정
- **데이터 수집**: 실시간 통계, 소스별 분류, 데이터 내보내기
- **연결 모니터링**: WebSocket 연결 상태, TCP 클라이언트 목록, 서버 로그

#### 프로젝트 구조
```
web_visualizer/
├── src/
│   ├── App.tsx                    # 메인 애플리케이션
│   ├── components/
│   │   ├── BrailleCell.tsx        # 점자 셀 컴포넌트 (2×3)
│   │   ├── BrailleInput.tsx       # 점자 입력 컴포넌트
│   │   ├── ConnectionInfo.tsx     # 연결 정보 컴포넌트
│   │   └── ServerLog.tsx          # 서버 로그 컴포넌트
│   ├── services/
│   │   └── WebSocketService.ts     # WebSocket 통신 서비스
│   ├── server/
│   │   ├── brailleServer.js        # 통합 서버 (TCP + WebSocket)
│   │   └── tcpServer.js            # TCP 서버 구현
│   ├── types/
│   │   ├── braille.ts             # 점자 타입 정의
│   │   └── websocket.ts           # WebSocket 타입 정의
│   └── utils/
│       ├── dataCollector.ts       # 데이터 수집 유틸리티
│       └── networkUtils.ts        # 네트워크 유틸리티
└── public/
    └── glove.png                  # 장갑 이미지 (배경용)
```

---

### 3. `wearable/` - ESP32 장갑 제어

**Wearable Haptic Module의 하드웨어 구현체**

#### 주요 컴포넌트
- **ESP32 MCU**: 양방향 통신 및 모터 제어
- **BLE Server**: Android 앱과의 실시간 통신
- **WiFi Client**: 웹 비주얼라이저 연동
- **진동 모터**: 6개 점자 점 표현
- **버튼 센서**: 사용자 입력 감지

#### 하드웨어 사양
```yaml
MCU: ESP32 (Dual-core, BLE + WiFi)
진동 모터: 6개 (ERM 또는 LRA)
전원: 리튬 배터리 (손목 장착형)
폼팩터: 손가락 끝 노출형 장갑
통신: BLE 5.0, WiFi 802.11 b/g/n
```

#### 파일 구조
```
wearable/
├── esp32_ble_server.ino        # BLE 서버 (Android 앱용)
├── esp32_web_client.ino        # WiFi 클라이언트 (웹용)
├── python_wifi_server.py       # Python WiFi 서버
├── websocket_server.py         # WebSocket 서버
└── glove/                      # 장갑 하드웨어 관련 파일
```

#### 업로드 방법
```bash
# Arduino IDE에서 열기
1. esp32_ble_server.ino 또는 esp32_web_client.ino 선택
2. 보드: ESP32 Dev Module 선택
3. 포트 선택 후 업로드
```

---

## 전체 시스템 실행 가이드

### Option 1: 완전한 하드웨어 세팅

```bash
# 1단계: ESP32 장갑 준비
cd wearable
# Arduino IDE에서 esp32_ble_server.ino 업로드

# 2단계: Android 앱 빌드
cd application
# Android Studio에서 빌드 및 기기 설치

# 3단계: 앱에서 BLE 연결
# - 앱 실행
# - BLE 스캔 및 ESP32 연결
# - 음성 입력 시작

# 4단계 (선택): 웹 비주얼라이저 병행 실행
cd web_visualizer
npm run dev
```

### Option 2: 장갑 없이 시연 (웹 전용)

```bash
# 1단계: 웹 비주얼라이저 실행 (통합 서버 포함)
cd web_visualizer
npm install
npm run dev
# 이 명령은 웹 서버(3000)와 TCP/WebSocket 서버(8888/8889)를 동시에 실행합니다

# 2단계: Android 앱을 WiFi 모드로 실행
# - 앱에서 WiFi 프로토타입 테스트 모드 선택
# - 서버 IP 입력 (예: 192.168.0.10:8888)
# - 음성 입력 시 웹에서 실시간 점자 시각화 확인

# 3단계: 웹에서 직접 점자 입력하기
# - 브라우저에서 http://localhost:3000 접속
# - 하단 점자 입력 영역에서 6개 점 클릭
# - 패턴 완성 후 "다음" 또는 "단어 커밋" 버튼 클릭
```

### Option 3: 개발/테스트 모드

```bash
# 웹 비주얼라이저 개발 모드
cd web_visualizer
npm run dev
# 웹 서버와 통합 서버가 동시에 실행됩니다

# 브라우저에서 접속
# http://localhost:3000

# 개발자 도구 콘솔에서 직접 테스트 가능
# - WebSocket 연결 상태 확인
# - 점자 패턴 수신 테스트
# - 데이터 수집 확인
```

---

## 📡 통신 프로토콜

### BLE GATT 프로토콜 (Android ↔ ESP32)

#### 서비스 정의
```yaml
Service UUID: 12345678-1234-1234-1234-123456789ABC

Characteristics:
  - BRAILLE_DOTS (Write):     점자 점 전송
  - BRAILLE_STATUS (Notify):  점자 상태 수신
  - TEXT_MESSAGE (Write):     텍스트 메시지
  - SETTINGS (Write):         설정 전송
```

#### 메시지 구조 (2-byte Binary)

```
Byte 0: 메시지 타입
  0x01: 점 터치
  0x02: 점 릴리즈
  0x10: 텍스트 메시지
  0x20: 설정

Byte 1: 데이터 (점자 점 비트마스크 또는 기타 데이터)
  Bit 0-5: 점자 6개 점 (0=비활성, 1=활성)
  예: 0b00000001 = 1점만 활성 = "100000"
      0b00011001 = 1,4,5점 활성 = "100110"
```

### WiFi Socket 프로토콜 (App ↔ TCP Server ↔ WebSocket Server)

#### TCP 프로토콜 (Android 앱 → TCP 서버, 포트 8888)
```
3바이트 바이너리 프로토콜:
[메시지 타입(1바이트)][점자 점(1바이트)][체크섬(1바이트)]

메시지 타입:
- 0x01: 점 상태 업데이트 (DOT_UPDATE)
- 0x02: 점 상태 초기화 (CLEAR)
- 0x03: 점자 입력 완료 (COMPLETE)

점자 점: 6비트 비트마스크 (비트 0-5 = 점 1-6)
```

#### WebSocket 프로토콜 (웹 클라이언트 ↔ WebSocket 서버, 포트 8889)
```json
// 점자 패턴 수신
{
  "type": "braille_pattern",
  "pattern": [true, false, false, true, true, false],
  "binary": "100110",
  "character": "D",
  "source": "esp32",
  "timestamp": 1234567890
}

// 구분자 메시지
{
  "type": "word_separator" | "sentence_separator" | "braille_separator"
}
```

자세한 프로토콜 문서:
- [간단한 점자 점 통신 프로토콜](application/SIMPLE_BRAILLE_DOT_PROTOCOL.md)
- [WiFi 프로토타입 프로토콜](application/WIFI_PROTOTYPE_PROTOCOL.md)

---

## 주요 기능 및 설계 원칙

### Design Criteria (논문 기반)

#### DC1: Familiarity & Personalization
- **6점 점자 시스템 활용**: 기존 점자 문해력 기반
- **사용자 정의 가능**: 속도, 패턴, 피드백 강도 조절

#### DC2: Non-Occlusion & Practicality
- **손가락 끝 노출 디자인**: 촉각 자유 보존
- **경량 웨어러블**: 일상 착용 가능
- **편안한 착용감**: 장시간 사용 지원

#### DC3: Real-Time Sensory Substitution
- **낮은 지연 시간**: <300ms 오디오-촉각 변환
- **양방향 통신**: 입력(점자) ↔ 출력(음성)
- **실시간 피드백**: 즉각적인 햅틱 응답

#### DC4: Environmental Awareness
- **환경 소리 감지**: 초인종, 알람, 경고음
- **긴급 신호**: SOS 패턴 (···---···)
- **호명 감지**: 부드러운 순차적 진동

#### DC5: Extensibility
- **모듈식 아키텍처**: IoT 디바이스 통합 가능
- **외부 서비스 연동**: API 확장 지원
- **다중 플랫폼**: Android, Web, 하드웨어

---

## 기술적 성과

### 성능 지표

| 항목 | 목표 | 달성 |
|------|------|------|
| STT 지연 시간 | <300ms | ~200ms (AssemblyAI) |
| TTB 변환 시간 | <10ms | ~5ms (liblouis) |
| BLE 전송 | 2-byte | 2-byte (최적화 완료) |
| WiFi 지연 | <100ms | ~50ms (WebSocket) |
| 점자 인식율 | >95% | 98% (6-dot 그리드) |

### 시스템 요구사항

#### Android 앱
- **최소**: Android 11 (API 30)
- **권장**: Android 13+ (API 33+)
- **메모리**: 최소 4GB RAM
- **저장공간**: 100MB 이상

#### 웹 비주얼라이저
- **브라우저**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **네트워크**: WebSocket 지원, TCP 소켓 접근 (Node.js 서버)
- **해상도**: 1280×720 이상 권장
- **TTS**: Web Speech API 지원 (Chrome/Edge 권장)
- **Node.js**: 16+ (서버 실행용)

#### ESP32 장갑
- **MCU**: ESP32 (4MB Flash, 520KB RAM)
- **전원**: 3.7V 리튬 배터리
- **모터**: 6개 진동 모터 (ERM/LRA)

---

## 🛠️ 개발 및 기여

### 개발 환경 설정

```bash
# 전체 저장소 클론
git clone https://github.com/yourusername/OFBGlove.git
cd OFBGlove

# Android 앱 개발
cd application
# Android Studio에서 열기

# 웹 비주얼라이저 개발
cd web_visualizer
npm install
npm run dev

# ESP32 개발
cd wearable
# Arduino IDE에서 .ino 파일 열기
```

### 브랜치 전략

```
main          # 안정 버전
├─ develop    # 개발 브랜치
├─ feature/*  # 기능 개발
└─ hotfix/*   # 긴급 수정
```

### 코딩 스타일

- **Kotlin**: [Kotlin Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html)
- **TypeScript**: [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- **Arduino**: 2-space 들여쓰기, 명확한 주석

---

## 📚 참고 문서

### 논문 및 연구

- **점자 표준**: [Braille Authority of North America](https://www.brailleauthority.org/)
- **liblouis 문서**: [liblouis GitHub](https://github.com/liblouis/liblouis)

### 관련 기술 문서

```
application/
├── DEVELOPMENT_INSTRUCTIONS.md          # 개발 가이드
├── BRAILLE_INPUT_IMPLEMENTATION.md      # 점자 입력 상세
├── BLE_GATT_ARCHITECTURE.md            # BLE 아키텍처
├── PROJECT_IMPROVEMENT_PROPOSAL.md      # 개선 제안서
└── README_KO.md                         # 한글 README

web_visualizer/
├── README.md                             # 웹 비주얼라이저 가이드
└── WEB_VISUALIZER_DEVELOPMENT_GUIDE.md  # 웹 개발 가이드

wearable/
└── README.md                            # 하드웨어 가이드
```

---


### 사용된 주요 라이브러리

| 라이브러리 | 버전 | 라이선스 |
|-----------|------|---------|
| liblouis-java | 5.1.0 | LGPL 2.1 |
| JNA | 5.17.0 | Apache 2.0 |
| AndroidX | - | Apache 2.0 |
| React | 18 | MIT |
| ESP32 Arduino | - | LGPL 2.1 |

---

