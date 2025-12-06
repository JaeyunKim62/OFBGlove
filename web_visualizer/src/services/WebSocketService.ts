// WebSocket 통신 서비스
import { WebSocketMessageType, BraillePatternMessage, ConnectedMessage, StatusMessage } from '../types/websocket';
import { BraillePattern } from '../types/braille';
import { NetworkUtils } from '../utils/networkUtils';
import { CommunicationService, ConnectionState } from './interfaces/CommunicationService';

export interface ClientInfo {
  id: string;
  address: string;
  userAgent: string;
  connectedAt: string;
  lastActivity: string;
  type: string;
}

export class WebSocketService implements CommunicationService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  
  // 연결 상태 (CommunicationService 인터페이스)
  public connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  
  // 이벤트 핸들러들 (CommunicationService 인터페이스)
  public onBraillePattern?: (pattern: BraillePattern) => void;
  public onConnected?: (data: ConnectedMessage) => void;
  public onStatus?: (data: StatusMessage) => void;
  public onClients?: (clients: ClientInfo[]) => void;
  public onClientsUpdated?: (clients: ClientInfo[]) => void;
  public onServerLog?: (log: any) => void;
  public onWordSeparator?: () => void;
  public onSentenceSeparator?: () => void;
  public onBrailleSeparator?: () => void;
  public onBlockedClients?: (clients: string[]) => void;
  public onError?: (error: Event) => void;
  public onClose?: (event: CloseEvent) => void;

  constructor(url?: string) {
    this.url = url || null;
  }

  private async getDefaultURL(): Promise<string> {
    try {
      // 동적으로 로컬 IP 감지
      const localIP = await NetworkUtils.getLocalIP();
      return `ws://${localIP}:8889/ws`;
    } catch (error) {
      console.error('IP 감지 실패, 기본값 사용:', error);
      // IP 감지 실패 시 localhost 사용
      return 'ws://localhost:8889/ws';
    }
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.connectionState = ConnectionState.CONNECTING;
        
        // URL이 없으면 동적으로 생성
        if (!this.url) {
          this.url = await this.getDefaultURL();
        }
        
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket 연결됨');
          this.reconnectAttempts = 0;
          this.connectionState = ConnectionState.CONNECTED;
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('메시지 파싱 오류:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket 오류:', error);
          this.connectionState = ConnectionState.ERROR;
          this.onError?.(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket 연결 종료:', event.code, event.reason);
          this.connectionState = ConnectionState.DISCONNECTED;
          this.onClose?.(event);
          this.attemptReconnect();
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any) {
    // 디버깅: 모든 메시지 타입 로그
    if (data.type === 'word_separator' || data.type === 'sentence_separator' || data.type === 'braille_pattern' || data.type === 'braille_sequence') {
      console.log(`🔍 WebSocket 메시지 수신: ${data.type}`, data);
    }
    
    switch (data.type) {
      case 'braille_pattern':
        this.handleBraillePattern(data as BraillePatternMessage);
        break;
      case 'braille_sequence':
        console.log('📨 braille_sequence 메시지 처리 시작:', data.patternCount, '개 패턴');
        if (data.patterns && Array.isArray(data.patterns)) {
          data.patterns.forEach((patternData: any) => {
            if (patternData.dots) {
              this.handleBraillePattern({
                type: 'braille_pattern',
                pattern: patternData.dots,
                character: patternData.character,
                binary: patternData.binary,
                timestamp: patternData.timestamp || Date.now(),
                source: 'esp32'
              } as BraillePatternMessage);
            }
          });
        }
        break;
      case 'connected':
        this.onConnected?.(data as ConnectedMessage);
        break;
      case 'status':
        this.onStatus?.(data as StatusMessage);
        break;
      case 'clients':
        this.onClients?.(data.clients);
        break;
      case 'clients_updated':
        this.onClientsUpdated?.(data.clients);
        break;
      case 'server_log':
        this.onServerLog?.(data.log);
        break;
      case 'word_separator':
        console.log('📨 word_separator 메시지 처리 시작');
        this.onWordSeparator?.();
        break;
      case 'sentence_separator':
        this.onSentenceSeparator?.();
        break;
      case 'braille_separator':
        this.onBrailleSeparator?.();
        break;
      case 'blocked_clients':
        this.onBlockedClients?.(data.clients);
        break;
      default:
        console.log('알 수 없는 메시지 타입:', data.type);
    }
  }

  private handleBraillePattern(data: BraillePatternMessage) {
    const pattern: BraillePattern = {
      dots: data.pattern.map((isActive: boolean, index: number) => ({
        id: index + 1,
        isActive
      })),
      timestamp: data.timestamp || Date.now(),
      source: (data.source || 'esp32') as 'esp32' | 'web' | 'demo', // source가 없으면 기본값 'esp32' 사용
      character: data.character,
      binary: data.binary
    };
    
    this.onBraillePattern?.(pattern);
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(async () => {
        try {
          await this.connect();
        } catch (error) {
          console.error('재연결 실패:', error);
        }
      }, this.reconnectInterval);
    } else {
      console.error('최대 재연결 시도 횟수 초과');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = ConnectionState.DISCONNECTED;
  }
  
  /**
   * 재연결 (CommunicationService 인터페이스)
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket이 연결되지 않음');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 클라이언트 목록 요청
  requestClients() {
    this.send({ type: 'get_clients' });
  }
}
