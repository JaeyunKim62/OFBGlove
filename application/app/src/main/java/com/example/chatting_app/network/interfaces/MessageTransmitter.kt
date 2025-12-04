package com.example.chatting_app.network.interfaces

import com.example.chatting_app.network.BrailleSettings
import com.example.chatting_app.network.BrailleSpeed
import com.example.chatting_app.network.BrailleMode

/**
 * 점자 전송 인터페이스
 * 점자 패턴 및 시퀀스 전송을 담당
 */
interface BrailleTransmitter {
    
    /**
     * 점 터치 전송
     * @param dotIndex 점 인덱스 (0-5)
     */
    fun sendDotTouch(dotIndex: Int)
    
    /**
     * 점 릴리즈 전송
     * @param dotIndex 점 인덱스 (0-5)
     */
    fun sendDotRelease(dotIndex: Int)
    
    /**
     * 패턴 완성 전송
     * @param dots 6개 점의 상태 (true=활성, false=비활성)
     */
    fun sendPatternComplete(dots: List<Boolean>)
    
    /**
     * 초기화 전송
     */
    fun sendClear()
    
    /**
     * 단어 구분자 전송 (공백)
     */
    fun sendWordSeparator()
    
    /**
     * 문장 구분자 전송
     */
    fun sendSentenceSeparator()
    
    /**
     * 점자 구분자 전송 (개별 점자 모드)
     */
    fun sendBrailleSeparator()
    
    /**
     * 점자 시퀀스 전송
     * @param patterns 점자 패턴 리스트 (각 패턴은 6개 점을 1바이트로 압축된 Byte)
     */
    fun sendBrailleSequence(patterns: List<Byte>)
    
    /**
     * 6개 점을 1바이트로 압축
     * @param dots 6개 점의 상태
     * @return 압축된 바이트
     */
    fun packBrailleDots(dots: List<Boolean>): Byte
}

/**
 * 텍스트 전송 인터페이스
 * 텍스트 메시지 전송을 담당
 */
interface TextTransmitter {
    
    /**
     * 텍스트 메시지 전송
     * @param text 일반 텍스트
     * @param braille 점자로 변환된 텍스트
     */
    fun sendTextMessage(text: String, braille: String)
    
    /**
     * 긴 텍스트 메시지를 청크로 분할하여 전송
     * @param text 일반 텍스트
     * @param braille 점자로 변환된 텍스트
     */
    fun sendLongTextMessage(text: String, braille: String)
}

/**
 * 설정 전송 인터페이스
 * 점자 설정(속도, 모드) 전송을 담당
 */
interface SettingsTransmitter {
    
    /**
     * 설정 전송
     * @param settings 점자 설정
     */
    fun sendSettings(settings: BrailleSettings)
    
    /**
     * 속도 설정만 전송
     * @param speed 점자 속도
     */
    fun sendSpeed(speed: BrailleSpeed)
    
    /**
     * 모드 설정만 전송
     * @param mode 점자 모드
     */
    fun sendMode(mode: BrailleMode)
    
    /**
     * 플래그 설정만 전송
     * @param flags 플래그 값
     */
    fun sendFlags(flags: Byte)
}

/**
 * 구성 전송 인터페이스
 * 하드웨어 구성(waveformId, holdDuration) 전송을 담당
 */
interface ConfigTransmitter {
    
    /**
     * waveformId 설정 전송
     * @param waveformId 진동 패턴 ID (0-255)
     */
    fun sendWaveformId(waveformId: Int)
    
    /**
     * holdDuration 설정 전송
     * @param holdDuration 점자 패턴 유지 시간 (ms, 0-65535)
     */
    fun sendHoldDuration(holdDuration: Int)
    
    /**
     * waveformId와 holdDuration을 함께 전송
     * @param waveformId 진동 패턴 ID (0-255)
     * @param holdDuration 점자 패턴 유지 시간 (ms, 0-65535)
     */
    fun sendWaveformIdAndHoldDuration(waveformId: Int, holdDuration: Int)
}

