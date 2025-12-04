/**
 * 메시지 브리지
 * 바이너리(TCP) ↔ JSON(WebSocket) 프로토콜 변환
 */

class MessageBridge {
  
  /**
   * 바이너리 메시지를 JSON으로 변환
   * TCP/ESP32 → WebSocket 클라이언트
   */
  binaryToJson(binaryMessage) {
    const { type: messageType, data, clientAddress } = binaryMessage;
    
    switch (messageType) {
      case 0x01: // DOT_PATTERN (점 터치)
        return {
          type: 'dot_pattern',
          dotIndex: data.length > 0 ? data[0] : 0,
          source: 'tcp',
          timestamp: Date.now()
        };
      
      case 0x02: // DOT_RELEASE (점 릴리즈)
        return {
          type: 'dot_release',
          dotIndex: data.length > 0 ? data[0] : 0,
          source: 'tcp',
          timestamp: Date.now()
        };
      
      case 0x03: // PATTERN_COMPLETE (패턴 완성)
        if (data.length > 0) {
          const dotsByte = data[0];
          const pattern = this.parseBraillePattern(dotsByte);
          return {
            type: 'braille_pattern',
            pattern: pattern,
            binary: `0b${dotsByte.toString(2).padStart(6, '0')}`,
            source: 'esp32',
            timestamp: Date.now()
          };
        }
        break;
      
      case 0x04: // CLEAR (초기화)
        return {
          type: 'clear',
          timestamp: Date.now()
        };
      
      case 0x05: // WORD_SEPARATOR (단어 구분자)
        return {
          type: 'word_separator',
          timestamp: Date.now()
        };
      
      case 0x06: // SENTENCE_SEPARATOR (문장 구분자)
        return {
          type: 'sentence_separator',
          timestamp: Date.now()
        };
      
      case 0x07: // BRAILLE_SEPARATOR (점자 구분자)
        return {
          type: 'braille_separator',
          timestamp: Date.now()
        };
      
      case 0x08: // BRAILLE_SEQUENCE (점자 시퀀스)
        if (data.length > 0) {
          const count = data[0];
          const patterns = [];
          for (let i = 0; i < count && i < data.length - 1; i++) {
            patterns.push(data[1 + i]);
          }
          return {
            type: 'braille_sequence',
            patterns: patterns,
            count: count,
            timestamp: Date.now()
          };
        }
        break;
      
      case 0x30: // IMAGE_DATA (이미지)
        return {
          type: 'image_data',
          image: data.toString('base64'),
          size: data.length,
          timestamp: Date.now()
        };
      
      default:
        console.log(`⚠️ 알 수 없는 메시지 타입: 0x${messageType.toString(16)}`);
        return {
          type: 'unknown',
          messageType: messageType,
          dataLength: data.length,
          timestamp: Date.now()
        };
    }
  }
  
  /**
   * JSON 메시지를 바이너리로 변환
   * WebSocket 클라이언트 → TCP/ESP32
   */
  jsonToBinary(jsonMessage) {
    switch (jsonMessage.type) {
      case 'dot_pattern':
        // 웹에서 입력한 점자 패턴 → ESP32로 전송
        if (typeof jsonMessage.pattern === 'number') {
          return {
            type: 0x03, // PATTERN_COMPLETE
            data: Buffer.from([jsonMessage.pattern])
          };
        } else if (Array.isArray(jsonMessage.pattern)) {
          // Boolean 배열을 바이트로 변환
          const dotsByte = this.packBrailleDots(jsonMessage.pattern);
          return {
            type: 0x03,
            data: Buffer.from([dotsByte])
          };
        }
        break;
      
      case 'image_data':
        // 웹에서 그린 이미지 → Android 앱으로 전송
        if (jsonMessage.image) {
          const imageBuffer = Buffer.from(jsonMessage.image, 'base64');
          return {
            type: 0x30, // IMAGE_DATA
            data: imageBuffer
          };
        }
        break;
      
      case 'clear':
        return {
          type: 0x04, // CLEAR
          data: Buffer.from([0x00])
        };
      
      case 'word_separator':
        return {
          type: 0x05, // WORD_SEPARATOR
          data: Buffer.from([0x00])
        };
      
      case 'sentence_separator':
        return {
          type: 0x06, // SENTENCE_SEPARATOR
          data: Buffer.from([0x00])
        };
      
      default:
        console.log(`⚠️ 변환 불가능한 메시지 타입: ${jsonMessage.type}`);
        return null;
    }
  }
  
  /**
   * 1바이트를 점자 패턴 배열로 변환
   */
  parseBraillePattern(dotsByte) {
    const pattern = [];
    for (let i = 0; i < 6; i++) {
      pattern.push((dotsByte & (1 << i)) !== 0);
    }
    return pattern;
  }
  
  /**
   * 점자 패턴 배열을 1바이트로 압축
   */
  packBrailleDots(dots) {
    let result = 0;
    for (let i = 0; i < Math.min(dots.length, 6); i++) {
      if (dots[i]) {
        result |= (1 << i);
      }
    }
    return result;
  }
}

module.exports = MessageBridge;

