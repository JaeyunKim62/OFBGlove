package com.example.chatting_app.network

import android.content.Context
import android.graphics.Bitmap
import com.example.chatting_app.network.interfaces.CommunicationChannel
import kotlinx.coroutines.flow.StateFlow

/**
 * WiFi 통신 채널 구현체
 * WifiClient를 래핑하여 CommunicationChannel 인터페이스를 구현
 */
class WifiCommunicationChannel(
    private val context: Context,
    private val ipAddress: String,
    private val port: Int = 8888
) : CommunicationChannel {
    
    private val wifiClient = WifiClient(context)
    
    /**
     * 연결 상태 Flow (WifiClient로 위임)
     */
    override val connectionState: StateFlow<ConnectionState>
        get() = wifiClient.connectionState
    
    /**
     * 수신된 메시지 Flow (WifiClient로 위임)
     */
    override val receivedMessage: StateFlow<WifiMessage?>
        get() = wifiClient.receivedMessage
    
    /**
     * 이미지 수신 콜백 설정 (WifiClient로 위임)
     */
    override fun setOnImageReceived(callback: (Bitmap) -> Unit) {
        wifiClient.onImageReceived = callback
    }
    
    /**
     * DOT_PATTERN 수신 콜백 설정 (WifiClient로 위임)
     */
    override fun setOnDotPatternReceived(callback: (Byte) -> Unit) {
        wifiClient.onDotPatternReceived = callback
    }
    
    /**
     * WiFi 서버에 연결
     */
    override fun connect() {
        wifiClient.connect(ipAddress, port)
    }
    
    /**
     * 연결 해제
     */
    override fun disconnect() {
        wifiClient.disconnect()
    }
    
    /**
     * 데이터 전송 (WifiClient로 위임)
     */
    override fun send(data: ByteArray) {
        wifiClient.send(data)
    }
    
    /**
     * 연결 상태 확인 (WifiClient로 위임)
     */
    override fun isConnected(): Boolean {
        return wifiClient.isConnected()
    }
    
    /**
     * 디버그 정보 반환 (WifiClient로 위임)
     */
    override fun getDebugInfo(): String {
        return wifiClient.getDebugInfo()
    }
}