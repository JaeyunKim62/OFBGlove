package com.example.chatting_app

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 학습 페이지 화면
 * 예시 문장들을 버튼으로 제공하고, 클릭 시 텍스트를 점자로 변환하여 전송
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearningScreen(
    modifier: Modifier = Modifier,
    viewModel: ChatViewModel,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val examples = LearningExamples.examples
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("학습 페이지") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "뒤로가기")
                    }
                }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            items(examples) { example ->
                LearningExampleCard(
                    example = example,
                    onClick = {
                        // 기존 메서드 재사용 (STT 없이)
                        viewModel.addSightedVoiceMessage(example.text)
                        viewModel.sendVoiceToWifi(example.text)
                        Toast.makeText(
                            context,
                            "전송됨: ${example.text}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                )
            }
        }
    }
}

/**
 * 학습 예시 카드 컴포넌트
 */
@Composable
fun LearningExampleCard(
    example: LearningExample,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            Text(
                text = example.text,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            // 향후 카테고리/설명 표시용
            example.category?.let {
                Text(
                    text = it,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

