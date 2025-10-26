import React, { useState, useEffect } from 'react';
import { BrailleDot } from '../types/braille';
import './BrailleInput.css';

interface BrailleInputProps {
  onPatternComplete: (pattern: BrailleDot[]) => void;
  onPatternChange: (pattern: BrailleDot[]) => void;
  isEnabled?: boolean;
}

export const BrailleInput: React.FC<BrailleInputProps> = ({
  onPatternComplete,
  onPatternChange,
  isEnabled = true
}) => {
  const [currentPattern, setCurrentPattern] = useState<BrailleDot[]>([]);
  const [isInputMode, setIsInputMode] = useState(true);
  const [inputStep, setInputStep] = useState<'select' | 'confirm' | 'complete'>('select');

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

  // 패턴 초기화
  const resetPattern = () => {
    setInputStep('select');
    initializePattern();
  };

  // 패턴 확인
  const confirmPattern = () => {
    if (currentPattern.some(dot => dot.isActive)) {
      setInputStep('confirm');
    }
  };

  // 패턴 전송
  const sendPattern = () => {
    onPatternComplete(currentPattern);
    setInputStep('complete');
    
    // 자동으로 새로운 입력 시작
    setTimeout(() => {
      initializePattern();
      setInputStep('select');
    }, 1000); // 1초 후 자동으로 새 입력 시작
  };

  // 패턴 수정 (확인 단계에서 선택 단계로 돌아가기)
  const editPattern = () => {
    setInputStep('select');
  };



  const activeDotsCount = currentPattern.filter(dot => dot.isActive).length;

  return (
    <div className={`braille-input ${isInputMode ? 'input-active' : ''}`}>
      <div className="braille-input-header">
        <h4>점자 입력</h4>
        <div className="input-status">
          {isInputMode ? (
            <span className="status-active">입력 모드</span>
          ) : (
            <span className="status-inactive">대기 중</span>
          )}
        </div>
      </div>

      <div className="braille-input-grid">
        {cellPositions.map((pos) => {
          const dot = currentPattern.find(d => d.id === pos.id);
          const isActive = dot?.isActive || false;
          
          return (
            <div
              key={pos.id}
              className={`braille-input-dot ${isActive ? 'active' : 'inactive'} clickable`}
              style={{
                gridRow: pos.row,
                gridColumn: pos.col,
              }}
              onClick={() => handleDotClick(pos.id)}
              data-dot-id={pos.id}
            >
              <div className="braille-input-dot-inner" />
              <div className="braille-input-dot-label">{pos.id}</div>
            </div>
          );
        })}
      </div>

      <div className="braille-input-info">
        <div className="pattern-count">
          활성 점: {activeDotsCount}/6
        </div>
      </div>

      <div className="braille-input-controls">
        <div className="input-controls">
          {inputStep === 'select' && (
            <>
              <button 
                onClick={confirmPattern}
                className="control-btn confirm-btn"
                disabled={activeDotsCount === 0}
              >
                확인
              </button>
              <button 
                onClick={resetPattern}
                className="control-btn cancel-btn"
              >
                초기화
              </button>
            </>
          )}
          
          {inputStep === 'confirm' && (
            <>
              <button 
                onClick={sendPattern}
                className="control-btn complete-btn"
              >
                전송
              </button>
              <button 
                onClick={editPattern}
                className="control-btn cancel-btn"
              >
                수정
              </button>
            </>
          )}
          
          {inputStep === 'complete' && (
            <div className="completion-message">
              ✅ 전송 완료! 새 입력 준비 중...
            </div>
          )}
        </div>
      </div>

      <div className="braille-input-help">
        <p>사용법: 점을 클릭하여 활성화/비활성화 → 확인 → 전송</p>
      </div>
    </div>
  );
};
