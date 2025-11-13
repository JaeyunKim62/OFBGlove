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
        *('a'..'z').map { letter ->
            LearningExample(
                id = letter.toString(),
                text = letter.toString(),
                category = "알파벳",
                description = "알파벳 $letter"
            )
        }.toTypedArray(),
        LearningExample(
            id = "P1",
            text = "ㄱ",
            category = "버튼",
            description = "1번 버튼"
        ),
        LearningExample(
            id = "P2",
            text = "ㄴ",
            category = "버튼",
            description = "2번 버튼"
        ),
        LearningExample(
            id = "P3",
            text = "ㄷ",
            category = "버튼",
            description = "3번 버튼"
        ),
        LearningExample(
            id = "P4",
            text = "ㄹ",
            category = "버튼",
            description = "4번 버튼"
        ),
        LearningExample(
            id = "P5",
            text = "ㅁ",
            category = "버튼",
            description = "5번 버튼"
        ),
        LearningExample(
            id = "P6",
            text = "ㅂ",
            category = "버튼",
            description = "6번 버튼"
        ),
        LearningExample(
            id = "dot1",
            text = "Dot 1",
            category = "버튼",
            description = "1번 점 테스트"
        ),
        LearningExample(
            id = "dot2",
            text = "Dot 2",
            category = "버튼",
            description = "2번 점 테스트"
        ),
        LearningExample(
            id = "dot3",
            text = "Dot 3",
            category = "버튼",
            description = "3번 점 테스트"
        ),
        LearningExample(
            id = "dot4",
            text = "Dot 4",
            category = "버튼",
            description = "4번 점 테스트"
        ),
        LearningExample(
            id = "dot5",
            text = "Dot 5",
            category = "버튼",
            description = "5번 점 테스트"
        ),
        LearningExample(
            id = "dot6",
            text = "Dot 6",
            category = "버튼",
            description = "6번 점 테스트"
        )
    )
}

