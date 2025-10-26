import React, { useState, useEffect, useRef } from 'react';
import { BrailleCell } from './components/BrailleCell';
import { BrailleInput } from './components/BrailleInput';
import { ConnectionInfo } from './components/ConnectionInfo';
import { ServerLog } from './components/ServerLog';
import { WebSocketService } from './services/WebSocketService';
import { DataCollector } from './utils/dataCollector';
import { BraillePattern, BrailleData, BrailleDot } from './types/braille';
import './App.css';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  data?: any;
}

function App() {
  const [braillePattern, setBraillePattern] = useState<BraillePattern | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState<BrailleData>({ patterns: [], totalCount: 0, lastUpdated: 0 });
  const [statistics, setStatistics] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showConnectionInfo, setShowConnectionInfo] = useState(false);
  const [showServerLog, setShowServerLog] = useState(false);
  const [brailleSequence, setBrailleSequence] = useState<BraillePattern[]>([]);
  const [showSequence, setShowSequence] = useState(false);
  const [sequenceWithSeparators, setSequenceWithSeparators] = useState<any[]>([]);
  
  // 문장 단위 시퀀스 (실시간 입력용)
  const [currentSentenceSequence, setCurrentSentenceSequence] = useState<BraillePattern[]>([]);
  const [isPlayingCurrentSentence, setIsPlayingCurrentSentence] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [displayDuration, setDisplayDuration] = useState(3000); // 기본 3초
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [displayMode, setDisplayMode] = useState<'hide' | 'fade' | 'keep'>('hide'); // 표시 모드
  const [brailleInterval, setBrailleInterval] = useState(1000); // 점자 간 간격 1초
  const [currentBrailleIndex, setCurrentBrailleIndex] = useState(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [separatorTimings, setSeparatorTimings] = useState<number[]>([]); // separator 간격 저장
  const [playbackMode, setPlaybackMode] = useState<'fixed' | 'original' | 'adaptive'>('fixed'); // 재생 모드
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 재생 속도 배율
  const [replayCount, setReplayCount] = useState(0); // 재생 횟수 추적
  const [navigationIndex, setNavigationIndex] = useState(0); // 네비게이션 인덱스
  const [wordSequence, setWordSequence] = useState<BraillePattern[][]>([]); // 단어별 점자 시퀀스
  const [currentWordIndex, setCurrentWordIndex] = useState(0); // 현재 단어 인덱스
  const [isPlayingWord, setIsPlayingWord] = useState(false); // 단어 재생 상태
  const [autoWordRepeat, setAutoWordRepeat] = useState(true); // 자동 단어 반복 활성화
  const [separatorOptimization, setSeparatorOptimization] = useState({
    wordSeparatorDelay: 1000, // 단어 구분자 지연 시간
    sentenceSeparatorDelay: 2000, // 문장 구분자 지연 시간
    brailleSeparatorDelay: 500, // 점자 구분자 지연 시간
    enableOptimization: true // 최적화 활성화
  });
  const [isInputMode, setIsInputMode] = useState(true); // 점자 입력 모드 (기본 활성화)
  const [inputPatterns, setInputPatterns] = useState<BraillePattern[]>([]); // 입력된 점자 패턴들
  
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const dataCollectorRef = useRef<DataCollector | null>(null);
  const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBrailleTimeRef = useRef<number>(0); // 마지막 점자 수신 시간
  const isRealTimeInputRef = useRef<boolean>(false); // 실시간 입력 상태 추적

  // 로그 추가 함수
  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // 최근 100개만 유지
  };

  // 로그 지우기 함수
  const clearLogs = () => {
    setLogs([]);
  };

  // 시퀀스 초기화 함수
  const clearSequence = () => {
    setBrailleSequence([]);
    setSequenceWithSeparators([]);
    setSeparatorTimings([]);
  };

  // 현재 문장 시퀀스 초기화 함수
  const clearCurrentSentenceSequence = () => {
    setCurrentSentenceSequence([]);
    setCurrentSentenceIndex(0);
    setIsPlayingCurrentSentence(false);
  };

  // 실시간 입력용 점자 패턴 표시 (시퀀스 재생과 동일한 방식)
  const displayRealTimeBraillePattern = (pattern: BraillePattern) => {
    console.log(`🎤 실시간 입력: ${pattern.character} (${pattern.binary}), 모드: ${displayMode}, 시간: ${displayDuration}ms`);
    isRealTimeInputRef.current = true;
    setBraillePattern(pattern);
    
    // 기존 타이머 클리어
    if (displayTimeoutRef.current) {
      clearTimeout(displayTimeoutRef.current);
      console.log('⏰ 실시간 입력 - 기존 타이머 클리어됨');
    }
    
    // 표시 모드에 따른 처리
    switch (displayMode) {
      case 'hide':
        // 설정된 시간 후 숨김
        if (displayDuration > 0) {
          console.log(`⏰ 실시간 입력 - ${displayDuration}ms 후 숨김 타이머 설정`);
          displayTimeoutRef.current = setTimeout(() => {
            console.log('👻 실시간 입력 - 점자 패턴 숨김');
            setBraillePattern(null);
            isRealTimeInputRef.current = false;
          }, displayDuration);
        }
        break;
        
      case 'fade':
        // 페이드 아웃 효과 (CSS transition 사용)
        if (displayDuration > 0) {
          console.log(`⏰ 실시간 입력 - ${displayDuration}ms 후 페이드 아웃 타이머 설정`);
          displayTimeoutRef.current = setTimeout(() => {
            console.log('👻 실시간 입력 - 점자 패턴 페이드 아웃');
            setBraillePattern(null);
            isRealTimeInputRef.current = false;
          }, displayDuration);
        }
        break;
        
      case 'keep':
        // 계속 표시 (타이머 설정 안함)
        console.log('🔒 실시간 입력 - 계속 표시 모드 - 타이머 설정 안함');
        break;
    }
  };


  // 점자 시퀀스 재생 함수 (개선된 버전)
  const playBrailleSequence = () => {
    if (brailleSequence.length === 0) return;
    
    setIsPlayingSequence(true);
    setCurrentBrailleIndex(0);
    isRealTimeInputRef.current = false; // 시퀀스 재생 시작 시 실시간 입력 상태 초기화
    
    const playNextBraille = (index: number) => {
      if (index >= brailleSequence.length) {
        setIsPlayingSequence(false);
        setBraillePattern(null);
        return;
      }
      
      const pattern = brailleSequence[index];
      // 시퀀스 재생 중에는 displayBraillePattern을 사용하지 않고 직접 설정
      console.log(`🎬 시퀀스 재생: ${index + 1}/${brailleSequence.length} - ${pattern.character} (${pattern.binary})`);
      
      // 실시간 입력 타이머가 있으면 클리어
      if (displayTimeoutRef.current) {
        clearTimeout(displayTimeoutRef.current);
        console.log('⏰ 시퀀스 재생 - 실시간 입력 타이머 클리어');
      }
      
      setBraillePattern(pattern);
      setCurrentBrailleIndex(index);
      
      // 재생 모드에 따른 간격 계산
      let nextInterval = brailleInterval; // 기본값
      
      switch (playbackMode) {
        case 'fixed':
          // 고정 간격 사용
          nextInterval = brailleInterval;
          break;
          
        case 'original':
          // 원본 separator 간격 사용
          if (separatorTimings.length > index) {
            nextInterval = separatorTimings[index];
          }
          break;
          
        case 'adaptive':
          // 적응형: 원본 간격을 속도 배율로 조정
          if (separatorTimings.length > index) {
            nextInterval = Math.max(200, separatorTimings[index] / playbackSpeed);
          } else {
            nextInterval = brailleInterval / playbackSpeed;
          }
          break;
      }
      
      // 속도 배율 적용
      nextInterval = Math.max(200, nextInterval / playbackSpeed);
      
      console.log(`⏱️ 다음 점자까지 ${nextInterval}ms 대기 (모드: ${playbackMode}, 속도: ${playbackSpeed}x)`);
      
      sequenceTimeoutRef.current = setTimeout(() => {
        playNextBraille(index + 1);
      }, nextInterval);
    };
    
    playNextBraille(0);
  };

  // 시퀀스 재생 중지
  const stopBrailleSequence = () => {
    setIsPlayingSequence(false);
    setCurrentBrailleIndex(0);
    setBraillePattern(null);
    isRealTimeInputRef.current = false; // 시퀀스 재생 중지 시 실시간 입력 상태 초기화
    
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
    }
  };

  // 재생 속도 조절 (실시간)
  const adjustPlaybackSpeed = (newSpeed: number) => {
    setPlaybackSpeed(Math.max(0.1, Math.min(5.0, newSpeed)));
  };

  // 재생 모드 변경
  const changePlaybackMode = (mode: 'fixed' | 'original' | 'adaptive') => {
    setPlaybackMode(mode);
    if (isPlayingSequence) {
      // 재생 중이면 재시작
      stopBrailleSequence();
      setTimeout(() => playBrailleSequence(), 100);
    }
  };

  // 다시듣기 기능 (전체 시퀀스)
  const replayBrailleSequence = () => {
    if (brailleSequence.length === 0) return;
    
    setReplayCount(prev => prev + 1);
    addLog('info', `다시듣기 시작 (${replayCount + 1}번째)`, { replayCount: replayCount + 1 });
    
    // 기존 재생 중지
    if (isPlayingSequence) {
      stopBrailleSequence();
    }
    
    // 잠시 후 재생 시작
    setTimeout(() => {
      playBrailleSequence();
    }, 200);
  };

  // 현재 문장 다시듣기 기능
  const replayCurrentSentence = () => {
    if (currentSentenceSequence.length === 0) return;
    
    setReplayCount(prev => prev + 1);
    addLog('info', `현재 문장 다시듣기 시작 (${replayCount + 1}번째)`, { replayCount: replayCount + 1 });
    
    // 기존 재생 중지
    if (isPlayingCurrentSentence) {
      stopCurrentSentenceSequence();
    }
    
    // 잠시 후 재생 시작
    setTimeout(() => {
      playCurrentSentenceSequence();
    }, 200);
  };



  // 구분자 최적화 설정 업데이트
  const updateSeparatorOptimization = (key: string, value: number | boolean) => {
    setSeparatorOptimization(prev => ({
      ...prev,
      [key]: value
    }));
    addLog('info', `구분자 최적화 설정 변경: ${key} = ${value}`, { key, value });
  };

  // 문장을 단어별로 분할하는 함수 (구분자 정보 활용)
  const splitSentenceIntoWords = (sentence: BraillePattern[]) => {
    const words: BraillePattern[][] = [];
    let currentWord: BraillePattern[] = [];
    
    // sequenceWithSeparators에서 해당 문장의 구분자 정보 찾기
    const sentenceStartIndex = brailleSequence.findIndex(p => p.timestamp === sentence[0]?.timestamp);
    const sentenceEndIndex = sentenceStartIndex + sentence.length;
    
    // 해당 범위의 구분자 정보 추출
    const relevantSeparators = sequenceWithSeparators.slice(sentenceStartIndex, sentenceEndIndex);
    
    let wordStartIndex = 0;
    
    for (let i = 0; i < relevantSeparators.length; i++) {
      const item = relevantSeparators[i];
      
      if (item.type === 'braille') {
        // 점자 패턴이면 현재 단어에 추가
        const patternIndex = sentenceStartIndex + i - wordStartIndex;
        if (patternIndex < sentence.length) {
          currentWord.push(sentence[patternIndex]);
        }
      } else if (item.type === 'word_separator') {
        // 단어 구분자면 현재 단어를 완성하고 새 단어 시작
        if (currentWord.length > 0) {
          words.push([...currentWord]);
          currentWord = [];
        }
      } else if (item.type === 'sentence_separator') {
        // 문장 구분자면 현재 단어를 완성하고 종료
        if (currentWord.length > 0) {
          words.push([...currentWord]);
        }
        break;
      }
    }
    
    // 마지막 단어 처리
    if (currentWord.length > 0) {
      words.push(currentWord);
    }
    
    // 구분자 정보가 없으면 전체 문장을 하나의 단어로 처리
    if (words.length === 0 && sentence.length > 0) {
      words.push([...sentence]);
    }
    
    return words;
  };

  // 단어 반복 재생 함수
  const playWordRepeat = (wordIndex: number) => {
    if (wordSequence.length === 0 || wordIndex >= wordSequence.length) return;
    
    const word = wordSequence[wordIndex];
    if (word.length === 0) return;
    
    setIsPlayingWord(true);
    setCurrentWordIndex(wordIndex);
    
    const playNextBraille = (brailleIndex: number) => {
      if (brailleIndex >= word.length) {
        // 단어 재생 완료 후 반복
        if (autoWordRepeat) {
          setTimeout(() => {
            playWordRepeat(wordIndex); // 같은 단어 반복
          }, 1000); // 1초 대기 후 반복
        } else {
          setIsPlayingWord(false);
        }
        return;
      }
      
      const pattern = word[brailleIndex];
      setBraillePattern(pattern);
      
      // 다음 점자로 이동 (단어 내에서의 간격)
      const nextInterval = Math.max(200, brailleInterval / playbackSpeed);
      
      setTimeout(() => {
        playNextBraille(brailleIndex + 1);
      }, nextInterval);
    };
    
    playNextBraille(0);
    addLog('info', `단어 ${wordIndex + 1}/${wordSequence.length} 반복 재생 시작`, { 
      wordIndex, 
      wordLength: word.length,
      word: word.map(p => p.character).join('')
    });
  };

  // 다음 단어로 이동
  const navigateToNextWord = () => {
    if (wordSequence.length === 0) return;
    
    const nextWordIndex = Math.min(wordSequence.length - 1, currentWordIndex + 1);
    setCurrentWordIndex(nextWordIndex);
    
    // 기존 단어 재생 중지
    if (isPlayingWord) {
      setIsPlayingWord(false);
    }
    
    // 새 단어 재생 시작
    setTimeout(() => {
      playWordRepeat(nextWordIndex);
    }, 200);
  };

  // 이전 단어로 이동
  const navigateToPreviousWord = () => {
    if (wordSequence.length === 0) return;
    
    const prevWordIndex = Math.max(0, currentWordIndex - 1);
    setCurrentWordIndex(prevWordIndex);
    
    // 기존 단어 재생 중지
    if (isPlayingWord) {
      setIsPlayingWord(false);
    }
    
    // 새 단어 재생 시작
    setTimeout(() => {
      playWordRepeat(prevWordIndex);
    }, 200);
  };

  // 단어 재생 중지
  const stopWordPlayback = () => {
    setIsPlayingWord(false);
    addLog('info', '단어 재생 중지');
  };

  // 소스별 패턴 분류 함수
  const getPatternsBySource = () => {
    const esp32Patterns = brailleSequence.filter(p => p.source === 'esp32');
    const webPatterns = brailleSequence.filter(p => p.source === 'web');
    const demoPatterns = brailleSequence.filter(p => p.source === 'demo');
    
    return {
      esp32: esp32Patterns,
      web: webPatterns,
      demo: demoPatterns,
      total: brailleSequence.length
    };
  };

  // 점자 입력 관련 함수들
  const handleBraillePatternComplete = (pattern: BrailleDot[]) => {
    const newPattern: BraillePattern = {
      dots: pattern,
      timestamp: Date.now(),
      source: 'web',
      character: getBrailleCharacter(pattern),
      binary: pattern.map(d => d.isActive ? '1' : '0').join('')
    };

    // 입력된 패턴을 상태에 추가
    setInputPatterns(prev => [...prev, newPattern]);
    
    // 현재 문장 시퀀스에도 추가
    setCurrentSentenceSequence(prev => [...prev, newPattern]);
    
    // 전체 시퀀스에도 추가
    setBrailleSequence(prev => [...prev, newPattern]);
    setSequenceWithSeparators(prev => [...prev, { type: 'braille', pattern: newPattern }]);
    
    // 데이터 수집기에 추가
    dataCollectorRef.current?.addPattern(newPattern);
    
    // 로그 추가
    addLog('success', `점자 패턴 입력 완료: ${newPattern.binary} (${newPattern.character})`, newPattern);
    
    // 입력 모드는 계속 유지 - setIsInputMode(false) 제거
  };

  const handleBraillePatternChange = (pattern: BrailleDot[]) => {
    // 실시간으로 패턴 변경 시 현재 패턴 표시 (입력 모드는 유지)
    const tempPattern: BraillePattern = {
      dots: pattern,
      timestamp: Date.now(),
      source: 'web',
      character: getBrailleCharacter(pattern),
      binary: pattern.map(d => d.isActive ? '1' : '0').join('')
    };
    
    setBraillePattern(tempPattern);
    // 입력 모드는 유지 - setIsInputMode(false) 제거
  };

  // 점자 문자 변환 함수
  const getBrailleCharacter = (pattern: BrailleDot[]): string => {
    const binary = pattern.map(d => d.isActive ? '1' : '0').join('');
    const brailleMap: { [key: string]: string } = {
      "100000": "A", "110000": "B", "100100": "C", "100110": "D",
      "100010": "E", "110100": "F", "110110": "G", "110010": "H",
      "010100": "I", "010110": "J", "101000": "K", "111000": "L",
      "101100": "M", "101110": "N", "101010": "O", "111100": "P",
      "111110": "Q", "111010": "R", "011100": "S", "011110": "T",
      "101001": "U", "111001": "V", "010111": "W", "101101": "X",
      "101111": "Y", "101011": "Z", "000000": " "
    };
    return brailleMap[binary] || "?";
  };

  // 입력 모드 토글
  const toggleInputMode = () => {
    setIsInputMode(!isInputMode);
    if (!isInputMode) {
      addLog('info', '점자 입력 모드 활성화');
    } else {
      addLog('info', '점자 입력 모드 비활성화');
    }
  };

  // 현재 문장 시퀀스 재생 함수
  const playCurrentSentenceSequence = (startIndex: number = 0) => {
    if (currentSentenceSequence.length === 0) return;
    
    setIsPlayingCurrentSentence(true);
    setCurrentSentenceIndex(startIndex);
    
    const playNextBraille = (index: number) => {
      if (index >= currentSentenceSequence.length) {
        setIsPlayingCurrentSentence(false);
        setBraillePattern(null);
        console.log('📝 문장 시퀀스 재생 완료');
        // 재생 완료 후 문장 시퀀스 초기화
        setTimeout(() => {
          clearCurrentSentenceSequence();
        }, 1000); // 1초 후 초기화
        return;
      }
      
      const pattern = currentSentenceSequence[index];
      console.log(`📝 문장 재생: ${index + 1}/${currentSentenceSequence.length} - ${pattern.character} (${pattern.binary})`);
      
      // 기존 타이머 클리어
      if (displayTimeoutRef.current) {
        clearTimeout(displayTimeoutRef.current);
      }
      
      setBraillePattern(pattern);
      setCurrentSentenceIndex(index);
      
      // 다음 점자로 이동 - separator 간격 사용
      let nextInterval = brailleInterval; // 기본값
      
      // separator 간격이 있으면 사용 (문장 내에서의 인덱스)
      if (separatorTimings.length > index) {
        nextInterval = separatorTimings[index];
      }
      
      // 속도 배율 적용
      nextInterval = Math.max(200, nextInterval / playbackSpeed);
      
      console.log(`⏱️ 문장 내 다음 점자까지 ${nextInterval}ms 대기`);
      
      displayTimeoutRef.current = setTimeout(() => {
        playNextBraille(index + 1);
      }, nextInterval);
    };
    
    playNextBraille(startIndex);
  };

  // 현재 문장 시퀀스 재생 중지
  const stopCurrentSentenceSequence = () => {
    setIsPlayingCurrentSentence(false);
    setCurrentSentenceIndex(0);
    setBraillePattern(null);
    
    if (displayTimeoutRef.current) {
      clearTimeout(displayTimeoutRef.current);
    }
  };

  useEffect(() => {
    // 데이터 수집기 초기화
    dataCollectorRef.current = new DataCollector((newData) => {
      setData(newData);
      setStatistics(dataCollectorRef.current?.getStatistics() || null);
    });

    // WebSocket 서비스 초기화
    wsServiceRef.current = new WebSocketService();
    
    wsServiceRef.current.onBraillePattern = (pattern) => {
      // 실시간 입력이 들어오면 기존 재생 중지
      if (isPlayingSequence) {
        console.log('🛑 실시간 입력으로 인한 전체 시퀀스 재생 중지');
        stopBrailleSequence();
      }
      if (isPlayingCurrentSentence) {
        console.log('🛑 실시간 입력으로 인한 문장 시퀀스 재생 중지');
        stopCurrentSentenceSequence();
      }
      
      // 현재 문장 시퀀스에 추가
      setCurrentSentenceSequence(prev => [...prev, pattern]);
      
      // 전체 시퀀스에도 추가
      setBrailleSequence(prev => [...prev, pattern]);
      setSequenceWithSeparators(prev => [...prev, { type: 'braille', pattern }]);
      
      dataCollectorRef.current?.addPattern(pattern);
      addLog('info', `점자 패턴 수신: ${pattern.binary} (${pattern.character})`, pattern);
      
      // 마지막 점자 수신 시간 기록
      lastBrailleTimeRef.current = Date.now();
    };
    
    wsServiceRef.current.onConnected = () => {
      setIsConnected(true);
      addLog('success', 'WebSocket 서버 연결됨');
      console.log('WebSocket 연결됨');
    };
    
    wsServiceRef.current.onError = (error) => {
      addLog('error', 'WebSocket 연결 오류', error);
      console.error('WebSocket 오류:', error);
      setIsConnected(false);
    };
    
    wsServiceRef.current.onClose = () => {
      addLog('warning', 'WebSocket 연결 종료');
      setIsConnected(false);
      console.log('WebSocket 연결 종료');
    };

    wsServiceRef.current.onServerLog = (log) => {
      addLog(log.type, log.message, log.data);
    };

  // 구분자 메시지 처리 (개선된 버전)
  wsServiceRef.current.onWordSeparator = () => {
    const separatorItem = { 
      type: 'word_separator', 
      content: ' ', 
      timestamp: Date.now(),
      id: `word_sep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setSequenceWithSeparators(prev => [...prev, separatorItem]);
    addLog('info', '단어 구분자 수신', { type: 'word_separator' });
  };

    wsServiceRef.current.onSentenceSeparator = () => {
      const separatorItem = { 
        type: 'sentence_separator', 
        content: '\n', 
        timestamp: Date.now(),
        id: `sentence_sep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      setSequenceWithSeparators(prev => [...prev, separatorItem]);
      
      // 문장 구분자 수신 시 현재 문장을 단어별로 분할하고 첫 번째 단어 반복 재생
      if (currentSentenceSequence.length > 0) {
        console.log(`📝 문장 완성: ${currentSentenceSequence.length}개 점자, 단어별 분할 시작`);
        
        // 문장을 단어별로 분할
        const words = splitSentenceIntoWords(currentSentenceSequence);
        setWordSequence(words);
        setCurrentWordIndex(0);
        
        // 첫 번째 단어 반복 재생 시작
        if (words.length > 0) {
          playWordRepeat(0);
        }
      }
      addLog('info', '문장 구분자 수신', { type: 'sentence_separator' });
    };

  wsServiceRef.current.onBrailleSeparator = () => {
    const currentTime = Date.now();
    const timeSinceLastBraille = currentTime - lastBrailleTimeRef.current;
    
    // separator 간격 저장 (최소 200ms, 최대 5000ms)
    const clampedInterval = Math.max(200, Math.min(5000, timeSinceLastBraille));
    setSeparatorTimings(prev => [...prev, clampedInterval]);
    
    const separatorItem = { 
      type: 'braille_separator', 
      content: ' ', 
      interval: clampedInterval,
      timestamp: currentTime,
      id: `braille_sep_${currentTime}_${Math.random().toString(36).substr(2, 9)}`
    };
    setSequenceWithSeparators(prev => [...prev, separatorItem]);
    
    addLog('info', `점자 구분자 수신: 간격 ${clampedInterval}ms`, { 
      type: 'braille_separator',
      interval: clampedInterval 
    });
  };

    // WebSocket 연결 시도
    wsServiceRef.current.connect().catch(console.error);

    // 컴포넌트 언마운트 시 정리
    return () => {
      wsServiceRef.current?.disconnect();
      if (displayTimeoutRef.current) {
        clearTimeout(displayTimeoutRef.current);
      }
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
      isRealTimeInputRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDotClick = (id: number) => {
    console.log(`점자 셀 점 ${id} 클릭됨`);
    // 여기서 테스트용 패턴을 생성할 수 있습니다
  };

  const handleReconnect = () => {
    if (wsServiceRef.current) {
      wsServiceRef.current.connect().catch(console.error);
    }
  };

  const handleClearData = () => {
    dataCollectorRef.current?.clearData();
  };

  const handleExportData = () => {
    const jsonData = dataCollectorRef.current?.exportData();
    if (jsonData) {
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `braille-data-${new Date().toISOString().slice(0, 19)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>OFBGlove 점자 비주얼라이저</h1>
        <div className="header-controls">
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '연결됨' : '연결 끊김'}
            </div>
            {!isConnected && (
              <button onClick={handleReconnect} className="reconnect-btn">
                재연결
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowDataPanel(true)} 
            className="data-collection-btn"
            title="데이터 수집"
          >
            📊 데이터 수집
          </button>
        </div>
      </header>

      <main className="App-main">
        <div className="braille-panel">
          <div className="braille-container">
            <BrailleCell 
              dots={braillePattern?.dots || []}
              size="large"
              showLabels={true}
              onDotClick={handleDotClick}
              displayMode={displayMode}
              isVisible={braillePattern !== null}
            />
          </div>
          
          {/* 단어 네비게이션 컨트롤 */}
          {wordSequence.length > 0 && (
            <div className="navigation-controls">
              <div className="navigation-info">
                단어 {currentWordIndex + 1} / {wordSequence.length}
                {wordSequence[currentWordIndex] && (
                  <span className="current-word">
                    ({wordSequence[currentWordIndex].map(p => p.character).join('')})
                  </span>
                )}
                {isPlayingWord && (
                  <span className="playing-indicator">🔄 반복 재생 중</span>
                )}
              </div>
              <div className="navigation-buttons">
                <button 
                  onClick={navigateToPreviousWord}
                  className="nav-btn prev-btn"
                  title="이전 단어"
                  disabled={currentWordIndex === 0}
                >
                  ⏪ 이전 단어
                </button>
                <button 
                  onClick={isPlayingWord ? stopWordPlayback : () => playWordRepeat(currentWordIndex)}
                  className={`nav-btn ${isPlayingWord ? 'stop-btn' : 'play-btn'}`}
                  title={isPlayingWord ? "단어 재생 중지" : "단어 재생 시작"}
                >
                  {isPlayingWord ? '⏹️ 중지' : '▶️ 재생'}
                </button>
                <button 
                  onClick={navigateToNextWord}
                  className="nav-btn next-btn"
                  title="다음 단어"
                  disabled={currentWordIndex >= wordSequence.length - 1}
                >
                  다음 단어 ⏩
                </button>
              </div>
              <div className="word-controls">
                <button 
                  onClick={() => setAutoWordRepeat(!autoWordRepeat)}
                  className={`toggle-btn ${autoWordRepeat ? 'active' : ''}`}
                  title="자동 단어 반복"
                >
                  {autoWordRepeat ? '🔄 자동 반복' : '⏸️ 수동 모드'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sentence-panel">
          {/* 현재 문장 시퀀스 표시 */}
          <div className="current-sentence-section">
            <div className="section-header">
              <div className="sentence-title-section">
                <h4>현재 문장 시퀀스</h4>
                {currentSentenceSequence.length > 0 && (
                  <div className="sentence-source-stats">
                    {(() => {
                      const esp32Count = currentSentenceSequence.filter(p => p.source === 'esp32').length;
                      const webCount = currentSentenceSequence.filter(p => p.source === 'web').length;
                      const demoCount = currentSentenceSequence.filter(p => p.source === 'demo').length;
                      
                      return (
                        <div className="source-stats">
                          {esp32Count > 0 && (
                            <span className="source-stat esp32-stat">
                              📡 {esp32Count}개
                            </span>
                          )}
                          {webCount > 0 && (
                            <span className="source-stat web-stat">
                              💻 {webCount}개
                            </span>
                          )}
                          {demoCount > 0 && (
                            <span className="source-stat demo-stat">
                              🎮 {demoCount}개
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="sentence-controls">
                {currentSentenceSequence.length > 0 && (
                  <>
                    <button 
                      onClick={isPlayingCurrentSentence ? stopCurrentSentenceSequence : () => playCurrentSentenceSequence()}
                      className={`action-btn ${isPlayingCurrentSentence ? 'stop-btn' : 'play-btn'}`}
                      title={isPlayingCurrentSentence ? "문장 재생 중지" : "현재 문장 재생"}
                    >
                      {isPlayingCurrentSentence ? '⏹️ 중지' : '▶️ 재생'}
                    </button>
                    <button 
                      onClick={replayCurrentSentence}
                      className="action-btn replay-btn"
                      title="현재 문장 다시듣기"
                    >
                      🔄 다시듣기
                    </button>
                    <button 
                      onClick={clearCurrentSentenceSequence}
                      className="action-btn clear-btn"
                      title="문장 시퀀스 초기화"
                    >
                      🗑️ 초기화
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {currentSentenceSequence.length === 0 ? (
              <div className="no-sentence">입력된 문장이 없습니다.</div>
            ) : (
              <div className="sentence-sequence-display">
                {/* 문자 라인 */}
                <div className="sentence-character-line">
                  {currentSentenceSequence.map((pattern, index) => {
                    const isCurrent = isPlayingCurrentSentence && index === currentSentenceIndex;
                    return (
                      <span 
                        key={`sentence-char-${pattern.timestamp}-${index}`} 
                        className={`sentence-character-item ${isCurrent ? 'current-braille' : ''} source-${pattern.source}`}
                        title={`${pattern.source === 'esp32' ? 'WiFi 외부 입력' : pattern.source === 'web' ? '웹 직접 입력' : '데모'} - ${pattern.binary}`}
                      >
                        {pattern.character || '?'}
                      </span>
                    );
                  })}
                </div>
                
                {/* 점자 패턴 라인 */}
                <div className="sentence-braille-line">
                  {currentSentenceSequence.map((pattern, index) => {
                    const isCurrent = isPlayingCurrentSentence && index === currentSentenceIndex;
                    return (
                      <div 
                        key={`sentence-braille-${pattern.timestamp}-${index}`} 
                        className={`sentence-braille-item ${isCurrent ? 'current-braille' : ''} source-${pattern.source}`}
                        title={`${pattern.source === 'esp32' ? 'WiFi 외부 입력' : pattern.source === 'web' ? '웹 직접 입력' : '데모'} - ${pattern.binary}`}
                      >
                        <BrailleCell 
                          dots={pattern.dots}
                          size="tiny"
                          showLabels={false}
                        />
                      </div>
                    );
                  })}
                </div>
                
                {/* 진행 상태 */}
                {isPlayingCurrentSentence && (
                  <div className="sentence-progress">
                    진행: {currentSentenceIndex + 1}/{currentSentenceSequence.length}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 점자 입력 섹션 - 메인 화면에 직접 표시 */}
        {isInputMode && (
          <div className="braille-input-section">
            <BrailleInput
              onPatternComplete={handleBraillePatternComplete}
              onPatternChange={handleBraillePatternChange}
              isEnabled={isInputMode}
            />
          </div>
        )}
      </main>

      {/* 데이터 수집 모달 */}
      {showDataPanel && (
        <div className="modal-overlay" onClick={() => setShowDataPanel(false)}>
          <div className="modal-content data-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>데이터 수집</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowDataPanel(false)}
              >
                ✕
              </button>
            </div>
            <div className="data-panel-content">
              <div className="panel-buttons">
                <button 
                  onClick={() => setShowConnectionInfo(true)} 
                  className="popup-btn connection-btn"
                  title="연결 정보"
                >
                  📱 연결 정보
                </button>
                <button 
                  onClick={() => setShowServerLog(true)} 
                  className="popup-btn log-btn"
                  title="서버 로그"
                >
                  📋 서버 로그
                </button>
                <button 
                  onClick={() => setShowSequence(true)} 
                  className="popup-btn sequence-btn"
                  title="점자 시퀀스"
                >
                  📝 시퀀스 ({brailleSequence.length})
                </button>
                <button 
                  onClick={() => setShowTimeSettings(true)} 
                  className="popup-btn time-btn"
                  title="표시 시간 설정"
                >
                  ⏱️ 시간 ({displayDuration/1000}초)
                </button>
                <button 
                  onClick={toggleInputMode}
                  className={`popup-btn input-btn ${isInputMode ? 'active' : ''}`}
                  title="점자 입력 모드 토글"
                >
                  {isInputMode ? '✏️ 입력 활성화' : '✏️ 입력 비활성화'}
                </button>
              </div>
              <div className="data-stats">
                <div className="stat-item">
                  <span className="stat-label">총 패턴:</span>
                  <span className="stat-value">{data.totalCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">고유 패턴:</span>
                  <span className="stat-value">{statistics?.uniquePatterns || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">분당 평균:</span>
                  <span className="stat-value">{statistics?.averagePatternsPerMinute || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">마지막 활동:</span>
                  <span className="stat-value">
                    {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : '없음'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">입력된 패턴:</span>
                  <span className="stat-value">{inputPatterns.length}</span>
                </div>
              </div>
              <div className="data-actions">
                <button onClick={handleClearData} className="action-btn clear-btn">
                  데이터 초기화
                </button>
                <button onClick={handleExportData} className="action-btn export-btn">
                  데이터 내보내기
                </button>
              </div>
              {braillePattern && (
                <div className="current-pattern">
                  <h4>현재 패턴</h4>
                  <div className="pattern-info">
                    <div className="pattern-character">
                      {braillePattern.character || '?'}
                    </div>
                    <div className="pattern-source">
                      소스: {braillePattern.source}
                    </div>
                    <div className="pattern-time">
                      {new Date(braillePattern.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 연결 정보 모달 */}
      {showConnectionInfo && (
        <div className="modal-overlay" onClick={() => setShowConnectionInfo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📱 핸드폰 TCP 연결 정보</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowConnectionInfo(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <ConnectionInfo />
            </div>
          </div>
        </div>
      )}

      {/* 서버 로그 모달 */}
      {showServerLog && (
        <div className="modal-overlay" onClick={() => setShowServerLog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 서버 로그</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowServerLog(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <ServerLog logs={logs} onClearLogs={clearLogs} />
            </div>
          </div>
        </div>
      )}

      {/* 점자 시퀀스 모달 */}
      {showSequence && (
        <div className="modal-overlay" onClick={() => setShowSequence(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 점자 입력 시퀀스 ({brailleSequence.length}개)</h3>
              <div className="sequence-stats">
                {(() => {
                  const patterns = getPatternsBySource();
                  return (
                    <div className="source-stats">
                      {patterns.esp32.length > 0 && (
                        <span className="source-stat esp32-stat">
                          📡 WiFi: {patterns.esp32.length}개
                        </span>
                      )}
                      {patterns.web.length > 0 && (
                        <span className="source-stat web-stat">
                          💻 웹입력: {patterns.web.length}개
                        </span>
                      )}
                      {patterns.demo.length > 0 && (
                        <span className="source-stat demo-stat">
                          🎮 데모: {patterns.demo.length}개
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="modal-actions">
                <button 
                  onClick={isPlayingSequence ? stopBrailleSequence : playBrailleSequence}
                  className={`action-btn ${isPlayingSequence ? 'stop-btn' : 'play-btn'}`}
                  title={isPlayingSequence ? "재생 중지" : "시퀀스 재생"}
                >
                  {isPlayingSequence ? '⏹️ 중지' : '▶️ 재생'}
                </button>
                <button 
                  onClick={replayBrailleSequence}
                  className="action-btn replay-btn"
                  title="전체 시퀀스 다시듣기"
                >
                  🔄 다시듣기
                </button>
                <button 
                  onClick={clearSequence}
                  className="action-btn clear-btn"
                  title="시퀀스 초기화"
                >
                  🗑️ 초기화
                </button>
                <button 
                  className="modal-close" 
                  onClick={() => setShowSequence(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="sequence-container">
                {brailleSequence.length === 0 ? (
                  <div className="no-sequence">입력된 점자 시퀀스가 없습니다.</div>
                ) : (
                  <div className="sequence-display">
                    {/* 문자 라인 */}
                    <div className="character-line">
                      {sequenceWithSeparators.map((item, index) => {
                        if (item.type === 'braille') {
                          const brailleIndex = brailleSequence.findIndex(p => p.timestamp === item.pattern.timestamp);
                          const isCurrent = isPlayingSequence && brailleIndex === currentBrailleIndex;
                          return (
                            <span 
                              key={`char-${item.pattern.timestamp}-${index}`} 
                              className={`character-item ${isCurrent ? 'current-braille' : ''} source-${item.pattern.source}`}
                              title={`${item.pattern.source === 'esp32' ? 'WiFi 외부 입력' : item.pattern.source === 'web' ? '웹 직접 입력' : '데모'} - ${item.pattern.binary}`}
                            >
                              {item.pattern.character || '?'}
                            </span>
                          );
                        } else if (item.type === 'word_separator') {
                          return (
                            <span 
                              key={item.id || `word-sep-${index}`} 
                              className="separator-item word-separator"
                              title="단어 구분자"
                            >
                              [단어]
                            </span>
                          );
                        } else if (item.type === 'sentence_separator') {
                          return (
                            <br 
                              key={item.id || `sentence-sep-${index}`} 
                              className="sentence-separator"
                              title="문장 구분자"
                            />
                          );
                        } else if (item.type === 'braille_separator') {
                          return (
                            <span 
                              key={item.id || `braille-sep-${index}`} 
                              className="separator-item braille-separator"
                              title={`점자 구분자 (간격: ${item.interval}ms)`}
                            >
                              [점자]
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                    
                    {/* 점자 패턴 라인 */}
                    <div className="braille-line">
                      {sequenceWithSeparators.map((item, index) => {
                        if (item.type === 'braille') {
                          const brailleIndex = brailleSequence.findIndex(p => p.timestamp === item.pattern.timestamp);
                          const isCurrent = isPlayingSequence && brailleIndex === currentBrailleIndex;
                          return (
                            <div 
                              key={`braille-${item.pattern.timestamp}-${index}`} 
                              className={`braille-item ${isCurrent ? 'current-braille' : ''} source-${item.pattern.source}`}
                              title={`${item.pattern.source === 'esp32' ? 'WiFi 외부 입력' : item.pattern.source === 'web' ? '웹 직접 입력' : '데모'} - ${item.pattern.binary}`}
                            >
                              <BrailleCell 
                                dots={item.pattern.dots}
                                size="tiny"
                                showLabels={false}
                              />
                            </div>
                          );
                        } else if (item.type === 'word_separator') {
                          return (
                            <span 
                              key={item.id || `word-sep-${index}`} 
                              className="separator-item word-separator"
                              title="단어 구분자"
                            >
                              [단어]
                            </span>
                          );
                        } else if (item.type === 'sentence_separator') {
                          return (
                            <br 
                              key={item.id || `sentence-sep-${index}`} 
                              className="sentence-separator"
                              title="문장 구분자"
                            />
                          );
                        } else if (item.type === 'braille_separator') {
                          return (
                            <span 
                              key={item.id || `braille-sep-${index}`} 
                              className="separator-item braille-separator"
                              title={`점자 구분자 (간격: ${item.interval}ms)`}
                            >
                              [점자]
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                    
                    {/* 상세 정보 (접을 수 있음) */}
                    <div className="sequence-details">
                      <details>
                        <summary>상세 정보 보기</summary>
                        <div className="details-list">
                          {brailleSequence.map((pattern, index) => (
                            <div key={`detail-${pattern.timestamp}-${index}`} className="detail-item">
                              <span className="detail-number">{index + 1}</span>
                              <span className="detail-binary">{pattern.binary}</span>
                              <span className="detail-character">{pattern.character || '?'}</span>
                              <span className="detail-time">
                                {new Date(pattern.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 시간 설정 모달 */}
      {showTimeSettings && (
        <div className="modal-overlay" onClick={() => setShowTimeSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⏱️ 점자 표시 시간 설정</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowTimeSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="time-settings">
                <div className="time-setting-item">
                  <label>표시 모드:</label>
                  <div className="display-mode-selector">
                    <button 
                      onClick={() => setDisplayMode('hide')}
                      className={`mode-btn ${displayMode === 'hide' ? 'active' : ''}`}
                    >
                      자동 숨김
                    </button>
                    <button 
                      onClick={() => setDisplayMode('fade')}
                      className={`mode-btn ${displayMode === 'fade' ? 'active' : ''}`}
                    >
                      페이드 아웃
                    </button>
                    <button 
                      onClick={() => setDisplayMode('keep')}
                      className={`mode-btn ${displayMode === 'keep' ? 'active' : ''}`}
                    >
                      계속 표시
                    </button>
                  </div>
                </div>

                <div className="time-setting-item">
                  <label htmlFor="duration-slider">표시 시간: {displayDuration/1000}초</label>
                  <input
                    id="duration-slider"
                    type="range"
                    min="500"
                    max="10000"
                    step="500"
                    value={displayDuration}
                    onChange={(e) => setDisplayDuration(Number(e.target.value))}
                    className="duration-slider"
                    disabled={displayMode === 'keep'}
                  />
                  {displayMode === 'keep' && (
                    <div className="mode-info">계속 표시 모드에서는 시간 설정이 무시됩니다.</div>
                  )}
                </div>
                
                <div className="time-setting-item">
                  <label htmlFor="interval-slider">점자 간 간격: {brailleInterval/1000}초</label>
                  <input
                    id="interval-slider"
                    type="range"
                    min="200"
                    max="5000"
                    step="200"
                    value={brailleInterval}
                    onChange={(e) => setBrailleInterval(Number(e.target.value))}
                    className="duration-slider"
                  />
                  <div className="time-presets">
                    <button 
                      onClick={() => setBrailleInterval(500)}
                      className={`preset-btn ${brailleInterval === 500 ? 'active' : ''}`}
                    >
                      0.5초
                    </button>
                    <button 
                      onClick={() => setBrailleInterval(1000)}
                      className={`preset-btn ${brailleInterval === 1000 ? 'active' : ''}`}
                    >
                      1초
                    </button>
                    <button 
                      onClick={() => setBrailleInterval(2000)}
                      className={`preset-btn ${brailleInterval === 2000 ? 'active' : ''}`}
                    >
                      2초
                    </button>
                    <button 
                      onClick={() => setBrailleInterval(3000)}
                      className={`preset-btn ${brailleInterval === 3000 ? 'active' : ''}`}
                    >
                      3초
                    </button>
                  </div>
                </div>

                <div className="time-setting-item">
                  <label>재생 모드:</label>
                  <div className="playback-mode-selector">
                    <button 
                      onClick={() => changePlaybackMode('fixed')}
                      className={`mode-btn ${playbackMode === 'fixed' ? 'active' : ''}`}
                    >
                      고정 간격
                    </button>
                    <button 
                      onClick={() => changePlaybackMode('original')}
                      className={`mode-btn ${playbackMode === 'original' ? 'active' : ''}`}
                    >
                      원본 속도
                    </button>
                    <button 
                      onClick={() => changePlaybackMode('adaptive')}
                      className={`mode-btn ${playbackMode === 'adaptive' ? 'active' : ''}`}
                    >
                      적응형
                    </button>
                  </div>
                </div>

                <div className="time-setting-item">
                  <label htmlFor="speed-slider">재생 속도: {playbackSpeed.toFixed(1)}x</label>
                  <input
                    id="speed-slider"
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={playbackSpeed}
                    onChange={(e) => adjustPlaybackSpeed(Number(e.target.value))}
                    className="duration-slider"
                  />
                  <div className="time-presets">
                    <button 
                      onClick={() => adjustPlaybackSpeed(0.5)}
                      className={`preset-btn ${playbackSpeed === 0.5 ? 'active' : ''}`}
                    >
                      0.5x
                    </button>
                    <button 
                      onClick={() => adjustPlaybackSpeed(1.0)}
                      className={`preset-btn ${playbackSpeed === 1.0 ? 'active' : ''}`}
                    >
                      1.0x
                    </button>
                    <button 
                      onClick={() => adjustPlaybackSpeed(2.0)}
                      className={`preset-btn ${playbackSpeed === 2.0 ? 'active' : ''}`}
                    >
                      2.0x
                    </button>
                    <button 
                      onClick={() => adjustPlaybackSpeed(3.0)}
                      className={`preset-btn ${playbackSpeed === 3.0 ? 'active' : ''}`}
                    >
                      3.0x
                    </button>
                  </div>
                </div>
                
                <div className="time-setting-item">
                  <label>구분자별 시간 최적화:</label>
                  <div className="optimization-toggle">
                    <button 
                      onClick={() => updateSeparatorOptimization('enableOptimization', !separatorOptimization.enableOptimization)}
                      className={`toggle-btn ${separatorOptimization.enableOptimization ? 'active' : ''}`}
                    >
                      {separatorOptimization.enableOptimization ? '✅ 활성화' : '❌ 비활성화'}
                    </button>
                  </div>
                </div>

                {separatorOptimization.enableOptimization && (
                  <>
                    <div className="time-setting-item">
                      <label htmlFor="word-separator-delay">단어 구분자 지연: {separatorOptimization.wordSeparatorDelay}ms</label>
                      <input
                        id="word-separator-delay"
                        type="range"
                        min="200"
                        max="3000"
                        step="100"
                        value={separatorOptimization.wordSeparatorDelay}
                        onChange={(e) => updateSeparatorOptimization('wordSeparatorDelay', Number(e.target.value))}
                        className="duration-slider"
                      />
                    </div>

                    <div className="time-setting-item">
                      <label htmlFor="sentence-separator-delay">문장 구분자 지연: {separatorOptimization.sentenceSeparatorDelay}ms</label>
                      <input
                        id="sentence-separator-delay"
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={separatorOptimization.sentenceSeparatorDelay}
                        onChange={(e) => updateSeparatorOptimization('sentenceSeparatorDelay', Number(e.target.value))}
                        className="duration-slider"
                      />
                    </div>

                    <div className="time-setting-item">
                      <label htmlFor="braille-separator-delay">점자 구분자 지연: {separatorOptimization.brailleSeparatorDelay}ms</label>
                      <input
                        id="braille-separator-delay"
                        type="range"
                        min="100"
                        max="2000"
                        step="50"
                        value={separatorOptimization.brailleSeparatorDelay}
                        onChange={(e) => updateSeparatorOptimization('brailleSeparatorDelay', Number(e.target.value))}
                        className="duration-slider"
                      />
                    </div>
                  </>
                )}

                <div className="time-info">
                  <h4>설명:</h4>
                  <ul>
                    <li><strong>표시 시간</strong>: 개별 점자 패턴이 화면에 표시되는 시간</li>
                    <li><strong>고정 간격</strong>: 모든 점자를 동일한 간격으로 재생</li>
                    <li><strong>원본 속도</strong>: braille_separator로 측정된 실제 입력 간격 사용</li>
                    <li><strong>적응형</strong>: 원본 간격을 속도 배율로 조정하여 재생</li>
                    <li><strong>재생 속도</strong>: 0.1x~5.0x 범위에서 속도 조절 (실시간)</li>
                    <li><strong>구분자 최적화</strong>: 단어/문장/점자 구분자별로 다른 지연 시간 설정</li>
                    <li><strong>측정된 간격</strong>: {separatorTimings.length}개 ({separatorTimings.length > 0 ? separatorTimings.map(t => `${t/1000}초`).join(', ') : '없음'})</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;