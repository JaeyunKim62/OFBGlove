package com.example.chatting_app

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.content.ContextCompat
import android.Manifest
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Job
import java.util.Locale
import com.example.chatting_app.network.UnifiedMessageManager
import com.example.chatting_app.network.WifiMessage
import com.example.chatting_app.network.MessageType
import com.example.chatting_app.network.WifiBrailleTransmitter
import com.example.chatting_app.network.WifiTextTransmitter
import com.example.chatting_app.network.WifiSettingsTransmitter
import com.example.chatting_app.ocr.TextRecognizerManager
import com.example.chatting_app.ocr.OcrResultListener
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import com.example.chatting_app.R

/**
 * ViewModel for managing chat functionality including speech recognition and text-to-speech
 */
class ChatViewModel : ViewModel() {
    
    // State flows for UI state management
    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()
    
    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()
    
    private val _isTtsReady = MutableStateFlow(false)
    val isTtsReady: StateFlow<Boolean> = _isTtsReady.asStateFlow()
    
    // Permission state
    private val _hasRecordAudioPermission = MutableStateFlow(false)
    val hasRecordAudioPermission: StateFlow<Boolean> = _hasRecordAudioPermission.asStateFlow()
    
    // STT Processing state
    private val _sttStatus = MutableStateFlow<SttStatus>(SttStatus.Idle)
    val sttStatus: StateFlow<SttStatus> = _sttStatus.asStateFlow()
    
    // Pending recognized text (before sending)
    private val _pendingRecognizedText = MutableStateFlow<String?>(null)
    val pendingRecognizedText: StateFlow<String?> = _pendingRecognizedText.asStateFlow()
    
    // Speech recognition and TTS instances
    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    
    // Braille converter
    private var brailleConverter: BrailleConverter? = null
    
    // Braille input manager
    private var brailleInputManager: BrailleInputManager? = null
    
    // Stable braille input state exposed to UI (does not change reference)
    private val _brailleInputState = MutableStateFlow(BrailleInputState())
    val brailleInputState: StateFlow<BrailleInputState> = _brailleInputState.asStateFlow()
    
    // Job to mirror manager's state into ViewModel's stable flow
    private var brailleInputCollectorJob: Job? = null
    
    // Unified message manager
    private var messageManager: UnifiedMessageManager? = null
    
    // OCR manager for 필담 이미지 인식
    private val textRecognizerManager = TextRecognizerManager()
    
    // WiFi transmitters (UnifiedMessageManager에서 가져옴)
    private var wifiBrailleTransmitter: WifiBrailleTransmitter? = null
    private var wifiTextTransmitter: WifiTextTransmitter? = null
    private var wifiSettingsTransmitter: WifiSettingsTransmitter? = null
    
    // WiFi connection state
    private val _isWifiConnected = MutableStateFlow(false)
    val isWifiConnected: StateFlow<Boolean> = _isWifiConnected.asStateFlow()
    
    private val _wifiConnectionStatus = MutableStateFlow("연결 안됨")
    val wifiConnectionStatus: StateFlow<String> = _wifiConnectionStatus.asStateFlow()
    
    // 전송 모드 (패턴 모드 vs 개별 점 모드)
    private val _transmissionMode = MutableStateFlow(TransmissionMode.PATTERN)
    val transmissionMode: StateFlow<TransmissionMode> = _transmissionMode.asStateFlow()
    
    private val _localIpAddress = MutableStateFlow<String?>(null)
    val localIpAddress: StateFlow<String?> = _localIpAddress.asStateFlow()
    
    // Saved IP address
    private val _savedIpAddress = MutableStateFlow<String>(DEFAULT_IP)
    val savedIpAddress: StateFlow<String> = _savedIpAddress.asStateFlow()
    
    // Application context for SharedPreferences
    private var appContext: Context? = null
    
    // SharedPreferences key for saved IP address
    companion object {
        private const val PREF_NAME = "wifi_prefs"
        private const val KEY_SAVED_IP = "saved_ip_address"
        private const val DEFAULT_IP = "172.20.100.65"
    }
    
    /**
     * Initialize application context for SharedPreferences
     */
    fun initializeContext(context: Context) {
        appContext = context.applicationContext
        // Load saved IP address on initialization
        _savedIpAddress.value = getSavedIpAddress()
    }
    
