#!/usr/bin/env node
/**
 * TCP Braille Server
 * ESP32 앱에서 TCP로 전송하는 점자 데이터를 받아서 웹 클라이언트에 전달
 */

const net = require('net');
const EventEmitter = require('events');

class TCPBrailleServer extends EventEmitter {
  constructor(port = 8888) {
    super();
    this.port = port;
    this.server = null;
    this.clients = new Set();
    this.blockedClients = new Set(); // 차단된 클라이언트 주소 저장
    this.brailleDots = [false, false, false, false, false, false];
    this.currentSettings = {
      speed: 1,
      mode: 0,
      flags: 0x00
    };
    this.patternHistory = [];
  }

  // 체크섬 계산
  calculateChecksum(data) {
    let checksum = 0;
    for (const byte of data) {
      checksum ^= byte;
    }
    return checksum & 0xFF;
  }

  // 점자 패턴 문자열 반환
  getBraillePattern() {
    return this.brailleDots.map(dot => dot ? '1' : '0').join('');
  }

  // 점자 문자 반환
  getBrailleCharacter() {
    const pattern = this.getBraillePattern();
    const brailleMap = {
      "100000": "A", "110000": "B", "100100": "C", "100110": "D",
      "100010": "E", "110100": "F", "110110": "G", "110010": "H",
      "010100": "I", "010110": "J", "101000": "K", "111000": "L",
      "101100": "M", "101110": "N", "101010": "O", "111100": "P",
      "111110": "Q", "111010": "R", "011100": "S", "011110": "T",
      "101001": "U", "111001": "V", "010111": "W", "101101": "X",
      "101111": "Y", "101011": "Z", "000000": "공백"
    };
    return brailleMap[pattern] || "?";
  }

  // 메시지 타입 이름 반환 (Python 서버와 동일)
  getMessageTypeName(messageType) {
    const typeNames = {
      0x01: "점 터치",
      0x02: "점 릴리즈", 
      0x03: "패턴 완성",
      0x04: "초기화",
      0x05: "단어 구분자",
      0x06: "문장 구분자",
      0x07: "점자 구분자",
      0x10: "텍스트 메시지",
      0x20: "설정",
      0x81: "상태 업데이트",
      0x82: "메시지 수신 확인",
      0x83: "설정 업데이트 확인"
    };
    return typeNames[messageType] || "알 수 없음";
  }

  // ESP32 메시지 처리 (Python 서버와 동일한 로직)
  handleESP32Message(messageType, data) {
    try {
      switch (messageType) {
        case 0x01: // DOT_TOUCH
          if (data.length >= 1) {
            const dotIndex = data[0];
            if (dotIndex >= 0 && dotIndex < 6) {
              this.brailleDots[dotIndex] = true;
              const logMessage = `점 터치: ${dotIndex + 1}번 점 활성화`;
              console.log(`👆 ${logMessage}`);
              // 단일 브로드캐스트만 수행
              this.broadcastBrailleUpdate();
            }
          }
          break;

        case 0x02: // DOT_RELEASE
          if (data.length >= 1) {
            const dotIndex = data[0];
            if (dotIndex >= 0 && dotIndex < 6) {
              this.brailleDots[dotIndex] = false;
              const logMessage = `점 릴리즈: ${dotIndex + 1}번 점 비활성화`;
              console.log(`👆 ${logMessage}`);
              // 단일 브로드캐스트만 수행
              this.broadcastBrailleUpdate();
            }
          }
          break;

        case 0x03: // PATTERN_COMPLETE
          if (data.length >= 1) {
            const byteValue = data[0];
            // 바이트를 6개 점으로 변환
            for (let i = 0; i < 6; i++) {
              this.brailleDots[i] = (byteValue & (1 << i)) !== 0;
            }
            
            const pattern = this.getBraillePattern();
            const character = this.getBrailleCharacter();
            const logMessage = `패턴 완성: ${pattern} (${character})`;
            console.log(`📝 ${logMessage}`);
            
            // 단일 브로드캐스트만 수행 - 패턴 완성 시에만 로그 전송
            this.broadcastBrailleUpdate(true);
          }
          break;

        case 0x04: // CLEAR
          this.brailleDots = [false, false, false, false, false, false];
          const clearMessage = "점자 상태 초기화";
          console.log(`🧹 ${clearMessage}`);
          // 단일 브로드캐스트만 수행
          this.broadcastBrailleUpdate();
          break;

        case 0x05: // WORD_SEPARATOR
          const wordSepMessage = "단어 구분자 (공백)";
          console.log(`📝 ${wordSepMessage}`);
          this.broadcastLog('info', wordSepMessage, { action: 'word_separator' });
          this.broadcastToClients({
            type: "word_separator",
            timestamp: Date.now()
          });
          break;

        case 0x06: // SENTENCE_SEPARATOR
          const sentenceSepMessage = "문장 구분자";
          console.log(`📝 ${sentenceSepMessage}`);
          this.broadcastLog('info', sentenceSepMessage, { action: 'sentence_separator' });
          this.broadcastToClients({
            type: "sentence_separator",
            timestamp: Date.now()
          });
          break;

        case 0x07: // BRAILLE_SEPARATOR
          const brailleSepMessage = "점자 구분자 (개별 점자 모드)";
          console.log(`📝 ${brailleSepMessage}`);
          this.broadcastLog('info', brailleSepMessage, { action: 'braille_separator' });
          this.broadcastToClients({
            type: "braille_separator",
            timestamp: Date.now()
          });
          break;

        case 0x10: // TEXT_MESSAGE
          try {
            const text = data.toString('utf-8');
            const textMessage = `텍스트 메시지: '${text}'`;
            console.log(`📝 ${textMessage}`);
            this.broadcastLog('info', textMessage, { text, action: 'text_message' });
            this.broadcastToClients({
              type: "text_message",
              text: text,
              timestamp: Date.now()
            });
          } catch (error) {
            const errorMessage = `텍스트 디코딩 실패: ${error.message}`;
            console.error(errorMessage, error);
            this.broadcastLog('error', errorMessage, { error: error.message });
          }
          break;

        case 0x20: // SETTINGS
          if (data.length >= 2) {
            const speed = data[0];
            const mode = data[1];
            if (speed >= 0 && speed <= 2 && mode >= 0 && mode <= 2) {
              this.currentSettings.speed = speed;
              this.currentSettings.mode = mode;
              const settingsMessage = `설정 업데이트: speed=${speed}, mode=${mode}`;
              console.log(`⚙️ ${settingsMessage}`);
              this.broadcastLog('info', settingsMessage, { speed, mode, action: 'settings' });
              this.broadcastToClients({
                type: "settings_updated",
                settings: { speed, mode },
                timestamp: Date.now()
              });
            }
          }
          break;

        default:
          const unknownMessage = `알 수 없는 메시지 타입: 0x${messageType.toString(16)}`;
          console.log(unknownMessage);
          this.broadcastLog('warning', unknownMessage, { messageType, action: 'unknown' });
      }
    } catch (error) {
      const errorMessage = `ESP32 메시지 처리 오류: ${error.message}`;
      console.error(errorMessage, error);
      this.broadcastLog('error', errorMessage, { error: error.message });
    }
  }

