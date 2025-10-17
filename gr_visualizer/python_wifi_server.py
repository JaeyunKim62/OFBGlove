#!/usr/bin/env python3
"""
ESP32 WiFi Server Python 버전
Arduino 서버와 완전히 동일한 로직으로 구현
테스트용으로 터미널에서 실행 가능
"""

import socket
import threading
import time
import struct
from typing import Dict, Any

# 메시지 타입 정의 (Arduino와 동일)
class MessageType:
    # 송신 메시지 (앱 → 서버)
    DOT_TOUCH = 0x01
    DOT_RELEASE = 0x02
    PATTERN_COMPLETE = 0x03
    CLEAR = 0x04
    WORD_SEPARATOR = 0x05     # 단어 구분자 (공백)
    SENTENCE_SEPARATOR = 0x06 # 문장 구분자
    BRAILLE_SEPARATOR = 0x07  # 점자 구분자 (개별 점자 모드)
    TEXT_MESSAGE = 0x10
    SETTINGS = 0x20
    
    # 수신 메시지 (서버 → 앱)
    STATUS_UPDATE = 0x81      # 0x80 + 0x01
    MESSAGE_RECEIVED = 0x82   # 0x80 + 0x02
    SETTINGS_UPDATED = 0x83   # 0x80 + 0x03

# 점자 설정 구조체
class BrailleSettings:
    def __init__(self):
        self.speed = 1  # 0=SLOW, 1=NORMAL, 2=FAST
        self.mode = 0   # 0=AUTO, 1=MANUAL, 2=REPEAT

