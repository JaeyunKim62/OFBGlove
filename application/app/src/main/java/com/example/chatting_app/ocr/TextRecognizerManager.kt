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
        // 문자 크기 범위 (여백 포함): 20-40 픽셀 (실제 문자는 16x16 ~ 24x24)
        private const val MIN_CHAR_SIZE = 32 // 최소 문자 크기 (픽셀)
        private const val MAX_CHAR_SIZE = 40 // 최대 문자 크기 (픽셀)
        private const val TARGET_CHAR_SIZE = 35 // 목표 문자 크기 (픽셀)
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
     * 최소한의 대비 향상 (텍스트를 더 선명하게, 성능 최소화)
     */
    private fun enhanceContrast(bitmap: Bitmap): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        val enhancedBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(enhancedBitmap)
        val paint = Paint()
        
        // 가벼운 대비 향상 (1.3배 - 너무 강하지 않게)
        val colorMatrix = ColorMatrix(floatArrayOf(
            1.3f, 0f, 0f, 0f, -15f,    // Red 채널
            0f, 1.3f, 0f, 0f, -15f,    // Green 채널
            0f, 0f, 1.3f, 0f, -15f,    // Blue 채널
            0f, 0f, 0f, 1f, 0f         // Alpha 채널
        ))
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
        
        canvas.drawBitmap(bitmap, 0f, 0f, paint)
        return enhancedBitmap
    }

    /**
     * 이미지 전처리 (흑백 변환 + 최소 대비 향상 + 크기 조정)
     * @param skipPreprocessing true면 전처리 없이 원본 그대로 사용 (디버깅용)
     */
    private fun preprocessImage(bitmap: Bitmap, skipPreprocessing: Boolean = false): Bitmap {
        // 디버깅: 전처리 없이 원본 그대로 테스트
        if (skipPreprocessing) {
            Log.d(TAG, "⚠️ 전처리 건너뛰기 - 원본 이미지 그대로 사용")
            return bitmap
        }
        
        var processed = bitmap
        
        // 1. 흑백 변환 (OCR에 유리, 색상 정보 불필요)
        processed = convertToGrayscale(processed)
        Log.d(TAG, "흑백 변환 완료")
        
        // 2. 최소한의 대비 향상 (텍스트 선명도 향상)
        processed = enhanceContrast(processed)
        Log.d(TAG, "대비 향상 완료")
        
        // 3. 크기 조정 (큰 이미지인 경우 축소)
        val width = processed.width
        val height = processed.height
        
        // 이미지 크기로부터 추정 문자 크기 계산 (일반적으로 이미지 높이의 1/10 ~ 1/20 정도)
        // 필담 이미지 특성상 텍스트가 중앙에 집중되어 있다고 가정
        val estimatedCharHeight = minOf(width, height) / 10f // 보수적으로 추정
        
        // 추정된 문자 크기가 최대값을 초과하면 이미지 축소
        if (estimatedCharHeight > MAX_CHAR_SIZE) {
            // 목표 문자 크기에 맞추기 위한 스케일 계산
            val scale = TARGET_CHAR_SIZE / estimatedCharHeight
            
            val newWidth = (width * scale).toInt().coerceAtLeast(1)
            val newHeight = (height * scale).toInt().coerceAtLeast(1)
            
            Log.d(TAG, "이미지 축소: ${width}x${height} -> ${newWidth}x${newHeight} (scale: $scale, 추정 문자 크기: ${estimatedCharHeight}px -> ${estimatedCharHeight * scale}px)")
            
            val scaledBitmap = Bitmap.createScaledBitmap(processed, newWidth, newHeight, true)
            
            // 처리된 이미지 메모리 해제
            if (processed != bitmap && !processed.isRecycled) {
                processed.recycle()
            }
            
            return scaledBitmap
        } else {
            Log.d(TAG, "크기 조정 불필요: 추정 문자 크기 ${estimatedCharHeight}px (범위: ${MIN_CHAR_SIZE}-${MAX_CHAR_SIZE}px)")
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
        
        // Bitmap 유효성 검증
        if (bitmap.isRecycled) {
            Log.e(TAG, "❌ Bitmap이 이미 재활용되었습니다!")
            listener.onError(IllegalStateException("Bitmap is recycled"))
            return
        }
        
        if (bitmap.width <= 0 || bitmap.height <= 0) {
            Log.e(TAG, "❌ Bitmap 크기가 유효하지 않습니다: ${bitmap.width}x${bitmap.height}")
            listener.onError(IllegalArgumentException("Invalid bitmap size"))
            return
        }
        
        Log.d(TAG, "✅ 원본 Bitmap 검증 완료: ${bitmap.width}x${bitmap.height}, Config=${bitmap.config}")

        // 이미지 전처리 (흑백 변환 + 크기 조정)
        // TODO: 전처리 없이 테스트하려면 skipPreprocessing=true로 변경
        val processedBitmap = preprocessImage(bitmap, skipPreprocessing = true)
        
        // 전처리된 Bitmap 검증
        if (processedBitmap.isRecycled) {
            Log.e(TAG, "❌ 전처리된 Bitmap이 재활용되었습니다!")
            listener.onError(IllegalStateException("Processed bitmap is recycled"))
            return
        }
        
        Log.d(TAG, "✅ 전처리된 Bitmap 검증 완료: ${processedBitmap.width}x${processedBitmap.height}, Config=${processedBitmap.config}")
        
        // Bitmap을 ML Kit가 이해하는 InputImage로 변환
        val image: InputImage
        try {
            image = InputImage.fromBitmap(processedBitmap, 0)
            Log.d(TAG, "✅ InputImage 생성 성공: width=${image.width}, height=${image.height}, rotation=${image.rotationDegrees}")
        } catch (e: Exception) {
            Log.e(TAG, "❌ InputImage 생성 실패", e)
            listener.onError(e)
            // 메모리 해제
            if (processedBitmap != bitmap && !processedBitmap.isRecycled) {
                processedBitmap.recycle()
            }
            return
        }

        Log.d(TAG, "🚀 ML Kit OCR 처리 시작... (InputImage: ${image.width}x${image.height})")
        
        // 이미지 처리 (비동기)
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                Log.d(TAG, "✅ ML Kit OCR 처리 완료")
                
                // --- ML Kit 인식 결과 상세 로깅 ---
                Log.d(TAG, "========== ML Kit OCR 결과 ==========")
                Log.d(TAG, "전체 인식 텍스트: '${visionText.text}'")
                Log.d(TAG, "전체 텍스트 길이: ${visionText.text.length}")
                Log.d(TAG, "텍스트 블록 개수: ${visionText.textBlocks.size}")
                Log.d(TAG, "-----------------------------------")
                
                // 각 블록별 상세 정보
                visionText.textBlocks.forEachIndexed { blockIndex, block ->
                    val boundingBox = block.boundingBox
                    Log.d(TAG, "블록[$blockIndex]:")
                    Log.d(TAG, "  - 텍스트: '${block.text}'")
                    Log.d(TAG, "  - 텍스트 길이: ${block.text.length}")
                    Log.d(TAG, "  - 좌표: ${boundingBox?.let { "left=${it.left}, top=${it.top}, right=${it.right}, bottom=${it.bottom}" } ?: "null"}")
                    Log.d(TAG, "  - 라인 개수: ${block.lines.size}")
                    Log.d(TAG, "  - 언어: ${block.recognizedLanguage}")

                    // 각 라인별 상세 정보
                    block.lines.forEachIndexed { lineIndex, line ->
                        val lineBox = line.boundingBox
                        Log.d(TAG, "    라인[$lineIndex]:")
                        Log.d(TAG, "      - 텍스트: '${line.text}'")
                        Log.d(TAG, "      - 텍스트 길이: ${line.text.length}")
                        Log.d(TAG, "      - 좌표: ${lineBox?.let { "left=${it.left}, top=${it.top}, right=${it.right}, bottom=${it.bottom}" } ?: "null"}")
                        Log.d(TAG, "      - 요소 개수: ${line.elements.size}")
                        Log.d(TAG, "      - 각도: ${line.angle}")
                        Log.d(TAG, "      - 언어: ${line.recognizedLanguage}")
                        
                        // 각 요소별 상세 정보
                        line.elements.forEachIndexed { elemIndex, element ->
                            val elemBox = element.boundingBox
                            Log.d(TAG, "        요소[$elemIndex]:")
                            Log.d(TAG, "          - 텍스트: '${element.text}'")
                            Log.d(TAG, "          - 텍스트 길이: ${element.text.length}")
                            Log.d(TAG, "          - 좌표: ${elemBox?.let { "left=${it.left}, top=${it.top}, right=${it.right}, bottom=${it.bottom}" } ?: "null"}")
                            Log.d(TAG, "          - 각도: ${element.angle}")
                        }
                    }
                    Log.d(TAG, "  ---")
                }
                Log.d(TAG, "===================================")
                
                // 처리 로직
                val recognizedText = visionText.text.trim()
                
                if (recognizedText.isNotEmpty()) {
                    Log.d(TAG, "✅ 인식 성공: '$recognizedText'")
                    listener.onResult(recognizedText)
                } else {
                    Log.w(TAG, "⚠️ 텍스트를 찾지 못했습니다. (블록 수: ${visionText.textBlocks.size})")
                    if (visionText.textBlocks.isEmpty()) {
                        Log.w(TAG, "⚠️ 텍스트 블록이 하나도 없습니다.")
                        Log.w(TAG, "💡 가능한 원인:")
                        Log.w(TAG, "   1. 이미지에 텍스트가 없음")
                        Log.w(TAG, "   2. 이미지 품질이 너무 낮음")
                        Log.w(TAG, "   3. 전처리 과정에서 이미지 손상")
                        Log.w(TAG, "   → 전처리 없이 테스트해보세요 (skipPreprocessing=true)")
                    } else {
                        Log.w(TAG, "⚠️ 블록은 있지만 텍스트가 비어있습니다.")
                    }
                    listener.onResult(null)
                }
                
                // 전처리된 이미지가 원본과 다르면 메모리 해제
                if (processedBitmap != bitmap && !processedBitmap.isRecycled) {
                    processedBitmap.recycle()
                }
            }
            .addOnFailureListener { e ->
                // --- 인식 실패 ---
                Log.e(TAG, "❌ ML Kit OCR 처리 실패")
                Log.e(TAG, "========== ML Kit OCR 실패 ==========")
                Log.e(TAG, "오류 메시지: ${e.message}")
                Log.e(TAG, "오류 타입: ${e.javaClass.simpleName}")
                Log.e(TAG, "스택 트레이스:", e)
                Log.e(TAG, "===================================")
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

