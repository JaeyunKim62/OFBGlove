package com.example.chatting_app.network

import android.util.Log

/**
 * WiFi 메시지 프로토콜 - GATT 호환
 */
object WifiMessageProtocol {
    
    private const val TAG = "WifiMessageProtocol"
    
    /**
     * 메시지 직렬화
     */
    fun serializeMessage(messageType: MessageType, data: ByteArray): ByteArray {
        val header = MessageHeader(
            messageType = messageType.value.toByte(),
            dataLength = data.size.toShort(),
            checksum = calculateChecksum(data)
        )
        
        val packet = ByteArray(4 + data.size)
        var offset = 0
        
        // 헤더 추가 (Little Endian)
        packet[offset++] = header.messageType
        val lengthBytes = header.dataLength.toByteArray()
        packet[offset++] = lengthBytes[0]  // LSB
        packet[offset++] = lengthBytes[1]  // MSB
        packet[offset++] = header.checksum
        
        // 데이터 추가
        System.arraycopy(data, 0, packet, offset, data.size)
        
        Log.d(TAG, "Serialized message: type=${messageType.name}, size=${packet.size}")
        return packet
    }
    
    /**
     * 메시지 역직렬화
     */
    fun deserializeMessage(packet: ByteArray): WifiMessage? {
        if (packet.size < 4) {
            Log.w(TAG, "Packet too small: ${packet.size}")
            return null
        }
        
        val header = MessageHeader(
            messageType = packet[0],
            dataLength = (((packet[2].toInt() and 0xFF) shl 8) or (packet[1].toInt() and 0xFF)).toShort(),
            checksum = packet[3]
        )
        
        if (packet.size < 4 + header.dataLength) {
            Log.w(TAG, "Packet incomplete: ${packet.size} < ${4 + header.dataLength}")
            return null
        }
        
        val data = packet.sliceArray(4 until 4 + header.dataLength)
        
        // 체크섬 검증
        if (calculateChecksum(data) != header.checksum) {
            Log.w(TAG, "Checksum mismatch")
            return null
        }
        
        val messageType = MessageType.values().find { it.value == header.messageType.toInt() }
        Log.d(TAG, "Deserialized message: type=${messageType?.name}, size=${data.size}")
        
        return WifiMessage(messageType, data)
    }
    
    /**
     * 체크섬 계산 (XOR)
     */
    private fun calculateChecksum(data: ByteArray): Byte {
        var checksum = 0
        for (byte in data) {
            checksum = checksum xor (byte.toInt() and 0xFF)
        }
        return checksum.toByte()
    }
    
    /**
     * Short를 Little Endian 바이트 배열로 변환
     */
    private fun Short.toByteArray(): ByteArray {
        return byteArrayOf(
            (this.toInt() and 0xFF).toByte(),        // LSB
            ((this.toInt() shr 8) and 0xFF).toByte()  // MSB
        )
    }
}

/**
 * 메시지 헤더 (4바이트)
 */
data class MessageHeader(
    val messageType: Byte,    // 메시지 타입 (1바이트)
    val dataLength: Short,    // 데이터 길이 (2바이트) - Little Endian
    val checksum: Byte        // 체크섬 (1바이트)
)

/**
 * 메시지 타입 정의 (GATT와 동일)
 * 송신(앱→ESP32)과 수신(ESP32→앱) 메시지를 구분
 */
enum class MessageType(val value: Int) {
    // 송신 메시지 (앱 → ESP32)
    DOT_PATTERN(0x01),        // 점자 패턴 입력 (하나씩) - 웹에서 수신 시 사용
    DOT_RELEASE(0x02),        // 점 릴리즈
    PATTERN_COMPLETE(0x03),   // 패턴 완성
    CLEAR(0x04),              // 초기화
    WORD_SEPARATOR(0x05),     // 단어 구분자 (공백)
    SENTENCE_SEPARATOR(0x06), // 문장 구분자
    BRAILLE_SEPARATOR(0x07),  // 점자 구분자 (개별 점자 모드)
    TEXT_MESSAGE(0x10),       // 텍스트 메시지
    SETTINGS(0x20),           // 설정
    
    // 수신 메시지 (ESP32 → 앱)
    STATUS_UPDATE(0x81),      // 상태 업데이트 (0x80 + 0x01)
    MESSAGE_RECEIVED(0x82),   // 메시지 수신 확인 (0x80 + 0x02)
    SETTINGS_UPDATED(0x83),   // 설정 업데이트 확인 (0x80 + 0x03)
    
    // 이미지 데이터 (웹 → 앱)
    IMAGE_DATA(0x30)          // 이미지 데이터
}
