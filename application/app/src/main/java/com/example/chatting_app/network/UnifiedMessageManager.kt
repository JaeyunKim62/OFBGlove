package com.example.chatting_app.network

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.example.chatting_app.network.interfaces.BrailleTransmitter
import com.example.chatting_app.network.interfaces.CommunicationChannel
import com.example.chatting_app.network.interfaces.ConfigTransmitter
import com.example.chatting_app.network.interfaces.SettingsTransmitter
import com.example.chatting_app.network.interfaces.TextTransmitter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 통합 메시지 매니저 - 인터페이스 기반 설계
 * WiFi, BLE 등 다양한 통신 방식을 통합 관리
 */
class UnifiedMessageManager(private val context: Context) {
    
    private val TAG = "UnifiedMessageManager"
    
    // 코루틴 스코프 (ViewModel 외부에서 사용되므로 자체 스코프 필요)
    private val managerScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    
    // 현재 통신 채널 및 전송기들
    private var channel: CommunicationChannel? = null
    private var brailleTransmitter: BrailleTransmitter? = null
    private var textTransmitter: TextTransmitter? = null
    private var settingsTransmitter: SettingsTransmitter? = null
    private var configTransmitter: ConfigTransmitter? = null
    
    // 현재 연결 타입
    private var currentConnectionType: ConnectionType? = null
    
    // 자체 상태 관리 (채널이 null일 때도 접근 가능)
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()
    
    private val _receivedMessage = MutableStateFlow<WifiMessage?>(null)
    val receivedMessage: StateFlow<WifiMessage?> = _receivedMessage.asStateFlow()
    
    /**
     * 이미지 수신 콜백 설정
     */
    fun setOnImageReceived(callback: (Bitmap) -> Unit) {
        channel?.setOnImageReceived(callback)
    }
    
    /**
     * DOT_PATTERN 수신 콜백 설정
     */
    fun setOnDotPatternReceived(callback: (Byte) -> Unit) {
        channel?.setOnDotPatternReceived(callback)
    }
    
    /**
     * WiFi 서버에 연결
     */
    fun connectWifi(ipAddress: String, port: Int = 8888) {
        Log.d(TAG, "Connecting to WiFi: $ipAddress:$port")
        
        // WiFi 채널 생성
        val wifiChannel = WifiCommunicationChannel(context, ipAddress, port)
        channel = wifiChannel
        
        // 전송기들 초기화
        initializeTransmitters(wifiChannel)
        
        // 연결 타입 설정
        currentConnectionType = ConnectionType.WIFI
        
        // 채널의 상태를 미러링
        mirrorChannelState(wifiChannel)
        
        // 연결 시작
        wifiChannel.connect()
    }
    
    /**
     * BLE 디바이스에 연결 (미구현)
     * TODO: BLE 구현 시 BleCommunicationChannel 사용
     */
    fun connectBle(deviceAddress: String) {
        Log.w(TAG, "BLE connection not implemented yet: $deviceAddress")
        _connectionState.value = ConnectionState.ERROR
        
        // TODO: BLE 구현 예시
        // val bleChannel = BleCommunicationChannel(context, deviceAddress)
        // channel = bleChannel
        // initializeTransmitters(bleChannel)
        // currentConnectionType = ConnectionType.BLE
        // mirrorChannelState(bleChannel)
        // bleChannel.connect()
    }
    
    /**
     * 전송기들 초기화
     */
    private fun initializeTransmitters(communicationChannel: CommunicationChannel) {
        brailleTransmitter = StandardBrailleTransmitter(communicationChannel)
        textTransmitter = StandardTextTransmitter(communicationChannel)
        settingsTransmitter = StandardSettingsTransmitter(communicationChannel)
        configTransmitter = StandardConfigTransmitter(communicationChannel)
    }
    
    /**
     * 채널의 상태를 UnifiedMessageManager의 StateFlow로 미러링
     */
    private fun mirrorChannelState(communicationChannel: CommunicationChannel) {
        // 연결 상태 미러링
        managerScope.launch {
            communicationChannel.connectionState.collect { state ->
                _connectionState.value = state
            }
        }
        
        // 수신 메시지 미러링
        managerScope.launch {
            communicationChannel.receivedMessage.collect { message ->
                _receivedMessage.value = message
            }
        }
    }
    
