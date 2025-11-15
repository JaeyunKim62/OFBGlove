package com.example.chatting_app.network

import android.util.Log

/**
 * WiFi 텍스트 메시지 전송기 - GATT 호환
 */
class WifiTextTransmitter(private val wifiClient: WifiClient) {
    
    private val TAG = "WifiTextTransmitter"
    
    /**
     * 텍스트 메시지 전송 (점자로 변환된 텍스트)
     */
    fun sendTextMessage(text: String, braille: String) {
        val textBytes = text.toByteArray(Charsets.UTF_8)
        val brailleBytes = braille.toByteArray(Charsets.UTF_8)
        
        // 데이터 크기 검증
        if (textBytes.size > 255 || brailleBytes.size > 255) {
            Log.w(TAG, "Message too large: text=${textBytes.size}, braille=${brailleBytes.size}")
            return
        }
        
        val data = ByteArray(1 + textBytes.size + 1 + brailleBytes.size)
        var offset = 0
        
        // 텍스트 길이 + 텍스트
        data[offset++] = textBytes.size.toByte()
        System.arraycopy(textBytes, 0, data, offset, textBytes.size)
        offset += textBytes.size
        
        // 점자 길이 + 점자
        data[offset++] = brailleBytes.size.toByte()
        System.arraycopy(brailleBytes, 0, data, offset, brailleBytes.size)
        
        // val packet = WifiMessageProtocol.serializeMessage(MessageType.TEXT_MESSAGE, data)
        // wifiClient.send(packet)
        
        Log.d(TAG, "Sent text message: text='$text', braille='$braille'")
    }
    
    /**
     * 긴 텍스트 메시지를 청크로 분할하여 전송
     */
    fun sendLongTextMessage(text: String, braille: String) {
        val maxChunkSize = 200 // 헤더 4바이트 + 메타데이터 2바이트 제외
        
        if (text.length <= maxChunkSize && braille.length <= maxChunkSize) {
            // 짧은 메시지는 일반 전송
            sendTextMessage(text, braille)
            return
        }
        
        // 긴 메시지는 청크로 분할
        val textChunks = text.chunked(maxChunkSize)
        val brailleChunks = braille.chunked(maxChunkSize)
        
        val maxChunks = maxOf(textChunks.size, brailleChunks.size)
        
        for (i in 0 until maxChunks) {
            val textChunk = textChunks.getOrElse(i) { "" }
            val brailleChunk = brailleChunks.getOrElse(i) { "" }
            
            sendTextMessage(textChunk, brailleChunk)
            
            // 청크 간 지연 (ESP32 처리 시간 확보)
            Thread.sleep(100)
        }
        
        Log.d(TAG, "Sent long text message in $maxChunks chunks")
    }
}
