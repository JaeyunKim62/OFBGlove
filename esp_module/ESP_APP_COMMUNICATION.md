# 📡 esp ↔ Android 앱 통신 프로토콜

## 📋 개요

esp와 Android 앱 간의 통신 프로토콜

---

## 🎯 통신 방향

### esp -> 앱: 입력된 점자 또는 이미지
- **목적**: esp에서 입력한 점자 패턴 또는 이미지를 앱으로 전송
- **경로**: esp → TCP 서버 (포트 8888) → Android 앱
- **용도**: esp에서 직접 입력한 점자 또는 필담 이미지를 앱에서 처리 (OCR 등)

### 앱 → esp: 점자 시퀀스
- **목적**: 앱에서 생성된 점자 패턴을 esp에서 시각화
- **경로**: Android 앱 → TCP 서버 (포트 8888) → esp
- **용도**: 음성 인식으로 생성된 점자 시퀀스 esp 에서 구현

## 📦 메시지 프로토콜

### 1. 기본 메시지 구조

모든 메시지는 다음 구조를 따릅니다:

```
[4바이트: 헤더][N바이트: 데이터]
```

#### 헤더 구조 (4바이트)

| 바이트 | 필드 | 설명 | 크기 |
|--------|------|------|------|
| 0 | Message Type | 메시지 타입 | 1바이트 |
| 1-2 | Data Length | 데이터 길이 (Little Endian) | 2바이트 |
| 3 | Checksum | 체크섬 (XOR) | 1바이트 |

#### 데이터 구조

- 데이터 길이는 헤더의 `Data Length` 필드에 명시
- 데이터는 헤더 바로 다음부터 시작
- 최대 데이터 길이: 65535 바이트 (Short 최대값)

### 2. 체크섬 계산

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

## 📨 메시지 타입

### 앱 → esp (점자 시퀀스)

점자 시퀀스를 esp로 전송

| 타입 | 값 | 설명 | 데이터 구조 | 전송 경로 |
|------|-----|------|-------------|-----------|
| `WORD_SEQUENCE` | 0x03 | 점자 패턴 시퀀스 | `[dotsByte: N바이트]` | 앱 → TCP → esp |
| `CLEAR` | 0x04 | 점자 초기화 | `[0x00]` (1바이트) | 앱 → TCP → esp |
| `WORD_SEPARATOR` | 0x05 | 단어 구분자 (공백) | `[0x00]` (1바이트) | 앱 → TCP → esp |
| `SENTENCE_SEPARATOR` | 0x06 | 문장 구분자 | `[0x00]` (1바이트) | 앱 → TCP → esp |
| `BRAILLE_SEPARATOR` | 0x07 | 점자 구분자 (개별 점자 모드) | `[0x00]` (1바이트) | 앱 → TCP → esp |

#### 점자 패턴 데이터 구조

**WORD_SEQUENCE (0x03) - 점자 패턴 시퀀스**
- 여러 점자 패턴을 하나의 메시지로 묶어서 전송
- 데이터 구조: `[dotsByte1][dotsByte2][dotsByte3]...[dotsByteN]`
- 각 `dotsByte` (1바이트): 6개 점의 비트마스크
  - Bit 0: 점 1 (LSB)
  - Bit 1: 점 2
  - Bit 2: 점 3
  - Bit 3: 점 4
  - Bit 4: 점 5
  - Bit 5: 점 6 (MSB)
- Data Length: 점자 패턴 개수 (N바이트)
- 예시: `0x19` (0b00011001) = 점 1, 4, 5 활성화

**구분자 메시지 (CLEAR, WORD_SEPARATOR, SENTENCE_SEPARATOR, BRAILLE_SEPARATOR)**
- 데이터: `[0x00]` (1바이트)
- 구분자 메시지는 데이터 없이 헤더만으로도 의미 전달이 가능하지만, 프로토콜 일관성을 위해 1바이트(0x00)를 포함합니다.

#### 점자 시퀀스 전송 예시

**예시: "hello world" 전송 (공백 포함)**

