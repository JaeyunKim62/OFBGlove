package com.example.chatting_app.network

import android.util.Log
import com.example.chatting_app.network.interfaces.SettingsTransmitter
import com.example.chatting_app.network.interfaces.CommunicationChannel

/**
 * 표준 설정 전송기 - GATT 호환 프로토콜 사용
 * 모든 통신 방식(WiFi, BLE, WebSocket 등)에서 사용 가능
 */
class StandardSettingsTransmitter(private val channel: CommunicationChannel) : SettingsTransmitter {
    
    private val TAG = "StandardSettingsTransmitter"
    
    /**
     * 설정 전송
     */
    override fun sendSettings(settings: BrailleSettings) {
        val data = ByteArray(3)
        data[0] = settings.speed.value
        data[1] = settings.mode.value
        data[2] = settings.flags
        
        val packet = WifiMessageProtocol.serializeMessage(MessageType.SETTINGS, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent settings: speed=${settings.speed.name}, mode=${settings.mode.name}")
    }
    
    /**
     * 속도 설정만 전송
     */
    override fun sendSpeed(speed: BrailleSpeed) {
        val settings = BrailleSettings(speed = speed, mode = BrailleMode.AUTO)
        sendSettings(settings)
    }
    
    /**
     * 모드 설정만 전송
     */
    override fun sendMode(mode: BrailleMode) {
        val settings = BrailleSettings(speed = BrailleSpeed.NORMAL, mode = mode)
        sendSettings(settings)
    }
    
    /**
     * 플래그 설정만 전송
     */
    override fun sendFlags(flags: Byte) {
        val settings = BrailleSettings(
            speed = BrailleSpeed.NORMAL,
            mode = BrailleMode.AUTO,
            flags = flags
        )
        sendSettings(settings)
    }
}

/**
 * 점자 설정
 */
data class BrailleSettings(
    val speed: BrailleSpeed,
    val mode: BrailleMode,
    val flags: Byte = 0x00
)

/**
 * 점자 속도
 */
enum class BrailleSpeed(val value: Byte) {
    SLOW(0),      // 느리게 (2초)
    NORMAL(1),    // 보통 (1초)
    FAST(2)       // 빠르게 (0.5초)
}

/**
 * 점자 모드
 */
enum class BrailleMode(val value: Byte) {
    AUTO(0),      // 자동 모드
    MANUAL(1),    // 수동 모드
    REPEAT(2)     // 다시듣기 모드
}

