import React, { useRef, useEffect, useState } from 'react';
import './HandwritingCanvas.css';

interface HandwritingCanvasProps {
  onImageComplete?: (imageData: string) => void; // base64 이미지 데이터 콜백
}

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  onImageComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  // Canvas 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context를 가져올 수 없습니다');
      return;
    }

    // Canvas 크기 설정 (픽셀 단위)
    canvas.width = 200;
    canvas.height = 200;

    // 흰색 배경
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 그리기 설정
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // 마우스/터치 이벤트 핸들러
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      // 터치 이벤트
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      // 마우스 이벤트
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setHasContent(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Canvas 지우기
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 흰색 배경으로 채우기
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  // Canvas를 base64 이미지로 변환
  const getImageData = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('이미지 변환 실패:', error);
      return null;
    }
  };

  // 전송 버튼 클릭 핸들러
  const handleSend = () => {
    const imageData = getImageData();
    if (imageData && onImageComplete) {
      onImageComplete(imageData);
      // 전송 후 Canvas 지우기
      clearCanvas();
    } else if (!imageData) {
      console.error('이미지 데이터를 가져올 수 없습니다');
    }
  };

  return (
    <div className="handwriting-canvas-container">
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="handwriting-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={(e) => {
            e.preventDefault(); // 스크롤 방지
            draw(e);
          }}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="canvas-controls">
        <button
          className="canvas-btn clear-btn"
          onClick={clearCanvas}
          disabled={!hasContent}
        >
          지우기
        </button>
        <button
          className="canvas-btn send-btn"
          onClick={handleSend}
          disabled={!hasContent}
        >
          전송
        </button>
      </div>
    </div>
  );
};

