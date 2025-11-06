# 필담 이미지 OCR 인식 가이드

이 문서는 WiFi 통신으로 수신한 필담 형식의 숫자/알파벳 이미지를 Google ML Kit을 사용하여 인식하는 방법을 설명합니다.

## 📋 목차
1. [OCR 결과 리스너 인터페이스 정의](#1단계-ocr-결과-처리를-위한-인터페이스-정의)
2. [OCR 헬퍼 클래스 구현](#2단계-ocr-기능-담당-헬퍼-클래스-만들기)
3. [통신으로 받은 이미지 처리](#3단계-통신으로-받은-이미지-처리)
4. [ChatViewModel에 통합](#4단계-chatviewmodel에-ocr-통합)

---

### 🧩 1단계: OCR 결과 처리를 위한 인터페이스 정의

먼저, 텍스트 인식이 (비동기적으로) 완료되었을 때 결과를 전달받기 위한 인터페이스를 정의합니다.

> 파일 위치: `application/app/src/main/java/com/example/chatting_app/ocr/OcrResultListener.kt`

```kotlin
package com.example.chatting_app.ocr

import java.lang.Exception

/**
 * OCR 처리 결과를 비동기적으로 전달받기 위한 리스너
 * 필담 이미지(숫자, 알파벳) 인식 결과를 처리합니다.
 */
interface OcrResultListener {
    
    /**
     * 인식이 성공했을 때 호출됩니다.
     * @param text 인식된 텍스트 (숫자 또는 알파벳)
     * 필담 이미지에서는 보통 한 글자씩 인식하지만, 여러 글자가 인식될 수도 있습니다.
     * (아무것도 찾지 못하면 null이 됩니다)
     */
    fun onResult(text: String?)

    /**
     * 인식 과정에서 오류가 발생했을 때 호출됩니다.
     */
    fun onError(exception: Exception)
}
```

-----

### 📦 2단계: OCR 기능 담당 헬퍼 클래스 만들기

이 클래스가 ML Kit 초기화, 이미지 처리, 결과 반환 등 모든 실질적인 작업을 담당합니다.
필담 이미지(숫자, 알파벳) 인식에 최적화되어 있습니다.

> 파일 위치: `application/app/src/main/java/com/example/chatting_app/ocr/TextRecognizerManager.kt`

```kotlin
package com.example.chatting_app.ocr

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer

/**
 * ML Kit 텍스트 인식을 전문적으로 처리하는 헬퍼 클래스
 * 필담 이미지(숫자, 알파벳) 인식에 최적화됨
 */
class TextRecognizerManager {

    companion object {
        private const val TAG = "TextRecognizerManager"
    }

    // 1. 기본 텍스트 인식 사용 (숫자, 알파벳 인식 지원)
    //    이 인스턴스는 한 번만 만들어두고 재사용하는 것이 효율적입니다.
    private val recognizer: TextRecognizer =
        TextRecognition.getClient()

    /**
     * 외부에서 텍스트 인식을 요청할 때 호출하는 메인 함수
     * WiFi 통신으로 받은 Bitmap 이미지를 처리합니다.
     *
     * @param bitmap 인식할 Bitmap 이미지 (통신으로 수신한 필담 이미지)
     * @param listener 결과를 전달받을 OcrResultListener
     */
    fun recognizeText(bitmap: Bitmap, listener: OcrResultListener) {
        
        Log.d(TAG, "필담 이미지 텍스트 인식 시작... (크기: ${bitmap.width}x${bitmap.height})")

        // 2. Bitmap을 ML Kit가 이해하는 InputImage로 변환합니다.
        //    통신으로 받은 이미지는 보통 회전되지 않았으므로 0도 사용
        val image: InputImage
        try {
            image = InputImage.fromBitmap(bitmap, 0)
        } catch (e: Exception) {
            Log.e(TAG, "InputImage 생성 실패", e)
            listener.onError(e)
            return
        }

        // 3. 이미지 처리 (비동기)
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                // --- 인식 성공 ---
                Log.d(TAG, "인식된 전체 텍스트: ${visionText.text}")
                
                // 4. 필담 이미지는 보통 한 글자(숫자 또는 알파벳)를 인식하는 것이 목표이지만,
                //    여러 글자가 인식될 수도 있으므로 전체 텍스트를 반환합니다.
                //    필요에 따라 첫 번째 요소만 추출할 수도 있습니다.
                
                val recognizedText = visionText.text.trim()
                
                if (recognizedText.isNotEmpty()) {
                    Log.d(TAG, "인식 성공: '$recognizedText'")
                    // 5. 성공 리스너로 결과 전달
                    listener.onResult(recognizedText)
                } else {
                    Log.d(TAG, "텍스트를 찾지 못했습니다.")
                    // 5. 성공했지만, 찾은 텍스트가 없음 (null 전달)
                    listener.onResult(null)
                }
            }
            .addOnFailureListener { e ->
                // --- 인식 실패 ---
                Log.e(TAG, "텍스트 인식 실패", e)
                // 5. 실패 리스너로 오류 전달
                listener.onError(e)
            }
    }

    /**
     * 리소스 정리 (선택사항)
     * 앱 종료 시 호출하면 됩니다.
     */
    fun close() {
        recognizer.close()
    }
}
```

-----

### 🚀 3단계: 통신으로 받은 이미지 처리

WiFi 통신으로 수신한 이미지 데이터를 Bitmap으로 변환하고 OCR 처리를 수행합니다.

#### 3-1. 이미지 데이터를 Bitmap으로 변환

> `WifiSocketService.kt`에 추가할 메서드들

```kotlin
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * WiFi 통신으로 수신한 이미지 데이터를 Bitmap으로 변환
 * 
 * @param imageData 수신한 이미지 바이트 배열 (JPEG/PNG 형식)
 * @return Bitmap 객체 (변환 실패 시 null)
 */
suspend fun convertImageDataToBitmap(imageData: ByteArray): Bitmap? {
    return withContext(Dispatchers.IO) {
        try {
            BitmapFactory.decodeByteArray(imageData, 0, imageData.size)
        } catch (e: Exception) {
            Log.e(TAG, "Bitmap 변환 실패", e)
            null
        }
    }
}
```

#### 3-2. 통신 수신 처리 예시

```kotlin
// WifiSocketService.kt의 startReceiving() 메서드 내부에 추가

// 이미지 데이터 수신 시
if (messageType == 0x30) { // IMAGE_DATA
    val bitmap = convertImageDataToBitmap(data)
    bitmap?.let {
        // OCR 처리
        handleReceivedImage(it)
    }
}
```

---

### 🔗 4단계: ChatViewModel에 OCR 통합

ChatViewModel에서 통신으로 받은 이미지를 처리하고 OCR 결과를 채팅 메시지로 추가합니다.

> 파일 위치: `application/app/src/main/java/com/example/chatting_app/ChatViewModel.kt`

```kotlin
import android.graphics.Bitmap
import com.example.chatting_app.ocr.TextRecognizerManager
import com.example.chatting_app.ocr.OcrResultListener

class ChatViewModel : ViewModel() {
    // ... 기존 코드 ...
    
    // OCR 매니저 인스턴스 (싱글톤처럼 한 번만 생성)
    private val textRecognizerManager = TextRecognizerManager()
    
    /**
     * WiFi 통신으로 받은 필담 이미지 처리
     * Bitmap 이미지를 받아서 OCR 처리 후 채팅 메시지로 추가합니다.
     *
     * @param bitmap 수신한 필담 이미지 Bitmap
     */
    fun handleReceivedImage(bitmap: Bitmap) {
        Log.d("ChatViewModel", "필담 이미지 수신됨, OCR 처리 시작... (크기: ${bitmap.width}x${bitmap.height})")
        
        // OCR 처리 (비동기)
        textRecognizerManager.recognizeText(bitmap, object : OcrResultListener {
            override fun onResult(text: String?) {
                if (text != null && text.isNotBlank()) {
                    Log.d("ChatViewModel", "OCR 인식 결과: '$text'")
                    
                    // 인식된 텍스트를 채팅 메시지로 추가
                    val message = ChatMessage(
                        content = text,
                        senderType = SenderType.VISUAL_IMPAIRED_USER
                    )
                    addMessage(message)
                    
                    // TTS로 읽어주기
                    speakText(text)
                    
                    // 점자 변환 및 WiFi 전송
                    val braille = brailleConverter?.convertToBraille(text) ?: ""
                    sendBrailleToWifi(text, braille)
                    
                    Log.d("ChatViewModel", "필담 이미지 처리 완료: '$text' -> 점자: '$braille'")
                } else {
                    Log.w("ChatViewModel", "OCR 인식 실패 또는 텍스트 없음")
                    // 사용자에게 알림 필요 시 여기에 추가
                }
            }
            
            override fun onError(exception: Exception) {
                Log.e("ChatViewModel", "OCR 처리 오류", exception)
                // 사용자에게 오류 알림 필요 시 여기에 추가
            }
        })
    }
    
    override fun onCleared() {
        super.onCleared()
        // 리소스 정리
        textRecognizerManager.close()
    }
}
```

---

### 📱 5단계: MainActivity에서 연결

MainActivity에서 WiFi 서비스의 이미지 수신 콜백을 설정합니다.

> 파일 위치: `application/app/src/main/java/com/example/chatting_app/MainActivity.kt`

```kotlin
// MainActivity의 onCreate() 또는 적절한 위치에 추가

// WiFi 서비스 이미지 수신 콜백 설정
wifiSocketService.setOnImageReceived { bitmap ->
    // ViewModel로 전달하여 OCR 처리
    viewModel.handleReceivedImage(bitmap)
}
```

---

## 📋 요약

### 구현 단계

1. **OcrResultListener 인터페이스**: OCR 결과를 비동기적으로 전달받기 위한 리스너 인터페이스
2. **TextRecognizerManager 클래스**: ML Kit을 사용한 텍스트 인식 헬퍼 클래스 (기본 텍스트 인식 사용)
3. **이미지 데이터 변환**: WiFi 통신으로 받은 바이트 배열을 Bitmap으로 변환
4. **ChatViewModel 통합**: 수신한 이미지를 OCR 처리하고 채팅 메시지로 추가
5. **MainActivity 연결**: WiFi 서비스의 이미지 수신 콜백 설정

### 주요 특징

- **필담 이미지 최적화**: 숫자와 알파벳 인식을 위해 기본 ML Kit 텍스트 인식 사용
- **비동기 처리**: ML Kit의 비동기 API를 활용하여 UI 블로킹 방지
- **통신 연동**: WiFi 통신으로 받은 이미지를 직접 처리 가능
- **자동 점자 변환**: 인식된 텍스트를 자동으로 점자로 변환하여 전송

### 사용 방법

WiFi 통신으로 Bitmap 이미지를 받으면:
```kotlin
viewModel.handleReceivedImage(bitmap)
```

이 메서드를 호출하면 자동으로:
1. OCR 처리 (숫자/알파벳 인식)
2. 채팅 메시지 추가
3. TTS로 읽어주기
4. 점자 변환 및 WiFi 전송

---

## 🔧 필요한 의존성 추가

`build.gradle.kts`에 다음 의존성을 추가해야 합니다:

```kotlin
dependencies {
    // ... 기존 의존성 ...
    
    // Google ML Kit Text Recognition (숫자, 알파벳 인식 지원)
    implementation("com.google.mlkit:text-recognition:16.0.1")
}
```

---

## 📝 파일 구조

```
application/app/src/main/java/com/example/chatting_app/
├── ocr/
│   ├── OcrResultListener.kt          # OCR 결과 리스너 인터페이스
│   └── TextRecognizerManager.kt      # OCR 처리 헬퍼 클래스
├── ChatViewModel.kt                  # handleReceivedImage() 메서드 추가
└── MainActivity.kt                   # 이미지 수신 콜백 설정
```

---

## 🎯 다음 단계

1. 위 파일들을 실제 프로젝트에 생성/수정
2. `build.gradle.kts`에 ML Kit 의존성 추가
3. WiFi 통신 프로토콜에 이미지 메시지 타입 추가 (0x30: IMAGE_DATA)
4. 테스트 이미지로 OCR 동작 확인