```
1. CLEAR (0x04) - 점자 초기화
   [0x04][0x00 0x01][0x00][0x00]

2. WORD_SEQUENCE (0x03) - "hello" 점자 패턴 시퀀스
   [0x03][0x00 0x05][checksum][0x23][0x19][0x13][0x13][0x1D]

3. WORD_SEPARATOR (0x05) - 공백 구분
   [0x05][0x00 0x01][0x00][0x00]

4. WORD_SEQUENCE (0x03) - "world" 점자 패턴 시퀀스
   [0x03][0x00 0x05][checksum][0x27][0x1D][0x13][0x11][0x0B]

5. SENTENCE_SEPARATOR (0x06) - 문장 구분
   [0x06][0x00 0x01][0x00][0x00]
```

**전송 순서:**
1. `CLEAR`로 점자 상태 초기화
2. 단어 단위로 `WORD_SEQUENCE` 전송 (여러 점자 패턴을 묶어서)
3. 공백 문자(`' '`)를 만나면 `WORD_SEPARATOR` 전송
4. 문장 끝에 `SENTENCE_SEPARATOR` 전송


### esp → 앱 메시지 (입력된 점자/이미지)

| 타입 | 값 | 설명 | 데이터 구조 | 전송 경로 |
|------|-----|------|-------------|-----------|
| `DOT_PATTERN` | 0x01 | 점자 패턴 입력 (하나씩) | `[dotsByte: 1바이트]` | esp → TCP → 앱 |
| `WORD_SEPARATOR` | 0x05 | 단어 구분자 (다음 버튼) | `[0x00]` (1바이트) | esp → TCP → 앱 |
| `SENTENCE_SEPARATOR` | 0x06 | 문장 구분자 (엔터 버튼) | `[0x00]` (1바이트) | esp → TCP → 앱 |
| `IMAGE_DATA` | 0x30 | 이미지 데이터 | `[imageBytes: N바이트]` | esp → TCP → 앱 |

#### esp 입력 메시지 설명

**DOT_PATTERN (0x01)**
- esp에서 사용자가 입력한 점자 패턴을 하나씩 전송
- 각 점자 패턴 입력 완료 시마다 개별 메시지로 전송
- 데이터: `[dotsByte: 1바이트]` - 6개 점의 비트마스크

**WORD_SEPARATOR (0x05) - "다음" 버튼**
- 단어 구분자 (공백 의미)
- 앱 → esp의 `WORD_SEPARATOR`와 동일한 의미
- 데이터: `[0x00]` (1바이트)

**SENTENCE_SEPARATOR (0x06) - "엔터" 버튼**
- 문장 구분자 (줄바꿈 의미)
- 앱 → esp의 `SENTENCE_SEPARATOR`와 동일한 의미
- 데이터: `[0x00]` (1바이트)

#### esp 입력 예시

**예시: "hello" 입력**

```
1. DOT_PATTERN (0x01) - "h" 점자 패턴
   [0x01][0x00 0x01][checksum][0x23]

2. DOT_PATTERN (0x01) - "e" 점자 패턴
   [0x01][0x00 0x01][checksum][0x19]

3. DOT_PATTERN (0x01) - "l" 점자 패턴
   [0x01][0x00 0x01][checksum][0x13]

4. DOT_PATTERN (0x01) - "l" 점자 패턴
   [0x01][0x00 0x01][checksum][0x13]

5. DOT_PATTERN (0x01) - "o" 점자 패턴
   [0x01][0x00 0x01][checksum][0x1D]

6. SENTENCE_SEPARATOR (0x06) - 엔터 버튼
   [0x06][0x00 0x01][0x00][0x00]
```

**예시: "hello world" 입력 (공백 포함)**

```
1-5. DOT_PATTERN (0x01) - "hello" 각 점자 패턴
   [0x01][0x00 0x01][checksum][dotsByte]

6. WORD_SEPARATOR (0x05) - "다음" 버튼 (공백)
   [0x05][0x00 0x01][0x00][0x00]

7-11. DOT_PATTERN (0x01) - "world" 각 점자 패턴
   [0x01][0x00 0x01][checksum][dotsByte]

12. SENTENCE_SEPARATOR (0x06) - 엔터 버튼
   [0x06][0x00 0x01][0x00][0x00]
```

---