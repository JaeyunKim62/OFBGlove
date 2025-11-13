package com.example.chatting_app

import android.content.Context
import android.util.Log

/**
 * 점자 변환을 위한 클래스
 * 기본 점자 변환만 사용 (liblouis-java 제거됨)
 */
class BrailleConverter(private val context: Context) {
    
    private var isInitialized = false
    
    init {
        initializeBrailleConverter()
    }
    
    /**
     * 점자 변환기 초기화
     */
    private fun initializeBrailleConverter() {
        try {
            Log.d("BrailleConverter", "기본 점자 변환기 초기화 시작")
            isInitialized = true
            Log.d("BrailleConverter", "기본 점자 변환기 초기화 완료")
        } catch (e: Exception) {
            Log.e("BrailleConverter", "기본 점자 변환기 초기화 실패: ${e.message}", e)
            isInitialized = false
        }
    }
    
    /**
     * 텍스트를 점자로 변환
     * @param text 변환할 텍스트
     * @return 점자 문자열
     */
    fun convertToBraille(text: String): String {
        return convertToBraille(text, null)
    }
    
    /**
     * 특정 테이블을 사용하여 텍스트를 점자로 변환 (테이블 매개변수는 무시됨)
     * @param text 변환할 텍스트
     * @param tableName 사용할 테이블 이름 (무시됨)
     * @return 점자 문자열
     */
    fun convertToBraille(text: String, @Suppress("UNUSED_PARAMETER") tableName: String?): String {
        return try {
            if (!isInitialized) {
                Log.e("BrailleConverter", "점자 변환기가 초기화되지 않음")
                return "[Error: Braille converter not initialized] $text"
            }
            
            if (text.isBlank()) {
                return ""
            }
            
            // 기본 점자 변환 사용
            val result = translateTextSimple(text)
            result
            
        } catch (e: Exception) {
            Log.e("BrailleConverter", "점자 변환 오류: ${e.message}", e)
            "[Error: ${e.message}] $text"
        }
    }
    
    /**
     * 간단한 점자 변환 (기본 구현)
     * 영어 알파벳과 기본 기호를 점자로 변환
     */
    private fun translateTextSimple(text: String): String {
        // 기본 점자 패턴 매핑 (영어 알파벳)
        val brailleMap = mapOf(
            'a' to "⠁", 'b' to "⠃", 'c' to "⠉", 'd' to "⠙", 'e' to "⠑",
            'f' to "⠋", 'g' to "⠛", 'h' to "⠓", 'i' to "⠊", 'j' to "⠚",
            'k' to "⠅", 'l' to "⠇", 'm' to "⠍", 'n' to "⠝", 'o' to "⠕",
            'p' to "⠏", 'q' to "⠟", 'r' to "⠗", 's' to "⠎", 't' to "⠞",
            'u' to "⠥", 'v' to "⠧", 'w' to "⠺", 'x' to "⠭", 'y' to "⠽", 'z' to "⠵",
            ' ' to " ", '.' to "⠲", ',' to "⠂", '!' to "⠖", '?' to "⠦",
            '0' to "⠴", '1' to "⠂", '2' to "⠆", '3' to "⠒", '4' to "⠲",
            '5' to "⠢", '6' to "⠖", '7' to "⠶", '8' to "⠦", '9' to "⠔"
        )
        
        return text.lowercase().map { char ->
            brailleMap[char] ?: char.toString()
        }.joinToString("")
    }
    
    /**
     * 사용 가능한 테이블 목록 가져오기 (빈 목록 반환)
     */
    fun getAvailableTables(): List<String> {
        return emptyList()
    }
    
    /**
     * 점자 변환기 정보 가져오기
     */
    fun getLiblouisInfo(): Map<String, Any> {
        return mapOf(
            "liblouis_version" to "Basic Translation Only",
            "available_tables" to emptyList<String>(),
            "is_liblouis_available" to false,
            "translation_method" to "Basic Character Mapping"
        )
    }
    
    /**
     * 역번역 기능 테스트 (지원하지 않음)
     */
    fun testBackTranslation(@Suppress("UNUSED_PARAMETER") brailleText: String): String? {
        Log.w("BrailleConverter", "역번역 기능은 지원하지 않습니다")
        return null
    }
    
    /**
     * 하이픈 처리 기능 테스트 (지원하지 않음)
     */
    fun testHyphenation(@Suppress("UNUSED_PARAMETER") text: String): String? {
        Log.w("BrailleConverter", "하이픈 처리 기능은 지원하지 않습니다")
        return null
    }
    
