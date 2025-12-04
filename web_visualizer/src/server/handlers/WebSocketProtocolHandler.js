/**
 * WebSocket 프로토콜 핸들러
 * 웹 브라우저 클라이언트와 JSON 프로토콜로 통신
 */

const WebSocket = require('ws');
const ProtocolHandler = require('../interfaces/ProtocolHandler');

class WebSocketProtocolHandler extends ProtocolHandler {
  constructor(port = 8889) {
    super(port);
    this.wsServer = null;
    this.wsClients = new Map(); // ws -> clientInfo
  }
  
  /**
   * WebSocket 서버 시작
   */
  start() {
    if (this.isRunning) {
      console.log(`WebSocket 서버가 이미 실행 중: 포트 ${this.port}`);
      return;
    }
    
    this.wsServer = new WebSocket.Server({ 
      port: this.port,
      host: '0.0.0.0'
    });
    
    this.wsServer.on('connection', (ws, req) => {
      this.handleClient(ws, req);
    });
    
    this.wsServer.on('listening', () => {
      console.log(`🚀 WebSocket 서버 시작: 포트 ${this.port}`);
      this.isRunning = true;
    });
    
    this.wsServer.on('error', (error) => {
      console.error('WebSocket 서버 오류:', error);
      this.emit('error', { error });
    });
  }
  
  /**
   * WebSocket 서버 중지
   */
  stop() {
    if (this.wsServer) {
      this.wsServer.close();
      this.isRunning = false;
      console.log('WebSocket 서버 중지');
    }
    
    // 모든 클라이언트 연결 해제
    for (const [ws, clientInfo] of this.wsClients) {
      ws.close();
    }
    this.wsClients.clear();
    this.clients.clear();
  }
  
  /**
   * WebSocket 클라이언트 연결 처리
   */
  handleClient(ws, req) {
    const clientAddress = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientInfo = {
      id: clientId,
      address: clientAddress,
      userAgent: userAgent,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      type: 'WebSocket'
    };
    
    console.log(`🌐 WebSocket 클라이언트 연결: ${clientAddress} (ID: ${clientId})`);
    
    this.clients.add(ws);
    this.wsClients.set(ws, clientInfo);
    
    this.emit('client_connected', { 
      client: ws, 
      info: clientInfo 
    });
    
    // 연결 확인 메시지 전송
    this.sendToClient(ws, {
      type: 'connected',
      clientId: clientId,
      message: 'WebSocket 연결 성공'
    });
    
    ws.on('message', (data) => {
      try {
        const message = this.parseMessage(data);
        console.log(`📨 WebSocket 메시지 수신 (${clientId}): ${message.type}`);
        
        // 활동 시간 업데이트
        clientInfo.lastActivity = new Date().toISOString();
        
        // 메시지 이벤트 발생
        this.emit('message_received', {
          client: ws,
          message: message,
          clientInfo: clientInfo
        });
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
        this.emit('error', { error, client: ws });
      }
    });
    
    ws.on('close', () => {
      console.log(`🔌 WebSocket 클라이언트 연결 해제: ${clientAddress}`);
      this.clients.delete(ws);
      this.wsClients.delete(ws);
      
      this.emit('client_disconnected', { 
        client: ws, 
        info: clientInfo 
      });
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket 클라이언트 오류 (${clientId}):`, error);
      this.clients.delete(ws);
      this.wsClients.delete(ws);
      this.emit('error', { error, client: ws });
    });
  }
  
  /**
   * JSON 메시지 파싱
   */
  parseMessage(data) {
    return JSON.parse(data.toString());
  }
  
  /**
   * 클라이언트에 JSON 메시지 전송
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * 모든 WebSocket 클라이언트에 브로드캐스트
   */
  broadcast(message) {
    for (const [ws, clientInfo] of this.wsClients) {
      this.sendToClient(ws, message);
    }
    console.log(`📣 WebSocket 브로드캐스트: ${message.type || 'unknown'} (${this.wsClients.size}명)`);
  }
  
  /**
   * 클라이언트 목록 반환
   */
  getClients() {
    return Array.from(this.wsClients.values());
  }
}

module.exports = WebSocketProtocolHandler;

