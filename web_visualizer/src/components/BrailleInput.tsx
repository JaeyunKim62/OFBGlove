import React, { useState, useEffect } from 'react';
import { BrailleDot, BraillePattern } from '../types/braille';
import './BrailleInput.css';

interface BrailleInputProps {
  onPatternComplete: (pattern: BrailleDot[]) => void;
  onPatternChange: (pattern: BrailleDot[]) => void;
  onSend?: () => void; // 전체 문장 전송 트리거
  onCommitWord?: () => void; // 현재 단어를 문장에 커밋 (더블클릭)
  onNextWord?: () => void; // 다음 단어로 이동 (단어 재생 중일 때)
  isEnabled?: boolean;
  gloveBg?: { posX: number; posY: number; scale: number; opacity: number };
  voicePattern?: BraillePattern | null; // 음성 입력 패턴 (esp32/demo 소스)
  isWordPlaying?: boolean; // 단어 재생 중인지 여부
  hasWebInputBuffer?: boolean; // 웹 입력 버퍼에 내용이 있는지 여부 (웹 입력 우선)
}

export const BrailleInput: React.FC<BrailleInputProps> = ({
  onPatternComplete,
  onPatternChange,
  onSend,
  onCommitWord,
  onNextWord,
  isEnabled = true,
  gloveBg,
  voicePattern,
  isWordPlaying = false,
  hasWebInputBuffer = false
}) => {
  const [currentPattern, setCurrentPattern] = useState<BrailleDot[]>([]);
  const [isInputMode, setIsInputMode] = useState(true);

  // 표준 점자 셀 배치 (2×3 그리드)
  const cellPositions = [
    { row: 1, col: 1, id: 1 }, // 1번 점 (왼쪽 위)
    { row: 2, col: 1, id: 2 }, // 2번 점 (왼쪽 중간)
    { row: 3, col: 1, id: 3 }, // 3번 점 (왼쪽 아래)
    { row: 1, col: 2, id: 4 }, // 4번 점 (오른쪽 위)
    { row: 2, col: 2, id: 5 }, // 5번 점 (오른쪽 중간)
    { row: 3, col: 2, id: 6 }, // 6번 점 (오른쪽 아래)
  ];

  // 점자 패턴 초기화
  const initializePattern = () => {
    const pattern = cellPositions.map(pos => ({
      id: pos.id,
      isActive: false
    }));
    setCurrentPattern(pattern);
    onPatternChange(pattern);
  };

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    initializePattern();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 점 클릭 핸들러
  const handleDotClick = (dotId: number) => {
    if (!isEnabled || !isInputMode) return;

    setCurrentPattern(prev => {
      const newPattern = prev.map(dot => 
        dot.id === dotId 
          ? { ...dot, isActive: !dot.isActive }
          : dot
      );
      onPatternChange(newPattern);
      return newPattern;
    });
  };

  // 키보드 이벤트 핸들러 추가
  useEffect(() => {
    if (!isEnabled || !isInputMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 입력 필드에 포커스가 있으면 무시 (텍스트 입력 중일 때)
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 숫자 키 1~6을 점 1~6에 매핑
      const keyToDotId: { [key: string]: number } = {
        'c': 1,
        'b': 2,
        'a': 3,
        'f': 4,
        'e': 5,
        'd': 6,
      };

      const dotId = keyToDotId[event.key];
      if (dotId) {
        event.preventDefault();
        handleDotClick(dotId);
        return;
      }

      // Enter 또는 Space: 패턴 확정 (다음 버튼과 동일)
      if (event.key === '2') {
        event.preventDefault();
        handleNextClick();
        return;
      }

      // Escape: 패턴 초기화
      if (event.key === '1') {
        event.preventDefault();
        resetPattern();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, isInputMode, currentPattern]);

  // 패턴 초기화
  const resetPattern = () => {
    initializePattern();
  };

  // 다음(셀 확정) - 공백 포함
  const confirmAndNext = () => {
    if (!isEnabled) return;
    onPatternComplete(currentPattern);
    initializePattern();
  };

  // 다음 버튼: 단어 재생 중이고 웹 입력 버퍼가 비어있을 때는 다음 단어로, 아니면 기존 동작 (confirm/커밋)
  const nextClickTimerRef = React.useRef<number | null>(null);
  const nextDelayMs = 450;
  const handleNextClick = () => {
    if (!isEnabled) return;
    
    // 웹 입력 버퍼가 비어있고 단어 재생 중일 때만 다음 단어로 이동 (웹 입력 우선)
    if (isWordPlaying && !hasWebInputBuffer && onNextWord) {
      onNextWord();
      return;
    }
    
    // 기존 동작: 단일 클릭은 confirm, 더블클릭은 단어 커밋
    if (nextClickTimerRef.current) {
      window.clearTimeout(nextClickTimerRef.current);
      nextClickTimerRef.current = null;
      if (onCommitWord) onCommitWord();
      initializePattern();
    } else {
      nextClickTimerRef.current = window.setTimeout(() => {
        confirmAndNext();
        nextClickTimerRef.current = null;
      }, nextDelayMs);
    }
  };



  // 활성 점 수 표시는 데모에서 사용하지 않음

  return (
    <div className={`braille-input ${isInputMode ? 'input-active' : ''}`}>
      {/* 장갑 배경 (입력 카드 내부) */}
      <div 
        className="glove-bg"
        style={{
          backgroundImage: 'url(/glove.png)',
          backgroundPosition: `${gloveBg?.posX ?? 0}% ${gloveBg?.posY ?? 50}%`,
          backgroundSize: `${gloveBg?.scale ?? 60}% auto`,
          opacity: gloveBg?.opacity ?? 0.35
        }}
      />
      <div className="braille-input-header">
        {/* <h4>점자 입력</h4> */}
        <div className="input-status">
          {isInputMode ? (
            <span className="status-active"></span>
          ) : (
            <span className="status-inactive">대기 중</span>
          )}
        </div>
      </div>

      <div className="braille-input-grid">
        {cellPositions.map((pos) => {
          const dot = currentPattern.find(d => d.id === pos.id);
          const isActive = dot?.isActive || false;
          
          // 음성 입력 패턴에서도 해당 점 찾기
          const voiceDot = voicePattern?.dots.find(d => d.id === pos.id);
          const isVoiceActive = voiceDot?.isActive || false;
          
          // 입력과 음성이 모두 활성화된 경우 입력 우선
          const showVoice = isVoiceActive && !isActive;
          
          // 디버깅용 로그 (음성 입력이 있을 때만)
          if (voicePattern && pos.id === 1) {
            console.log(`🎤 BrailleInput 렌더링: voicePattern 존재=${!!voicePattern}, 첫 번째 점 isVoiceActive=${isVoiceActive}, isActive=${isActive}, showVoice=${showVoice}`);
          }
          
          return (
            <div
              key={pos.id}
              className={`braille-input-dot ${isActive ? 'active' : 'inactive'} ${showVoice ? 'voice-active' : ''} clickable`}
              style={{
                gridRow: pos.row,
                gridColumn: pos.col,
              }}
              onClick={() => handleDotClick(pos.id)}
              data-dot-id={pos.id}
              data-voice-active={isVoiceActive}
              data-input-active={isActive}
            >
              <div className="braille-input-dot-inner" />
            </div>
          );
        })}
      </div>
      

      <div className="braille-input-controls">
        <div className="input-controls">
          <button onClick={handleNextClick} className="control-btn confirm-btn">다음</button>
        </div>
      </div>

      
    </div>
  );
};