  // 점자 상태 업데이트 브로드캐스트
  broadcastBrailleUpdate(sendLog = false) {
    const pattern = {
      dots: [...this.brailleDots],
      timestamp: Date.now(),
      source: "esp32"
    };
    
    this.patternHistory.push(pattern);
    
    // 최근 100개 패턴만 유지
    if (this.patternHistory.length > 100) {
      this.patternHistory = this.patternHistory.slice(-100);
    }
    
    const braillePattern = this.getBraillePattern();
    const character = this.getBrailleCharacter();
    
    console.log(`📝 점자 패턴 업데이트: ${braillePattern} (${character})`);
    
    // 패턴 브로드캐스트
    this.broadcastToClients({
      type: "braille_pattern",
      pattern: this.brailleDots,
      binary: braillePattern,
      character: character,
      timestamp: pattern.timestamp
    });
    
    // 로그 브로드캐스트 (요청된 경우에만)
    if (sendLog && braillePattern !== '000000') {
      this.broadcastLog('success', `패턴 완성: ${braillePattern} (${character})`, { 
        pattern: braillePattern, 
        character, 
        timestamp: pattern.timestamp 
      });
    }
  }

  // 모든 클라이언트에 메시지 브로드캐스트
  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    console.log(`📤 WebSocket 브로드캐스트: ${message.type} (${this.clients.size}개 클라이언트)`);
    
