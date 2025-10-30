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
  const [webInputBuffer, setWebInputBuffer] = useState<BraillePattern[]>([]); // 웹 입력 버퍼(전송 전까지 대기)
  // 장갑 배경 조정 상태
  const [showGloveControls, setShowGloveControls] = useState(false);
  const [glovePosX, setGlovePosX] = useState(30); // % (좌측 기준)
  const [glovePosY, setGlovePosY] = useState(50); // % (상단 기준)
  const [gloveScale, setGloveScale] = useState(100); // % (contain 유사 효과)
  const [gloveOpacity, setGloveOpacity] = useState(1); // 0~1
  
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const dataCollectorRef = useRef<DataCollector | null>(null);
  const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wordTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 단어 재생 타이머
  const wordRepeatTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 단어 반복 타이머
  const lastBrailleTimeRef = useRef<number>(0); // 마지막 점자 수신 시간
  const isRealTimeInputRef = useRef<boolean>(false); // 실시간 입력 상태 추적
  const lastPatternRef = useRef<{ binary: string; character: string; source: string } | null>(null); // 마지막 패턴 (중복 체크용)

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
    
    addLog('info', '다시듣기 시작');
    
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
    
    addLog('info', '현재 문장 다시듣기 시작');
    
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

  // 문장을 단어별로 분할하는 함수 (000000 패턴을 단어 구분자로 사용)
  const splitSentenceIntoWords = (sentence: BraillePattern[]) => {
    const words: BraillePattern[][] = [];
    let currentWord: BraillePattern[] = [];
    
    for (let i = 0; i < sentence.length; i++) {
      const pattern = sentence[i];
      
      if (pattern.binary === '000000') {
        // 공백 패턴이면 현재 단어를 완성하고 새 단어 시작
        if (currentWord.length > 0) {
          words.push([...currentWord]);
          currentWord = [];
        }
      } else {
        // 일반 패턴이면 현재 단어에 추가
        currentWord.push(pattern);
      }
    }
    
    // 마지막 단어 추가 (공백으로 끝나지 않은 경우)
    if (currentWord.length > 0) {
      words.push([...currentWord]);
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
    
    // 기존 타이머 정리
    if (wordTimeoutRef.current) {
      clearTimeout(wordTimeoutRef.current);
      wordTimeoutRef.current = null;
    }
    if (wordRepeatTimeoutRef.current) {
      clearTimeout(wordRepeatTimeoutRef.current);
      wordRepeatTimeoutRef.current = null;
    }
    
    const word = wordSequence[wordIndex];
    if (word.length === 0) return;
    
    setIsPlayingWord(true);
    setCurrentWordIndex(wordIndex);
    
    const playNextBraille = (brailleIndex: number) => {
      if (brailleIndex >= word.length) {
        // 단어 재생 완료 후 반복 (단어가 1개만 있어도 반복)
        if (autoWordRepeat) {
          wordRepeatTimeoutRef.current = setTimeout(() => {
            playWordRepeat(wordIndex); // 같은 단어 반복 (1개짜리도 계속 반복)
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
      
      wordTimeoutRef.current = setTimeout(() => {
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
    
    // 기존 타이머 정리
    if (wordTimeoutRef.current) {
      clearTimeout(wordTimeoutRef.current);
      wordTimeoutRef.current = null;
    }
    if (wordRepeatTimeoutRef.current) {
      clearTimeout(wordRepeatTimeoutRef.current);
      wordRepeatTimeoutRef.current = null;
    }
    
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
    
    // 기존 타이머 정리
    if (wordTimeoutRef.current) {
      clearTimeout(wordTimeoutRef.current);
      wordTimeoutRef.current = null;
    }
    if (wordRepeatTimeoutRef.current) {
      clearTimeout(wordRepeatTimeoutRef.current);
      wordRepeatTimeoutRef.current = null;
    }
    
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
    // 타이머 정리
    if (wordTimeoutRef.current) {
      clearTimeout(wordTimeoutRef.current);
      wordTimeoutRef.current = null;
    }
    if (wordRepeatTimeoutRef.current) {
      clearTimeout(wordRepeatTimeoutRef.current);
      wordRepeatTimeoutRef.current = null;
    }
    
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
    // 웹 입력은 전송 시점까지 버퍼에만 저장
    setWebInputBuffer(prev => [...prev, newPattern]);
    
    // 데이터 수집기는 데모 화면 최소화 정책으로 웹 입력 버퍼 단계에서는 추가하지 않음
    
    // 로그 추가 (웹 입력 버퍼 적재)
    addLog('success', `웹 입력(버퍼): ${newPattern.binary} (${newPattern.character})`, newPattern);
    
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

  // 000000 패턴 객체 생성 함수 (구분자용)
  const createSpacePattern = (source: 'esp32' | 'web' | 'demo' = 'esp32'): BraillePattern => {
    return {
      dots: [
        { id: 1, isActive: false },
        { id: 2, isActive: false },
        { id: 3, isActive: false },
        { id: 4, isActive: false },
        { id: 5, isActive: false },
        { id: 6, isActive: false }
      ],
      timestamp: Date.now(),
      source: source,
      character: ' ',
      binary: '000000'
    };
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
    console.log('🔄 useEffect 실행 - WebSocket 초기화 시작');
    
    // 데이터 수집기 초기화
    dataCollectorRef.current = new DataCollector((newData) => {
      setData(newData);
      setStatistics(dataCollectorRef.current?.getStatistics() || null);
    });

    // WebSocket 서비스가 이미 존재하면 재생성하지 않음
    if (wsServiceRef.current) {
      console.log('⚠️ WebSocket 서비스가 이미 존재함 - 스킵');
      return;
    }

    // WebSocket 서비스 초기화
    console.log('✅ 새로운 WebSocket 서비스 생성');
    wsServiceRef.current = new WebSocketService();
    
    wsServiceRef.current.onBraillePattern = (pattern) => {
      console.log(`🎯 onBraillePattern 핸들러 호출: ${pattern.character} (${pattern.binary}) at ${new Date().toISOString()}`);
      
      // 공백 패턴(000000)은 단어 구분자로 처리 - 000000 점자 패턴으로 표시
      if (pattern.binary === '000000') {
        // 중복 체크: ref를 사용하여 동기적으로 마지막 패턴 확인
        const lastPattern = lastPatternRef.current;
        if (lastPattern && lastPattern.binary === '000000') {
          console.log('⚠️ 공백 패턴 중복 감지 및 무시 (lastPatternRef 기준)');
          return; // 중복이면 즉시 반환
        }
        
        console.log('📝 공백 패턴을 단어 구분자로 처리 (000000 점자로 표시)');
        
        // ref 업데이트
        lastPatternRef.current = {
          binary: pattern.binary || '',
          character: pattern.character || '',
          source: pattern.source || 'esp32'
        };
        
        // 현재 문장 시퀀스에 추가
        setCurrentSentenceSequence(prev => {
          const lastPattern = prev[prev.length - 1];
          if (lastPattern && lastPattern.binary === '000000') {
            console.log('⚠️ currentSentenceSequence에서 공백 패턴 중복 감지');
            return prev; // 중복이면 상태 변경 없음
          }
          console.log('✅ currentSentenceSequence에 공백 패턴 추가');
          return [...prev, pattern];
        });
        
        // brailleSequence에 추가
        setBrailleSequence(prev => {
          const lastPattern = prev[prev.length - 1];
          if (lastPattern && lastPattern.binary === '000000') {
            console.log('⚠️ brailleSequence에서 공백 패턴 중복 감지');
            return prev; // 중복이면 상태 변경 없음
          }
          console.log('✅ brailleSequence에 공백 패턴 추가');
          return [...prev, pattern];
        });
        
        // sequenceWithSeparators에도 추가
        setSequenceWithSeparators(prev => {
          const lastItem = prev[prev.length - 1];
          if (lastItem && lastItem.type === 'braille' && lastItem.pattern.binary === '000000') {
            console.log('⚠️ sequenceWithSeparators에서 공백 패턴 중복 감지');
            return prev; // 중복이면 상태 변경 없음
          }
          console.log('✅ sequenceWithSeparators에 공백 패턴 추가');
          return [...prev, { type: 'braille', pattern }];
        });
        
        // dataCollector에 추가
        dataCollectorRef.current?.addPattern(pattern);
        addLog('info', '단어 구분자 (공백)', { pattern: '000000' });
        return;
      }
      
      // 중복 수신 체크: ref를 사용하여 동기적으로 마지막 패턴 확인 (타임스탬프 무관)
      const lastPattern = lastPatternRef.current;
      
      // 마지막 패턴과 정확히 동일한 패턴이면 중복으로 판단
      if (lastPattern && 
          lastPattern.binary === pattern.binary && 
          lastPattern.character === pattern.character &&
          lastPattern.source === pattern.source) {
        console.log('⚠️ 중복 패턴 감지 및 무시 (마지막 패턴과 동일):', pattern.character, pattern.binary);
        return; // 중복이면 즉시 반환
      }
      
      // 중복이 아니면 ref 업데이트
      lastPatternRef.current = {
        binary: pattern.binary || '',
        character: pattern.character || '',
        source: pattern.source || 'esp32'
      };
      
      // 상태 업데이트
      setBrailleSequence(prev => [...prev, pattern]);
      
      // 중복이 아니면 sequenceWithSeparators에도 추가
      setSequenceWithSeparators(sequencePrev => {
        const lastItem = sequencePrev[sequencePrev.length - 1];
        // 마지막 항목과 정확히 동일한 패턴인지 확인
        if (lastItem && lastItem.type === 'braille') {
          if (lastItem.pattern.binary === pattern.binary && 
              lastItem.pattern.character === pattern.character &&
              lastItem.pattern.source === pattern.source) {
            console.log('⚠️ sequenceWithSeparators에서 중복 패턴 감지 및 무시:', pattern.character, pattern.binary);
            return sequencePrev; // 상태 변경 없음
          }
        }
        return [...sequencePrev, { type: 'braille', pattern }];
      });
      
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
      
      // dataCollector와 로그는 한 번만 실행 (중복이 아닌 경우만)
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
    console.log('🔧 onWordSeparator 핸들러 등록됨');
    wsServiceRef.current.onWordSeparator = () => {
      console.log('📝 onWordSeparator 호출됨 - 단어 구분자 처리 시작');
    
      // 단어 구분자를 000000 점자 패턴으로 변환
      const spacePattern = createSpacePattern('esp32');
      
      console.log('✅ 단어 구분자 추가 중 - 공백 패턴:', spacePattern);
      
      // 현재 문장 시퀀스에 중복 체크하고 추가
      setCurrentSentenceSequence(prev => {
        const lastPattern = prev[prev.length - 1];
        // 마지막 패턴이 이미 공백이면 중복
        if (lastPattern && lastPattern.binary === '000000') {
          console.log('⚠️ currentSentenceSequence에서 단어 구분자 중복 감지:', lastPattern);
          return prev; // 중복이면 상태 변경 없음
        }
        console.log('✅ currentSentenceSequence에 단어 구분자 추가, 현재 길이:', prev.length, '→', prev.length + 1);
        return [...prev, spacePattern];
      });
      
      // ref 업데이트
      lastPatternRef.current = {
        binary: spacePattern.binary || '',
        character: spacePattern.character || '',
        source: spacePattern.source || 'esp32'
      };
      
      // brailleSequence에도 추가
      setBrailleSequence(prev => [...prev, spacePattern]);
      
      // sequenceWithSeparators에도 추가
      setSequenceWithSeparators(prev => {
        const lastItem = prev[prev.length - 1];
        // 마지막 항목이 이미 공백이면 중복
        if (lastItem && lastItem.type === 'braille' && lastItem.pattern.binary === '000000') {
          console.log('⚠️ sequenceWithSeparators에서 단어 구분자 중복 감지');
          return prev; // 중복이면 상태 변경 없음
        }
        console.log('✅ sequenceWithSeparators에 단어 구분자 추가');
        return [...prev, { type: 'braille', pattern: spacePattern }];
      });
      
      // dataCollector에 추가
      dataCollectorRef.current?.addPattern(spacePattern);
      addLog('info', '단어 구분자 수신 (000000)', { pattern: '000000' });
    };

    wsServiceRef.current.onSentenceSeparator = () => {
      // 문장 구분자도 000000 점자 패턴으로 변환
      const spacePattern = createSpacePattern('esp32');
      
      console.log('📝 onSentenceSeparator 호출됨 - 문장 구분자 처리 시작');
      
      // 현재 문장 시퀀스에 중복 체크하고 추가
      setCurrentSentenceSequence(prev => {
        const lastPattern = prev[prev.length - 1];
        // 마지막 패턴이 이미 공백이면 중복
        if (lastPattern && lastPattern.binary === '000000') {
          console.log('⚠️ currentSentenceSequence에서 문장 구분자 중복 감지:', lastPattern);
          return prev; // 중복이면 상태 변경 없음
        }
        console.log('✅ currentSentenceSequence에 문장 구분자 추가, 현재 길이:', prev.length, '→', prev.length + 1);
        return [...prev, spacePattern];
      });
      
      // ref 업데이트
      lastPatternRef.current = {
        binary: spacePattern.binary || '',
        character: spacePattern.character || '',
        source: spacePattern.source || 'esp32'
      };
      
      // brailleSequence에도 추가
      setBrailleSequence(prev => [...prev, spacePattern]);
      
      // sequenceWithSeparators에도 추가
      setSequenceWithSeparators(prev => {
        const lastItem = prev[prev.length - 1];
        // 마지막 항목이 이미 공백이면 중복
        if (lastItem && lastItem.type === 'braille' && lastItem.pattern.binary === '000000') {
          console.log('⚠️ sequenceWithSeparators에서 문장 구분자 중복 감지');
          return prev; // 중복이면 상태 변경 없음
        }
        console.log('✅ sequenceWithSeparators에 문장 구분자 추가');
        return [...prev, { type: 'braille', pattern: spacePattern }];
      });
      
      // dataCollector에 추가
      dataCollectorRef.current?.addPattern(spacePattern);
      
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
      if (wordTimeoutRef.current) {
        clearTimeout(wordTimeoutRef.current);
      }
      if (wordRepeatTimeoutRef.current) {
        clearTimeout(wordRepeatTimeoutRef.current);
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

  // 웹 입력 버퍼 전송(문장 확정)
  const handleSendBufferedWebInput = () => {
    if (webInputBuffer.length === 0) {
      addLog('warning', '전송할 웹 입력이 없습니다');
      return;
    }

    // currentSentenceSequence, brailleSequence, sequenceWithSeparators에 일괄 반영
    setCurrentSentenceSequence(prev => [...prev, ...webInputBuffer]);
    setBrailleSequence(prev => [...prev, ...webInputBuffer]);
    setSequenceWithSeparators(prev => [
      ...prev,
      ...webInputBuffer.map(p => ({ type: 'braille', pattern: p }))
    ]);

    // 데이터 수집기 반영
    webInputBuffer.forEach(p => dataCollectorRef.current?.addPattern(p));

    addLog('info', `웹 입력 전송: ${webInputBuffer.length}개 패턴 적용`, {
      count: webInputBuffer.length
    });

    // 전송 후 버퍼 초기화
    setWebInputBuffer([]);
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

  // 유틸: 패턴 배열을 텍스트로 변환(000000은 공백)
  const patternsToText = (patterns: BraillePattern[]) => {
    return patterns.map(p => (p.binary === '000000' ? ' ' : (p.character || '?'))).join('');
  };

  // 현재 문장 텍스트(전체, 소스별)
  const sentenceTextAll = patternsToText(currentSentenceSequence);
  const sentenceTextEsp32 = patternsToText(currentSentenceSequence.filter(p => p.source === 'esp32'));
  const sentenceTextWeb = patternsToText(currentSentenceSequence.filter(p => p.source === 'web'));

  // 현재 단어 텍스트(웹 입력 버퍼 기준)
  const currentWebWordText = (() => {
    if (webInputBuffer.length === 0) return '';
    // 버퍼 내 마지막 공백 이후의 연속 패턴들만 단어로 간주
    let start = webInputBuffer.length - 1;
    for (let i = webInputBuffer.length - 1; i >= 0; i--) {
      if (webInputBuffer[i].binary === '000000') { start = i + 1; break; }
      if (i === 0) start = 0;
    }
    return patternsToText(webInputBuffer.slice(start)).replace(/\?/g, '');
  })();
  const lastBufferedIsSpace = webInputBuffer.length > 0 && webInputBuffer[webInputBuffer.length - 1].binary === '000000';
  const webBufferPreview = webInputBuffer.map(p => (p.binary === '000000' ? '␣' : (p.character || '?'))).join('');

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
          
          {/* 점자 셀 아래 큰 이전/다음 버튼 - 항상 표시 */}
          <div className="word-nav-buttons-large">
            <button 
              onClick={navigateToPreviousWord}
              className="nav-btn-large prev-btn-large"
              title="이전 단어"
              disabled={wordSequence.length === 0 || currentWordIndex === 0}
            >
              <span className="nav-icon">⏮</span>
              <span className="nav-text">이전</span>
            </button>
            <button 
              onClick={navigateToNextWord}
              className="nav-btn-large next-btn-large"
              title="다음 단어"
              disabled={wordSequence.length === 0 || currentWordIndex >= wordSequence.length - 1}
            >
              <span className="nav-text">다음</span>
              <span className="nav-icon">⏭</span>
            </button>
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
            </div>
          )}
        </div>

        <div className="sentence-panel">
          {/* 텍스트 해석 */}
          <div className="text-output">
            <div className="text-row">
              <span className="text-label">현재 단어(웹):</span>
              <span className="text-value">{currentWebWordText || (lastBufferedIsSpace ? '␣' : '—')}</span>
            </div>
            {webInputBuffer.length > 0 && (
              <div className="text-row">
                <span className="text-label">웹 버퍼:</span>
                <span className="text-value">{webBufferPreview}</span>
              </div>
            )}
            <div className="text-row">
              <span className="text-label">전체 문장:</span>
              <span className="text-value sentence">{sentenceTextAll || '—'}</span>
            </div>
          </div>
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
                        {pattern.binary === '000000' ? '공백' : (pattern.character || '?')}
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
              onSend={handleSendBufferedWebInput}
              isEnabled={isInputMode}
              gloveBg={{ posX: glovePosX, posY: glovePosY, scale: gloveScale, opacity: gloveOpacity }}
            />
            {/* 배경 조정 토글 & 컨트롤 (입력 영역 하단) */}
            <div style={{ marginTop: 12 }}>
              <button 
                className="popup-btn"
                onClick={() => setShowGloveControls(!showGloveControls)}
              >
                🧤 배경 조정 {showGloveControls ? '닫기' : '열기'}
              </button>
            </div>
            {showGloveControls && (
              <div className="glove-controls" style={{ marginTop: 10 }}>
                <div className="row">
                  <label>X 위치</label>
                  <input type="range" min={-50} max={100} step={1} value={glovePosX} onChange={(e) => setGlovePosX(Number(e.target.value))} />
                  <span>{glovePosX}%</span>
                </div>
                <div className="row">
                  <label>Y 위치</label>
                  <input type="range" min={0} max={100} step={1} value={glovePosY} onChange={(e) => setGlovePosY(Number(e.target.value))} />
                  <span>{glovePosY}%</span>
                </div>
                <div className="row">
                  <label>크기</label>
                  <input type="range" min={20} max={150} step={1} value={gloveScale} onChange={(e) => setGloveScale(Number(e.target.value))} />
                  <span>{gloveScale}%</span>
                </div>
                <div className="row">
                  <label>투명도</label>
                  <input type="range" min={0} max={1} step={0.05} value={gloveOpacity} onChange={(e) => setGloveOpacity(Number(e.target.value))} />
                  <span>{Math.round(gloveOpacity * 100)}%</span>
                </div>
              </div>
            )}
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
                      {braillePattern.binary === '000000' ? '공백' : (braillePattern.character || '?')}
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
              <ConnectionInfo wsService={wsServiceRef.current} />
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
                    {/* 문자 라인 - 모든 항목을 점자 패턴으로 표시 (구분자는 000000으로) */}
                    <div className="character-line">
                      {sequenceWithSeparators.map((item, index) => {
                        if (item.type === 'braille') {
                          const brailleIndex = brailleSequence.findIndex(p => p.timestamp === item.pattern.timestamp);
                          const isCurrent = isPlayingSequence && brailleIndex === currentBrailleIndex;
                          const isSpace = item.pattern.binary === '000000';
                          return (
                            <span 
                              key={`char-${item.pattern.timestamp}-${index}`} 
                              className={`character-item ${isCurrent ? 'current-braille' : ''} ${isSpace ? 'space-character' : ''} source-${item.pattern.source}`}
                              title={`${item.pattern.source === 'esp32' ? 'WiFi 외부 입력' : item.pattern.source === 'web' ? '웹 직접 입력' : '데모'} - ${item.pattern.binary}${isSpace ? ' (공백)' : ''}`}
                            >
                              {item.pattern.character || '?'}
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                    
                    {/* 점자 패턴 라인 - 모든 항목을 점자 패턴으로 표시 (구분자는 000000으로) */}
                    <div className="braille-line">
                      {sequenceWithSeparators.map((item, index) => {
                        if (item.type === 'braille') {
                          const brailleIndex = brailleSequence.findIndex(p => p.timestamp === item.pattern.timestamp);
                          const isCurrent = isPlayingSequence && brailleIndex === currentBrailleIndex;
                          const isSpace = item.pattern.binary === '000000';
                          return (
                            <div 
                              key={`braille-${item.pattern.timestamp}-${index}`} 
                              className={`braille-item ${isCurrent ? 'current-braille' : ''} ${isSpace ? 'space-braille' : ''} source-${item.pattern.source}`}
                              title={`${item.pattern.source === 'esp32' ? 'WiFi 외부 입력' : item.pattern.source === 'web' ? '웹 직접 입력' : '데모'} - ${item.pattern.binary}${isSpace ? ' (공백)' : ''}`}
                            >
                              <BrailleCell 
                                dots={item.pattern.dots}
                                size="tiny"
                                showLabels={false}
                              />
                            </div>
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