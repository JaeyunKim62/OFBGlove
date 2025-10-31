package com.example.chatting_app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/**
 * WiFi 연결 상태를 표시하고 관리하는 카드 컴포넌트
 */
@Composable
fun WifiConnectionCard(
    isConnected: Boolean,
    connectionStatus: String,
    localIpAddress: String?,
    savedIpAddress: String,
    onStartServer: suspend () -> Unit,
    onConnectToServer: suspend (String) -> Unit,
    onDisconnect: () -> Unit,
    onSaveIpAddress: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showSettingsDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isConnected) 
                MaterialTheme.colorScheme.primaryContainer
            else 
                MaterialTheme.colorScheme.errorContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // WiFi 상태 표시
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (isConnected) 
                            Icons.Default.Wifi 
                        else 
                            Icons.Default.WifiOff,
                        contentDescription = "WiFi 상태",
                        tint = if (isConnected) 
                            MaterialTheme.colorScheme.primary 
                        else 
                            MaterialTheme.colorScheme.error
                    )
                    
                    Spacer(modifier = Modifier.width(8.dp))
                    
                    Column {
                        Text(
                            text = if (isConnected) "연결됨" else "연결 안됨",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (isConnected) 
                                MaterialTheme.colorScheme.primary 
                            else 
                                MaterialTheme.colorScheme.error
                        )
                        
                        Text(
                            text = connectionStatus,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                
                // 연결/해제 버튼 및 설정 버튼
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { showSettingsDialog = true }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "설정",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    
                    if (isConnected) {
                        Button(
                            onClick = onDisconnect,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Text("연결 해제", fontSize = 12.sp)
                        }
                    } else {
                        Button(
                            onClick = {
                                scope.launch {
                                    onConnectToServer(savedIpAddress)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            Text("연결", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
    
    // IP 설정 다이얼로그
    if (showSettingsDialog) {
        IpSettingsDialog(
            currentIp = savedIpAddress,
            onDismiss = { showSettingsDialog = false },
            onSave = { ipAddress ->
                onSaveIpAddress(ipAddress)
                showSettingsDialog = false
            }
        )
    }
}

/**
 * IP 설정 다이얼로그
 */
@Composable
private fun IpSettingsDialog(
    currentIp: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var ipAddress by remember { mutableStateOf(currentIp) }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("서버 IP 주소 설정")
        },
        text = {
            Column {
                Text("서버 IP 주소를 입력하세요:")
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = ipAddress,
                    onValueChange = { ipAddress = it },
                    label = { Text("IP 주소") },
                    placeholder = { Text("172.20.100.65") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { 
                    if (ipAddress.isNotBlank()) {
                        onSave(ipAddress)
                    }
                },
                enabled = ipAddress.isNotBlank()
            ) {
                Text("저장")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss
            ) {
                Text("취소")
            }
        }
    )
}
