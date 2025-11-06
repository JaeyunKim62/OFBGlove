package com.example.chatting_app.ocr

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/**
 * ML Kit 텍스트 인식을 전문적으로 처리하는 헬퍼 클래스
 * 필담 이미지(숫자, 알파벳) 인식에 최적화됨
 */
class TextRecognizerManager {

    companion object {
        private const val TAG = "TextRecognizerManager"
        private const val MIN_IMAGE_SIZE = 200 // 최소 이미지 크기
        private const val TARGET_SIZE = 400 // 목표 이미지 크기
    }

    // 기본 라틴 문자 인식 (숫자, 알파벳 지원)
    private val recognizer: TextRecognizer = TextRecognition.getClient(TextRecognizerOptions.Builder().build())

    /**
     * 이미지를 흑백으로 변환 (OCR 성능 향상, 색상 정보 불필요)
     */
    private fun convertToGrayscale(bitmap: Bitmap): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        val grayBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(grayBitmap)
        val paint = Paint()
        
        // 그레이스케일 변환 필터 (채도를 0으로)
        val colorMatrix = ColorMatrix()
        colorMatrix.setSaturation(0f)
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
        
        canvas.drawBitmap(bitmap, 0f, 0f, paint)
        return grayBitmap
    }

    /**
     * 이미지 전처리 (흑백 변환 + 크기 조정)
     */
    private fun preprocessImage(bitmap: Bitmap): Bitmap {
        var processed = bitmap
        
        // 1. 흑백 변환 (OCR에 유리, 색상 정보 불필요)
        processed = convertToGrayscale(processed)
        Log.d(TAG, "흑백 변환 완료")
        
        // 2. 크기 확대 (작은 이미지인 경우)
        val width = processed.width
        val height = processed.height
        
        if (width < MIN_IMAGE_SIZE || height < MIN_IMAGE_SIZE) {
            val scale = maxOf(
                TARGET_SIZE.toFloat() / width,
                TARGET_SIZE.toFloat() / height
            )
            
            val newWidth = (width * scale).toInt()
            val newHeight = (height * scale).toInt()
            
            Log.d(TAG, "이미지 확대: ${width}x${height} -> ${newWidth}x${newHeight} (scale: $scale)")
            
            val scaledBitmap = Bitmap.createScaledBitmap(processed, newWidth, newHeight, true)
            
            // 흑백 변환된 이미지 메모리 해제
            if (processed != bitmap && !processed.isRecycled) {
                processed.recycle()
            }
            
            return scaledBitmap
        }
        
        // 원본이 처리된 이미지면 메모리 해제
        if (processed != bitmap && !processed.isRecycled) {
            processed.recycle()
        }
        
        return processed
    }

    /**
     * 외부에서 텍스트 인식을 요청할 때 호출하는 메인 함수
     * WiFi 통신으로 받은 Bitmap 이미지를 처리합니다.
     *
     * @param bitmap 인식할 Bitmap 이미지 (통신으로 수신한 필담 이미지)
     * @param listener 결과를 전달받을 OcrResultListener
     */
    fun recognizeText(bitmap: Bitmap, listener: OcrResultListener) {
        
        Log.d(TAG, "필담 이미지 텍스트 인식 시작... (크기: ${bitmap.width}x${bitmap.height})")

        // 이미지 전처리 (흑백 변환 + 크기 조정)
        val processedBitmap = preprocessImage(bitmap)
        
        // Bitmap을 ML Kit가 이해하는 InputImage로 변환
        val image: InputImage
        try {
            image = InputImage.fromBitmap(processedBitmap, 0)
        } catch (e: Exception) {
            Log.e(TAG, "InputImage 생성 실패", e)
            listener.onError(e)
            // 메모리 해제
            if (processedBitmap != bitmap && !processedBitmap.isRecycled) {
                processedBitmap.recycle()
            }
            return
        }

        // 이미지 처리 (비동기)
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                // --- 인식 성공 ---
                Log.d(TAG, "인식된 전체 텍스트: '${visionText.text}'")
                
                // 디버깅: 텍스트 블록 정보 확인
                Log.d(TAG, "텍스트 블록 개수: ${visionText.textBlocks.size}")
                visionText.textBlocks.forEachIndexed { index, block ->
                    Log.d(TAG, "블록 $index: '${block.text}' (라인 수: ${block.lines.size})")
                    block.lines.forEachIndexed { lineIndex, line ->
                        Log.d(TAG, "  라인 $lineIndex: '${line.text}' (요소 수: ${line.elements.size})")
                        line.elements.forEachIndexed { elemIndex, element ->
                            Log.d(TAG, "    요소 $elemIndex: '${element.text}'")
                        }
                    }
                }
                
                val recognizedText = visionText.text.trim()
                
                if (recognizedText.isNotEmpty()) {
                    Log.d(TAG, "인식 성공: '$recognizedText'")
                    listener.onResult(recognizedText)
                } else {
                    Log.w(TAG, "텍스트를 찾지 못했습니다. (블록 수: ${visionText.textBlocks.size})")
                    listener.onResult(null)
                }
                
                // 전처리된 이미지가 원본과 다르면 메모리 해제
                if (processedBitmap != bitmap && !processedBitmap.isRecycled) {
                    processedBitmap.recycle()
                }
            }
            .addOnFailureListener { e ->
                // --- 인식 실패 ---
                Log.e(TAG, "텍스트 인식 실패", e)
                listener.onError(e)
                
                // 전처리된 이미지가 원본과 다르면 메모리 해제
                if (processedBitmap != bitmap && !processedBitmap.isRecycled) {
                    processedBitmap.recycle()
                }
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

