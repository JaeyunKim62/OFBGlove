/**
 * 이미지 리사이즈 및 변환 유틸리티 함수
 */

/**
 * base64 이미지를 지정된 크기로 리사이즈
 * @param imageData base64 이미지 문자열 (예: "data:image/png;base64,...")
 * @param targetSize 리사이즈할 크기 (기본값: 30px)
 * @returns 리사이즈된 base64 이미지 (Promise)
 */
export const resizeImage = (
  imageData: string,
  targetSize: number = 30
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context를 가져올 수 없습니다'));
        return;
      }
      
      // 흰색 배경
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, targetSize, targetSize);
      
      // 이미지를 targetSize×targetSize로 강제 리사이즈 (비율 무시)
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      
      // base64로 변환
      try {
        const resizedImage = canvas.toDataURL('image/png');
        resolve(resizedImage);
      } catch (error) {
        reject(new Error('이미지 변환 실패: ' + (error as Error).message));
      }
    };
    
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = imageData;
  });
};

/**
 * base64 문자열을 ArrayBuffer로 변환
 * @param base64 base64 문자열 (예: "data:image/png;base64,iVBORw0KGgo...")
 * @returns ArrayBuffer
 */
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  // data:image/png;base64, 부분 제거
  const base64Data = base64.includes(',') 
    ? base64.split(',')[1] 
    : base64;
  
  const binaryString = window.atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
};

