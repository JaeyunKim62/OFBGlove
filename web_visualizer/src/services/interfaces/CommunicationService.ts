// 통신 서비스 인터페이스
// Android 앱의 CommunicationChannel과 유사한 구조
import { BraillePattern } from '../../types/braille';
import { ConnectedMessage, StatusMessage } from '../../types/websocket';
import { ClientInfo } from '../WebSocketService';

/**
 * 연결 상태
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * 통신 서비스 인터페이스
 * WebSocket, SSE, WebRTC 등 다양한 통신 방식을 추상화
 */
export interface CommunicationService {
  // ========== 연결 관리 ==========
  
  /**
   * 서버에 연결
   */
  connect(): Promise<void>;
  
  /**
   * 연결 해제
   */
  disconnect(): void;
  
  /**
   * 연결 상태 확인
   */
  isConnected(): boolean;
  
  /**
   * 재연결 (선택적)
   */
  reconnect?(): Promise<void>;
  
  // ========== 메시지 송수신 ==========
  
  /**
   * 메시지 전송
   */
  send(message: any): void;
  
  /**
   * 클라이언트 목록 요청 (선택적)
   */
  requestClients?(): void;
  
  // ========== 상태 관찰 ==========
  
  /**
   * 연결 상태 (옵셔널 - 리액티브 스트림)
   */
  connectionState?: ConnectionState;
  
  // ========== 이벤트 핸들러 ==========
  
  /**
   * 점자 패턴 수신
   */
  onBraillePattern?: (pattern: BraillePattern) => void;
  
  /**
   * 연결 완료
   */
  onConnected?: (data: ConnectedMessage) => void;
  
  /**
   * 상태 업데이트
   */
  onStatus?: (data: StatusMessage) => void;
  
  /**
   * 클라이언트 목록
   */
  onClients?: (clients: ClientInfo[]) => void;
  
  /**
   * 클라이언트 목록 업데이트
   */
  onClientsUpdated?: (clients: ClientInfo[]) => void;
  
  /**
   * 서버 로그
   */
  onServerLog?: (log: any) => void;
  
  /**
   * 단어 구분자
   */
  onWordSeparator?: () => void;
  
  /**
   * 문장 구분자
   */
  onSentenceSeparator?: () => void;
  
  /**
   * 점자 구분자
   */
  onBrailleSeparator?: () => void;
  
  /**
   * 차단된 클라이언트 목록
   */
  onBlockedClients?: (clients: string[]) => void;
  
  /**
   * 오류 발생
   */
  onError?: (error: Event) => void;
  
  /**
   * 연결 종료
   */
  onClose?: (event: CloseEvent) => void;
}

