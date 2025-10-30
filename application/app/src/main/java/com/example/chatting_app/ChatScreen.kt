package com.example.chatting_app

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.flow.StateFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 활성 사용자 타입
 */
enum class ActiveUserType {
    DEAF_BLIND,      // 시청각장애인 사용자
    AUDIO_SPEAKER    // 음성 발화자 사용자
}

/**
 * Main chat screen composable that displays the conversation and handles user input
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    modifier: Modifier = Modifier,
    // 왼쪽 사용자 (시청각장애인) 점자 입력만 유지
    onVisualImpairedBrailleMessage: () -> Unit,
    // 오른쪽 사용자 (음성 발화자) 입력
    onSightedTextMessage: (String) -> Unit,
    onSightedVoiceMessageStart: () -> Unit,
    onSightedVoiceMessageStop: () -> Unit,
    pendingRecognizedText: String?,
    onSendPendingVoiceMessage: () -> Unit,
    onClearPendingVoiceMessage: () -> Unit,
    // 공통 상태
    isListening: Boolean,
    messages: List<ChatMessage> = emptyList(),
    // 점자 입력 관련 매개변수
    brailleInputState: StateFlow<BrailleInputState>,
    onBrailleDotTouched: (Int) -> Unit = {},
    onBrailleComplete: () -> Unit = {},
    onBrailleClear: () -> Unit = {},
    onBrailleSend: () -> Unit = {},
    // 음성 점자 패턴 관련 매개변수
    onNextVoicePattern: () -> Unit = {},
    onPreviousVoicePattern: () -> Unit = {},
    onExitVoiceMode: () -> Unit = {}
) {
    // 현재 활성 사용자 - 음성 발화자만 사용 (시청각장애인 비활성화)
    var currentActiveUser by remember { mutableStateOf(ActiveUserType.AUDIO_SPEAKER) }
    
    // 왼쪽 사용자 (시청각장애인) 상태 - 텍스트 입력 제거됨
    
    // 오른쪽 사용자 (음성 발화자) 상태
    var sightedTextInput by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    
    // Scroll to bottom when new messages arrive
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }
    
    // 사용자 전환 기능 비활성화 (음성 발화자만 사용)
    // LaunchedEffect(currentActiveUser) {
    //     if (brailleInputState.value.isShowingVoiceBraille) {
    //         android.util.Log.d("ChatScreen", "사용자 전환 감지 - 점자 표시 모드 자동 종료")
    //         onExitVoiceMode()
    //     }
    // }
    
    // Animated alpha for listening state (최적화)
    val micAlpha by animateFloatAsState(
        targetValue = if (isListening) 0.6f else 1f,
        animationSpec = tween(300),
        label = "mic_alpha"
    )

    Column(
        modifier = modifier.fillMaxSize()
    ) {
        // Chat Messages
        // Messages List
        val configuration = LocalConfiguration.current
        val screenWidth = configuration.screenWidthDp.dp
        val messagePadding = (screenWidth * 0.03f).coerceAtLeast(8.dp).coerceAtMost(24.dp)
        
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = messagePadding),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            items(messages) { message ->
                ChatMessageBubble(message = message)
            }
        }

        // User Switcher 비활성화 (음성 발화자만 사용)
        // UserSwitcher(
        //     currentUser = currentActiveUser,
        //     onUserSwitch = { userType ->
        //         currentActiveUser = userType
        //     }
        // )

        // Input Area - Two User Sections (가로 배치 고정)
        val screenHeight = configuration.screenHeightDp.dp
        
        // 화면 크기에 맞는 패딩과 간격 조정
        val horizontalPadding = (screenWidth * 0.03f).coerceAtLeast(8.dp).coerceAtMost(24.dp)
        val verticalPadding = (screenHeight * 0.02f).coerceAtLeast(8.dp).coerceAtMost(20.dp)
        val spacing = (screenWidth * 0.04f).coerceAtLeast(12.dp).coerceAtMost(24.dp)
        
        // 입력 영역 - 음성 발화자만 사용 (시청각장애인 입력 영역 비활성화)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = horizontalPadding, vertical = verticalPadding)
        ) {
            // 음성 발화자 입력 영역만 표시
            SightedUserInput(
                textInput = sightedTextInput,
                onTextInputChange = { sightedTextInput = it },
                onTextSend = {
                    if (sightedTextInput.isNotBlank()) {
                        onSightedTextMessage(sightedTextInput)
                        sightedTextInput = ""
                    }
                },
                onVoiceStart = onSightedVoiceMessageStart,
                onVoiceStop = onSightedVoiceMessageStop,
                pendingRecognizedText = pendingRecognizedText,
                onSendPendingText = onSendPendingVoiceMessage,
                onClearPendingText = onClearPendingVoiceMessage,
                isListening = isListening,
                micAlpha = micAlpha,
                isActive = true, // 항상 활성화 (음성 발화자만 사용)
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/**
 * 시청각장애인 사용자 입력 영역
 */
