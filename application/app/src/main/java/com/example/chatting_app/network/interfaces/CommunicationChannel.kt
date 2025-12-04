package com.example.chatting_app.network.interfaces

import android.graphics.Bitmap
import com.example.chatting_app.network.ConnectionState
import com.example.chatting_app.network.WifiMessage
import kotlinx.coroutines.flow.StateFlow

/**
 * 통신 채널 인터페이스
 * WiFi, BLE 등 다양한 통신 방식을 추상화하여 일관된 인터페이스 제공
 */
interface CommunicationChannel {
    
    /**
     * 연결 상태 Flow
     */
    val connectionState: StateFlow<ConnectionState>
    
    /**
     * 수신된 메시지 Flow
     */
    val receivedMessage: StateFlow<WifiMessage?>
    
    /**
     * 이미지 수신 콜백 설정
     */
    fun setOnImageReceived(callback: (Bitmap) -> Unit)
    
    /**
     * DOT_PATTERN 수신 콜백 설정
     */
    fun setOnDotPatternReceived(callback: (Byte) -> Unit)
    
    /**
     * 연결
     */
    fun connect()
    
    /**
     * 연결 해제
     */
    fun disconnect()
    
    /**
     * 데이터 전송
     * @param data 전송할 바이트 배열
     */
    fun send(data: ByteArray)
    
    /**
     * 연결 상태 확인
     * @return 연결되어 있으면 true, 아니면 false
     */
    fun isConnected(): Boolean
    
    /**
     * 디버그 정보 반환
     * @return 디버그 정보 문자열
     */
    fun getDebugInfo(): String
}

