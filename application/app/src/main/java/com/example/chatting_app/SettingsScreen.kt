package com.example.chatting_app

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

/**
 * 설정 페이지 화면
 * waveformId와 holdDuration을 설정하고 ESP32로 전송
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    modifier: Modifier = Modifier,
    viewModel: ChatViewModel,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    
    // 상태 변수
    var waveformIdText by remember { mutableStateOf("47") }
    var holdDurationText by remember { mutableStateOf("1000") }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("설정") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "뒤로가기")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "ESP32 설정",
                style = MaterialTheme.typography.headlineSmall
            )
            
            // waveformId 입력
            OutlinedTextField(
                value = waveformIdText,
                onValueChange = { 
                    if (it.all { char -> char.isDigit() }) {
                        waveformIdText = it
                    }
                },
                label = { Text("Waveform ID (0-255)") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
            
            // holdDuration 입력
            OutlinedTextField(
                value = holdDurationText,
                onValueChange = { 
                    if (it.all { char -> char.isDigit() }) {
                        holdDurationText = it
                    }
                },
                label = { Text("Hold Duration (ms, 0-65535)") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
            
            // 전송 버튼
            Button(
                onClick = {
                    val waveformId = waveformIdText.toIntOrNull()
                    val holdDuration = holdDurationText.toIntOrNull()
                    
                    when {
                        waveformId == null -> {
                            Toast.makeText(context, "Waveform ID를 올바르게 입력하세요", Toast.LENGTH_SHORT).show()
                        }
                        waveformId < 0 || waveformId > 255 -> {
                            Toast.makeText(context, "Waveform ID는 0-255 사이여야 합니다", Toast.LENGTH_SHORT).show()
                        }
                        holdDuration == null -> {
                            Toast.makeText(context, "Hold Duration을 올바르게 입력하세요", Toast.LENGTH_SHORT).show()
                        }
                        holdDuration < 0 || holdDuration > 65535 -> {
                            Toast.makeText(context, "Hold Duration은 0-65535 사이여야 합니다", Toast.LENGTH_SHORT).show()
                        }
                        else -> {
                            viewModel.sendWaveformIdAndHoldDuration(waveformId, holdDuration)
                            Toast.makeText(
                                context,
                                "설정 전송됨: waveformId=$waveformId, holdDuration=${holdDuration}ms",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("설정 전송")
            }
            
            // 개별 전송 버튼들
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        val waveformId = waveformIdText.toIntOrNull()
                        if (waveformId != null && waveformId >= 0 && waveformId <= 255) {
                            viewModel.sendWaveformId(waveformId)
                            Toast.makeText(context, "Waveform ID 전송됨: $waveformId", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Waveform ID를 올바르게 입력하세요 (0-255)", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Waveform ID만")
                }
                
                Button(
                    onClick = {
                        val holdDuration = holdDurationText.toIntOrNull()
                        if (holdDuration != null && holdDuration >= 0 && holdDuration <= 65535) {
                            viewModel.sendHoldDuration(holdDuration)
                            Toast.makeText(context, "Hold Duration 전송됨: ${holdDuration}ms", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Hold Duration을 올바르게 입력하세요 (0-65535)", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Hold Duration만")
                }
            }
        }
    }
}

