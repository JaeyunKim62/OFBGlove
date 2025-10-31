package com.example.chatting_app

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * 점자 입력 상태를 관리하는 데이터 클래스
 */
data class BrailleInputState(
    val dots: List<Boolean> = List(6) { false },
    val currentPattern: String = "",
    val inputText: String = "",
    val isWaitingForComplete: Boolean = false,
    val lastCharacter: Char? = null,
    // 음성 변환된 점자 패턴 관련 상태
    val voiceBraillePatterns: List<List<Boolean>> = emptyList(), // 음성으로 변환된 점자 패턴들
    val currentVoicePatternIndex: Int = 0, // 현재 표시 중인 패턴 인덱스
    val isShowingVoiceBraille: Boolean = false // 음성 점자 표시 모드 여부
)

/**
 * 점자 입력을 관리하는 클래스
 * 점자 패턴 입력, 문자 변환, TTS 피드백을 담당
 */
class BrailleInputManager(private val context: Context) {
    
    private val patternConverter = BraillePatternConverter()
    private var textToSpeech: TextToSpeech? = null
    private val hapticFeedbackManager = HapticFeedbackManager(context)
    
    // 점자 입력 상태
    private val _brailleInputState = MutableStateFlow(BrailleInputState())
    val brailleInputState: StateFlow<BrailleInputState> = _brailleInputState.asStateFlow()
    
    init {
        initializeTts()
    }
    
