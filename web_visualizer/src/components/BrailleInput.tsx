import React, { useState, useEffect } from 'react';
import { BrailleDot } from '../types/braille';
import './BrailleInput.css';

interface BrailleInputProps {
  onPatternComplete: (pattern: BrailleDot[]) => void;
  onPatternChange: (pattern: BrailleDot[]) => void;
  onSend?: () => void; // 전체 문장 전송 트리거
  isEnabled?: boolean;
  gloveBg?: { posX: number; posY: number; scale: number; opacity: number };
}

export const BrailleInput: React.FC<BrailleInputProps> = ({
  onPatternComplete,
  onPatternChange,
  onSend,
  isEnabled = true,
  gloveBg
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
            </div>
          );
        })}
      </div>
      

      <div className="braille-input-controls">
        <div className="input-controls">
          <button onClick={confirmAndNext} className="control-btn confirm-btn">다음</button>
        </div>
      </div>

      
    </div>
  );
};
