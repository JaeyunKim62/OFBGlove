package com.example.chatting_app.network

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.InputStream
import java.io.OutputStream
import java.net.Socket
import java.util.concurrent.LinkedBlockingQueue

/**
 * WiFi 클라이언트 - GATT 호환 프로토콜 사용
 */
class WifiClient(private val context: Context) {
    
    private var socket: Socket? = null
    private var outputStream: OutputStream? = null
    private var inputStream: InputStream? = null
    private var isReceiving = false
    
    // 전송 큐 및 전송 스레드 제어
    private val sendQueue = LinkedBlockingQueue<ByteArray>()
    private var sendThread: Thread? = null
    private var isSending = false
    
    // 연결 상태
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()
    
    // 수신된 메시지
    private val _receivedMessage = MutableStateFlow<WifiMessage?>(null)
    val receivedMessage: StateFlow<WifiMessage?> = _receivedMessage.asStateFlow()
    
    // 이미지 수신 콜백 (메인 스레드에서 호출됨)
    var onImageReceived: ((Bitmap) -> Unit)? = null
    
    // DOT_PATTERN 수신 콜백 (메인 스레드에서 호출됨)
    var onDotPatternReceived: ((Byte) -> Unit)? = null
    
    companion object {
        private const val TAG = "WifiClient"
        private const val BUFFER_SIZE = 4096
    }
    
    /**
     * WiFi 서버에 연결
     */
    fun connect(ipAddress: String, port: Int = 8888) {
        Log.d(TAG, "Connecting to $ipAddress:$port")
        _connectionState.value = ConnectionState.CONNECTING
        
        // 백그라운드 스레드에서 네트워크 작업 수행
        Thread {
            try {
                Log.d(TAG, "Creating socket...")
                socket = Socket(ipAddress, port)
                
                Log.d(TAG, "Getting streams...")
                outputStream = socket?.getOutputStream()
                inputStream = socket?.getInputStream()
                
                Log.d(TAG, "Socket connected: ${socket?.isConnected}")
                Log.d(TAG, "Socket bound: ${socket?.isBound}")
                Log.d(TAG, "Socket closed: ${socket?.isClosed}")
                
                _connectionState.value = ConnectionState.CONNECTED
                Log.d(TAG, "Connected successfully to $ipAddress:$port")
                
                // 전송 스레드 시작
                startSendingThread()
                
                // 수신 스레드 시작
                startReceivingThread()
                
            } catch (e: Exception) {
                Log.e(TAG, "Connection failed to $ipAddress:$port: ${e.message}", e)
                Log.e(TAG, "Exception type: ${e.javaClass.simpleName}")
                _connectionState.value = ConnectionState.ERROR
            }
        }.start()
    }
    
    /**
     * 연결 해제
     */
    fun disconnect() {
        // 백그라운드 스레드에서 연결 해제 작업 수행
        Thread {
            try {
                isReceiving = false
                isSending = false
                
                // 전송 스레드 종료
                sendThread?.interrupt()
                sendQueue.clear()
                
                socket?.close()
                outputStream?.close()
                inputStream?.close()
                _connectionState.value = ConnectionState.DISCONNECTED
                Log.d(TAG, "Disconnected")
            } catch (e: Exception) {
                Log.e(TAG, "Disconnect error: ${e.message}")
            }
        }.start()
    }
    
    /**
     * 전송 스레드 시작
     */
    private fun startSendingThread() {
        if (isSending) return
        
        isSending = true
        sendThread = Thread {
            Log.d(TAG, "Send thread started")
            while (isSending && socket?.isConnected == true) {
                try {
                    // 큐에서 데이터 가져오기 (블로킹)
                    val data = sendQueue.take()
                    
                    // 데이터 전송
                    outputStream?.write(data)
                    outputStream?.flush()
                    Log.d(TAG, "Sent ${data.size} bytes")
                    
                } catch (e: InterruptedException) {
                    Log.d(TAG, "Send thread interrupted")
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Send error: ${e.message}", e)
                    _connectionState.value = ConnectionState.ERROR
                    break
                }
            }
            Log.d(TAG, "Send thread stopped")
            isSending = false
        }
        sendThread?.start()
    }
    
