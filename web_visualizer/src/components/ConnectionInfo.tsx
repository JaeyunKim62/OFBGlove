import React, { useState, useEffect } from 'react';
import { NetworkUtils } from '../utils/networkUtils';
import { WebSocketService, ClientInfo } from '../services/WebSocketService';
import './ConnectionInfo.css';

interface ConnectionInfoProps {
  onIPDetected?: (ip: string) => void;
  wsService?: WebSocketService | null; // App.tsx에서 전달받은 WebSocket 서비스
}

export const ConnectionInfo: React.FC<ConnectionInfoProps> = ({ onIPDetected, wsService }) => {
  const [localIP, setLocalIP] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string>('');
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [blockedClients, setBlockedClients] = useState<string[]>([]);

  useEffect(() => {
    detectIP();
    
    // App.tsx의 WebSocket 서비스가 준비되면 클라이언트 목록 요청
    if (wsService) {
      wsService.onClients = (clientList) => {
        setClients(clientList);
      };
      
      wsService.onClientsUpdated = (clientList) => {
        setClients(clientList);
      };
      
      wsService.onBlockedClients = (blockedList) => {
        setBlockedClients(blockedList);
      };
      
      // 클라이언트 목록과 차단된 클라이언트 목록 요청
      wsService.requestClients();
      wsService.send({
        type: 'get_blocked_clients'
      });
    }
  }, [wsService]);

  const detectIP = async () => {
    setIsDetecting(true);
    setError('');
    
    try {
      const ip = await NetworkUtils.getLocalIP();
      setLocalIP(ip);
      onIPDetected?.(ip);
    } catch (err) {
      setError('WiFi IP 주소 감지 실패. 수동으로 입력해주세요.');
      console.error('IP 감지 오류:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('클립보드에 복사되었습니다!');
    }).catch(() => {
      // 폴백: 텍스트 선택
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('클립보드에 복사되었습니다!');
    });
  };

  const generateQRCode = () => {
    if (localIP) {
      const url = NetworkUtils.getHTTPURL(localIP);
      // QR 코드 생성 (간단한 방법)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
      window.open(qrUrl, '_blank');
    }
  };

  const blockClient = (address: string) => {
    if (wsService && confirm(`클라이언트 ${address}를 차단하시겠습니까?`)) {
      wsService.send({
        type: 'block_client',
        address: address
      });
      console.log(`🚫 클라이언트 차단 요청: ${address}`);
    }
  };

  const unblockClient = (address: string) => {
    if (wsService && confirm(`클라이언트 ${address}의 차단을 해제하시겠습니까?`)) {
      wsService.send({
        type: 'unblock_client',
        address: address
      });
      console.log(`✅ 클라이언트 차단 해제 요청: ${address}`);
    }
  };

  const refreshBlockedClients = () => {
    if (wsService) {
      wsService.send({
        type: 'get_blocked_clients'
      });
    }
  };

  return (
    <div className="connection-info">
      <h3>📱 핸드폰 TCP 연결 정보</h3>
      
      {isDetecting && (
        <div className="detecting">
          <div className="spinner"></div>
          <span>WiFi IP 주소 감지 중...</span>
        </div>
      )}

      {error && (
        <div className="error">
          <span>{error}</span>
          <button onClick={detectIP} className="retry-btn">
            다시 시도
          </button>
        </div>
      )}

      {localIP && (
        <div className="connection-details">
          <div className="info-item">
            <label>WiFi IP 주소 (무선 어댑터):</label>
            <div className="value-container">
              <span className="ip-address">{localIP}</span>
              <button 
                onClick={() => copyToClipboard(localIP)}
                className="copy-btn"
                title="복사"
              >
                📋
              </button>
            </div>
          </div>

          {/* 연결된 클라이언트 목록 */}
          <div className="info-item">
            <label>연결된 클라이언트 ({clients.length}개):</label>
            <div className="clients-list">
              {clients.length === 0 ? (
                <div className="no-clients">연결된 클라이언트가 없습니다</div>
              ) : (
                clients.map((client) => (
                  <div key={client.id} className="client-item">
                    <div className="client-header">
                      <span className="client-type">{client.type}</span>
                      <span className="client-id">{client.id}</span>
                      <button 
                        onClick={() => blockClient(client.address)}
                        className="block-btn"
                        title="클라이언트 차단"
                      >
                        🚫 차단
                      </button>
                    </div>
                    <div className="client-details">
                      <div className="client-address">📍 {client.address}</div>
                      <div className="client-user-agent">🌐 {client.userAgent}</div>
                      <div className="client-time">
                        <div>연결: {new Date(client.connectedAt).toLocaleString()}</div>
                        <div>활동: {new Date(client.lastActivity).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={() => wsService?.requestClients()} 
              className="refresh-clients-btn"
              title="클라이언트 목록 새로고침"
            >
              🔄 새로고침
            </button>
          </div>

          {/* 차단된 클라이언트 목록 */}
          <div className="info-item">
            <label>차단된 클라이언트 ({blockedClients.length}개):</label>
            <div className="blocked-clients-list">
              {blockedClients.length === 0 ? (
                <div className="no-blocked-clients">차단된 클라이언트가 없습니다</div>
              ) : (
                blockedClients.map((address) => (
                  <div key={address} className="blocked-client-item">
                    <div className="blocked-client-header">
                      <span className="blocked-client-address">🚫 {address}</span>
                      <button 
                        onClick={() => unblockClient(address)}
                        className="unblock-btn"
                        title="차단 해제"
                      >
                        ✅ 해제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={refreshBlockedClients} 
              className="refresh-blocked-btn"
              title="차단된 클라이언트 목록 새로고침"
            >
              🔄 새로고침
            </button>
          </div>

              <div className="info-item">
                <label>TCP 서버 주소 (핸드폰/ESP32 앱용):</label>
                <div className="value-container">
                  <span className="url">{localIP}:8888</span>
                  <button 
                    onClick={() => copyToClipboard(`${localIP}:8888`)}
                    className="copy-btn"
                    title="복사"
                  >
                    📋
                  </button>
                </div>
              </div>

          <div className="info-item">
            <label>웹 시각화 주소 (노트북 브라우저용):</label>
            <div className="value-container">
              <span className="url">{NetworkUtils.getHTTPURL(localIP)}</span>
              <button 
                onClick={() => copyToClipboard(NetworkUtils.getHTTPURL(localIP))}
                className="copy-btn"
                title="복사"
              >
                📋
              </button>
            </div>
          </div>

          <div className="actions">
            <button onClick={generateQRCode} className="qr-btn">
              📱 QR 코드 생성
            </button>
            <button onClick={detectIP} className="refresh-btn">
              🔄 새로고침
            </button>
          </div>

          <div className="instructions">
            <h4>연결 방법:</h4>
            <div className="connection-methods">
              <div className="method">
                <h5>📱 핸드폰/ESP32 앱 (TCP 클라이언트):</h5>
                <ol>
                  <li>핸드폰/ESP32가 노트북과 같은 WiFi에 연결되어 있는지 확인</li>
                  <li>앱에서 TCP 연결 설정</li>
                    <li>서버 주소: <code>{localIP}</code></li>
                    <li>포트: <code>8888</code></li>
                  <li>GATT 호환 프로토콜로 점자 데이터 전송</li>
                </ol>
              </div>
              
              <div className="method">
                <h5>💻 노트북 (웹 시각화):</h5>
                <ol>
                  <li>노트북 브라우저에서 위의 웹 시각화 주소 접속</li>
                  <li>실시간으로 들어오는 점자 패턴 확인</li>
                  <li>데이터 수집 및 통계 확인</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
