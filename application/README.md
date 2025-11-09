# 음성-텍스트 채팅 시뮬레이터 (점자 지원)

음성 사용자와 텍스트 사용자 간의 대화를 시뮬레이션하는 포괄적인 Android 채팅 애플리케이션으로, 고급 음성 인식, 텍스트-음성 변환, 점자 입력/출력 기능을 제공합니다. 접근성을 고려하여 설계된 이 앱은 음성, 텍스트, 점자 등 다양한 입력 방법을 지원합니다.

## 🌟 주요 기능

### 🎤 고급 음성 처리
- **실시간 음성 인식**: Android의 SpeechRecognizer를 사용한 음성을 텍스트로 변환
- **고급 STT 처리**: 포괄적인 상태 피드백 및 오류 처리
- **상태 관리**: 모든 음성 인식 상태에 대한 시각적 피드백
- **자동 재시도**: 인식 실패 시 스마트 재시도 로직

### 📝 다중 입력 방법
- **텍스트 입력**: 전통적인 키보드 입력 및 전송 기능
- **음성 입력**: 실시간 인식이 가능한 탭-투-스피크
- **점자 입력**: 촉각 입력을 위한 6-dot 점자 그리드 (숨김)
- **입력 모드 전환**: 입력 방법 간의 원활한 전환 (숨김)

### 🔊 텍스트-음성 변환 통합
- **자동 TTS**: 텍스트 메시지가 자동으로 음성으로 재생
- **실시간 피드백**: 점자 입력에 대한 즉각적인 오디오 피드백
- **언어 지원**: 설정 가능한 TTS 언어 설정

### 🔤 점자 지원
- **양방향 변환**: 텍스트 ↔ 점자 양방향 변환
- **대화형 점자 입력**: 직접 점자 입력을 위한 6-dot 점자 그리드 (숨김)
- **실시간 번역**: 즉각적인 점자 번역 및 오디오 피드백
- **점자 전송 모듈**: WiFi 점자 패턴 전송 전용 모듈

### 📶 WiFi 통신
- **GATT 호환 프로토콜**: BLE GATT 메시지 구조를 사용한 WiFi 구현
- **실시간 점자 전송**: 4바이트 헤더 + 데이터 바이너리 프로토콜
- **메시지 타입**: DOT_PATTERN, PATTERN_COMPLETE, BRAILLE_SEQUENCE, WORD_SEPARATOR, SENTENCE_SEPARATOR, BRAILLE_SEPARATOR, TEXT_MESSAGE, SETTINGS, IMAGE_DATA
- **텍스트 메시지 지원**: 압축된 텍스트 및 점자 메시지 전송
- **사용자 설정**: 속도, 모드, 구성 전송
- **이미지 수신**: 필담 이미지 수신 및 OCR 처리 지원
- **통합 메시지 관리자**: WiFi 연결을 위한 중앙화된 통신 관리

### 📷 OCR 지원
- **ML Kit 텍스트 인식**: Google ML Kit를 사용한 필담 인식
- **이미지 수신**: 웹 비주얼라이저로부터 필담 이미지 수신
- **실시간 처리**: 이미지 처리 및 텍스트 변환
- **다국어 지원**: 숫자, 알파벳, 일본어 문자

### 🎨 현대적인 UI/UX
- **Jetpack Compose**: 최신 Android UI 툴킷으로 구축
- **Material Design 3**: 현대적이고 접근 가능한 디자인 시스템
- **반응형 레이아웃**: 다양한 화면 크기에 최적화
- **접근성 기능**: 시청각장애인을 위한 향상된 접근성
- **햅틱 피드백**: 점자 입력을 위한 촉각 피드백

## 🚀 작동 방식

### 음성 사용자 모드
1. "음성 사용자" 모드로 전환
2. 마이크 버튼을 탭하여 음성 인식 시작
3. 메시지를 명확하게 말하기
4. 인식된 텍스트가 파란색 메시지 버블로 표시
5. 점자 번역이 자동으로 생성되어 표시
6. 무선 통신을 통해 점자 시퀀스 송신