@Composable
private fun VisualImpairedUserInput(
    onBrailleSend: () -> Unit,
    brailleInputState: StateFlow<BrailleInputState>,
    onBrailleDotTouched: (Int) -> Unit,
    onBrailleComplete: () -> Unit,
    onBrailleClear: () -> Unit,
    onNextVoicePattern: () -> Unit = {},
    onPreviousVoicePattern: () -> Unit = {},
    onExitVoiceMode: () -> Unit = {},
    isActive: Boolean = true,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (isActive) 1f else 0.5f),
        colors = CardDefaults.cardColors(
            containerColor = if (isActive) 
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            else 
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Text(
                text = "시청각장애인 사용자",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // 점자 입력 그리드 (항상 표시)
            BrailleInputGrid(
                brailleInputState = brailleInputState,
                onDotTouched = if (isActive) onBrailleDotTouched else { _ -> },
                onComplete = if (isActive) onBrailleComplete else { -> },
                onClear = if (isActive) onBrailleClear else { -> },
                onSend = if (isActive) onBrailleSend else { -> },
                onNextVoicePattern = if (isActive) onNextVoicePattern else { -> },
                onPreviousVoicePattern = if (isActive) onPreviousVoicePattern else { -> },
                onExitVoiceMode = if (isActive) onExitVoiceMode else { -> }
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            
        }
    }
}

/**
 * 음성 발화자 사용자 입력 영역
 */
@Composable
private fun SightedUserInput(
    textInput: String,
    onTextInputChange: (String) -> Unit,
    onTextSend: () -> Unit,
    onVoiceStart: () -> Unit,
    onVoiceStop: () -> Unit,
    pendingRecognizedText: String?,
    onSendPendingText: () -> Unit,
    onClearPendingText: () -> Unit,
    isListening: Boolean,
    micAlpha: Float,
    isActive: Boolean = true,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (isActive) 1f else 0.5f),
        colors = CardDefaults.cardColors(
            containerColor = if (isActive) 
                MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f)
            else 
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Text(
                text = "음성 발화자 사용자",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // 음성 입력 (위쪽) - 버튼 클릭 시 음성 인식 시작
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Button(
                    onClick = {
                        if (isActive) {
                            onVoiceStart()
                        }
                    },
                    modifier = Modifier.alpha(if (isActive) micAlpha else 0.5f),
                    enabled = isActive
                ) {
                    Text(if (isListening) "음성 입력 중..." else "음성 입력")
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // 전송/취소 버튼 (인식 결과가 있을 때만 표시)
            if (pendingRecognizedText != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onSendPendingText,
                        modifier = Modifier.weight(1f),
                        enabled = isActive
                    ) {
                        Text("전송")
                    }
                    Button(
                        onClick = onClearPendingText,
                        modifier = Modifier.weight(1f),
                        enabled = isActive,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer
                        )
                    ) {
                        Text("취소")
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }
            
            // 텍스트 입력 (음성 입력 아래)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = textInput,
                    onValueChange = if (isActive) onTextInputChange else { _: String -> },
                    label = { Text("텍스트") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    enabled = isActive
                )
                
                Spacer(modifier = Modifier.width(8.dp))
                
                IconButton(
                    onClick = if (isActive) onTextSend else { -> },
                    enabled = isActive && textInput.isNotBlank()
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "전송"
                    )
                }
            }
        }
    }
}

/**
 * Chat message bubble component
 */
@Composable
private fun ChatMessageBubble(message: ChatMessage) {
    val isFromVisualImpaired = message.senderType == SenderType.VISUAL_IMPAIRED_USER
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isFromVisualImpaired) Arrangement.Start else Arrangement.End
    ) {
        Card(
            modifier = Modifier.widthIn(max = 280.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isFromVisualImpaired) 
                    MaterialTheme.colorScheme.primaryContainer 
                else 
                    MaterialTheme.colorScheme.secondaryContainer
            ),
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isFromVisualImpaired) 4.dp else 16.dp,
                bottomEnd = if (isFromVisualImpaired) 16.dp else 4.dp
            )
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                // Sender label
                Text(
                    text = if (isFromVisualImpaired) "시청각장애인" else "음성 발화자",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isFromVisualImpaired) 
                        MaterialTheme.colorScheme.onPrimaryContainer 
                    else 
                        MaterialTheme.colorScheme.onSecondaryContainer,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                // Message content
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isFromVisualImpaired) 
                        MaterialTheme.colorScheme.onPrimaryContainer 
                    else 
                        MaterialTheme.colorScheme.onSecondaryContainer
                )
                
                // Braille content (if available)
                if (message.hasBraille) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Text(
                            text = "점자: ${message.brailleContent}",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(8.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(4.dp))
                
                // Timestamp
                Text(
                    text = message.formattedTime,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isFromVisualImpaired) 
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    else 
                        MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                )
            }
        }
    }
}

/**
 * 사용자 전환 컴포넌트
 */
@Composable
private fun UserSwitcher(
    modifier: Modifier = Modifier,
    currentUser: ActiveUserType,
    onUserSwitch: (ActiveUserType) -> Unit
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 사용자 전환 버튼
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onUserSwitch(ActiveUserType.DEAF_BLIND) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (currentUser == ActiveUserType.DEAF_BLIND)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.surface,
                        contentColor = if (currentUser == ActiveUserType.DEAF_BLIND)
                            MaterialTheme.colorScheme.onPrimary
                        else
                            MaterialTheme.colorScheme.onSurface
                    ),
                    modifier = Modifier.height(36.dp)
                ) {
                    Text(
                        text = "시청각장애인",
                        fontSize = 12.sp
                    )
                }
                
                Button(
                    onClick = { onUserSwitch(ActiveUserType.AUDIO_SPEAKER) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (currentUser == ActiveUserType.AUDIO_SPEAKER)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.surface,
                        contentColor = if (currentUser == ActiveUserType.AUDIO_SPEAKER)
                            MaterialTheme.colorScheme.onPrimary
                        else
                            MaterialTheme.colorScheme.onSurface
                    ),
                    modifier = Modifier.height(36.dp)
                ) {
                    Text(
                        text = "음성 발화자",
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}
