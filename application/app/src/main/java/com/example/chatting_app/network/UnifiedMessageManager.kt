package com.example.chatting_app.network

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import kotlinx.coroutines.flow.StateFlow

/**
 * 통합 메시지 매니저 - WiFi와 BLE 통합 관리
 */
class UnifiedMessageManager(private val context: Context) {
    
    private val TAG = "UnifiedMessageManager"
    
    // WiFi 클라이언트
    private val wifiClient = WifiClient(context)
    private val wifiBrailleTransmitter = WifiBrailleTransmitter(wifiClient)
    private val wifiTextTransmitter = WifiTextTransmitter(wifiClient)
    private val wifiSettingsTransmitter = WifiSettingsTransmitter(wifiClient)
    
    // BLE 매니저 (나중에 구현)
    // private val bleManager = BrailleBleManager(context)
    
    // 현재 연결 타입
    private var currentConnectionType = ConnectionType.WIFI
    
    // 연결 상태
    val connectionState: StateFlow<ConnectionState> = wifiClient.connectionState
    
    // 수신된 메시지
    val receivedMessage: StateFlow<WifiMessage?> = wifiClient.receivedMessage
    
    /**
     * 이미지 수신 콜백 설정
     */
    fun setOnImageReceived(callback: (Bitmap) -> Unit) {
        wifiClient.onImageReceived = callback
    }
    
    /**
     * DOT_PATTERN 수신 콜백 설정
     */
    fun setOnDotPatternReceived(callback: (Byte) -> Unit) {
        wifiClient.onDotPatternReceived = callback
    }
    
    /**
     * WiFi 서버에 연결
     */
    fun connectWifi(ipAddress: String, port: Int = 8888) {
        currentConnectionType = ConnectionType.WIFI
        wifiClient.connect(ipAddress, port)
        Log.d(TAG, "Connecting to WiFi: $ipAddress:$port")
    }
    
    /**
     * BLE 디바이스에 연결 (나중에 구현)
     */
    fun connectBle(deviceAddress: String) {
        currentConnectionType = ConnectionType.BLE
        // bleManager.connect(deviceAddress)
        Log.d(TAG, "BLE connection not implemented yet")
    }
    
    /**
     * 연결 해제
     */
    fun disconnect() {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiClient.disconnect()
            ConnectionType.BLE -> {
                // bleManager.disconnect()
            }
        }
        Log.d(TAG, "Disconnected from $currentConnectionType")
    }
    
    /**
     * 점 터치 전송
     */
    fun sendDotTouch(dotIndex: Int) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendDotTouch(dotIndex)
            ConnectionType.BLE -> {
                // bleManager.sendDotTouch(dotIndex)
                Log.d(TAG, "BLE dot touch not implemented yet")
            }
        }
    }
    
    /**
     * 점 릴리즈 전송
     */
    fun sendDotRelease(dotIndex: Int) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendDotRelease(dotIndex)
            ConnectionType.BLE -> {
                // bleManager.sendDotRelease(dotIndex)
                Log.d(TAG, "BLE dot release not implemented yet")
            }
        }
    }
    
    /**
     * 패턴 완성 전송
     */
    fun sendPatternComplete(dots: List<Boolean>) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendPatternComplete(dots)
            ConnectionType.BLE -> {
                // bleManager.sendPatternComplete(dots)
                Log.d(TAG, "BLE pattern complete not implemented yet")
            }
        }
    }
    
    /**
     * 초기화 전송
     */
    fun sendClear() {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendClear()
            ConnectionType.BLE -> {
                // bleManager.sendClear()
                Log.d(TAG, "BLE clear not implemented yet")
            }
        }
    }
    
    /**
     * 단어 구분자 전송 (공백)
     */
    fun sendWordSeparator() {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendWordSeparator()
            ConnectionType.BLE -> {
                // bleManager.sendWordSeparator()
                Log.d(TAG, "BLE word separator not implemented yet")
            }
        }
    }
    
    /**
     * 문장 구분자 전송
     */
    fun sendSentenceSeparator() {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendSentenceSeparator()
            ConnectionType.BLE -> {
                // bleManager.sendSentenceSeparator()
                Log.d(TAG, "BLE sentence separator not implemented yet")
            }
        }
    }
    
    /**
     * 점자 구분자 전송 (개별 점자 모드)
     */
    fun sendBrailleSeparator() {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiBrailleTransmitter.sendBrailleSeparator()
            ConnectionType.BLE -> {
                // bleManager.sendBrailleSeparator()
                Log.d(TAG, "BLE braille separator not implemented yet")
            }
        }
    }
    
    /**
     * 텍스트 메시지 전송
     */
    fun sendTextMessage(text: String, braille: String) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiTextTransmitter.sendTextMessage(text, braille)
            ConnectionType.BLE -> {
                // bleManager.sendTextMessage(text, braille)
                Log.d(TAG, "BLE text message not implemented yet")
            }
        }
    }
    
    /**
     * 긴 텍스트 메시지 전송 (청크 분할)
     */
    fun sendLongTextMessage(text: String, braille: String) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiTextTransmitter.sendLongTextMessage(text, braille)
            ConnectionType.BLE -> {
                // bleManager.sendLongTextMessage(text, braille)
                Log.d(TAG, "BLE long text message not implemented yet")
            }
        }
    }
    
    /**
     * 설정 전송
     */
    fun sendSettings(settings: BrailleSettings) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiSettingsTransmitter.sendSettings(settings)
            ConnectionType.BLE -> {
                // bleManager.sendSettings(settings)
                Log.d(TAG, "BLE settings not implemented yet")
            }
        }
    }
    
    /**
     * 속도 설정 전송
     */
    fun sendSpeed(speed: BrailleSpeed) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiSettingsTransmitter.sendSpeed(speed)
            ConnectionType.BLE -> {
                // bleManager.sendSpeed(speed)
                Log.d(TAG, "BLE speed not implemented yet")
            }
        }
    }
    
    /**
     * 모드 설정 전송
     */
    fun sendMode(mode: BrailleMode) {
        when (currentConnectionType) {
            ConnectionType.WIFI -> wifiSettingsTransmitter.sendMode(mode)
            ConnectionType.BLE -> {
                // bleManager.sendMode(mode)
                Log.d(TAG, "BLE mode not implemented yet")
            }
        }
    }
    
    /**
     * 연결 상태 확인
     */
    fun isConnected(): Boolean {
        return when (currentConnectionType) {
            ConnectionType.WIFI -> wifiClient.isConnected()
            ConnectionType.BLE -> {
                // bleManager.isConnected()
                false
            }
        }
    }
    
    /**
     * 현재 연결 타입 반환
     */
    fun getCurrentConnectionType(): ConnectionType {
        return currentConnectionType
    }
}

/**
 * 연결 타입
 */
enum class ConnectionType {
    WIFI, BLE
}
