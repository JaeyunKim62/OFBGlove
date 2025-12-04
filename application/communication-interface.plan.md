# 📄 COMMUNICATION_INTERFACE_DESIGN.md

## 목적
Android 앱의 통신 레이어를 인터페이스로 추상화하여 
WiFi, BLE 등 다양한 통신 방식을 쉽게 교체할 수 있도록 개선

## 문제점 (Before)
- UnifiedMessageManager에 when 문 20+ 개 반복
- WiFi 구현에 직접 의존 (강한 결합)
- 새 통신 방식 추가 시 모든 when 문 수정 필요
- 테스트 어려움

## 해결 방안 (After)
- 인터페이스 기반 설계로 전환
- 다형성을 활용한 확장 가능한 구조
- 팩토리 패턴으로 동적 객체 생성

## 인터페이스 설계

### 1. CommunicationChannel
통신 채널의 공통 규격
- connect(), disconnect()
- send(data: ByteArray)
- connectionState, receivedMessage

### 2. MessageTransmitter
메시지 전송 기능
- BrailleTransmitter: 점자 전송
- TextTransmitter: 텍스트 전송
- SettingsTransmitter: 설정 전송
- ConfigTransmitter: 하드웨어 제어

## 구현 계획

### Phase 1: 인터페이스 정의
- CommunicationChannel.kt
- MessageTransmitter.kt

### Phase 2: 어댑터 생성
- WifiCommunicationChannel (WifiClient 래핑)

### Phase 3: 기존 코드 리팩토링
- Transmitter들 인터페이스 구현
- UnifiedMessageManager 개선

### Phase 4: BLE 스텁
- BleCommunicationChannel (미래 구현용)

### Phase 5: 테스트
- 단위 테스트 작성 (미완료)

## 기대 효과
- 확장성: 새 통신 방식 추가 용이
- 유지보수성: when 문 제거로 코드 간결
- 테스트 용이성: Mock 객체 사용 가능
- 미래 지향적: BLE, WebSocket 등 지원 준비

## 참고 문서
- BLE_GATT_ARCHITECTURE.md
- WIFI_PROTOTYPE_PROTOCOL.md
- protocol.md