    /**
     * 데이터 전송 (큐에 추가)
     */
    fun send(data: ByteArray) {
        if (!isSending || socket?.isConnected != true) {
            Log.w(TAG, "Cannot send: not connected or sending thread not started")
            return
        }
        
        try {
            sendQueue.put(data) // 큐에 데이터 추가 (블로킹되지 않음)
            Log.d(TAG, "Queued ${data.size} bytes for sending")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to queue data: ${e.message}", e)
        }
    }
    
    /**
     * 수신 스레드 시작
     */
    private fun startReceivingThread() {
        isReceiving = true
        Thread {
            val buffer = ByteArray(BUFFER_SIZE)
            while (isReceiving && socket?.isConnected == true) {
                try {
                    val bytesRead = inputStream?.read(buffer) ?: 0
                    if (bytesRead > 0) {
                        val packet = buffer.sliceArray(0 until bytesRead)
                        handleReceivedMessage(packet)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Receive error: ${e.message}")
                    break
                }
            }
            Log.d(TAG, "Receiving thread stopped")
        }.start()
    }
    
    /**
     * 수신된 메시지 처리
     */
    private fun handleReceivedMessage(packet: ByteArray) {
        val message = WifiMessageProtocol.deserializeMessage(packet)
        if (message != null) {
            Log.d(TAG, "Received message: ${message.messageType}")
            
            // IMAGE_DATA 메시지 처리
            if (message.messageType == MessageType.IMAGE_DATA) {
                // 이미지를 Bitmap으로 변환
                val bitmap = BitmapFactory.decodeByteArray(
                    message.data, 0, message.data.size
                )
                bitmap?.let {
                    // 메인 스레드에서 콜백 호출 (UI 업데이트를 위해)
                    Handler(Looper.getMainLooper()).post {
                        onImageReceived?.invoke(it)
                    }
                    Log.d(TAG, "이미지 수신 및 Bitmap 변환 완료: ${it.width}x${it.height}")
                } ?: run {
                    Log.e(TAG, "Bitmap 변환 실패: 이미지 데이터가 유효하지 않음")
                }
            } 
            // DOT_PATTERN 메시지 처리 (0x01, 웹에서 전송된 점자 패턴)
            else if (message.messageType == MessageType.DOT_PATTERN && message.data.isNotEmpty()) {
                // dotsByte (1바이트) 추출
                val dotsByte = message.data[0]
                Log.d(TAG, "DOT_PATTERN 수신: 0x${dotsByte.toString(16).padStart(2, '0')}")
                
                // 메인 스레드에서 콜백 호출 (UI 업데이트를 위해)
                Handler(Looper.getMainLooper()).post {
                    onDotPatternReceived?.invoke(dotsByte)
                }
            } else {
                // 다른 메시지는 기존대로 처리
                _receivedMessage.value = message
            }
        } else {
            Log.w(TAG, "Failed to deserialize message")
        }
    }
    
    /**
     * 연결 상태 확인
     */
    fun isConnected(): Boolean {
        return socket?.isConnected == true && _connectionState.value == ConnectionState.CONNECTED
    }
    
    /**
     * 연결 상태 디버그 정보
     */
    fun getDebugInfo(): String {
        return "Socket: ${socket?.let { "connected=${it.isConnected}, bound=${it.isBound}, closed=${it.isClosed}" } ?: "null"}, " +
                "State: ${_connectionState.value}, " +
                "OutputStream: ${outputStream != null}, " +
                "InputStream: ${inputStream != null}, " +
                "Receiving: $isReceiving"
    }
}

/**
 * 연결 상태
 */
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}

/**
 * WiFi 메시지
 */
data class WifiMessage(
    val messageType: MessageType?,
    val data: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as WifiMessage

        if (messageType != other.messageType) return false
        if (!data.contentEquals(other.data)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = messageType?.hashCode() ?: 0
        result = 31 * result + data.contentHashCode()
        return result
    }
}
