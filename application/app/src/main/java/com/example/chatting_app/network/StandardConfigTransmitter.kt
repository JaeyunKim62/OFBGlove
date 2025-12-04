package com.example.chatting_app.network

import android.util.Log
import com.example.chatting_app.network.interfaces.ConfigTransmitter
import com.example.chatting_app.network.interfaces.CommunicationChannel

/**
 * 표준 하드웨어 구성 전송기 - MSG_CONFIG_SET (0x0A) 사용
 * 모든 통신 방식(WiFi, BLE, WebSocket 등)에서 사용 가능
 */
class StandardConfigTransmitter(private val channel: CommunicationChannel) : ConfigTransmitter {
    
    private val TAG = "StandardConfigTransmitter"
    
    /**
     * waveformId 설정 전송
     * @param waveformId 진동 패턴 ID (0-255)
     */
    override fun sendWaveformId(waveformId: Int) {
        if (waveformId < 0 || waveformId > 255) {
            Log.w(TAG, "Invalid waveformId: $waveformId (must be 0-255)")
            return
        }
        
        // 파라미터 타입 0x01 = waveformId
        val data = byteArrayOf(0x01, waveformId.toByte())
        val packet = WifiMessageProtocol.serializeMessage(MessageType.MSG_CONFIG_SET, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent waveformId: $waveformId")
    }
    
    /**
     * holdDuration 설정 전송 (전체 설정 사용)
     * ESP32에서는 holdDuration이 전체 설정(0x05)에만 포함되어 있으므로,
     * 기본값을 사용하여 전체 설정으로 전송
     * @param holdDuration 점자 패턴 유지 시간 (ms, 0-65535)
     */
    override fun sendHoldDuration(holdDuration: Int) {
        if (holdDuration < 0 || holdDuration > 65535) {
            Log.w(TAG, "Invalid holdDuration: $holdDuration (must be 0-65535)")
            return
        }
        
        // 파라미터 타입 0x05 = 전체 설정
        // 데이터 구조: [0x05][waveformId][patternLength][holdDuration_LSB][holdDuration_MSB]
        //              [intervalDuration_LSB][intervalDuration_MSB][intensity][speed][mode][flags]
        // 기본값 사용: waveformId=47, patternLength=1, intervalDuration=200, intensity=100, speed=1, mode=0, flags=0
        val data = byteArrayOf(
            0x05,  // 파라미터 타입 = 전체 설정
            47,    // waveformId (기본값)
            1,     // patternLength (기본값)
            (holdDuration and 0xFF).toByte(),        // holdDuration LSB
            ((holdDuration shr 8) and 0xFF).toByte(), // holdDuration MSB
            (200 and 0xFF).toByte(),    // intervalDuration LSB (기본값 200)
            ((200 shr 8) and 0xFF).toByte(), // intervalDuration MSB
            100,   // intensity (기본값)
            1,     // speed (기본값 NORMAL)
            0,     // mode (기본값 NORMAL)
            0x00   // flags
        )
        val packet = WifiMessageProtocol.serializeMessage(MessageType.MSG_CONFIG_SET, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent holdDuration: $holdDuration ms (via full config)")
    }
    
    /**
     * waveformId와 holdDuration을 함께 전송
     * @param waveformId 진동 패턴 ID (0-255)
     * @param holdDuration 점자 패턴 유지 시간 (ms, 0-65535)
     */
    override fun sendWaveformIdAndHoldDuration(waveformId: Int, holdDuration: Int) {
        if (waveformId < 0 || waveformId > 255) {
            Log.w(TAG, "Invalid waveformId: $waveformId (must be 0-255)")
            return
        }
        if (holdDuration < 0 || holdDuration > 65535) {
            Log.w(TAG, "Invalid holdDuration: $holdDuration (must be 0-65535)")
            return
        }
        
        // waveformId를 먼저 전송
        sendWaveformId(waveformId)
        
        // holdDuration은 전체 설정으로 전송 (기본값 사용)
        sendHoldDuration(holdDuration)
        
        Log.d(TAG, "Sent waveformId: $waveformId, holdDuration: $holdDuration ms")
    }
    
    /**
     * dotMode 설정 전송 (진동 방식)
     * @param dotMode 0=CELL(동시 진동), 1=DOT_BY_DOT(순차 진동)
     */
    override fun sendDotMode(dotMode: Int) {
        if (dotMode < 0 || dotMode > 1) {
            Log.w(TAG, "Invalid dotMode: $dotMode (must be 0 or 1)")
            return
        }
        
        // 파라미터 타입 0x06 = dotMode
        val data = byteArrayOf(0x06, dotMode.toByte())
        val packet = WifiMessageProtocol.serializeMessage(MessageType.MSG_CONFIG_SET, data)
        channel.send(packet)
        
        val modeName = if (dotMode == 0) "CELL(동시)" else "DOT_BY_DOT(순차)"
        Log.d(TAG, "Sent dotMode: $dotMode ($modeName)")
    }
    
    /**
     * dotInterval 설정 전송 (순차 진동 시 점 간 간격)
     * @param dotInterval 점 간 간격 (ms, 0-65535)
     */
    override fun sendDotInterval(dotInterval: Int) {
        if (dotInterval < 0 || dotInterval > 65535) {
            Log.w(TAG, "Invalid dotInterval: $dotInterval (must be 0-65535)")
            return
        }
        
        // 파라미터 타입 0x07 = dotInterval
        val data = byteArrayOf(
            0x07,
            (dotInterval and 0xFF).toByte(),        // LSB
            ((dotInterval shr 8) and 0xFF).toByte() // MSB
        )
        val packet = WifiMessageProtocol.serializeMessage(MessageType.MSG_CONFIG_SET, data)
        channel.send(packet)
        
        Log.d(TAG, "Sent dotInterval: $dotInterval ms")
    }
}

