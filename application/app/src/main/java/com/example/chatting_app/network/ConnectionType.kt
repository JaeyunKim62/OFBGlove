package com.example.chatting_app.network

/**
 * 연결 타입
 * 다양한 통신 방식을 나타냄
 */
enum class ConnectionType {
    /**
     * WiFi TCP 연결
     */
    WIFI,
    
    /**
     * Bluetooth Low Energy 연결
     */
    BLE,
    
    /**
     * WebSocket 연결 (미래 확장용)
     */
    WEBSOCKET,
    
    /**
     * 시리얼(USB) 연결 (미래 확장용)
     */
    SERIAL
}

