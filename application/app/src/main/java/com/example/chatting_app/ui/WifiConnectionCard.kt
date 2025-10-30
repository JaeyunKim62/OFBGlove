package com.example.chatting_app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
    onStartServer: suspend () -> Unit,
    onConnectToServer: suspend (String) -> Unit,
    onDisconnect: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showConnectionDialog by remember { mutableStateOf(false) }
    var serverIpAddress by remember { mutableStateOf("") }
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
                            text = if (isConnected) "WiFi 연결됨" else "연결 안됨",
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
                
                // 연결/해제 버튼
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
                        onClick = { showConnectionDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("연결", fontSize = 12.sp)
                    }
                }
            }
            
            // IP 주소 표시
            if (localIpAddress != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "로컬 IP: $localIpAddress",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
    
    // 연결 다이얼로그
    if (showConnectionDialog) {
        WifiConnectionDialog(
            onDismiss = { showConnectionDialog = false },
            onStartServer = {
                scope.launch {
                    onStartServer()
                    showConnectionDialog = false
                }
            },
            onConnectToServer = { ipAddress ->
                scope.launch {
                    onConnectToServer(ipAddress)
                    showConnectionDialog = false
                }
            }
        )
    }
}

/**
 * WiFi 연결 옵션을 선택하는 다이얼로그
 */
@Composable
private fun WifiConnectionDialog(
    onDismiss: () -> Unit,
    onStartServer: () -> Unit,
    onConnectToServer: (String) -> Unit
) {
    var showIpInput by remember { mutableStateOf(false) }
    var ipAddress by remember { mutableStateOf("") }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("WiFi 연결 옵션")
        },
        text = {
            if (showIpInput) {
                Column {
                    Text("서버 IP 주소를 입력하세요:")
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = ipAddress,
                        onValueChange = { ipAddress = it },
                        label = { Text("IP 주소 (예: 192.168.1.100)") },
                        placeholder = { Text("192.168.1.100") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            } else {
                Text("연결 방식을 선택하세요:")
            }
        },
        confirmButton = {
            if (showIpInput) {
                Button(
                    onClick = { 
                        if (ipAddress.isNotBlank()) {
                            onConnectToServer(ipAddress)
                        }
                    },
                    enabled = ipAddress.isNotBlank()
                ) {
                    Text("연결")
                }
            } else {
                Button(
                    onClick = { showIpInput = true }
                ) {
                    Text("서버에 연결")
                }
            }
        },
        dismissButton = {
            if (showIpInput) {
                Button(
                    onClick = { showIpInput = false }
                ) {
                    Text("뒤로")
                }
            } else {
                Button(
                    onClick = onDismiss
                ) {
                    Text("취소")
                }
            }
        }
    )
    
    // 서버 시작 버튼 (다이얼로그 외부)
    if (!showIpInput) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Button(
                onClick = onStartServer,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.secondary
                )
            ) {
                Text("서버 시작")
            }
        }
    }
}
