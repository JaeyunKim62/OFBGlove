// WebSocket 통신 서비스
import { WebSocketMessageType, BraillePatternMessage, ConnectedMessage, StatusMessage } from '../types/websocket';
import { BraillePattern } from '../types/braille';
import { NetworkUtils } from '../utils/networkUtils';

export interface ClientInfo {
  id: string;
  address: string;
  userAgent: string;
  connectedAt: string;
  lastActivity: string;
  type: string;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  
  // 이벤트 핸들러들
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
        // URL이 없으면 동적으로 생성
        if (!this.url) {
          this.url = await this.getDefaultURL();
        }
        
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket 연결됨');
          this.reconnectAttempts = 0;
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
          this.onError?.(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket 연결 종료:', event.code, event.reason);
          this.onClose?.(event);
          this.attemptReconnect();
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'braille_pattern':
        this.handleBraillePattern(data as BraillePatternMessage);
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
      source: data.source as 'esp32' | 'web' | 'demo',
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