    /**
     * 연결 해제
     */
    fun disconnect() {
        channel?.disconnect()
        _connectionState.value = ConnectionState.DISCONNECTED
        Log.d(TAG, "Disconnected from ${currentConnectionType ?: "Unknown"}")
    }
    
    /**
     * 리소스 정리 (ViewModel onCleared 등에서 호출)
     */
    fun cleanup() {
        disconnect()
        // 코루틴 스코프는 SupervisorJob이므로 자동으로 정리됨
    }
    
    // ========== 점자 전송 메서드 (BrailleTransmitter로 위임) ==========
    
    /**
     * 점 터치 전송
     */
    fun sendDotTouch(dotIndex: Int) {
        brailleTransmitter?.sendDotTouch(dotIndex)
    }
    
    /**
     * 점 릴리즈 전송
     */
    fun sendDotRelease(dotIndex: Int) {
        brailleTransmitter?.sendDotRelease(dotIndex)
    }
    
    /**
     * 패턴 완성 전송
     */
    fun sendPatternComplete(dots: List<Boolean>) {
        brailleTransmitter?.sendPatternComplete(dots)
    }
    
    /**
     * 초기화 전송
     */
    fun sendClear() {
        brailleTransmitter?.sendClear()
    }
    
    /**
     * 단어 구분자 전송 (공백)
     */
    fun sendWordSeparator() {
        brailleTransmitter?.sendWordSeparator()
    }
    
    /**
     * 문장 구분자 전송
     */
    fun sendSentenceSeparator() {
        brailleTransmitter?.sendSentenceSeparator()
    }
    
    /**
     * 점자 구분자 전송 (개별 점자 모드)
     */
    fun sendBrailleSeparator() {
        brailleTransmitter?.sendBrailleSeparator()
    }
    
    /**
     * 점자 시퀀스 전송
     */
    fun sendBrailleSequence(patterns: List<Byte>) {
        brailleTransmitter?.sendBrailleSequence(patterns)
    }
    
    // ========== 텍스트 전송 메서드 (TextTransmitter로 위임) ==========
    
    /**
     * 텍스트 메시지 전송
     */
    fun sendTextMessage(text: String, braille: String) {
        textTransmitter?.sendTextMessage(text, braille)
    }
    
    /**
     * 긴 텍스트 메시지 전송 (청크 분할)
     */
    fun sendLongTextMessage(text: String, braille: String) {
        textTransmitter?.sendLongTextMessage(text, braille)
    }
    
    // ========== 설정 전송 메서드 (SettingsTransmitter로 위임) ==========
    
    /**
     * 설정 전송
     */
    fun sendSettings(settings: BrailleSettings) {
        settingsTransmitter?.sendSettings(settings)
    }
    
    /**
     * 속도 설정 전송
     */
    fun sendSpeed(speed: BrailleSpeed) {
        settingsTransmitter?.sendSpeed(speed)
    }
    
    /**
     * 모드 설정 전송
     */
    fun sendMode(mode: BrailleMode) {
        settingsTransmitter?.sendMode(mode)
    }
    
    // ========== 구성 전송 메서드 (ConfigTransmitter로 위임) ==========
    
    /**
     * waveformId 설정 전송 (MSG_CONFIG_SET)
     */
    fun sendWaveformId(waveformId: Int) {
        configTransmitter?.sendWaveformId(waveformId)
    }
    
    /**
     * holdDuration 설정 전송 (MSG_CONFIG_SET)
     */
    fun sendHoldDuration(holdDuration: Int) {
        configTransmitter?.sendHoldDuration(holdDuration)
    }
    
    /**
     * waveformId와 holdDuration을 함께 전송 (MSG_CONFIG_SET)
     */
    fun sendWaveformIdAndHoldDuration(waveformId: Int, holdDuration: Int) {
        configTransmitter?.sendWaveformIdAndHoldDuration(waveformId, holdDuration)
    }
    
    // ========== 상태 확인 메서드 ==========
    
    /**
     * 연결 상태 확인
     */
    fun isConnected(): Boolean {
        return channel?.isConnected() ?: false
    }
    
    /**
     * 현재 연결 타입 반환
     */
    fun getCurrentConnectionType(): ConnectionType? {
        return currentConnectionType
    }
    
    /**
     * 디버그 정보 반환
     */
    fun getDebugInfo(): String {
        return channel?.getDebugInfo() ?: "No channel connected"
    }
}
