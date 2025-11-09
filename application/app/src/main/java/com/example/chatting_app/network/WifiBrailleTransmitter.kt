package com.example.chatting_app.network

import android.util.Log

/**
 * WiFi 점자 전송기 - GATT 호환
 */
class WifiBrailleTransmitter(private val wifiClient: WifiClient) {
    
    private val TAG = "WifiBrailleTransmitter"
    
    /**
     * 점 터치 전송
     */
    fun sendDotTouch(dotIndex: Int) {
        if (dotIndex !in 0..5) {
            Log.w(TAG, "Invalid dot index: $dotIndex")
            return
        }
        
        val data = byteArrayOf(dotIndex.toByte())
        val packet = WifiMessageProtocol.serializeMessage(MessageType.DOT_PATTERN, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent dot touch: $dotIndex")
    }
    
    /**
     * 점 릴리즈 전송
     */
    fun sendDotRelease(dotIndex: Int) {
        if (dotIndex !in 0..5) {
            Log.w(TAG, "Invalid dot index: $dotIndex")
            return
        }
        
        val data = byteArrayOf(dotIndex.toByte())
        val packet = WifiMessageProtocol.serializeMessage(MessageType.DOT_RELEASE, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent dot release: $dotIndex")
    }
    
    /**
     * 패턴 완성 전송
     */
    fun sendPatternComplete(dots: List<Boolean>) {
        if (dots.size != 6) {
            Log.w(TAG, "Invalid dots size: ${dots.size}")
            return
        }
        
        val dotsByte = packBrailleDots(dots)
        val data = byteArrayOf(dotsByte)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.PATTERN_COMPLETE, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent pattern complete: ${dotsToString(dots)}")
    }
    
    /**
     * 초기화 전송
     */
    fun sendClear() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.CLEAR, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent clear")
    }
    
    /**
     * 단어 구분자 전송 (공백)
     */
    fun sendWordSeparator() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.WORD_SEPARATOR, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent word separator")
    }
    
    /**
     * 문장 구분자 전송
     */
    fun sendSentenceSeparator() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.SENTENCE_SEPARATOR, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent sentence separator")
    }
    
    /**
     * 점자 구분자 전송 (개별 점자 모드)
     */
    fun sendBrailleSeparator() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.BRAILLE_SEPARATOR, data)
        wifiClient.send(packet)
        
        Log.d(TAG, "Sent braille separator")
    }
    
    /**
     * 6개 점을 1바이트로 압축
     */
    private fun packBrailleDots(dots: List<Boolean>): Byte {
        var result: Int = 0
        dots.forEachIndexed { index, isActive ->
            if (isActive) {
                result = result or (1 shl index)
            }
        }
        return result.toByte()
    }
    
    /**
     * 점 상태를 문자열로 변환 (디버깅용)
     */
    private fun dotsToString(dots: List<Boolean>): String {
        return dots.map { if (it) "1" else "0" }.joinToString("")
    }
}