    /**
     * 텍스트를 점자로 변환하고 점자 패턴 배열도 함께 반환
     * @param text 변환할 텍스트
     * @return 점자 텍스트와 점자 패턴 배열을 포함한 결과
     */
    fun convertToBrailleWithPatterns(text: String): BraillePatternResult {
        return try {
            
            if (!isInitialized) {
                Log.e("BrailleConverter", "점자 변환기가 초기화되지 않음")
                return BraillePatternResult(
                    originalText = text,
                    brailleText = "",
                    braillePatterns = emptyList(),
                    isSuccess = false,
                    errorMessage = "Braille converter not initialized"
                )
            }
            
            if (text.isBlank()) {
                return BraillePatternResult(
                    originalText = text,
                    brailleText = "",
                    braillePatterns = emptyList(),
                    isSuccess = true
                )
            }
            
            // 기본 점자 변환
            val brailleText = translateTextSimple(text)
            
            // 점자 패턴 배열 생성
            val patterns = mutableListOf<List<Boolean>>()
            for (char in text.lowercase()) {
                if (char == ' ') continue; // 공백은 점자 패턴 배열에 추가하지 않음
                val pattern = characterToDots(char)
                if (pattern.isNotEmpty()) {
                    patterns.add(pattern)
                }
            }
            
            
            BraillePatternResult(
                originalText = text,
                brailleText = brailleText,
                braillePatterns = patterns,
                isSuccess = true
            )
            
        } catch (e: Exception) {
            Log.e("BrailleConverter", "점자 패턴 변환 오류: ${e.message}", e)
            BraillePatternResult(
                originalText = text,
                brailleText = "",
                braillePatterns = emptyList(),
                isSuccess = false,
                errorMessage = e.message
            )
        }
    }
    
    /**
     * 문자를 6개 점의 상태로 변환
     * @param character 변환할 문자
     * @return 6개 점의 활성화 상태 리스트
     */
    private fun characterToDots(character: Char): List<Boolean> {
        val pattern = getCharacterPattern(character)
        if (pattern == null) {
            Log.w("BrailleConverter", "알 수 없는 문자: $character")
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
     * 문자에 해당하는 점자 패턴 문자열 반환
     * @param character 찾을 문자
     * @return 점자 패턴 문자열 (예: "125")
     */
    private fun getCharacterPattern(character: Char): String? {
        val brailleMap = mapOf(
            'a' to "1", 'b' to "12", 'c' to "14", 'd' to "145", 'e' to "15",
            'f' to "124", 'g' to "1245", 'h' to "125", 'i' to "24", 'j' to "245",
            'k' to "13", 'l' to "123", 'm' to "134", 'n' to "1345", 'o' to "135",
            'p' to "1234", 'q' to "12345", 'r' to "1235", 's' to "234", 't' to "2345",
            'u' to "136", 'v' to "1236", 'w' to "2456", 'x' to "1346", 'y' to "13456", 'z' to "1356",
            '0' to "245", '1' to "1", '2' to "12", '3' to "14", '4' to "145",
            '5' to "15", '6' to "124", '7' to "1245", '8' to "125", '9' to "24",
            '.' to "2", ',' to "6", '!' to "235", '?' to "236", ';' to "3",
            ':' to "23", '-' to "256", '"' to "36", '\'' to "2356", ' ' to ""
        )
        
        return brailleMap[character]
    }
    
    /**
     * 엔진 정보 가져오기
     */
    fun getEngineInfo(): Map<String, Any> {
        return mapOf(
            "engine_name" to "BasicBrailleConverter",
            "version" to "1.0.0",
            "is_initialized" to isInitialized,
            "translation_method" to "Basic Character Mapping",
            "supported_languages" to listOf("English (Basic)")
        )
    }
}

/**
 * 점자 변환 결과를 나타내는 데이터 클래스
 */
data class BrailleResult(
    val originalText: String,
    val brailleText: String,
    val isSuccess: Boolean,
    val errorMessage: String? = null
)

/**
 * 점자 패턴 변환 결과를 나타내는 데이터 클래스
 */
data class BraillePatternResult(
    val originalText: String,
    val brailleText: String,
    val braillePatterns: List<List<Boolean>>, // 6개 점의 Boolean 배열들
    val isSuccess: Boolean,
    val errorMessage: String? = null
)