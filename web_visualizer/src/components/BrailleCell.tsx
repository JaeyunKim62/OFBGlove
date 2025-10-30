import React from 'react';
import { BrailleDot } from '../types/braille';
import './BrailleCell.css';

interface BrailleCellProps {
  dots: BrailleDot[];
  size?: 'tiny' | 'small' | 'medium' | 'large';
  showLabels?: boolean;
  onDotClick?: (id: number) => void;
  displayMode?: 'hide' | 'fade' | 'keep';
  isVisible?: boolean;
}

export const BrailleCell: React.FC<BrailleCellProps> = ({
  dots,
  size = 'medium',
  showLabels = true,
  onDotClick,
  displayMode = 'hide',
  isVisible = true
}) => {
  // 표준 점자 셀 배치 (2×3 그리드)
  const cellPositions = [
    { row: 1, col: 1, id: 1 }, // 1번 점 (왼쪽 위)
    { row: 2, col: 1, id: 2 }, // 2번 점 (왼쪽 중간)
    { row: 3, col: 1, id: 3 }, // 3번 점 (왼쪽 아래)
    { row: 1, col: 2, id: 4 }, // 4번 점 (오른쪽 위)
    { row: 2, col: 2, id: 5 }, // 5번 점 (오른쪽 중간)
    { row: 3, col: 2, id: 6 }, // 6번 점 (오른쪽 아래)
  ];

  const getBrailleCharacter = (dots: BrailleDot[]): string => {
    const pattern = dots.map(d => d.isActive ? '1' : '0').join('');
    const brailleMap: { [key: string]: string } = {
      "100000": "A", "110000": "B", "100100": "C", "100110": "D",
      "100010": "E", "110100": "F", "110110": "G", "110010": "H",
      "010100": "I", "010110": "J", "101000": "K", "111000": "L",
      "101100": "M", "101110": "N", "101010": "O", "111100": "P",
      "111110": "Q", "111010": "R", "011100": "S", "011110": "T",
      "101001": "U", "111001": "V", "010111": "W", "101101": "X",
      "101111": "Y", "101011": "Z", "000000": "⌴"
    };
    return brailleMap[pattern] || "?";
  };

  return (
    <div className={`braille-cell braille-cell-${size} braille-cell-${displayMode} ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="braille-cell-title">점자 셀</div>
      <div className="braille-cell-grid">
        {cellPositions.map((pos) => {
          const dot = dots.find(d => d.id === pos.id);
          const isActive = dot?.isActive || false;
          
          return (
            <div
              key={pos.id}
              className={`braille-cell-dot ${isActive ? 'active' : 'inactive'}`}
              style={{
                gridRow: pos.row,
                gridColumn: pos.col,
              }}
              onClick={() => onDotClick?.(pos.id)}
              data-dot-id={pos.id}
            >
              <div className="braille-cell-dot-inner" />
              {showLabels && (
                <div className="braille-cell-dot-label">{pos.id}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="braille-cell-character">
        {getBrailleCharacter(dots)}
      </div>
    </div>
  );
};