    /**
     * TTS 초기화
     */
    private fun initializeTts() {
        textToSpeech = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = textToSpeech?.setLanguage(Locale.US)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.w("BrailleInputManager", "TTS 언어가 지원되지 않습니다")
                } else {
                    Log.d("BrailleInputManager", "TTS 초기화 완료")
                }
            } else {
                Log.e("BrailleInputManager", "TTS 초기화 실패")
            }
        }
    }
    
    /**
     * 점자 점을 터치했을 때 호출
     * @param dotIndex 터치한 점의 인덱스 (0-5)
     */
    fun onDotTouched(dotIndex: Int) {
        if (dotIndex !in 0..5) {
            Log.w("BrailleInputManager", "잘못된 점 인덱스: $dotIndex")
            return
        }
        
        val currentState = _brailleInputState.value
        val newDots = currentState.dots.toMutableList()
        val wasActive = newDots[dotIndex]
        newDots[dotIndex] = !newDots[dotIndex] // 토글
        
        val newPattern = patternConverter.dotsToPattern(newDots)
        
        _brailleInputState.value = currentState.copy(
            dots = newDots,
            currentPattern = newPattern,
            isWaitingForComplete = newPattern.isNotEmpty()
        )
        
        // 햅틱 피드백 제공
        hapticFeedbackManager.provideDotFeedback(dotIndex, newDots[dotIndex])
        
        // 점자 점 터치 로그 제거 (성능 최적화)
    }
    
    /**
     * 완료 버튼을 눌렀을 때 호출
     */
    fun onCompletePressed() {
        val currentState = _brailleInputState.value
        
        if (currentState.currentPattern.isEmpty()) {
            Log.w("BrailleInputManager", "완료할 점자 패턴이 없습니다")
            speakText("점자를 입력해주세요")
            return
        }
        
        // 패턴 검증
        if (!patternConverter.validatePattern(currentState.currentPattern)) {
            Log.w("BrailleInputManager", "유효하지 않은 점자 패턴: ${currentState.currentPattern}")
            speakText("유효하지 않은 점자 패턴입니다")
            return
        }
        
        // 문자 변환
        val character = patternConverter.patternToCharacter(currentState.currentPattern)
        
        if (character != null) {
            // 성공적으로 변환됨
            val newInputText = currentState.inputText + character
            
            val newState = BrailleInputState(
                dots = List(6) { false },  // 점자 그리드 초기화
                currentPattern = "",       // 패턴 초기화
                inputText = newInputText,  // 누적된 텍스트
                isWaitingForComplete = false,  // 완료 대기 상태 해제
                lastCharacter = character
            )
            
            _brailleInputState.value = newState
            
            // 성공 햅틱 피드백 제공
            hapticFeedbackManager.provideSuccessFeedback()
            
            // 변환된 문자를 TTS로 읽어주기
            speakCharacter(character)
        } else {
            // 변환 실패
            Log.w("BrailleInputManager", "알 수 없는 점자 패턴: ${currentState.currentPattern}")
            
            // 오류 햅틱 피드백 제공
            hapticFeedbackManager.provideErrorFeedback()
            
            speakText("알 수 없는 점자 패턴입니다")
            
            // 패턴을 그대로 표시
            _brailleInputState.value = currentState.copy(
                isWaitingForComplete = false
            )
        }
    }
    
    /**
     * 지우기 버튼을 눌렀을 때 호출
     */
    fun onClearPressed() {
        val currentState = _brailleInputState.value
        
        if (currentState.inputText.isNotEmpty()) {
            // 입력된 텍스트에서 마지막 문자 제거
            val newInputText = currentState.inputText.dropLast(1)
            
            _brailleInputState.value = BrailleInputState(
                inputText = newInputText
            )
            
            Log.d("BrailleInputManager", "마지막 문자 제거: $newInputText")
        } else {
            // 입력된 텍스트가 없으면 현재 패턴만 초기화
            _brailleInputState.value = BrailleInputState()
            Log.d("BrailleInputManager", "점자 입력 초기화")
        }
    }
    
    /**
     * 입력을 완전히 초기화
     */
    fun resetInput() {
        _brailleInputState.value = BrailleInputState()
        Log.d("BrailleInputManager", "점자 입력 완전 초기화")
        Log.d("BrailleInputManager", "초기화된 상태: ${_brailleInputState.value}")
    }
    
    /**
     * 현재 입력된 텍스트를 반환
     */
    fun getInputText(): String {
        return _brailleInputState.value.inputText
    }
    
    /**
     * 현재 점자 패턴을 반환
     */
    fun getCurrentPattern(): String {
        return _brailleInputState.value.currentPattern
    }
    
    /**
     * 점자 패턴을 시각적으로 표시
     */
    fun getPatternVisual(): String {
        val currentState = _brailleInputState.value
        return patternConverter.patternToVisual(currentState.currentPattern)
    }
    
    /**
     * 문자를 TTS로 읽어주기
     */
    private fun speakCharacter(character: Char) {
        textToSpeech?.speak(
            character.toString(),
            TextToSpeech.QUEUE_FLUSH,
            null,
            "braille_character_${System.currentTimeMillis()}"
        )
    }
    
    /**
     * 텍스트를 TTS로 읽어주기
     */
    private fun speakText(text: String) {
        textToSpeech?.speak(
            text,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "braille_text_${System.currentTimeMillis()}"
        )
    }
    
    /**
     * 입력된 텍스트를 TTS로 읽어주기
     */
    fun speakInputText() {
        val inputText = getInputText()
        if (inputText.isNotEmpty()) {
            speakText(inputText)
        }
    }
    
    /**
     * 음성 인식된 텍스트를 점자 패턴 배열로 변환하여 저장 (deprecated - use setVoiceBraillePatternsFromResult)
     * @param text 음성 인식된 텍스트
     */
    @Deprecated("Use setVoiceBraillePatternsFromResult instead")
    fun setVoiceBraillePatterns(text: String) {
        Log.d("BrailleInputManager", "음성 점자 패턴 설정 시작: '$text'")
        
        val patterns = mutableListOf<List<Boolean>>()
        
        // 각 문자를 점자 패턴으로 변환
        for (char in text) {
            val pattern = characterToDots(char)
            if (pattern.isNotEmpty()) {
                patterns.add(pattern)
            }
        }
        
        setVoiceBraillePatternsFromResult(patterns)
    }
    
    /**
     * 점자 패턴 배열을 직접 설정
     * @param patterns 점자 패턴 배열
     */
    fun setVoiceBraillePatternsFromResult(patterns: List<List<Boolean>>) {
        Log.d("BrailleInputManager", "점자 패턴 배열 설정: ${patterns.size}개 패턴")
        
        val newState = _brailleInputState.value.copy(
            voiceBraillePatterns = patterns,
            currentVoicePatternIndex = 0,
            isShowingVoiceBraille = patterns.isNotEmpty(),
            dots = if (patterns.isNotEmpty()) patterns[0] else List(6) { false }
        )
        
        _brailleInputState.value = newState
        
        Log.d("BrailleInputManager", "점자 패턴 배열 설정 완료: ${patterns.size}개 패턴")
        Log.d("BrailleInputManager", "패턴들: ${patterns.map { it.mapIndexed { i, active -> "${i+1}:${if(active) "●" else "○"}" }.joinToString(" ") }}")
    }
    
    /**
     * 문자를 6개 점의 상태로 변환
     * @param character 변환할 문자
     * @return 6개 점의 활성화 상태 리스트
     */
    private fun characterToDots(character: Char): List<Boolean> {
        val pattern = patternConverter.characterToPattern(character.lowercaseChar())
        if (pattern == null) {
            Log.w("BrailleInputManager", "알 수 없는 문자: $character")
            return emptyList()
        }
        
        val dots = BooleanArray(6) { false }
        for (char in pattern) {
            if (char.isDigit() && char in '1'..'6') {
                dots[char.digitToInt() - 1] = true
            }
        }
        
        return dots.toList()
    }
    
    /**
     * 다음 음성 점자 패턴으로 이동
     */
    fun nextVoicePattern() {
        val currentState = _brailleInputState.value
        Log.d("BrailleInputManager", "nextVoicePattern 호출됨")
        Log.d("BrailleInputManager", "현재 상태: isShowingVoiceBraille=${currentState.isShowingVoiceBraille}, patterns=${currentState.voiceBraillePatterns.size}, currentIndex=${currentState.currentVoicePatternIndex}")
        
        if (!currentState.isShowingVoiceBraille || currentState.voiceBraillePatterns.isEmpty()) {
            Log.w("BrailleInputManager", "표시할 음성 점자 패턴이 없습니다")
            return
        }
        
        val nextIndex = currentState.currentVoicePatternIndex + 1
        Log.d("BrailleInputManager", "다음 인덱스: $nextIndex, 전체 패턴 수: ${currentState.voiceBraillePatterns.size}")
        
        if (nextIndex < currentState.voiceBraillePatterns.size) {
            val newState = currentState.copy(
                currentVoicePatternIndex = nextIndex,
                dots = currentState.voiceBraillePatterns[nextIndex]
            )
            _brailleInputState.value = newState
            Log.d("BrailleInputManager", "다음 점자 패턴으로 이동 완료: $nextIndex")
            Log.d("BrailleInputManager", "새로운 점 상태: ${newState.dots.mapIndexed { i, active -> "${i+1}:${if(active) "●" else "○"}" }.joinToString(" ")}")
        } else {
            Log.d("BrailleInputManager", "마지막 점자 패턴에 도달했습니다")
            // 마지막 패턴에 도달했을 때의 처리 (예: 메시지 전송 또는 초기화)
            speakText("마지막 점자입니다")
        }
    }
    
    /**
     * 이전 음성 점자 패턴으로 이동
     */
    fun previousVoicePattern() {
        val currentState = _brailleInputState.value
        Log.d("BrailleInputManager", "previousVoicePattern 호출됨")
        Log.d("BrailleInputManager", "현재 상태: isShowingVoiceBraille=${currentState.isShowingVoiceBraille}, patterns=${currentState.voiceBraillePatterns.size}, currentIndex=${currentState.currentVoicePatternIndex}")
        
        if (!currentState.isShowingVoiceBraille || currentState.voiceBraillePatterns.isEmpty()) {
            Log.w("BrailleInputManager", "표시할 음성 점자 패턴이 없습니다")
            return
        }
        
        val prevIndex = currentState.currentVoicePatternIndex - 1
        Log.d("BrailleInputManager", "이전 인덱스: $prevIndex")
        
        if (prevIndex >= 0) {
            val newState = currentState.copy(
                currentVoicePatternIndex = prevIndex,
                dots = currentState.voiceBraillePatterns[prevIndex]
            )
            _brailleInputState.value = newState
            Log.d("BrailleInputManager", "이전 점자 패턴으로 이동 완료: $prevIndex")
            Log.d("BrailleInputManager", "새로운 점 상태: ${newState.dots.mapIndexed { i, active -> "${i+1}:${if(active) "●" else "○"}" }.joinToString(" ")}")
        } else {
            Log.d("BrailleInputManager", "첫 번째 점자 패턴입니다")
            speakText("첫 번째 점자입니다")
        }
    }
    
    /**
     * 음성 점자 표시 모드 종료
     */
    fun exitVoiceBrailleMode() {
        val currentState = _brailleInputState.value
        Log.d("BrailleInputManager", "exitVoiceBrailleMode 호출됨")
        Log.d("BrailleInputManager", "현재 상태: isShowingVoiceBraille=${currentState.isShowingVoiceBraille}, patterns=${currentState.voiceBraillePatterns.size}")
        
        val newState = _brailleInputState.value.copy(
            isShowingVoiceBraille = false,
            voiceBraillePatterns = emptyList(),
            currentVoicePatternIndex = 0,
            dots = List(6) { false }
        )
        _brailleInputState.value = newState
        Log.d("BrailleInputManager", "음성 점자 표시 모드 종료 완료")
        Log.d("BrailleInputManager", "새로운 상태: isShowingVoiceBraille=${newState.isShowingVoiceBraille}, patterns=${newState.voiceBraillePatterns.size}")
        Log.d("BrailleInputManager", "점자 그리드 비활성화됨 - isShowingVoiceBraille=false")
    }
    
    /**
     * 현재 음성 점자 패턴의 인덱스 정보 반환
     */
    fun getVoicePatternInfo(): String {
        val currentState = _brailleInputState.value
        if (!currentState.isShowingVoiceBraille || currentState.voiceBraillePatterns.isEmpty()) {
            return "표시할 점자가 없습니다"
        }
        
        val current = currentState.currentVoicePatternIndex + 1
        val total = currentState.voiceBraillePatterns.size
        return "$current / $total"
    }
    
    
    /**
     * 리소스 정리
     */
    fun cleanup() {
        textToSpeech?.shutdown()
        textToSpeech = null
        hapticFeedbackManager.cleanup()
    }
}
