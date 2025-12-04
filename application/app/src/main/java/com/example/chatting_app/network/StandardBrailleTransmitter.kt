package com.example.chatting_app.network

import android.util.Log
import com.example.chatting_app.network.interfaces.BrailleTransmitter
import com.example.chatting_app.network.interfaces.CommunicationChannel

/**
 * 표준 점자 전송기 - GATT 호환 프로토콜 사용
 * 모든 통신 방식(WiFi, BLE, WebSocket 등)에서 사용 가능
 */
class StandardBrailleTransmitter(private val channel: CommunicationChannel) : BrailleTransmitter {
    
    private val TAG = "StandardBrailleTransmitter"
    
    /**
     * 점 터치 전송
     */
    override fun sendDotTouch(dotIndex: Int) {
        if (dotIndex !in 0..5) {
            Log.w(TAG, "Invalid dot index: $dotIndex")
            return
        }
        
        val data = byteArrayOf(dotIndex.toByte())
        val packet = WifiMessageProtocol.serializeMessage(MessageType.DOT_PATTERN, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent dot touch: $dotIndex")
    }
    
    /**
     * 점 릴리즈 전송
     */
    override fun sendDotRelease(dotIndex: Int) {
        if (dotIndex !in 0..5) {
            Log.w(TAG, "Invalid dot index: $dotIndex")
            return
        }
        
        val data = byteArrayOf(dotIndex.toByte())
        val packet = WifiMessageProtocol.serializeMessage(MessageType.DOT_RELEASE, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent dot release: $dotIndex")
    }
    
    /**
     * 패턴 완성 전송
     */
    override fun sendPatternComplete(dots: List<Boolean>) {
        if (dots.size != 6) {
            Log.w(TAG, "Invalid dots size: ${dots.size}")
            return
        }
        
        val dotsByte = packBrailleDots(dots)
        val data = byteArrayOf(dotsByte)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.PATTERN_COMPLETE, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent pattern complete: ${dotsToString(dots)}")
    }
    
    /**
     * 초기화 전송
     */
    override fun sendClear() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.CLEAR, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent clear")
    }
    
    /**
     * 단어 구분자 전송 (공백)
     */
    override fun sendWordSeparator() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.WORD_SEPARATOR, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent word separator")
    }
    
    /**
     * 문장 구분자 전송
     */
    override fun sendSentenceSeparator() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.SENTENCE_SEPARATOR, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent sentence separator")
    }
    
    /**
     * 점자 구분자 전송 (개별 점자 모드)
     */
    override fun sendBrailleSeparator() {
        val data = byteArrayOf(0x00)
        val packet = WifiMessageProtocol.serializeMessage(MessageType.BRAILLE_SEPARATOR, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent braille separator")
    }
    
    /**
     * 점자 시퀀스 전송 (BRAILLE_SEQUENCE 0x08)
     * 여러 점자 패턴을 한 번에 전송
     * 
     * @param patterns 점자 패턴 리스트 (각 패턴은 6개 점을 1바이트로 압축된 Byte)
     */
    override fun sendBrailleSequence(patterns: List<Byte>) {
        if (patterns.isEmpty()) {
            Log.w(TAG, "Empty braille sequence")
            return
        }
        
        if (patterns.size > 255) {
            Log.w(TAG, "Braille sequence too long: ${patterns.size} (max 255)")
            return
        }
        
        // 데이터 구조: [패턴 개수(1)][패턴1(1)][패턴2(1)]...[패턴N(1)]
        val data = ByteArray(1 + patterns.size)
        data[0] = patterns.size.toByte()  // 패턴 개수
        
        for (i in patterns.indices) {
            data[1 + i] = patterns[i]  // 각 패턴
        }
        
        val packet = WifiMessageProtocol.serializeMessage(MessageType.BRAILLE_SEQUENCE, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent braille sequence: ${patterns.size} patterns")
    }
    
    /**
     * 6개 점을 1바이트로 압축
     */
    override fun packBrailleDots(dots: List<Boolean>): Byte {
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