    let successCount = 0;
    let errorCount = 0;
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(messageStr);
          successCount++;
        } catch (error) {
          console.error("❌ 클라이언트 전송 오류:", error);
          this.clients.delete(client);
          errorCount++;
        }
      } else {
        console.log(`⚠️ 클라이언트 연결 상태 이상: ${client.readyState}`);
        errorCount++;
      }
    });
    
    if (successCount > 0) {
      console.log(`✅ 클라이언트 전송 성공: ${successCount}개`);
    }
    if (errorCount > 0) {
      console.log(`❌ 클라이언트 전송 실패: ${errorCount}개`);
    }
  }

  // 로그 브로드캐스트
  broadcastLog(type, message, data = null) {
    const logMessage = {
      type: 'server_log',
      log: {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        type: type,
        message: message,
        data: data
      }
    };
    
    this.broadcastToClients(logMessage);
  }

  // TCP 클라이언트 연결 처리
  handleTCPClient(socket) {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`🔗 TCP 클라이언트 연결: ${clientAddress}`);
    console.log(`📊 현재 TCP 클라이언트 수: ${this.server.listenerCount('connection')}`);

    socket.on('data', (data) => {
      console.log(`📨 TCP 데이터 수신 (${clientAddress}): ${data.length}바이트`);
      this.processTCPData(data, clientAddress);
    });

    socket.on('close', () => {
      console.log(`🔌 TCP 클라이언트 연결 해제: ${clientAddress}`);
    });

    socket.on('error', (error) => {
      console.error(`TCP 클라이언트 오류 (${clientAddress}):`, error);
    });
  }

  // TCP 데이터 처리 (Python 서버와 동일한 방식)
  processTCPData(data, clientAddress) {
    try {
      // 헤더 읽기 (4바이트)
      if (data.length < 4) {
        const logMessage = `불완전한 헤더: ${data.length}바이트`;
        console.log(`❌ ${logMessage}`);
        this.broadcastLog('warning', logMessage, { dataLength: data.length, clientAddress });
        return;
      }

      // 헤더 파싱 (Little Endian) - Python과 동일
      const messageType = data[0];
      const dataLength = (data[2] << 8) | data[1]; // Little Endian
      const checksum = data[3];

      const messageTypeName = this.getMessageTypeName(messageType);
      console.log(`📥 수신: ${messageTypeName} (0x${messageType.toString(16).padStart(2, '0')}), 크기=${dataLength}, 체크섬=0x${checksum.toString(16).padStart(2, '0')}`);

      // 데이터 읽기
      if (dataLength > 0) {
        if (data.length < 4 + dataLength) {
          const logMessage = `불완전한 데이터: ${data.length - 4}/${dataLength}바이트`;
          console.log(`❌ ${logMessage}`);
          this.broadcastLog('warning', logMessage, { receivedLength: data.length - 4, expectedLength: dataLength, clientAddress });
          return;
        }

        const messageData = data.slice(4, 4 + dataLength);

        // 체크섬 검증
        const calculatedChecksum = this.calculateChecksum(messageData);
        if (calculatedChecksum !== checksum) {
          const logMessage = `체크섬 불일치: 계산=0x${calculatedChecksum.toString(16).padStart(2, '0')}, 수신=0x${checksum.toString(16).padStart(2, '0')}`;
          console.log(`❌ ${logMessage}`);
          this.broadcastLog('error', logMessage, { calculatedChecksum, receivedChecksum: checksum, clientAddress });
          return;
        }

        // 메시지 타입별 처리
        this.handleESP32Message(messageType, messageData);
      } else {
        // 데이터가 없는 메시지 (CLEAR 등)
        this.handleESP32Message(messageType, Buffer.alloc(0));
      }

    } catch (error) {
      const logMessage = `TCP 데이터 처리 오류: ${error.message}`;
      console.error(`❌ ${logMessage}`, error);
      this.broadcastLog('error', logMessage, { error: error.message, clientAddress });
    }
  }

  // 서버 시작
  start() {
    this.server = net.createServer((socket) => {
      this.handleTCPClient(socket);
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 TCP Braille Server 시작!`);
      console.log(`📡 TCP 서버: 0.0.0.0:${this.port}`);
      console.log(`💡 ESP32 앱에서 이 주소로 TCP 연결하세요`);
      console.log(`🔗 연결 주소: 172.20.100.102:${this.port}`);
      console.log("=" * 50);
    });

    this.server.on('error', (error) => {
      console.error("TCP 서버 오류:", error);
    });
  }

  // 서버 종료
  stop() {
    if (this.server) {
      this.server.close();
      console.log("🔚 TCP Braille Server 종료");
    }
  }

  // WebSocket 클라이언트 등록
  addWebSocketClient(ws) {
    this.clients.add(ws);
    console.log(`📊 WebSocket 클라이언트 등록: ${this.clients.size}개 연결됨`);
    
    // 현재 상태 전송
    ws.send(JSON.stringify({
      type: "connected",
      status: "connected",
      braille_dots: this.brailleDots,
      pattern: this.getBraillePattern(),
      character: this.getBrailleCharacter(),
      timestamp: Date.now()
    }));
  }

  // WebSocket 클라이언트 제거
  removeWebSocketClient(ws) {
    this.clients.delete(ws);
    console.log(`📊 WebSocket 클라이언트 제거: ${this.clients.size}개 연결됨`);
  }

  // 클라이언트 차단
  blockClient(address) {
    this.blockedClients.add(address);
    console.log(`🚫 클라이언트 차단: ${address}`);
    
    // 해당 주소의 기존 연결들 강제 종료
    this.clients.forEach(client => {
      if (client._socket && client._socket.remoteAddress === address) {
        console.log(`🔌 차단된 클라이언트 연결 종료: ${address}`);
        client.close(1000, 'Client blocked by administrator');
        this.clients.delete(client);
      }
    });
    
    this.broadcastLog('warning', `클라이언트 차단됨: ${address}`, { 
      action: 'block_client', 
      address: address 
    });
  }

  // 클라이언트 차단 해제
  unblockClient(address) {
    this.blockedClients.delete(address);
    console.log(`✅ 클라이언트 차단 해제: ${address}`);
    
    this.broadcastLog('info', `클라이언트 차단 해제됨: ${address}`, { 
      action: 'unblock_client', 
      address: address 
    });
  }

  // 클라이언트가 차단되었는지 확인
  isClientBlocked(address) {
    return this.blockedClients.has(address);
  }

  // 차단된 클라이언트 목록 반환
  getBlockedClients() {
    return Array.from(this.blockedClients);
  }
}

module.exports = TCPBrailleServer;
