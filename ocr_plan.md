# 필담 이미지 OCR 통신 구현 계획

이 문서는 웹에서 필담 형식의 숫자/알파벳 이미지를 그려서 Android 앱으로 전송하고 OCR 인식하는 전체 구현 계획을 설명합니다.

## 📋 목차
1. [현재 통신 구조 분석](#1-현재-통신-구조-분석)
2. [이미지 통신 프로토콜 설계](#2-이미지-통신-프로토콜-설계)
3. [웹 드로잉 화면 구현](#3-웹-드로잉-화면-구현)
4. [이미지 리사이즈 및 전송](#4-이미지-리사이즈-및-전송)
5. [서버 측 중계 구현](#5-서버-측-중계-구현)
6. [Android 앱 수신 및 OCR 처리](#6-android-앱-수신-및-ocr-처리)

---

## 1. 현재 통신 구조 분석

### 현재 구조
```
웹 클라이언트 → WebSocket 서버 (포트 8889) → TCP 서버 (포트 8888) → Android 앱
```

### 통신 경로
- **웹 → 서버**: WebSocket (JSON 메시지)
- **서버 → 앱**: TCP Socket (바이너리 프로토콜)

### 관련 파일
- `web_visualizer/src/server/brailleServer.js`: 통합 서버 (TCP + WebSocket)
- `web_visualizer/src/server/tcpServer.js`: TCP 서버 구현
- `application/app/src/main/java/com/example/chatting_app/network/WifiClient.kt`: Android WiFi 클라이언트
- `application/app/src/main/java/com/example/chatting_app/network/WifiMessageProtocol.kt`: 메시지 프로토콜

### 현재 상태
- ✅ 웹 → 서버 WebSocket 연결 구현됨
- ✅ 서버 → 앱 TCP 연결 구현됨
- ✅ 점자 패턴 통신 구현됨
- ❌ 이미지 데이터 통신 미구현
- ❌ 웹에서 이미지 그리기 기능 미구현

---

## 2. 이미지 통신 프로토콜 설계

### 메시지 타입 추가

#### Android 앱 측 (`WifiMessageProtocol.kt`)
```kotlin
enum class MessageType(val value: Int) {
    // ... 기존 타입들 ...
    IMAGE_DATA(0x30),  // 이미지 데이터 (웹 → 앱)
}
```

#### 메시지 구조
- **헤더**: 4바이트 (메시지 타입 + 데이터 길이 + 체크섬)
- **데이터**: 이미지 바이트 배열 (PNG 형식)

### 프로토콜 형식
```
[헤더 4바이트][이미지 데이터]
- 헤더[0]: 메시지 타입 (0x30 = IMAGE_DATA)
- 헤더[1-2]: 데이터 길이 (Little Endian, 2바이트)
- 헤더[3]: 체크섬 (XOR)
- 데이터: PNG 이미지 바이트 배열
```

---

## 3. 웹 드로잉 화면 구현

### 컴포넌트 구조
```
web_visualizer/src/components/HandwritingCanvas.tsx
```

### 주요 기능
- Canvas 기반 드로잉 인터페이스
- 마우스/터치 이벤트 지원
- 지우기 기능
- 전송 기능

### Canvas 픽셀 크기

#### 원본 Canvas 크기 (사용자가 그리는 크기)
- **기본 크기**: 200px × 200px
- **최소 크기**: 150px × 150px
- **최대 크기**: 400px × 400px
- **설명**: 사용자가 편하게 글씨를 그릴 수 있도록 충분한 크기 제공
- **CSS 표시 크기**: 반응형으로 조정 가능 (예: 300px × 300px로 표시)

#### 리사이즈 후 크기 (OCR 전송용)
- **고정 크기**: 30px × 30px
- **설명**: OCR 인식에 최적화된 작은 크기로 고정 크기로 리사이즈하여 전송
- **리사이즈 방식**: 원본 200×200px를 30×30px로 고정 크기로 리사이즈 (비율 무시)

#### 픽셀 크기 흐름
```
1. Canvas 원본: 200px × 200px (사용자가 그림)
   ↓
2. base64 이미지 변환: 200px × 200px PNG
   ↓
3. 리사이즈: 30px × 30px (고정 크기)
   ↓
4. 전송: 리사이즈된 이미지 바이트 배열
   ↓
5. Android 앱 수신: 30px × 30px 크기의 Bitmap
```

### 구현 내용

#### 3-1. HandwritingCanvas 컴포넌트 생성
- 파일 위치: `web_visualizer/src/components/HandwritingCanvas.tsx`
- **Canvas 라이브러리**: 순수 HTML5 Canvas API 사용 (별도 라이브러리 없음)
  - React의 `useRef`로 Canvas DOM 요소 참조
  - 네이티브 Canvas 2D Context API 사용 (`getContext('2d')`)
  - 추가 의존성 없이 브라우저 기본 기능만 사용
- Canvas 설정:
  - `width={200}` (픽셀)
  - `height={200}` (픽셀)
  - CSS로 표시 크기 조정 가능 (예: `style={{ width: '300px', height: '300px' }}`)
- 기능:
  - Canvas 드로잉 (마우스/터치)
  - 흰색 배경, 검은색 선
  - 지우기 버튼
  - 전송 버튼
- 동작 방식:
  - **Canvas 기본 동작**: Canvas에 그린 획들은 드로잉 중간에도 자동으로 화면에 표시됨
    - 마우스/터치로 그리는 동안 실시간으로 그린 경로가 화면에 보임
    - `stroke()` 또는 `lineTo()` + `stroke()` 호출 시 즉시 화면에 그려짐
  - **마우스/터치 이벤트 처리**:
    - `onMouseDown` / `onTouchStart`: 드로잉 시작, `beginPath()`, `moveTo()` 호출
    - `onMouseMove` / `onTouchMove`: 드로잉 중, `lineTo()`, `stroke()` 호출
    - `onMouseUp` / `onTouchEnd`: 드로잉 종료
  - **전송 기능**: 전송 버튼 클릭 시 현재 Canvas 내용을 이미지로 변환하여 서버로 전송
  - **에러 처리**: 
    - Canvas 초기화 실패 시 에러 메시지 표시
    - 이미지 변환 실패 시 에러 처리
    - WebSocket 전송 실패 시 재시도 또는 에러 표시

#### 3-2. CSS 스타일링
- 파일 위치: `web_visualizer/src/components/HandwritingCanvas.css`
- 스타일:
  - 캔버스 테두리
  - 버튼 스타일
  - 반응형 레이아웃

#### 3-3. App.tsx에 통합
- HandwritingCanvas 컴포넌트 추가
- 이미지 완성 콜백 처리
- 전송 버튼 클릭 시:
  1. Canvas의 현재 내용을 base64 이미지로 변환 (`canvas.toDataURL('image/png')`)
  2. 이미지 리사이즈 (30×30px) - `resizeImage()` 함수 사용
  3. base64 → ArrayBuffer 변환 - `base64ToArrayBuffer()` 함수 사용
  4. WebSocket을 통해 서버로 전송
  5. **WebSocket 메시지 형식**:
     ```typescript
     {
       type: 'image_data',
       image: Array.from(arrayBuffer) // Uint8Array를 배열로 변환
     }
     ```

---

## 4. 이미지 리사이즈 및 전송

### 유틸리티 함수
```
web_visualizer/src/utils/imageUtils.ts
```

### 주요 함수

#### resizeImage()
- **입력**: base64 이미지 문자열 (예: `"data:image/png;base64,..."`)
- **출력**: 리사이즈된 base64 이미지 (30px × 30px 고정)
- **기능**:
  - 원본 이미지를 30×30px로 고정 크기로 리사이즈 (비율 무시)
  - 흰색 배경 유지
  - PNG 형식으로 변환
- **구현 예시**:
  ```typescript
  export const resizeImage = (
    imageData: string,
    targetSize: number = 30
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context를 가져올 수 없습니다'));
          return;
        }
        
        // 흰색 배경
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, targetSize, targetSize);
        
        // 이미지를 30×30px로 강제 리사이즈 (비율 무시)
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        
        // base64로 변환
        const resizedImage = canvas.toDataURL('image/png');
        resolve(resizedImage);
      };
      
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = imageData;
    });
  };
  ```

#### base64ToArrayBuffer()
- **입력**: base64 문자열 (예: `"data:image/png;base64,iVBORw0KGgo..."`)
- **출력**: ArrayBuffer
- **기능**: base64를 바이너리 데이터로 변환
- **구현 예시**:
  ```typescript
  export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    // data:image/png;base64, 부분 제거
    const base64Data = base64.includes(',') 
      ? base64.split(',')[1] 
      : base64;
    
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  };
  ```

### 리사이즈 규칙
- **원본 크기**: Canvas는 200px × 200px로 생성 (사용자가 그리는 크기)
- **리사이즈 후 크기**: 30px × 30px (고정 크기)
- **리사이즈 방식**: 원본 200×200px를 30×30px로 고정 크기로 리사이즈
- **비율 처리**: 비율 무시, 항상 30×30px로 고정
- **배경**: 흰색 배경 유지
- **리사이즈 알고리즘**: 
  - 원본 이미지를 30×30px로 강제 리사이즈
  - Canvas의 `drawImage()` 메서드로 30×30px 캔버스에 그리기
  - 예: 200×200 → 30×30 (항상 동일)

### 픽셀 크기 예시

#### 모든 시나리오 (고정 크기)
- Canvas 원본: 200px × 200px
- 사용자가 어떤 글씨를 그리든 상관없이
- 리사이즈 후: 30px × 30px (고정)
- 전송 크기: 약 1-3KB (PNG 압축)

#### 예시
- "A" 그리기 → 30px × 30px
- "123" 그리기 → 30px × 30px
- "1" 그리기 → 30px × 30px
- 모든 경우 동일하게 30×30px로 전송

---

## 5. 서버 측 중계 구현

### TCP 서버 확장 (`tcpServer.js`)

#### 5-1. WebSocket 메시지 처리 추가 (`brailleServer.js`)
```javascript
// brailleServer.js의 handleWebSocketMessage()에 추가
case 'image_data':
  // WebSocket에서 받은 이미지를 TCP 클라이언트로 전달
  const imageBytes = Buffer.from(data.image);
  const imageMessage = this.tcpServer.createImageMessage(imageBytes);
  
  // TCP 서버의 모든 클라이언트에게 전송
  // tcpServer.js의 clients Set에 저장된 모든 TCP 소켓에 전송
  this.tcpServer.broadcastToTCPClients(imageMessage);
  break;
```

#### 5-1-1. TCP 서버에 브로드캐스트 메서드 추가 (`tcpServer.js`)
```javascript
// tcpServer.js에 추가
broadcastToTCPClients(message) {
  this.clients.forEach(socket => {
    if (socket && !socket.destroyed) {
      try {
        socket.write(message);
      } catch (error) {
        console.error('TCP 클라이언트 전송 오류:', error);
        this.clients.delete(socket);
      }
    }
  });
}
```

#### 5-2. 이미지 메시지 생성 함수 (`tcpServer.js`)
```javascript
// tcpServer.js에 추가
createImageMessage(imageData) {
  const messageType = 0x30; // IMAGE_DATA
  const dataLength = imageData.length;
  const checksum = this.calculateChecksum(imageData);
  
  // 헤더 생성 (4바이트)
  const header = Buffer.alloc(4);
  header[0] = messageType;
  header[1] = dataLength & 0xFF; // LSB
  header[2] = (dataLength >> 8) & 0xFF; // MSB
  header[3] = checksum;
  
  // 헤더 + 데이터 결합
  return Buffer.concat([header, imageData]);
}
```

**참고**: `tcpServer.js`에는 이미 `calculateChecksum()` 메서드가 구현되어 있음

### WebSocket 서버 (`brailleServer.js`)
- 기존 구조 유지
- 이미지 메시지 타입 추가만 필요
- **중요**: WebSocket 메시지는 `brailleServer.js`의 `handleWebSocketMessage()`에서 처리
- `tcpServer.js`는 TCP 클라이언트 관리만 담당
- WebSocket → TCP 중계는 `brailleServer.js`에서 `tcpServer` 인스턴스의 메서드 호출

---

## 6. Android 앱 수신 및 OCR 처리

### 6-1. 메시지 프로토콜 확장

#### `WifiMessageProtocol.kt` 수정
```kotlin
enum class MessageType(val value: Int) {
    // ... 기존 타입들 ...
    IMAGE_DATA(0x30),  // 이미지 데이터
}
```

### 6-2. WiFi 클라이언트 수신 처리

#### `WifiClient.kt` 수정
```kotlin
private fun handleReceivedMessage(packet: ByteArray) {
    val message = WifiMessageProtocol.deserializeMessage(packet)
    if (message != null) {
        when (message.messageType) {
            MessageType.IMAGE_DATA -> {
                // 이미지를 Bitmap으로 변환
                val bitmap = BitmapFactory.decodeByteArray(
                    message.data, 0, message.data.size
                )
                bitmap?.let {
                    // 메인 스레드에서 콜백 호출 (UI 업데이트를 위해)
                    Handler(Looper.getMainLooper()).post {
                        onImageReceived?.invoke(it)
                    }
                } ?: run {
                    Log.e(TAG, "Bitmap 변환 실패: 이미지 데이터가 유효하지 않음")
                }
            }
            // ... 기존 처리 ...
        }
    }
}

// 이미지 수신 콜백 (메인 스레드에서 호출됨)
var onImageReceived: ((Bitmap) -> Unit)? = null
```

**참고**: 
- `Handler(Looper.getMainLooper())`를 사용하여 메인 스레드에서 콜백 호출
- `BitmapFactory.decodeByteArray()`는 null을 반환할 수 있으므로 null 체크 필요

### 6-3. ChatViewModel 통합

#### `ChatViewModel.kt` 수정
```kotlin
// 이미지 수신 처리 (이미 구현됨)
fun handleReceivedImage(bitmap: Bitmap) {
    // OCR 처리
    textRecognizerManager.recognizeText(bitmap, object : OcrResultListener {
        override fun onResult(text: String?) {
            // 인식된 텍스트 처리
            // 채팅 메시지 추가
            // TTS 재생
            // 점자 변환 및 전송
        }
        
        override fun onError(exception: Exception) {
            // 오류 처리
        }
    })
}
```

### 6-4. MainActivity 연결

#### `MainActivity.kt` 수정
```kotlin
// WiFi 클라이언트 이미지 수신 콜백 설정
wifiClient.onImageReceived = { bitmap ->
    viewModel.handleReceivedImage(bitmap)
}
```

---

## 📝 구현 체크리스트

### 웹 측 구현
- [ ] `HandwritingCanvas.tsx` 컴포넌트 생성
- [ ] `HandwritingCanvas.css` 스타일 추가
- [ ] `imageUtils.ts` 유틸리티 함수 구현
- [ ] `App.tsx`에 HandwritingCanvas 통합
- [ ] 이미지 리사이즈 로직 구현 (30×30px 고정)
- [ ] WebSocket을 통한 이미지 전송 구현

### 서버 측 구현
- [ ] `tcpServer.js`에 이미지 메시지 처리 추가
- [ ] `createImageMessage()` 함수 구현
- [ ] TCP 클라이언트로 이미지 전달 로직 추가
- [ ] WebSocket → TCP 중계 테스트

### Android 앱 측 구현
- [ ] `WifiMessageProtocol.kt`에 IMAGE_DATA 타입 추가
- [ ] `WifiClient.kt`에 이미지 수신 처리 추가
- [ ] `ChatViewModel.kt`의 `handleReceivedImage()` 활용
- [ ] `MainActivity.kt`에 이미지 수신 콜백 연결
- [ ] OCR 처리 테스트

---

## 🔄 데이터 흐름

```
1. 사용자가 웹에서 Canvas에 글씨 그림
   (Canvas 원본: 200px × 200px)
   ↓
2. "전송" 버튼 클릭
   ↓
3. Canvas → base64 이미지 변환
   (200px × 200px PNG, 약 10-30KB)
   ↓
4. 이미지 리사이즈 (30px × 30px 고정)
   (항상 30×30px로 고정 크기 리사이즈)
   ↓
5. base64 → ArrayBuffer 변환
   (리사이즈된 이미지, 약 1-3KB)
   ↓
6. WebSocket으로 서버에 전송
   ↓
7. 서버에서 TCP 메시지로 변환
   (헤더 4바이트 + 이미지 데이터)
   ↓
8. Android 앱으로 TCP 전송
   ↓
9. Android 앱에서 Bitmap으로 변환
   (30px × 30px 크기의 Bitmap)
   ↓
10. ML Kit OCR 처리
    ↓
11. 인식된 텍스트를 채팅 메시지로 추가
    ↓
12. TTS로 읽어주기
    ↓
13. 점자 변환 및 전송
```

---

## 📁 폴더 구조

### 전체 프로젝트 구조
```
OFBGlove/
├── web_visualizer/                    # 웹 비주얼라이저
│   ├── src/
│   │   ├── components/
│   │   │   ├── HandwritingCanvas.tsx  # ✨ 새로 생성 (필담 드로잉 컴포넌트)
│   │   │   ├── HandwritingCanvas.css  # ✨ 새로 생성 (드로잉 컴포넌트 스타일)
│   │   │   ├── BrailleCell.tsx
│   │   │   ├── BrailleInput.tsx
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── imageUtils.ts          # ✨ 새로 생성 (이미지 리사이즈/변환 유틸)
│   │   │   ├── dataCollector.ts
│   │   │   └── networkUtils.ts
│   │   ├── server/
│   │   │   ├── brailleServer.js       # 🔧 수정 (WebSocket 이미지 메시지 처리)
│   │   │   └── tcpServer.js           # 🔧 수정 (TCP 이미지 메시지 생성/전송)
│   │   ├── services/
│   │   │   └── WebSocketService.ts
│   │   ├── App.tsx                    # 🔧 수정 (HandwritingCanvas 통합)
│   │   └── ...
│   └── package.json
│
└── application/                       # Android 앱
    └── app/
        └── src/
            └── main/
                ├── java/
                │   └── com/
                │       └── example/
                │           └── chatting_app/
                │               ├── network/
                │               │   ├── WifiMessageProtocol.kt  # 🔧 수정 (IMAGE_DATA 타입 추가)
                │               │   └── WifiClient.kt            # 🔧 수정 (이미지 수신 처리)
                │               ├── ocr/
                │               │   ├── OcrResultListener.kt     # ✅ 기존 (OCR 리스너)
                │               │   └── TextRecognizerManager.kt # ✅ 기존 (OCR 처리)
                │               ├── ChatViewModel.kt             # ✅ 기존 (handleReceivedImage 활용)
                │               └── MainActivity.kt              # 🔧 수정 (이미지 수신 콜백 연결)
                └── res/
                    └── drawable/
                        └── test_*.png                          # ✅ 기존 (테스트 이미지)
```

### 새로 생성할 파일
1. `web_visualizer/src/components/HandwritingCanvas.tsx` - 필담 드로잉 컴포넌트
2. `web_visualizer/src/components/HandwritingCanvas.css` - 드로잉 컴포넌트 스타일
3. `web_visualizer/src/utils/imageUtils.ts` - 이미지 리사이즈/변환 유틸리티

### 수정할 파일
1. `web_visualizer/src/App.tsx` - HandwritingCanvas 통합
2. `web_visualizer/src/server/brailleServer.js` - WebSocket 이미지 메시지 처리
3. `web_visualizer/src/server/tcpServer.js` - TCP 이미지 메시지 생성/전송
4. `application/app/src/main/java/com/example/chatting_app/network/WifiMessageProtocol.kt` - IMAGE_DATA 타입 추가
5. `application/app/src/main/java/com/example/chatting_app/network/WifiClient.kt` - 이미지 수신 처리
6. `application/app/src/main/java/com/example/chatting_app/MainActivity.kt` - 이미지 수신 콜백 연결

### 기존 파일 (수정 불필요, 활용만)
- `application/app/src/main/java/com/example/chatting_app/ocr/OcrResultListener.kt` - OCR 리스너 인터페이스
- `application/app/src/main/java/com/example/chatting_app/ocr/TextRecognizerManager.kt` - OCR 처리 매니저
- `application/app/src/main/java/com/example/chatting_app/ChatViewModel.kt` - `handleReceivedImage()` 메서드 활용

---

## 🧪 테스트 계획

### 1단계: 웹 드로잉 테스트
- [ ] Canvas에 글씨 그리기
- [ ] 지우기 기능
- [ ] 이미지 변환 확인

### 2단계: 이미지 리사이즈 테스트
- [ ] 리사이즈 후 크기 확인 (30×30px 고정)
- [ ] 고정 크기 리사이즈 확인 (비율 무시)
- [ ] 이미지 품질 확인

### 3단계: 통신 테스트
- [ ] 웹 → 서버 전송 확인
- [ ] 서버 → 앱 전송 확인
- [ ] 이미지 데이터 무결성 확인

### 4단계: OCR 테스트
- [ ] 숫자 인식 테스트 (0-9)
- [ ] 알파벳 인식 테스트 (A-Z, a-z)
- [ ] 인식 정확도 확인

---

## 📚 참고 자료

- 기존 OCR 구현: `application/mlocr.md`
- WiFi 프로토콜: `application/WIFI_PROTOTYPE_PROTOCOL.md`
- WebSocket 서비스: `web_visualizer/src/services/WebSocketService.ts`
- TCP 서버: `web_visualizer/src/server/tcpServer.js`

---

## 🎯 다음 단계

1. **웹 드로잉 컴포넌트 구현** (우선순위: 높음)
   - HandwritingCanvas 컴포넌트 생성
   - 기본 드로잉 기능 구현

2. **이미지 처리 유틸리티 구현** (우선순위: 높음)
   - 리사이즈 함수 구현
   - base64 변환 함수 구현

3. **서버 측 중계 구현** (우선순위: 중간)
   - TCP 서버에 이미지 메시지 처리 추가

4. **Android 앱 수신 구현** (우선순위: 중간)
   - 메시지 프로토콜 확장
   - 이미지 수신 처리

5. **통합 테스트** (우선순위: 높음)
   - 전체 플로우 테스트
   - OCR 정확도 확인