    /**
     * Get saved IP address, or default if not saved
     */
    fun getSavedIpAddress(): String {
        val context = appContext ?: return DEFAULT_IP
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_SAVED_IP, DEFAULT_IP) ?: DEFAULT_IP
    }
    
    /**
     * Save IP address
     */
    fun saveIpAddress(ipAddress: String) {
        val context = appContext ?: return
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_SAVED_IP, ipAddress).apply()
        _savedIpAddress.value = ipAddress
        Log.d("ChatViewModel", "IP 주소 저장됨: $ipAddress")
    }
    
    /**
     * Check if RECORD_AUDIO permission is granted
     */
    fun hasRecordAudioPermission(context: Context): Boolean {
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        
        _hasRecordAudioPermission.value = hasPermission
        return hasPermission
    }
    
    /**
     * Called when permission is granted
     */
    fun onPermissionGranted() {
        _hasRecordAudioPermission.value = true
    }
    
    /**
     * Called when permission is denied
     */
    fun onPermissionDenied() {
        _hasRecordAudioPermission.value = false
        // TODO: Show user-friendly message about permission being required
    }
    
    /**
     * Initialize speech recognition and TTS engines
     */
    fun initializeSpeechEngines(context: Context) {
        initializeSpeechRecognizer(context)
        initializeTextToSpeech(context)
        initializeBrailleConverter(context)
        initializeBrailleInputManager(context)
        initializeMessageManager(context)
        
        // Add some sample messages to demonstrate the app
        addSampleMessages()
    }
    
    /**
     * Initialize speech recognition engine with STT processing
     */
    private fun initializeSpeechRecognizer(context: Context) {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    // STT Processing: Speech recognition is ready to listen
                    _sttStatus.value = SttStatus.Ready
                }
                
                override fun onBeginningOfSpeech() {
                    // STT Processing: User started speaking
                    _sttStatus.value = SttStatus.Listening
                }
                
                override fun onRmsChanged(rmsdB: Float) {
                    // STT Processing: Audio level changed (can be used for visual feedback)
                    // This provides real-time audio input level for UI feedback
                }
                
                override fun onBufferReceived(buffer: ByteArray?) {
                    // STT Processing: Audio buffer received
                    // This is where the actual audio data is being processed
                }
                
                override fun onEndOfSpeech() {
                    // STT Processing: User stopped speaking, processing results
                    _sttStatus.value = SttStatus.Processing
                    _isListening.value = false
                }
                
                override fun onError(error: Int) {
                    // STT Processing: Handle speech recognition errors
                    _isListening.value = false
                    _sttStatus.value = SttStatus.Error(getSttErrorMessage(error))
                    
                    // Auto-retry for certain errors
                    when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH,
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                            // These are common errors, could retry automatically
                            // For now, just reset to idle state
                            _sttStatus.value = SttStatus.Idle
                        }
                        else -> {
                            // For other errors, stay in error state
                        }
                    }
                }
                
                override fun onResults(results: Bundle?) {
                    // STT Processing: Speech recognition results received
                    _sttStatus.value = SttStatus.Processing
                    
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val recognizedText = matches[0]
                        
                        // Process the recognized text
                        processRecognizedText(recognizedText)
                        
                        _sttStatus.value = SttStatus.Success
                    } else {
                        _sttStatus.value = SttStatus.Error("No speech recognized")
                    }
                    
                    _isListening.value = false
                }
                
                override fun onPartialResults(partialResults: Bundle?) {
                    // STT Processing: Partial results (real-time feedback)
                    val partialMatches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!partialMatches.isNullOrEmpty()) {
                        // Could show partial results in UI for real-time feedback
                        // For now, just log or could update a partial result state
                        // partialText is available but not used in current implementation
                    }
                }
                
                override fun onEvent(eventType: Int, params: Bundle?) {
                    // STT Processing: Speech recognition events
                    // These events are not commonly used in most implementations
                }
            })
        } else {
            _sttStatus.value = SttStatus.Error("Speech recognition not available on this device")
        }
    }
    
    /**
     * Initialize braille converter
     */
    private fun initializeBrailleConverter(context: Context) {
        try {
            Log.d("ChatViewModel", "점자 변환기 초기화 시작")
            brailleConverter = BrailleConverter(context)
            Log.d("ChatViewModel", "점자 변환기 초기화 완료")
        } catch (e: Exception) {
            Log.e("ChatViewModel", "점자 변환기 초기화 실패: ${e.message}", e)
            // 점자 변환기가 실패해도 앱은 계속 동작하도록 함
            brailleConverter = null
        }
    }
    
    /**
     * Initialize braille input manager
     */
    private fun initializeBrailleInputManager(context: Context) {
        try {
            Log.d("ChatViewModel", "점자 입력 관리자 초기화 시작")
            brailleInputManager = BrailleInputManager(context)
            Log.d("ChatViewModel", "점자 입력 관리자 초기화 완료")
            Log.d("ChatViewModel", "점자 입력 상태: ${brailleInputManager?.brailleInputState?.value}")
            Log.d("ChatViewModel", "brailleInputManager 인스턴스: $brailleInputManager")

            // Mirror manager state into stable ViewModel StateFlow
            val managerFlow = brailleInputManager!!.brailleInputState
            // Set initial value
            _brailleInputState.value = managerFlow.value
            // Restart collector
            brailleInputCollectorJob?.cancel()
            brailleInputCollectorJob = viewModelScope.launch {
                managerFlow.collect { newState ->
                    _brailleInputState.value = newState
                }
            }
        } catch (e: Exception) {
            Log.e("ChatViewModel", "점자 입력 관리자 초기화 실패: ${e.message}", e)
            brailleInputManager = null
        }
    }
    
    /**
     * Process the recognized text from STT (음성 발화자 사용자의 음성 입력)
     * 인식 결과를 임시 저장하고, 전송 버튼을 눌러야 전송됨
     */
    private fun processRecognizedText(recognizedText: String) {
        if (recognizedText.isNotBlank()) {
            // Clean up the recognized text
            val cleanedText = cleanRecognizedText(recognizedText)
            
            // 인식 결과를 임시 저장 (전송 버튼 대기)
            _pendingRecognizedText.value = cleanedText
        }
    }
    
    /**
     * 전송 버튼 클릭 시 호출 - 임시 저장된 인식 결과를 전송
     */
    fun sendPendingVoiceMessage() {
        val pendingText = _pendingRecognizedText.value
        if (!pendingText.isNullOrBlank()) {
            // STT 결과를 음성 발화자 사용자 메시지로 처리 (텍스트 + 점자)
            addSightedVoiceMessage(pendingText)
            
            // WiFi로 전송
            sendVoiceToWifi(pendingText)
            
            // 임시 저장된 텍스트 초기화
            _pendingRecognizedText.value = null
        }
    }
    
    /**
     * 임시 저장된 인식 결과 취소 (전송 버튼을 누르지 않고 취소)
     */
    fun clearPendingVoiceMessage() {
        _pendingRecognizedText.value = null
    }
    
    /**
     * Clean and process the recognized text
     */
    private fun cleanRecognizedText(text: String): String {
        return text.trim()
            .replaceFirstChar { it.uppercase() } // Capitalize first letter
    }
    
    /**
     * Get user-friendly error message for STT errors
     */
    private fun getSttErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            SpeechRecognizer.ERROR_AUDIO -> "Audio recording error occurred"
            SpeechRecognizer.ERROR_CLIENT -> "Client side error occurred"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
            SpeechRecognizer.ERROR_NETWORK -> "Network error occurred"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout occurred"
            SpeechRecognizer.ERROR_NO_MATCH -> "No speech input recognized"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy"
            SpeechRecognizer.ERROR_SERVER -> "Server error occurred"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input detected"
            else -> "Unknown error occurred"
        }
    }
    
    /**
     * Initialize text-to-speech engine
     */
    private fun initializeTextToSpeech(context: Context) {
        textToSpeech = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = textToSpeech?.setLanguage(Locale.US)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // TODO: Handle language not supported case
                } else {
                    _isTtsReady.value = true
                }
                
                // Set utterance progress listener for TTS callbacks
                textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        // TTS started
                    }
                    
                    override fun onDone(utteranceId: String?) {
                        // TTS completed
                    }
                    
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        // TTS error
                    }
                })
            } else {
                // TODO: Handle TTS initialization failure
            }
        }
    }
    
    /**
     * Start or stop speech recognition
     */
    fun toggleSpeechRecognition() {
        if (_isListening.value) {
            stopSpeechRecognition()
        } else {
            startSpeechRecognition()
        }
    }
    
    /**
     * Start speech recognition with STT processing (public for button hold feature)
     */
    fun startSpeechRecognition() {
        speechRecognizer?.let { recognizer ->
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US)
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak now...")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3) // Get multiple results for better accuracy
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true) // Enable partial results
            }
            
            try {
                recognizer.startListening(intent)
                _isListening.value = true
                _sttStatus.value = SttStatus.Starting
            } catch (e: Exception) {
                // Handle speech recognition start failure
                _isListening.value = false
                _sttStatus.value = SttStatus.Error("Failed to start speech recognition: ${e.message}")
            }
        } ?: run {
            _sttStatus.value = SttStatus.Error("Speech recognizer not initialized")
        }
    }
    
    /**
     * Stop speech recognition (public for button release feature)
     */
    fun stopSpeechRecognition() {
        speechRecognizer?.stopListening()
        _isListening.value = false
        _sttStatus.value = SttStatus.Idle
    }
    
    /**
     * Add a voice message to the chat (deprecated - use specific user methods)
     */
    @Deprecated("Use addVisualImpairedTextMessage or addSightedTextMessage instead")
    fun addVoiceMessage(content: String) {
        if (content.isNotBlank()) {
            val message = ChatMessage(
                content = content,
                senderType = SenderType.VISUAL_IMPAIRED_USER
            )
            addMessage(message)
        }
    }
    
    
    /**
     * Add a text message to the chat (deprecated - use specific user methods)
     */
    @Deprecated("Use addVisualImpairedTextMessage or addSightedTextMessage instead")
    fun addTextMessage(content: String) {
        if (content.isNotBlank()) {
            val message = ChatMessage(
                content = content,
                senderType = SenderType.VISUAL_IMPAIRED_USER
            )
            addMessage(message)
            
            // Automatically play text message via TTS
            speakText(content)
        }
    }
    
    // ==================== 새로운 사용자별 메시지 처리 메서드들 ====================
    
    /**
     * 시청각장애인 사용자의 텍스트 메시지 추가 (텍스트 + TTS)
     */
    
    /**
     * 음성 발화자 사용자의 텍스트 메시지 추가 (텍스트 + 점자)
     */
    fun addSightedTextMessage(content: String) {
        if (content.isNotBlank()) {
            viewModelScope.launch {
                try {
                    // 통합된 점자 변환 (텍스트 + 패턴)
                    val brailleResult = withContext(Dispatchers.IO) {
                        if (brailleConverter != null) {
                            try {
                                brailleConverter!!.convertToBrailleWithPatterns(content)
                            } catch (e: Exception) {
                                Log.e("ChatViewModel", "점자 변환 오류: ${e.message}", e)
                                BraillePatternResult(
                                    originalText = content,
                                    brailleText = "",
                                    braillePatterns = emptyList(),
                                    isSuccess = false,
                                    errorMessage = e.message
                                )
                            }
                        } else {
                            Log.w("ChatViewModel", "점자 변환기가 초기화되지 않음")
                            BraillePatternResult(
                                originalText = content,
                                brailleText = "",
                                braillePatterns = emptyList(),
                                isSuccess = false,
                                errorMessage = "Braille converter not initialized"
                            )
                        }
                    }
                    
                    val message = ChatMessage(
                        content = content,
                        senderType = SenderType.SIGHTED_USER,
                        brailleContent = if (brailleResult.isSuccess) brailleResult.brailleText else null
                    )
                    addMessage(message)
                    
                    // 점자 패턴을 점자 그리드에 표시
                    if (brailleResult.isSuccess && brailleResult.braillePatterns.isNotEmpty()) {
                        brailleInputManager?.setVoiceBraillePatternsFromResult(brailleResult.braillePatterns)
                    }
                    
                } catch (e: Exception) {
                    Log.e("ChatViewModel", "음성 발화자 메시지 처리 오류: ${e.message}", e)
                    // 점자 변환이 실패해도 메시지는 추가
                    val message = ChatMessage(
                        content = content,
                        senderType = SenderType.SIGHTED_USER,
                        brailleContent = null
                    )
                    addMessage(message)
                }
            }
        }
    }
    
    /**
     * 음성 발화자 사용자의 음성 메시지 추가 (STT + 텍스트 + 점자)
     */
    fun addSightedVoiceMessage(content: String) {
        if (content.isNotBlank()) {
            // STT로 인식된 텍스트를 음성 발화자 사용자 메시지로 처리
            addSightedTextMessage(content)
        }
    }
    
    /**
     * Add a text message from Voice User (A user) with braille conversion
     * This uses the same logic as voice input but without STT processing
     */
    fun addVoiceUserTextMessage(content: String) {
        if (content.isNotBlank()) {
            // Clean up the text input
            val cleanedText = cleanRecognizedText(content)
            
            // Add the processed text as a sighted user message with braille
            addSightedTextMessage(cleanedText)
        }
    }
    
    /**
     * Add a message to the chat list
     */
    private fun addMessage(message: ChatMessage) {
        viewModelScope.launch {
            val currentMessages = _messages.value.toMutableList()
            currentMessages.add(message)
            _messages.value = currentMessages
        }
    }
    
    /**
     * Speak text using TTS
     */
    private fun speakText(text: String) {
        if (_isTtsReady.value) {
            textToSpeech?.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                null,
                "message_${System.currentTimeMillis()}"
            )
        }
    }
    
    /**
     * Test braille conversion functionality
     */
    fun testBrailleConversion() {
        viewModelScope.launch {
            try {
                val testText = "Hello World! This is a test of braille conversion."
                
                // 점자 변환기 정보 확인
                val brailleInfo = withContext(Dispatchers.IO) {
                    brailleConverter?.getLiblouisInfo()
                }
                android.util.Log.d("ChatViewModel", "점자 변환기 정보: $brailleInfo")
                
                // 점자 변환 테스트
                val brailleResult = withContext(Dispatchers.IO) {
                    brailleConverter?.convertToBraille(testText)
                }
                
                android.util.Log.d("ChatViewModel", "Braille conversion test:")
                android.util.Log.d("ChatViewModel", "Original: $testText")
                android.util.Log.d("ChatViewModel", "Braille: $brailleResult")
                
                // 역번역 테스트 (점자가 있는 경우)
                if (!brailleResult.isNullOrEmpty()) {
                    val backTranslation = withContext(Dispatchers.IO) {
                        brailleConverter?.testBackTranslation(brailleResult)
                    }
                    android.util.Log.d("ChatViewModel", "Back translation: $backTranslation")
                }
                
                // 하이픈 처리 테스트
                val hyphenationResult = withContext(Dispatchers.IO) {
                    brailleConverter?.testHyphenation(testText)
                }
                android.util.Log.d("ChatViewModel", "Hyphenation: $hyphenationResult")
                
                // Add test message with braille
                val testMessage = ChatMessage(
                    content = testText,
                    senderType = SenderType.VISUAL_IMPAIRED_USER,
                    brailleContent = brailleResult
                )
                
                val currentMessages = _messages.value.toMutableList()
                currentMessages.add(0, testMessage) // Add at the beginning
                _messages.value = currentMessages
                
            } catch (e: Exception) {
                android.util.Log.e("ChatViewModel", "Braille conversion test failed: ${e.message}", e)
            }
        }
    }
    
    /**
     * Add sample messages to demonstrate the app functionality
     */
    private fun addSampleMessages() {
        val sampleMessages = listOf(
            ChatMessage(
                content = "안녕하세요! 저는 시청각장애인 사용자입니다. 텍스트나 점자로 입력할 수 있어요.",
                senderType = SenderType.VISUAL_IMPAIRED_USER
            ),
            ChatMessage(
                content = "안녕하세요! 저는 음성 발화자 사용자입니다. 텍스트나 음성으로 입력할 수 있어요.",
                senderType = SenderType.SIGHTED_USER
            ),
            ChatMessage(
                content = "정말 좋네요! 이 앱은 접근성을 고려한 채팅 기능을 보여줍니다.",
                senderType = SenderType.VISUAL_IMPAIRED_USER
            )
        )
        
        viewModelScope.launch {
            _messages.value = sampleMessages
        }
    }
    
    // ==================== 점자 입력 관련 메서드들 ====================
    
    
    /**
     * 점자 점을 터치했을 때 호출
     */
    fun onBrailleDotTouched(dotIndex: Int) {
        Log.d("ChatViewModel", "점자 점 터치 이벤트 수신: $dotIndex")
        Log.d("ChatViewModel", "brailleInputManager 상태: ${brailleInputManager != null}")
        brailleInputManager?.onDotTouched(dotIndex)
    }
    
    /**
     * 점자 입력 완료 버튼을 눌렀을 때 호출
     */
    fun onBrailleComplete() {
        Log.d("ChatViewModel", "점자 완료 버튼 이벤트 수신")
        brailleInputManager?.onCompletePressed()
    }
    
    /**
     * 점자 입력 지우기 버튼을 눌렀을 때 호출
     */
    fun onBrailleClear() {
        Log.d("ChatViewModel", "점자 지우기 버튼 이벤트 수신")
        brailleInputManager?.onClearPressed()
    }
    
    /**
     * 점자 입력을 완전히 초기화
     */
    fun resetBrailleInput() {
        brailleInputManager?.resetInput()
    }
    
    
    /**
     * 점자로 입력된 메시지를 채팅에 추가 (시청각장애인 사용자)
     */
    fun addBrailleMessage(content: String) {
        Log.d("ChatViewModel", "점자 메시지 전송 이벤트 수신: '$content' (길이: ${content.length})")
        if (content.isNotBlank()) {
            Log.d("ChatViewModel", "점자 메시지 처리 시작")
            // 점자 입력 메시지를 시청각장애인 사용자로 처리 (텍스트 + TTS)
            val message = ChatMessage(
                content = content,
                senderType = SenderType.VISUAL_IMPAIRED_USER
            )
            addMessage(message)
            
            // 시청각장애인 사용자는 TTS로 메시지를 읽어줌
            speakText(content)
            
            // 점자 변환
            val braille = brailleConverter?.convertToBraille(content) ?: ""
            
            // WiFi로 전송
            sendBrailleToWifi(content, braille)
            
            // 점자 입력 초기화
            resetBrailleInput()
            Log.d("ChatViewModel", "점자 메시지 처리 완료")
        } else {
            Log.w("ChatViewModel", "점자 메시지가 비어있어서 전송하지 않음")
        }
    }
    
    /**
     * 점자 입력된 텍스트를 TTS로 읽어주기
     */
    fun speakBrailleInputText() {
        brailleInputManager?.speakInputText()
    }
    
    /**
     * 점자 입력 테스트 함수
     */
    fun testBrailleInput() {
        viewModelScope.launch {
            try {
                Log.d("ChatViewModel", "점자 입력 테스트 시작")
                
                // 테스트 패턴: H (1, 2, 5번 점)
                onBrailleDotTouched(0) // 1번 점
                onBrailleDotTouched(1) // 2번 점  
                onBrailleDotTouched(4) // 5번 점
                
                // 잠시 대기
                kotlinx.coroutines.delay(1000)
                
                // 완료 버튼 테스트
                onBrailleComplete()
                
                Log.d("ChatViewModel", "점자 입력 테스트 완료")
                
            } catch (e: Exception) {
                Log.e("ChatViewModel", "점자 입력 테스트 실패: ${e.message}", e)
            }
        }
    }
    
    // ==================== 음성 점자 패턴 관련 메서드들 ====================
    
    /**
     * 음성 인식된 텍스트를 점자 패턴으로 변환하여 설정 (deprecated - use setVoiceBraillePatternsFromResult)
     */
    @Deprecated("Use setVoiceBraillePatternsFromResult instead")
    private fun setVoiceBraillePatterns(text: String) {
        Log.d("ChatViewModel", "음성 점자 패턴 설정: '$text'")
        // 이 메서드는 더 이상 사용하지 않음
    }
    
    /**
     * 점자 패턴 배열을 직접 설정
     */
    private fun setVoiceBraillePatternsFromResult(patterns: List<List<Boolean>>) {
        Log.d("ChatViewModel", "점자 패턴 배열 설정: ${patterns.size}개 패턴")
        brailleInputManager?.setVoiceBraillePatternsFromResult(patterns)
    }
    
    /**
     * 다음 음성 점자 패턴으로 이동
     */
    fun nextVoiceBraillePattern() {
        Log.d("ChatViewModel", "다음 음성 점자 패턴으로 이동")
        brailleInputManager?.nextVoicePattern()
    }
    
    /**
     * 이전 음성 점자 패턴으로 이동
     */
    fun previousVoiceBraillePattern() {
        Log.d("ChatViewModel", "이전 음성 점자 패턴으로 이동")
        brailleInputManager?.previousVoicePattern()
    }
    
    /**
     * 음성 점자 표시 모드 종료
     */
    fun exitVoiceBrailleMode() {
        Log.d("ChatViewModel", "음성 점자 표시 모드 종료")
        brailleInputManager?.exitVoiceBrailleMode()
    }
    
    /**
     * 현재 음성 점자 패턴 정보 반환
     */
    fun getVoiceBrailleInfo(): String {
        return brailleInputManager?.getVoicePatternInfo() ?: "점자 정보 없음"
    }
    
    // ==================== WiFi 통신 관련 메서드들 ====================
    
    /**
     * Unified Message Manager 초기화
     */
    private fun initializeMessageManager(context: Context) {
        try {
            Log.d("ChatViewModel", "Unified Message Manager 초기화 시작")
            messageManager = UnifiedMessageManager(context)
            
            // WiFi transmitters 초기화
            initializeWifiTransmitters()
            
            // WiFi 상태 모니터링
            viewModelScope.launch {
                messageManager?.connectionState?.collect { state ->
                    _isWifiConnected.value = (state == com.example.chatting_app.network.ConnectionState.CONNECTED)
                    _wifiConnectionStatus.value = when (state) {
                        com.example.chatting_app.network.ConnectionState.CONNECTED -> "연결됨"
                        com.example.chatting_app.network.ConnectionState.CONNECTING -> "연결 중..."
                        com.example.chatting_app.network.ConnectionState.DISCONNECTED -> "연결 안됨"
                        com.example.chatting_app.network.ConnectionState.ERROR -> "연결 오류"
                    }
                }
            }
            
            // 메시지 수신 모니터링
            viewModelScope.launch {
                messageManager?.receivedMessage?.collect { message ->
                    if (message != null) {
                        handleReceivedWifiMessage(message)
                    }
                }
            }
            
            // 이미지 수신 콜백 설정
            messageManager?.setOnImageReceived { bitmap ->
                handleReceivedImage(bitmap)
            }
            
            Log.d("ChatViewModel", "Unified Message Manager 초기화 완료")
        } catch (e: Exception) {
            Log.e("ChatViewModel", "Unified Message Manager 초기화 실패: ${e.message}", e)
        }
    }
    
    /**
     * WiFi transmitters 초기화 (UnifiedMessageManager에서 가져옴)
     */
    private fun initializeWifiTransmitters() {
        try {
            Log.d("ChatViewModel", "WiFi transmitters 초기화 시작")
            
            // UnifiedMessageManager에서 transmitters 가져오기
            // 실제로는 UnifiedMessageManager 내부의 transmitters를 직접 사용
            // 여기서는 참조만 저장
            wifiBrailleTransmitter = null  // UnifiedMessageManager 내부에서 관리
            wifiTextTransmitter = null     // UnifiedMessageManager 내부에서 관리
            wifiSettingsTransmitter = null // UnifiedMessageManager 내부에서 관리
            
            Log.d("ChatViewModel", "WiFi transmitters 초기화 완료 (UnifiedMessageManager 사용)")
        } catch (e: Exception) {
            Log.e("ChatViewModel", "WiFi transmitters 초기화 실패: ${e.message}", e)
        }
    }
    
    /**
     * WiFi 서버에 연결
     */
    fun connectToWifiServer(ipAddress: String, port: Int = 8888) {
        Log.d("ChatViewModel", "Connecting to WiFi server: $ipAddress:$port")
        messageManager?.connectWifi(ipAddress, port)
        
        // 연결 상태 모니터링
        viewModelScope.launch {
            messageManager?.connectionState?.collect { state ->
                Log.d("ChatViewModel", "WiFi connection state changed: $state")
                when (state) {
                    com.example.chatting_app.network.ConnectionState.CONNECTED -> {
                        Log.d("ChatViewModel", "WiFi connected successfully")
                        _localIpAddress.value = getLocalIpAddress()
                    }
                    com.example.chatting_app.network.ConnectionState.ERROR -> {
                        Log.e("ChatViewModel", "WiFi connection error")
                    }
                    com.example.chatting_app.network.ConnectionState.DISCONNECTED -> {
                        Log.d("ChatViewModel", "WiFi disconnected")
                    }
                    else -> {
                        Log.d("ChatViewModel", "WiFi connection state: $state")
                    }
                }
            }
        }
    }
    
    /**
     * WiFi 연결 해제
     */
    fun disconnectWifi() {
        messageManager?.disconnect()
    }
    
    /**
     * 전송 모드 변경
     */
    fun setTransmissionMode(mode: TransmissionMode) {
        _transmissionMode.value = mode
        Log.d("ChatViewModel", "전송 모드 변경: $mode")
    }
    
    /**
     * WiFi 메시지 전송
     */
    fun sendWifiMessage(text: String, braille: String = "") {
        messageManager?.sendTextMessage(text, braille)
    }
    
    /**
     * 점자 시퀀스 WiFi 메시지 전송
     */
    fun sendWifiBrailleSequence(text: String, braille: String) {
        messageManager?.sendTextMessage(text, braille)
    }
    
    /**
     * 점자 입력 WiFi 메시지 전송
     */
    fun sendWifiBrailleInput(text: String, braille: String) {
        messageManager?.sendTextMessage(text, braille)
    }
    
    /**
     * WiFi로 수신된 메시지 처리
     */
    private fun handleReceivedWifiMessage(message: WifiMessage) {
        Log.d("ChatViewModel", "WiFi 메시지 수신: 타입=${message.messageType}, 데이터크기=${message.data.size}")
        
        when (message.messageType) {
            MessageType.STATUS_UPDATE -> {
                // 상태 업데이트 메시지 처리
                Log.d("ChatViewModel", "WiFi 상태 업데이트 수신")
            }
            MessageType.MESSAGE_RECEIVED -> {
                // 메시지 수신 확인 처리
                Log.d("ChatViewModel", "WiFi 메시지 수신 확인")
            }
            MessageType.SETTINGS_UPDATED -> {
                // 설정 업데이트 확인 처리
                Log.d("ChatViewModel", "WiFi 설정 업데이트 확인")
            }
            else -> {
                Log.d("ChatViewModel", "알 수 없는 WiFi 메시지 타입: ${message.messageType}")
            }
        }
    }
    
    
    /**
     * 음성 인식 결과를 WiFi로 전송
     */
    private fun sendVoiceToWifi(text: String) {
        if (_isWifiConnected.value) {
            // 점자 변환 (캐시된 결과 사용)
            val braille = brailleConverter?.convertToBraille(text) ?: ""
            
            // WiFi로 전송
            sendWifiBrailleSequence(text, braille)
            
            // 음성 점자 패턴을 개별적으로 서버로 전송
            sendVoiceBraillePatternsToServer(text)
        }
    }
    
    /**
     * 음성 점자 패턴을 서버로 전송 (기존 convertToBrailleWithPatterns 활용)
     */
    private fun sendVoiceBraillePatternsToServer(text: String) {
        if (_isWifiConnected.value) {
            try {
                // 기존의 convertToBrailleWithPatterns 메서드 활용
                val brailleResult = brailleConverter?.convertToBrailleWithPatterns(text)
                if (brailleResult != null && brailleResult.isSuccess) {
                    val patterns = brailleResult.braillePatterns
                    Log.d("ChatViewModel", "음성 점자 패턴 서버 전송 시작: ${patterns.size}개 패턴")
                    
                    // 각 점자 패턴을 개별적으로 서버로 전송 (구분자 포함)
                    viewModelScope.launch {
                        sendBraillePatternsWithSeparators(text, patterns)
                    }
                    
                    Log.d("ChatViewModel", "음성 점자 패턴 서버 전송 완료")
                } else {
                    Log.w("ChatViewModel", "음성 점자 패턴 변환 실패")
                }
            } catch (e: Exception) {
                Log.e("ChatViewModel", "음성 점자 패턴 서버 전송 오류: ${e.message}", e)
            }
        }
    }
    
    /**
     * 점자 패턴을 구분자와 함께 전송
     */
    private suspend fun sendBraillePatternsWithSeparators(text: String, patterns: List<List<Boolean>>) {
        val currentMode = _transmissionMode.value
        
        if (currentMode == TransmissionMode.DOT_BY_DOT) {
            // 개별 점 모드: 점자를 개별 점으로 분할하여 전송
            sendBraillePatternsDotByDot(text, patterns)
        } else {
            // 패턴 모드: 기존 방식
            sendBraillePatternsNormal(text, patterns)
        }
    }
    
    /**
     * 일반 패턴 모드로 전송
     */
    private suspend fun sendBraillePatternsNormal(text: String, patterns: List<List<Boolean>>) {
        var patternIndex = 0
        
        for (char in text) {
            if (patternIndex < patterns.size) {
                val pattern = patterns[patternIndex]
                
                if (char == ' ') {
                    // 공백 문자인 경우: 구분자만 전송하고 점자 패턴은 건너뜀
                    messageManager?.sendWordSeparator()
                    kotlinx.coroutines.delay(50) // 구분자 간격
                } else {
                    // 일반 문자인 경우: 점자 패턴 전송
                    sendBraillePatternToServer(pattern, patternIndex, patterns.size)
                    kotlinx.coroutines.delay(100) // 100ms 간격
                }
                
                patternIndex++
            }
        }
        
        // 문장 끝에 문장 구분자 전송
        messageManager?.sendSentenceSeparator()
    }
    
    /**
     * 개별 점 모드로 전송 (점자를 개별 점으로 분할)
     */
    private suspend fun sendBraillePatternsDotByDot(text: String, patterns: List<List<Boolean>>) {
        // 먼저 텍스트 메시지 전송
        messageManager?.sendTextMessage(text, "")
        kotlinx.coroutines.delay(100)
        
        var patternIndex = 0
        
        for (char in text) {
            if (patternIndex < patterns.size) {
                val pattern = patterns[patternIndex]
                
                if (char == ' ') {
                    // 공백 문자인 경우: 구분자만 전송
                    messageManager?.sendWordSeparator()
                    kotlinx.coroutines.delay(50)
                } else {
                    // 일반 문자인 경우: 점자를 개별 점으로 분할하여 전송
                    sendBraillePatternDotByDot(pattern, patternIndex, patterns.size)
                }
                
                patternIndex++
            }
        }
        
        // 문장 끝에 문장 구분자 전송
        messageManager?.sendSentenceSeparator()
    }
    
    /**
     * 점자 패턴을 개별 점으로 분할하여 전송
     */
    private suspend fun sendBraillePatternDotByDot(pattern: List<Boolean>, patternIndex: Int, totalPatterns: Int) {
        // 6개 점을 개별적으로 전송 (점 간은 연결)
        for (dotIndex in 0..5) {
            val isActive = pattern[dotIndex]
            if (isActive) {
                // 활성화된 점만 전송
                val singleDotPattern = BooleanArray(6) { i -> i == dotIndex }
                sendBraillePatternToServer(singleDotPattern.toList(), patternIndex, totalPatterns)
                kotlinx.coroutines.delay(50) // 개별 점 간격 (점 간은 연결)
            }
        }
        
        // 점자 구분자 전송 (다음 점자와 구분하기 위해)
        if (patternIndex < totalPatterns - 1) {
            messageManager?.sendBrailleSeparator()
            kotlinx.coroutines.delay(30) // 점자 구분자 간격
        }
    }
    
    /**
     * 점자 패턴을 서버로 전송
     */
    private fun sendBraillePatternToServer(dots: List<Boolean>, patternIndex: Int, totalPatterns: Int) {
        if (_isWifiConnected.value) {
            try {
                // UnifiedMessageManager를 통해 점자 패턴 전송
                messageManager?.sendPatternComplete(dots)
                
                Log.d("ChatViewModel", "점자 패턴 전송: ${patternIndex + 1}/${totalPatterns} - ${dotsToString(dots)}")
            } catch (e: Exception) {
                Log.e("ChatViewModel", "점자 패턴 서버 전송 오류: ${e.message}", e)
            }
        }
    }
    
    /**
     * 점자 패턴을 문자열로 변환
     */
    private fun dotsToString(dots: List<Boolean>): String {
        return dots.map { active -> 
            if (active) "1" else "0" 
        }.joinToString("")
    }
    
    /**
     * 점자 입력 결과를 WiFi로 전송
     */
    private fun sendBrailleToWifi(text: String, braille: String) {
        if (_isWifiConnected.value) {
            sendWifiBrailleInput(text, braille)
            Log.d("ChatViewModel", "점자 입력 결과를 WiFi로 전송: $text")
        }
    }
    
    /**
     * 로컬 IP 주소 가져오기
     */
    private fun getLocalIpAddress(): String? {
        try {
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                val addresses = networkInterface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val address = addresses.nextElement()
                    if (!address.isLoopbackAddress && address is java.net.Inet4Address) {
                        return address.hostAddress
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("ChatViewModel", "Failed to get local IP address: ${e.message}")
        }
        return null
    }
    
    /**
     * WiFi 통신으로 받은 필담 이미지 처리
     * Bitmap 이미지를 받아서 OCR 처리 후 채팅 메시지로 추가합니다.
     *
     * @param bitmap 수신한 필담 이미지 Bitmap
     */
    fun handleReceivedImage(bitmap: Bitmap) {
        Log.d("ChatViewModel", "필담 이미지 수신됨, OCR 처리 시작... (크기: ${bitmap.width}x${bitmap.height})")
        
        // OCR 처리 (비동기)
        textRecognizerManager.recognizeText(bitmap, object : OcrResultListener {
            override fun onResult(text: String?) {
                if (text != null && text.isNotBlank()) {
                    Log.d("ChatViewModel", "OCR 인식 결과: '$text'")
                    
                    // 인식된 텍스트를 채팅 메시지로 추가
                    val message = ChatMessage(
                        content = text,
                        senderType = SenderType.VISUAL_IMPAIRED_USER
                    )
                    addMessage(message)
                    
                    // TTS로 읽어주기
                    speakText(text)
                    
                    Log.d("ChatViewModel", "필담 이미지 처리 완료: '$text'")
                } else {
                    Log.w("ChatViewModel", "OCR 인식 실패 또는 텍스트 없음")
                }
            }
            
            override fun onError(exception: Exception) {
                Log.e("ChatViewModel", "OCR 처리 오류", exception)
            }
        })
    }
    
    /**
     * 테스트 이미지로 OCR 테스트 실행
     * drawable/test_*.png 이미지를 사용하여 OCR 동작을 테스트합니다.
     */
    fun testOcrWithImage(context: Context) {
        try {
            val drawable = ContextCompat.getDrawable(context, R.drawable.test_a)
            if (drawable is BitmapDrawable) {
                val bitmap = drawable.bitmap
                Log.d("ChatViewModel", "테스트 이미지 로드 완료: ${bitmap.width}x${bitmap.height}")
                handleReceivedImage(bitmap)
            } else {
                Log.e("ChatViewModel", "테스트 이미지를 BitmapDrawable로 변환할 수 없음")
            }
        } catch (e: Exception) {
            Log.e("ChatViewModel", "테스트 이미지 로드 실패", e)
        }
    }
    
    /**
     * Clean up resources when ViewModel is cleared
     */
    override fun onCleared() {
        super.onCleared()
        speechRecognizer?.destroy()
        textToSpeech?.shutdown()
        brailleInputManager?.cleanup()
        brailleInputCollectorJob?.cancel()
        messageManager?.disconnect()
        textRecognizerManager.close()
    }
}

/**
 * Represents the current status of STT processing
 */
sealed class SttStatus {
    object Idle : SttStatus()
    object Starting : SttStatus()
    object Ready : SttStatus()
    object Listening : SttStatus()
    object Processing : SttStatus()
    object Success : SttStatus()
    data class Error(val message: String) : SttStatus()
}
