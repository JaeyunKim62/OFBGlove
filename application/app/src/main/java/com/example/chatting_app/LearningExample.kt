package com.example.chatting_app

/**
 * 학습 페이지에서 사용할 예시 텍스트 데이터 모델
 */
data class LearningExample(
    val id: String,
    val text: String,
    val category: String? = null,  // 향후 카테고리 지원용
    val description: String? = null // 향후 설명 추가용
)

/**
 * 학습 페이지 예시 텍스트 목록
 * 향후 확장: SharedPreferences에서 로드하거나 서버에서 가져오기
 */
object LearningExamples {
    val examples = listOf(
        LearningExample(
            id = "hello_world",
            text = "hello world",
            category = "기본",
            description = "기본 인사말"
        ),
        LearningExample(
            id = "good_morning",
            text = "good morning",
            category = "인사말",
            description = "아침 인사"
        ),
        LearningExample(
            id = "thank_you",
            text = "thank you",
            category = "인사말",
            description = "감사 인사"
        ),
        LearningExample(
            id = "how_are_you",
            text = "how are you",
            category = "질문",
            description = "안부 질문"
        ),
        LearningExample(
            id = "a",
            text = "a",
            category = "알파벳",
            description = "알파벳 a"
        ),
        LearningExample(
            id = "b",
            text = "b",
            category = "알파벳",
            description = "알파벳 b"
        ),
    )
}

