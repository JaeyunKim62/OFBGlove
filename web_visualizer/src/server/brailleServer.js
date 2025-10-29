#!/usr/bin/env node
/**
 * 통합 Braille Server
 * TCP 서버 (ESP32 앱용) + WebSocket 서버 (웹 클라이언트용)
 */

const WebSocket = require('ws');
const TCPBrailleServer = require('./tcpServer');

class BrailleServer {
  constructor(tcpPort = 8888, wsPort = 8889) {
    this.tcpServer = new TCPBrailleServer(tcpPort);
    this.wsServer = null;
    this.wsPort = wsPort;
    this.webSocketClients = new Map(); // WebSocket 클라이언트 정보 저장
  }

  start() {
    // TCP 서버 시작 (ESP32 앱용)
    this.tcpServer.start();

    // WebSocket 서버 시작 (웹 클라이언트용)
    this.wsServer = new WebSocket.Server({ 
      port: this.wsPort,
      host: '0.0.0.0' // 모든 인터페이스에서 접속 허용
    });

    this.wsServer.on('connection', (ws, req) => {
      const clientAddress = req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      
      console.log(`🔍 WebSocket 연결 시도: ${clientAddress} (${userAgent})`);
      
      // 차단된 클라이언트 확인
      if (this.tcpServer.isClientBlocked(clientAddress)) {
        console.log(`🚫 차단된 클라이언트 연결 거부: ${clientAddress} (${userAgent})`);
        ws.close(1000, 'Client blocked by administrator');
        return;
      }
      
      // 내부 연결 차단 (로컬호스트만 차단, 네트워크 연결은 허용)
      const isInternalConnection = 
        clientAddress === '127.0.0.1' || 
        clientAddress === '::1' || 
        clientAddress === '::ffff:127.0.0.1';
      
      // if (isInternalConnection) {
      //   console.log(`🚫 내부 연결 차단: ${clientAddress} (${userAgent})`);
      //   ws.close(1000, 'Internal connections are not allowed');
      //   return;
      // }
      
      console.log(`✅ 네트워크 연결 허용: ${clientAddress} (${userAgent})`);
      
      const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 클라이언트 정보 저장
      const clientInfo = {
        id: clientId,
        address: clientAddress,
        userAgent: userAgent,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        type: 'WebSocket'
      };
      
      this.webSocketClients.set(ws, clientInfo);
      
      console.log(`🌐 WebSocket 클라이언트 연결: ${clientAddress} (ID: ${clientId})`);
      
      // TCP 서버에 WebSocket 클라이언트 등록
      this.tcpServer.addWebSocketClient(ws);
      
      // 클라이언트 목록 업데이트 브로드캐스트
      this.broadcastClientsUpdate();

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          // 마지막 활동 시간 업데이트
          if (this.webSocketClients.has(ws)) {
            this.webSocketClients.get(ws).lastActivity = new Date().toISOString();
          }
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🌐 WebSocket 클라이언트 연결 해제: ${clientAddress} (ID: ${clientId})`);
        this.webSocketClients.delete(ws);
        this.tcpServer.removeWebSocketClient(ws);
        // 클라이언트 목록 업데이트 브로드캐스트
        this.broadcastClientsUpdate();
      });

      ws.on('error', (error) => {
        console.error(`WebSocket 클라이언트 오류 (${clientAddress}):`, error);
        this.webSocketClients.delete(ws);
        this.tcpServer.removeWebSocketClient(ws);
        // 클라이언트 목록 업데이트 브로드캐스트
        this.broadcastClientsUpdate();
      });
    });

    this.wsServer.on('listening', () => {
      console.log(`🌐 WebSocket 서버 시작: ws://0.0.0.0:${this.wsPort}/ws`);
      console.log(`📱 웹 클라이언트에서 이 주소로 연결하세요`);
    });

    this.wsServer.on('error', (error) => {
      console.error('WebSocket 서버 오류:', error);
    });

    console.log('🎯 통합 Braille Server 시작 완료!');
    console.log(`📡 TCP 서버: 0.0.0.0:${this.tcpServer.port} (ESP32 앱용)`);
    console.log(`🌐 WebSocket 서버: ws://0.0.0.0:${this.wsPort}/ws (웹 클라이언트용)`);
    console.log('=' * 50);
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          t0: data.t0 || Date.now()
        }));
        break;
      
      case 'block_client':
        if (data.address) {
          this.tcpServer.blockClient(data.address);
          console.log(`🚫 관리자 요청으로 클라이언트 차단: ${data.address}`);
        }
        break;
      
      case 'unblock_client':
        if (data.address) {
          this.tcpServer.unblockClient(data.address);
          console.log(`✅ 관리자 요청으로 클라이언트 차단 해제: ${data.address}`);
        }
        break;
      
      case 'get_blocked_clients':
        const blockedClients = this.tcpServer.getBlockedClients();
        ws.send(JSON.stringify({
          type: 'blocked_clients',
          clients: blockedClients
        }));
        break;

      case 'get_status':
        ws.send(JSON.stringify({
          type: 'status',
          braille_dots: this.tcpServer.brailleDots,
          pattern: this.tcpServer.getBraillePattern(),
          character: this.tcpServer.getBrailleCharacter(),
          settings: this.tcpServer.currentSettings,
          connected_clients: this.tcpServer.clients.size,
          timestamp: Date.now()
        }));
        break;

      case 'get_clients':
        const clients = Array.from(this.webSocketClients.values());
        ws.send(JSON.stringify({
          type: 'clients',
          clients: clients,
          total: clients.length,
          timestamp: Date.now()
        }));
        break;

      default:
        console.log('알 수 없는 WebSocket 메시지 타입:', data.type);
    }
  }

  // 클라이언트 목록 가져오기
  getClients() {
    return Array.from(this.webSocketClients.values());
  }

  // 모든 클라이언트에게 클라이언트 목록 업데이트 브로드캐스트
  broadcastClientsUpdate() {
    const clients = this.getClients();
    const message = JSON.stringify({
      type: 'clients_updated',
      clients: clients,
      total: clients.length,
      timestamp: Date.now()
    });

    this.webSocketClients.forEach((clientInfo, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (error) {
          console.error('클라이언트 목록 브로드캐스트 오류:', error);
        }
      }
    });
  }

  stop() {
    if (this.tcpServer) {
      this.tcpServer.stop();
    }
    if (this.wsServer) {
      this.wsServer.close();
    }
    console.log('🔚 통합 Braille Server 종료');
  }
}

// 서버 실행
if (require.main === module) {
  const server = new BrailleServer();
  
  // 종료 시그널 처리
  process.on('SIGINT', () => {
    console.log('\n🛑 종료 시그널 수신');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 종료 시그널 수신');
    server.stop();
    process.exit(0);
  });

  server.start();
}

module.exports = BrailleServer;