**참고**: 실시간 상태 피드백(시작 중, 준비 완료, 듣는 중, 처리 중, 성공, 오류)은 ViewModel에 구현되어 있으나 현재 UI에 표시되지 않습니다.

### 텍스트 사용자 모드 (숨김)
1. "텍스트 사용자" 모드로 전환
2. 텍스트 필드에 메시지 입력
3. 전송 버튼 탭
4. 텍스트가 회색 메시지 버블로 표시
5. 메시지가 TTS를 사용하여 자동으로 재생

### 점자 입력 모드 (숨김)
1. "점자 입력" 모드로 전환
2. 6-dot 점자 그리드를 사용하여 문자 입력:
   - 점 1-6을 터치하여 점자 패턴 생성
   - 활성 점에 대한 시각적 피드백 표시
   - "완료" 버튼을 탭하여 패턴 완성
3. 실시간 문자 인식 및 오디오 피드백
4. 채팅 시스템과의 원활한 통합

## 🛠️ 기술 아키텍처

### 핵심 기술
- **플랫폼**: Android API 30+ (Android 11+)
- **언어**: Kotlin 2.0.21
- **UI 프레임워크**: Material Design 3와 함께하는 Jetpack Compose
- **아키텍처**: StateFlow와 Coroutines를 사용한 MVVM
- **빌드 시스템**: Gradle 8.10.1

### 주요 라이브러리
- **liblouis-java**: 5.1.0 - 전문급 점자 번역
- **JNA**: 5.17.0 - liblouis를 위한 네이티브 라이브러리 접근
- **AndroidX Compose BOM**: 2024.09.00 - 최신 Compose 컴포넌트
- **Lifecycle**: 2.7.0 - ViewModel 및 상태 관리

### 프로젝트 구조
```
app/src/main/java/com/example/chatting_app/
├── MainActivity.kt              # 권한 처리가 포함된 앱 진입점
├── ChatScreen.kt               # 메인 채팅 UI 컴포저블
├── ChatViewModel.kt            # 비즈니스 로직 및 상태 관리
├── ChatMessage.kt              # 메시지 데이터 클래스
├── BrailleConverter.kt         # 점자 변환 래퍼
├── BrailleConverterJava.kt     # liblouis-java 통합
├── BrailleInputGrid.kt         # 6-dot 점자 입력 UI
├── BrailleInputManager.kt      # 점자 입력 로직
├── BraillePatternConverter.kt  # 점자 패턴 인식
├── network/
│   ├── UnifiedMessageManager.kt # 중앙화된 WiFi 메시지 관리
│   ├── WifiClient.kt            # WiFi 클라이언트 구현
│   ├── WifiMessageProtocol.kt   # GATT 호환 프로토콜
│   ├── WifiBrailleTransmitter.kt # 점자 패턴 전송기
│   ├── WifiTextTransmitter.kt   # 텍스트 메시지 전송기
│   └── WifiSettingsTransmitter.kt # 설정 전송기
├── ocr/
│   └── TextRecognizerManager.kt # ML Kit OCR 통합
└── ui/theme/                   # Material Design 3 테마
```

## 🔌 WiFi 통신 프로토콜

### 프로토콜 개요

앱은 **GATT 호환 바이너리 프로토콜**을 사용하여 WiFi를 통해 ESP32 또는 웹 비주얼라이저 서버와 통신합니다.

### 통신 구조

```
앱 (클라이언트) ←→ ESP32 (서버, 포트 8888)
앱 (클라이언트) ←→ 웹 비주얼라이저 (서버, 포트 8888)
```

- **앱**: 클라이언트 역할 (ESP32 또는 웹 서버에 연결)
- **ESP32/웹**: 서버 역할 (각각 독립적으로 앱과 통신)
- ESP32와 웹은 서로 직접 통신하지 않음

### 주요 메시지 타입

**앱에서 사용하는 메시지:**
- **송신**: `BRAILLE_SEQUENCE` (0x08) - 점자 시퀀스 전송 (유일한 점자 전송 방식)
- **수신**: `PATTERN_COMPLETE` (0x03) - ESP32/웹에서 입력한 점자 패턴
- **수신**: `IMAGE_DATA` (0x30) - 웹 비주얼라이저로부터 받은 필담 이미지

