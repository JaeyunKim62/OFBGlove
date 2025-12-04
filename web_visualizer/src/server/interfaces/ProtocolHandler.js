/**
 * 프로토콜 핸들러 기본 클래스
 * TCP, WebSocket, MQTT 등 다양한 프로토콜을 추상화
 * 
 * Android 앱의 CommunicationChannel과 유사한 구조
 */

const EventEmitter = require('events');

class ProtocolHandler extends EventEmitter {
  constructor(port) {
    super();
    this.port = port;
    this.clients = new Set();
    this.isRunning = false;
  }
  
  // ========== 추상 메서드 (하위 클래스에서 구현 필요) ==========
  
  /**
   * 서버 시작
   * @throws {Error} 구현되지 않은 경우
   */
  start() {
    throw new Error('ProtocolHandler.start() must be implemented by subclass');
  }
  
  /**
   * 서버 중지
   * @throws {Error} 구현되지 않은 경우
   */
  stop() {
    throw new Error('ProtocolHandler.stop() must be implemented by subclass');
  }
  
  /**
   * 클라이언트 연결 처리
   * @param {*} client - 클라이언트 객체 (Socket, WebSocket 등)
   * @throws {Error} 구현되지 않은 경우
   */
  handleClient(client) {
    throw new Error('ProtocolHandler.handleClient() must be implemented by subclass');
  }
  
  /**
   * 클라이언트에 메시지 전송
   * @param {*} client - 클라이언트 객체
   * @param {*} message - 전송할 메시지
   * @throws {Error} 구현되지 않은 경우
   */
  sendToClient(client, message) {
    throw new Error('ProtocolHandler.sendToClient() must be implemented by subclass');
  }
  
  /**
   * 모든 클라이언트에 메시지 브로드캐스트
   * @param {*} message - 전송할 메시지
   */
  broadcast(message) {
    for (const client of this.clients) {
      try {
        this.sendToClient(client, message);
      } catch (error) {
        console.error('Broadcast error:', error);
      }
    }
  }
  
  // ========== 공통 이벤트 (하위 클래스에서 emit) ==========
  
  /**
   * 이벤트:
   * - 'message_received': { client, message } - 메시지 수신
   * - 'client_connected': { client, info } - 클라이언트 연결
   * - 'client_disconnected': { client, info } - 클라이언트 연결 해제
   * - 'error': { error } - 오류 발생
   */
  
  // ========== 공통 유틸리티 메서드 ==========
  
  /**
   * 클라이언트 수 반환
   */
  getClientCount() {
    return this.clients.size;
  }
  
  /**
   * 실행 상태 확인
   */
  isServerRunning() {
    return this.isRunning;
  }
}

module.exports = ProtocolHandler;

