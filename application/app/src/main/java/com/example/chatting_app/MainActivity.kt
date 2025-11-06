package com.example.chatting_app

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.ActivityResultLauncher
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.chatting_app.ui.theme.Chatting_appTheme
import com.example.chatting_app.ui.WifiConnectionCard
import com.example.chatting_app.ui.TransmissionModeSelector
import com.example.chatting_app.TransmissionMode
import android.Manifest
import kotlinx.coroutines.launch
import android.content.Intent
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.Text

class MainActivity : ComponentActivity() {
    
    private val viewModel: ChatViewModel by viewModels<ChatViewModel>()
    
    // Register the permission launcher during activity creation (before onStart)
    private val requestPermissionLauncher: ActivityResultLauncher<String> = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Permission granted, can now use speech recognition
            viewModel.onPermissionGranted()
        } else {
            // Permission denied
            viewModel.onPermissionDenied()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        setContent {
            Chatting_appTheme {
                ChatApp(
                    viewModel = viewModel,
                    requestPermission = { permission ->
                        requestPermissionLauncher.launch(permission)
                    }
                )
            }
        }
    }
}

@Composable
fun ChatApp(
    viewModel: ChatViewModel,
    requestPermission: (String) -> Unit
) {
    val context = LocalContext.current
    val messages by viewModel.messages.collectAsStateWithLifecycle()
    val isListening by viewModel.isListening.collectAsStateWithLifecycle()
    val pendingRecognizedText by viewModel.pendingRecognizedText.collectAsStateWithLifecycle()
    
    // 점자 입력 상태
    val brailleInputStateFlow = viewModel.brailleInputState
    
    // WiFi 연결 상태
    val isWifiConnected by viewModel.isWifiConnected.collectAsStateWithLifecycle()
    val wifiConnectionStatus by viewModel.wifiConnectionStatus.collectAsStateWithLifecycle()
    val localIpAddress by viewModel.localIpAddress.collectAsStateWithLifecycle()
    val transmissionMode by viewModel.transmissionMode.collectAsStateWithLifecycle()
    
    // 저장된 IP 주소
    val savedIpAddress by viewModel.savedIpAddress.collectAsStateWithLifecycle()
    
    // 점자 입력 상태는 ChatScreen에서만 구독
    
    // Initialize speech engines when the app starts
    LaunchedEffect(Unit) {
        viewModel.initializeContext(context)
        viewModel.initializeSpeechEngines(context)
        
        // Test braille conversion functionality
        viewModel.testBrailleConversion()
        
        // 점자 입력 준비 완료
    }
    
    // Check and request permissions when needed
    LaunchedEffect(Unit) {
        if (!viewModel.hasRecordAudioPermission(context)) {
            requestPermission(Manifest.permission.RECORD_AUDIO)
        }
    }
    
    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier = Modifier.padding(innerPadding)
        ) {
            // WiFi 연결 카드
            WifiConnectionCard(
                isConnected = isWifiConnected,
                connectionStatus = wifiConnectionStatus,
                localIpAddress = localIpAddress,
                savedIpAddress = savedIpAddress,
                onStartServer = {
                    // 서버 모드는 현재 지원하지 않음 (UnifiedMessageManager는 클라이언트만 지원)
                    Toast.makeText(context, "서버 모드는 현재 지원하지 않습니다", Toast.LENGTH_SHORT).show()
                },
                onConnectToServer = { ipAddress ->
                    viewModel.connectToWifiServer(ipAddress)
                },
                onDisconnect = {
                    viewModel.disconnectWifi()
                },
                onSaveIpAddress = { ipAddress ->
                    viewModel.saveIpAddress(ipAddress)
                },
                modifier = Modifier.padding(16.dp)
            )
            
            // 전송 모드 선택
            TransmissionModeSelector(
                currentMode = transmissionMode,
                onModeChanged = { mode: TransmissionMode ->
                    viewModel.setTransmissionMode(mode)
                },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
            
            // OCR 테스트 버튼 (개발용)
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        viewModel.testOcrWithImage(context)
                    }
                ) {
                    Text("OCR 테스트 (test_8.png)")
                }
            }
            
            // 기존 채팅 화면
            ChatScreen(
                modifier = Modifier.fillMaxSize(),
                // 왼쪽 사용자 (시청각장애인) 점자 입력만 유지
                onVisualImpairedBrailleMessage = {
                    val currentState = brailleInputStateFlow.value
                    android.util.Log.d("MainActivity", "시청각장애인 점자 전송 - 현재 상태: $currentState")
                    android.util.Log.d("MainActivity", "전송할 텍스트: '${currentState.inputText}' (길이: ${currentState.inputText.length})")
                    viewModel.addBrailleMessage(currentState.inputText)
                },
                // 오른쪽 사용자 (음성 발화자) 입력
                onSightedTextMessage = { content ->
                    viewModel.addSightedTextMessage(content)
                },
                onSightedVoiceMessageStart = {
                    // Check permission before starting speech recognition
                    if (viewModel.hasRecordAudioPermission(context)) {
                        viewModel.startSpeechRecognition()
                    } else {
                        requestPermission(Manifest.permission.RECORD_AUDIO)
                    }
                },
                onSightedVoiceMessageStop = {
                    // Stop speech recognition when button is released
                    viewModel.stopSpeechRecognition()
                },
                pendingRecognizedText = pendingRecognizedText,
                onSendPendingVoiceMessage = {
                    viewModel.sendPendingVoiceMessage()
                },
                onClearPendingVoiceMessage = {
                    viewModel.clearPendingVoiceMessage()
                },
                // 공통 상태
                isListening = isListening,
                messages = messages,
                // 점자 입력 관련 매개변수
                brailleInputState = brailleInputStateFlow,
                onBrailleDotTouched = { dotIndex ->
                    viewModel.onBrailleDotTouched(dotIndex)
                },
                onBrailleComplete = {
                    viewModel.onBrailleComplete()
                },
                onBrailleClear = {
                    viewModel.onBrailleClear()
                },
                onBrailleSend = {
                    val currentState = brailleInputStateFlow.value
                    viewModel.addBrailleMessage(currentState.inputText)
                },
                // 음성 점자 패턴 관련 매개변수
                onNextVoicePattern = {
                    viewModel.nextVoiceBraillePattern()
                },
                onPreviousVoicePattern = {
                    viewModel.previousVoiceBraillePattern()
                },
                onExitVoiceMode = {
                    viewModel.exitVoiceBrailleMode()
                }
            )
        }
    }
}