### 상세 프로토콜 문서

프로토콜의 상세 내용은 [protocol.md](../protocol.md)를 참조하세요.

- 메시지 구조 및 헤더 형식
- 모든 메시지 타입 참조표
- 프로토콜 사용 예시
- 점자 패턴 인코딩 방법

## 📱 설정 및 설치

### 사전 요구사항
- Android Studio (최신 버전)
- Android SDK 35
- API 30+ (Android 11+) Android 기기
- 마이크 접근 권한
- TTS를 위한 인터넷 연결

### 설치 단계
1. 저장소 클론
2. Android Studio에서 열기
3. Gradle 파일 동기화
4. Android 기기에서 빌드 및 실행
5. 프롬프트가 나타나면 필요한 권한 부여

### 필요한 권한
- `RECORD_AUDIO`: 음성 인식 기능
- `INTERNET`: WiFi 통신
- `ACCESS_NETWORK_STATE`: 네트워크 상태 확인
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`: BLE 통신 (선택사항)
- `VIBRATE`: 햅틱 피드백

## 🎯 현재 구현 상태

### ✅ 완료된 기능
- [x] 상태 관리가 포함된 고급 음성 인식
- [x] 텍스트-음성 변환 통합
- [x] liblouis-java 점자 번역
- [x] 6-dot 점자 입력 그리드
- [x] 실시간 점자 패턴 인식
- [x] 오디오 피드백이 포함된 대화형 점자 입력
- [x] GATT 호환 프로토콜을 사용한 WiFi 통신
- [x] 통합 메시지 관리 시스템
- [x] 이미지 수신 및 OCR 처리
- [x] 현대적인 Material Design 3 UI
- [x] StateFlow를 사용한 MVVM 아키텍처
- [x] 포괄적인 오류 처리
- [x] 런타임 권한 관리

### 🔄 진행 중

### 📋 계획된 기능
- [ ] 향상된 OCR 정확도 개선
- [ ] BLE 통신 통합
- [ ] 점자 학습용 프로세스
- [ ] liblouis library 통합으로 점자 번역
- [ ] 테스트 예제 및 코드
- [ ] 채팅 기록 내보내기/가져오기

## 🧪 테스트

### 단위 테스트
- ViewModel 비즈니스 로직 테스트
- 점자 변환 테스트
- 패턴 인식 테스트

### UI 테스트
- Compose 컴포넌트 테스트
- 점자 입력 상호작용 테스트
- 접근성 테스트

### 통합 테스트
- End-to-end 채팅 플로우 테스트
- 음성 인식 테스트
- TTS 기능 테스트

## 🔧 개발

### 프로젝트 빌드
```bash
# 디버그 빌드
./gradlew assembleDebug

# 릴리즈 빌드
./gradlew assembleRelease

# 테스트 실행
./gradlew test
```

### 코드 스타일
- Kotlin 코딩 규칙 준수
- Compose 가이드라인 적용
- Material Design 3 컴포넌트 사용
- MVVM 아키텍처 원칙 유지

## 📚 문서

- [개발 지침서](DEVELOPMENT_INSTRUCTIONS.md) - 포괄적인 개발 가이드
- [점자 입력 구현](BRAILLE_INPUT_IMPLEMENTATION.md) - 상세한 점자 기능 문서

## 🤝 기여하기

1. 저장소 포크
2. 기능 브랜치 생성
3. 코딩 표준 준수
4. 새 기능에 대한 테스트 추가
5. 풀 리퀘스트 제출

## 📄 라이선스

이 프로젝트는 다음 오픈소스 라이브러리를 사용합니다:
- **liblouis**: LGPL 2.1
- **JNA**: Apache 2.0
- **AndroidX**: Apache 2.0

## 🆘 지원

문제 및 질문이 있는 경우:
1. 문서 파일 확인
2. 개발 지침서 검토
3. GitHub에서 이슈 열기

---

**참고**: 이 앱은 접근성을 고려하여 설계되었으며, 다양한 요구사항과 선호도를 가진 사용자를 수용하기 위해 여러 입력 방법을 지원합니다.