class PythonWifiServer:
    def __init__(self, host='0.0.0.0', port=8888):
        self.host = host
        self.port = port
        self.server_socket = None
        self.running = False
        
        # 점자 상태
        self.braille_dots = [False] * 6
        self.current_settings = BrailleSettings()
        
        # 연결된 클라이언트
        self.connected_clients = []
        
        print(f"🐍 Python WiFi Server 초기화 완료")
        print(f"📡 서버 주소: {host}:{port}")
        print(f"🎯 메시지 타입: {len([attr for attr in dir(MessageType) if not attr.startswith('_')])}개")
        print("-" * 50)

    def calculate_checksum(self, data: bytes) -> int:
        """체크섬 계산 (Arduino와 동일)"""
        checksum = 0
        for byte in data:
            checksum ^= byte
        return checksum & 0xFF

    def send_message(self, client_socket: socket.socket, message_type: int, data: bytes):
        """메시지 전송 (Arduino와 동일한 구조)"""
        try:
            # 헤더 구성: [messageType(1)][dataLength(2)][checksum(1)]
            data_length = len(data)
            checksum = self.calculate_checksum(data)
            
            # Little Endian으로 패킹
            header = struct.pack('<BHB', message_type, data_length, checksum)
            packet = header + data
            
            client_socket.send(packet)
            print(f"📤 전송: 타입=0x{message_type:02X}, 크기={data_length}, 체크섬=0x{checksum:02X}")
            
        except Exception as e:
            print(f"❌ 메시지 전송 실패: {e}")

    def send_status_update(self, client_socket: socket.socket):
        """상태 업데이트 전송"""
        data = bytes([0x01])  # STATUS_UPDATE
        self.send_message(client_socket, MessageType.STATUS_UPDATE, data)

    def send_message_received(self, client_socket: socket.socket):
        """메시지 수신 확인 전송"""
        data = bytes([0x02])  # MESSAGE_RECEIVED
        self.send_message(client_socket, MessageType.MESSAGE_RECEIVED, data)

    def send_settings_updated(self, client_socket: socket.socket):
        """설정 업데이트 확인 전송"""
        data = bytes([0x03])  # SETTINGS_UPDATED
        self.send_message(client_socket, MessageType.SETTINGS_UPDATED, data)

    def handle_dot_touch(self, client_socket: socket.socket, data: bytes):
        """점 터치 처리"""
        if len(data) >= 1:
            dot_index = data[0]
            if 0 <= dot_index < 6:
                self.braille_dots[dot_index] = True
                self.send_status_update(client_socket)
            else:
                print(f"❌ 잘못된 점 인덱스: {dot_index}")
        else:
            print(f"❌ 데이터가 너무 짧음: {len(data)} 바이트")

    def handle_dot_release(self, client_socket: socket.socket, data: bytes):
        """점 릴리즈 처리"""
        if len(data) >= 1:
            dot_index = data[0]
            if 0 <= dot_index < 6:
                self.braille_dots[dot_index] = False
                pattern = self.get_braille_pattern()
                print(f"👆 점 릴리즈: {dot_index + 1}번 점 비활성화")
                print(f"   📍 점자 패턴: {pattern}")
                self.send_status_update(client_socket)
            else:
                print(f"❌ 잘못된 점 인덱스: {dot_index}")

    def handle_pattern_complete(self, client_socket: socket.socket, data: bytes):
        """패턴 완성 처리"""
        if len(data) >= 1:
            # 바이트 데이터를 이진수 패턴으로 변환
            byte_value = data[0]
            binary_pattern = self.byte_to_binary_pattern(byte_value)
            print(f"점자 패턴: {binary_pattern}")
            print(f"바이트 값: 0x{byte_value:02X}")
        else:
            # 기존 방식 (점자 상태 기반)
            pattern = self.get_braille_pattern()
            print(f"점자 패턴: {pattern}")
        
        self.send_message_received(client_socket)

    def handle_clear(self, client_socket: socket.socket, data: bytes):
        """초기화 처리"""
        self.braille_dots = [False] * 6
        pattern = self.get_braille_pattern()
        print(f"🧹 점자 상태 초기화")
        print(f"   📍 점자 패턴: {pattern}")
        self.send_status_update(client_socket)
    
    def handle_word_separator(self, client_socket: socket.socket, data: bytes):
        """단어 구분자 처리"""
        print("📝 단어 구분자 (공백)")
        self.send_status_update(client_socket)
    
    def handle_sentence_separator(self, client_socket: socket.socket, data: bytes):
        """문장 구분자 처리"""
        print("📄 문장 구분자")
        self.send_status_update(client_socket)
    
    def handle_braille_separator(self, client_socket: socket.socket, data: bytes):
        """점자 구분자 처리"""
        print("🔸 점자 구분자")
        self.send_status_update(client_socket)

    def handle_text_message(self, client_socket: socket.socket, data: bytes):
        """텍스트 메시지 처리"""
        try:
            text = data.decode('utf-8')
            print(f"📝 텍스트 메시지: '{text}'")
            print(f"   길이: {len(text)} 문자")
            self.send_message_received(client_socket)
        except UnicodeDecodeError:
            print(f"❌ 텍스트 디코딩 실패")

    def handle_settings(self, client_socket: socket.socket, data: bytes):
        """설정 처리"""
        if len(data) >= 2:
            speed = data[0]
            mode = data[1]
            
            if 0 <= speed <= 2 and 0 <= mode <= 2:
                self.current_settings.speed = speed
                self.current_settings.mode = mode
                
                speed_names = ["SLOW", "NORMAL", "FAST"]
                mode_names = ["AUTO", "MANUAL", "REPEAT"]
                
                print(f"⚙️ 설정 업데이트:")
                print(f"   속도: {speed_names[speed]} ({speed})")
                print(f"   모드: {mode_names[mode]} ({mode})")
                self.send_settings_updated(client_socket)
            else:
                print(f"❌ 잘못된 설정 값: speed={speed}, mode={mode}")

    def get_braille_pattern(self) -> str:
        """점자 패턴 문자열 반환"""
        pattern = ""
        for i in range(6):
            pattern += "1" if self.braille_dots[i] else "0"
        return pattern
    
    def byte_to_binary_pattern(self, byte_value: int) -> str:
        """바이트 값을 6자리 이진수 패턴으로 변환"""
        # 6자리 이진수로 변환 (앞에 0 패딩)
        binary = format(byte_value, '06b')
        return binary
    
    def get_visual_pattern(self) -> str:
        """점자 패턴을 시각적으로 표현"""
        # 6점 점자 그리드 (2x3)
        # 1 4
        # 2 5  
        # 3 6
        visual = ""
        visual += "●" if self.braille_dots[0] else "○"  # 1번 점
        visual += " " if self.braille_dots[0] or self.braille_dots[3] else " "
        visual += "●" if self.braille_dots[3] else "○"  # 4번 점
        visual += "\n"
        visual += "●" if self.braille_dots[1] else "○"  # 2번 점
        visual += " " if self.braille_dots[1] or self.braille_dots[4] else " "
        visual += "●" if self.braille_dots[4] else "○"  # 5번 점
        visual += "\n"
        visual += "●" if self.braille_dots[2] else "○"  # 3번 점
        visual += " " if self.braille_dots[2] or self.braille_dots[5] else " "
        visual += "●" if self.braille_dots[5] else "○"  # 6번 점
        return visual
    
    def get_message_type_name(self, message_type: int) -> str:
        """메시지 타입 이름 반환"""
        type_names = {
            MessageType.DOT_TOUCH: "점 터치",
            MessageType.DOT_RELEASE: "점 릴리즈", 
            MessageType.PATTERN_COMPLETE: "패턴 완성",
            MessageType.CLEAR: "초기화",
            MessageType.WORD_SEPARATOR: "단어 구분자",
            MessageType.SENTENCE_SEPARATOR: "문장 구분자",
            MessageType.BRAILLE_SEPARATOR: "점자 구분자",
            MessageType.TEXT_MESSAGE: "텍스트 메시지",
            MessageType.SETTINGS: "설정",
            MessageType.STATUS_UPDATE: "상태 업데이트",
            MessageType.MESSAGE_RECEIVED: "메시지 수신 확인",
            MessageType.SETTINGS_UPDATED: "설정 업데이트 확인"
        }
        return type_names.get(message_type, f"알 수 없음")

    def get_braille_character(self) -> str:
        """점자 문자 반환 (간단한 매핑)"""
        pattern = self.get_braille_pattern()
        # 간단한 점자-문자 매핑 (실제로는 liblouis 사용)
        braille_map = {
            "100000": "A", "110000": "B", "100100": "C", "100110": "D",
            "100010": "E", "110100": "F", "110110": "G", "110010": "H",
            "010100": "I", "010110": "J", "101000": "K", "111000": "L",
            "101100": "M", "101110": "N", "101010": "O", "111100": "P",
            "111110": "Q", "111010": "R", "011100": "S", "011110": "T",
            "101001": "U", "111001": "V", "010111": "W", "101101": "X",
            "101111": "Y", "101011": "Z", "000000": " "
        }
        return braille_map.get(pattern, "?")

    def handle_client(self, client_socket: socket.socket, client_address):
        """클라이언트 연결 처리"""
        print(f"🔗 클라이언트 연결: {client_address}")
        self.connected_clients.append(client_socket)
        
        try:
            while self.running:
                # 헤더 읽기 (4바이트)
                header_data = client_socket.recv(4)
                if not header_data:
                    break
                
                if len(header_data) < 4:
                    print(f"❌ 불완전한 헤더: {len(header_data)}바이트")
                    continue
                
                # 헤더 파싱 (Little Endian)
                message_type, data_length, checksum = struct.unpack('<BHB', header_data)
                
                message_type_name = self.get_message_type_name(message_type)
                print(f"📥 수신: {message_type_name} (0x{message_type:02X}), 크기={data_length}, 체크섬=0x{checksum:02X}")
                
                # 데이터 읽기
                if data_length > 0:
                    data = client_socket.recv(data_length)
                    if len(data) != data_length:
                        print(f"❌ 불완전한 데이터: {len(data)}/{data_length}바이트")
                        continue
                    
                    # 체크섬 검증
                    calculated_checksum = self.calculate_checksum(data)
                    if calculated_checksum != checksum:
                        print(f"❌ 체크섬 불일치: 계산={calculated_checksum:02X}, 수신={checksum:02X}")
                        continue
                
                # 메시지 타입별 처리
                if message_type == MessageType.DOT_TOUCH:
                    self.handle_dot_touch(client_socket, data)
                elif message_type == MessageType.DOT_RELEASE:
                    self.handle_dot_release(client_socket, data)
                elif message_type == MessageType.PATTERN_COMPLETE:
                    self.handle_pattern_complete(client_socket, data)
                elif message_type == MessageType.CLEAR:
                    self.handle_clear(client_socket, data)
                elif message_type == MessageType.WORD_SEPARATOR:
                    self.handle_word_separator(client_socket, data)
                elif message_type == MessageType.SENTENCE_SEPARATOR:
                    self.handle_sentence_separator(client_socket, data)
                elif message_type == MessageType.BRAILLE_SEPARATOR:
                    self.handle_braille_separator(client_socket, data)
                elif message_type == MessageType.TEXT_MESSAGE:
                    self.handle_text_message(client_socket, data)
                elif message_type == MessageType.SETTINGS:
                    self.handle_settings(client_socket, data)
                else:
                    print(f"❌ 알 수 없는 메시지 타입: 0x{message_type:02X}")
                
                print("-" * 30)
                
        except Exception as e:
            print(f"❌ 클라이언트 처리 오류: {e}")
        finally:
            print(f"🔌 클라이언트 연결 종료: {client_address}")
            if client_socket in self.connected_clients:
                self.connected_clients.remove(client_socket)
            client_socket.close()

    def start_server(self):
        """서버 시작"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            self.running = True
            
            print(f"🚀 Python WiFi Server 시작!")
            print(f"📡 대기 중: {self.host}:{self.port}")
            print(f"💡 종료하려면 Ctrl+C를 누르세요")
            print("=" * 50)
            
            while self.running:
                try:
                    client_socket, client_address = self.server_socket.accept()
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, client_address)
                    )
                    client_thread.daemon = True
                    client_thread.start()
                    
                except KeyboardInterrupt:
                    print(f"\n🛑 서버 종료 요청")
                    break
                except Exception as e:
                    print(f"❌ 서버 오류: {e}")
                    
        except Exception as e:
            print(f"❌ 서버 시작 실패: {e}")
        finally:
            self.stop_server()

    def stop_server(self):
        """서버 종료"""
        self.running = False
        if self.server_socket:
            self.server_socket.close()
        print(f"🔚 Python WiFi Server 종료")

def main():
    """메인 함수"""
    print("🐍 Python WiFi Server (Arduino 호환)")
    print("=" * 50)
    
    server = PythonWifiServer()
    
    try:
        server.start_server()
    except KeyboardInterrupt:
        print(f"\n🛑 사용자에 의한 종료")
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
    finally:
        server.stop_server()

if __name__ == "__main__":
    main()
