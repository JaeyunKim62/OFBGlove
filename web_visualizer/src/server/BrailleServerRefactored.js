#!/usr/bin/env node
/**
 * 통합 Braille Server (리팩토링 버전)
 * 인터페이스 기반 설계로 프로토콜 핸들러들을 조합
 */

const TcpProtocolHandler = require('./handlers/TcpProtocolHandler');
const WebSocketProtocolHandler = require('./handlers/WebSocketProtocolHandler');
const MessageBridge = require('./MessageBridge');

class BrailleServer {
  constructor(tcpPort = 8888, wsPort = 8889) {
    // 프로토콜 핸들러들 생성
    this.tcpHandler = new TcpProtocolHandler(tcpPort);
    this.wsHandler = new WebSocketProtocolHandler(wsPort);
    this.bridge = new MessageBridge();
    
    // 점자 상태 (공유)
    this.brailleDots = [false, false, false, false, false, false];
    this.currentSettings = {
      speed: 1,
      mode: 0,
      flags: 0x00
    };
    
    // 브리지 설정
    this.setupBridge();
  }
  
  /**
   * 프로토콜 간 브리지 설정
   * TCP ↔ WebSocket 메시지 변환 및 전달
   */
  setupBridge() {
    // TCP에서 메시지 받으면 → JSON 변환 → WebSocket 브로드캐스트
    this.tcpHandler.on('message_received', ({ client, message }) => {
      console.log(`🔄 TCP → WebSocket 브리지: 타입 0x${message.type.toString(16)}`);
      
      const jsonMessage = this.bridge.binaryToJson(message);
      if (jsonMessage) {
        // 점자 상태 업데이트
        this.updateBrailleState(jsonMessage);
        
        // WebSocket 클라이언트들에게 전달
        this.wsHandler.broadcast(jsonMessage);
      }
    });
    
    // WebSocket에서 메시지 받으면 → 바이너리 변환 → TCP 전송
    this.wsHandler.on('message_received', ({ client, message, clientInfo }) => {
      console.log(`📨 WebSocket 메시지: ${message.type}`);
      
      // 특수 메시지 처리
      if (this.handleSpecialMessage(client, message)) {
        return; // 특수 메시지는 여기서 끝
      }
      
      // 일반 메시지는 TCP로 전달
      const binaryMessage = this.bridge.jsonToBinary(message);
      if (binaryMessage) {
        console.log(`🔄 WebSocket → TCP 브리지: ${message.type}`);
        
        // 점자 상태 업데이트
        this.updateBrailleState(message);
        
        // TCP 클라이언트들에게 전달
        this.tcpHandler.broadcast(binaryMessage);
      }
    });
    
    // 클라이언트 연결/해제 이벤트
    this.tcpHandler.on('client_connected', ({ info }) => {
      console.log(`✅ TCP 클라이언트 연결: ${info.address}`);
      this.broadcastClientsUpdate();
    });
    
    this.tcpHandler.on('client_disconnected', ({ info }) => {
      console.log(`❌ TCP 클라이언트 연결 해제: ${info.address}`);
      this.broadcastClientsUpdate();
    });
    
    this.wsHandler.on('client_connected', ({ info }) => {
      console.log(`✅ WebSocket 클라이언트 연결: ${info.id}`);
      this.broadcastClientsUpdate();
    });
    
    this.wsHandler.on('client_disconnected', ({ info }) => {
      console.log(`❌ WebSocket 클라이언트 연결 해제: ${info.id}`);
      this.broadcastClientsUpdate();
    });
  }
  
  /**
   * 특수 메시지 처리 (브리지 없이 직접 처리)
   * @returns {boolean} 처리되었으면 true
   */
  handleSpecialMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        this.wsHandler.sendToClient(ws, {
          type: 'pong',
          t0: data.t0 || Date.now()
        });
        return true;
      
      case 'get_status':
        this.wsHandler.sendToClient(ws, {
          type: 'status',
          braille_dots: this.brailleDots,
          settings: this.currentSettings,
          tcp_clients: this.tcpHandler.getClientCount(),
          ws_clients: this.wsHandler.getClientCount(),
          timestamp: Date.now()
        });
        return true;
      
      case 'get_clients':
        const clients = this.wsHandler.getClients();
        this.wsHandler.sendToClient(ws, {
          type: 'clients',
          clients: clients,
          total: clients.length,
          timestamp: Date.now()
        });
        return true;
      
      default:
        return false; // 특수 메시지가 아님
    }
  }
  
  /**
   * 점자 상태 업데이트
   */
  updateBrailleState(message) {
    if (message.type === 'braille_pattern' && message.pattern) {
      this.brailleDots = message.pattern;
    }
  }
  
  /**
   * 클라이언트 목록 업데이트 브로드캐스트
   */
  broadcastClientsUpdate() {
    const clients = this.wsHandler.getClients();
    this.wsHandler.broadcast({
      type: 'clients_updated',
      clients: clients,
      total: clients.length,
      timestamp: Date.now()
    });
  }
  
  /**
   * 서버 시작
   */
  start() {
    console.log('🎯 통합 Braille Server 시작...');
    
    this.tcpHandler.start();
    this.wsHandler.start();
    
    console.log('🎯 통합 Braille Server 시작 완료!');
    console.log(`📡 TCP 서버: 0.0.0.0:${this.tcpHandler.port} (Android/ESP32용)`);
    console.log(`🌐 WebSocket 서버: ws://0.0.0.0:${this.wsHandler.port}/ws (웹 클라이언트용)`);
    console.log('='.repeat(50));
  }
  
  /**
   * 서버 중지
   */
  stop() {
    this.tcpHandler.stop();
    this.wsHandler.stop();
    console.log('🛑 통합 Braille Server 중지');
  }
}

module.exports = BrailleServer;

// 직접 실행 시
if (require.main === module) {
  const server = new BrailleServer(8888, 8889);
  server.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⚠️  서버 종료 중...');
    server.stop();
    process.exit(0);
  });
}

