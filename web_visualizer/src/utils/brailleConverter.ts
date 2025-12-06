import { BrailleDot } from '../types/braille';

/**
 * 문자를 점자 패턴으로 변환
 */
export const characterToBraillePattern = (char: string): BrailleDot[] => {
  const charUpper = char.toUpperCase();
  const brailleMap: { [key: string]: string } = {
    "A": "100000", "B": "110000", "C": "100100", "D": "100110",
    "E": "100010", "F": "110100", "G": "110110", "H": "110010",
    "I": "010100", "J": "010110", "K": "101000", "L": "111000",
    "M": "101100", "N": "101110", "O": "101010", "P": "111100",
    "Q": "111110", "R": "111010", "S": "011100", "T": "011110",
    "U": "101001", "V": "111001", "W": "010111", "X": "101101",
    "Y": "101111", "Z": "101011", " ": "000000"
  };
  
  const binary = brailleMap[charUpper] || "000000";
  return binary.split('').map((bit, index) => ({
    id: index + 1,
    isActive: bit === '1'
  }));
};

/**
 * 점자 패턴을 바이트로 변환
 */
export const patternToByte = (pattern: BrailleDot[]): number => {
  let byte = 0;
  for (let i = 0; i < 6; i++) {
    if (pattern[i]?.isActive) {
      byte |= (1 << i); // Bit 0: 점 1, Bit 1: 점 2, ..., Bit 5: 점 6
    }
  }
  return byte;
};

/**
 * 텍스트를 점자 시퀀스로 변환하여 WebSocket을 통해 전송
 */
export const sendTextAsBrailleSequence = (
  text: string,
  wsService: any,  // WebSocketService 타입
  addLog: (type: string, message: string) => void
) => {
  if (!text || text.length === 0) return;
  if (!wsService || !wsService.isConnected()) {
    addLog('error', 'WebSocket이 연결되지 않았습니다');
    return;
  }
  
  const upperText = text.toUpperCase();
  addLog('info', `텍스트 전송 시작: "${text}" (${upperText.length}자)`);
  
  // 텍스트를 공백으로 분리하여 단어 배열 생성
  const words = upperText.split(' ').filter(word => word.length > 0);
  
  // 각 단어를 처리
  words.forEach((word, wordIndex) => {
    // 단어의 모든 문자를 점자 바이트로 변환
    const wordBytes: number[] = [];
    
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const pattern = characterToBraillePattern(char);
      const byte = patternToByte(pattern);
      wordBytes.push(byte);
    }
    
    // 단어 전체를 한 번에 braille_sequence로 전송
    console.log(`📤 단어 전송 (${wordIndex + 1}/${words.length}): "${word}" - [${wordBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
    
    wsService.send({
      type: 'braille_sequence',
      patterns: wordBytes,
      patternCount: wordBytes.length
    });
    
    // 단어 사이에 word_separator 전송 (마지막 단어가 아닌 경우)
    if (wordIndex < words.length - 1) {
      console.log('📤 단어 구분자 전송');
      wsService.send({
        type: 'word_separator'
      });
    }
  });
  
  // 모든 단어 전송 완료 후 sentence_separator 전송
  console.log('📤 문장 구분자 전송');
  wsService.send({
    type: 'sentence_separator'
  });
  
  addLog('success', `텍스트 전송 완료: "${text}" (${words.length}개 단어)`);
};

