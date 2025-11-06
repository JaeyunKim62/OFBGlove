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

