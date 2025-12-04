/**
 * TCP 프로토콜 핸들러
 * Android/ESP32로부터 바이너리 프로토콜을 처리
 */

const net = require('net');
const ProtocolHandler = require('../interfaces/ProtocolHandler');

class TcpProtocolHandler extends ProtocolHandler {
  constructor(port = 8888) {
    super(port);
    this.server = null;
    this.tcpBuffers = new Map(); // socket -> Buffer
  }
  
  /**
   * TCP 서버 시작
   */
  start() {
    if (this.isRunning) {
      console.log(`TCP 서버가 이미 실행 중: 포트 ${this.port}`);
      return;
    }
    
    this.server = net.createServer((socket) => {
      this.handleClient(socket);
    });
    
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 TCP 서버 시작: 포트 ${this.port}`);
      this.isRunning = true;
    });
    
    this.server.on('error', (error) => {
      console.error('TCP 서버 오류:', error);
      this.emit('error', { error });
    });
  }
  
  /**
   * TCP 서버 중지
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.isRunning = false;
      console.log('TCP 서버 중지');
    }
    
    // 모든 클라이언트 연결 해제
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();
    this.tcpBuffers.clear();
  }
  
  /**
   * TCP 클라이언트 연결 처리
   */
  handleClient(socket) {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`🔗 TCP 클라이언트 연결: ${clientAddress}`);
    
    this.clients.add(socket);
    this.tcpBuffers.set(socket, Buffer.alloc(0));
    
    this.emit('client_connected', { 
      client: socket, 
      info: { address: clientAddress, type: 'TCP' }
    });
    
    socket.on('data', (data) => {
      console.log(`📨 TCP 데이터 수신 (${clientAddress}): ${data.length}바이트`);
      
      // 버퍼에 데이터 추가
      const existingBuffer = this.tcpBuffers.get(socket) || Buffer.alloc(0);
      const combinedBuffer = Buffer.concat([existingBuffer, data]);
      this.tcpBuffers.set(socket, combinedBuffer);
      
      // 메시지 파싱 및 처리
      this.processBuffer(socket, clientAddress);
    });
    
    socket.on('close', () => {
      console.log(`🔌 TCP 클라이언트 연결 해제: ${clientAddress}`);
      this.clients.delete(socket);
      this.tcpBuffers.delete(socket);
      
      this.emit('client_disconnected', { 
        client: socket, 
        info: { address: clientAddress }
      });
    });
    
    socket.on('error', (error) => {
      console.error(`TCP 클라이언트 오류 (${clientAddress}):`, error);
      this.clients.delete(socket);
      this.tcpBuffers.delete(socket);
      this.emit('error', { error, client: socket });
    });
  }
  
  /**
   * 버퍼에서 완전한 메시지 파싱
   */
  processBuffer(socket, clientAddress) {
    let buffer = this.tcpBuffers.get(socket);
    if (!buffer || buffer.length === 0) return;
    
    let processed = 0;
    
    while (buffer.length >= 4) {
      // 헤더 파싱 (4바이트)
      const messageType = buffer[0];
      const dataLength = (buffer[2] << 8) | buffer[1]; // Little Endian
      const checksum = buffer[3];
      const totalLength = 4 + dataLength;
      
      // 메시지가 완전한지 확인
      if (buffer.length < totalLength) {
        break; // 불완전한 메시지, 버퍼에 남김
      }
      
      // 데이터 추출
      const messageData = dataLength > 0 ? 
        buffer.slice(4, 4 + dataLength) : Buffer.alloc(0);
      
      // 체크섬 검증
      if (dataLength > 0) {
        const calculatedChecksum = this.calculateChecksum(messageData);
        if (calculatedChecksum !== checksum) {
          console.log(`❌ 체크섬 불일치`);
          buffer = buffer.slice(totalLength);
          this.tcpBuffers.set(socket, buffer);
          processed++;
          continue;
        }
      }
      
      console.log(`📥 메시지 타입: 0x${messageType.toString(16).padStart(2, '0')}, 크기: ${dataLength}`);
      
      // 메시지 이벤트 발생
      this.emit('message_received', {
        client: socket,
        message: {
          type: messageType,
          data: messageData,
          clientAddress
        }
      });
      
      // 처리된 메시지 제거
      buffer = buffer.slice(totalLength);
      this.tcpBuffers.set(socket, buffer);
      processed++;
    }
    
    if (processed > 0) {
      console.log(`✅ ${processed}개 메시지 처리 완료`);
    }
  }
  
  /**
   * 체크섬 계산 (XOR)
   */
  calculateChecksum(data) {
    let checksum = 0;
    for (const byte of data) {
      checksum ^= byte;
    }
    return checksum & 0xFF;
  }
  
  /**
   * 클라이언트에 바이너리 메시지 전송
   */
  sendToClient(socket, message) {
    try {
      // message.type과 message.data로 바이너리 패킷 생성
      const packet = this.serializeMessage(message.type, message.data || Buffer.alloc(0));
      socket.write(packet);
      console.log(`📤 TCP 전송: 타입 0x${message.type.toString(16)}, 크기 ${packet.length}`);
    } catch (error) {
      console.error('TCP 전송 오류:', error);
    }
  }
  
  /**
   * 메시지 직렬화 (바이너리)
   */
  serializeMessage(messageType, data) {
    const dataLength = data.length;
    const checksum = dataLength > 0 ? this.calculateChecksum(data) : 0;
    
    const packet = Buffer.alloc(4 + dataLength);
    packet[0] = messageType;
    packet[1] = dataLength & 0xFF;        // LSB
    packet[2] = (dataLength >> 8) & 0xFF; // MSB
    packet[3] = checksum;
    
    if (dataLength > 0) {
      data.copy(packet, 4);
    }
    
    return packet;
  }
}

module.exports = TcpProtocolHandler;

