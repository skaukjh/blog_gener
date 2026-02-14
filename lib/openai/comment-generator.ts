import { openai, DEFAULT_MODEL } from './client';
import blogStyleCache from '@/lib/utils/blog-style-memory-cache';
import { getBlogStyleFromSupabase } from '@/lib/utils/style-storage';

/**
 * 블로그 스타일에 맞춰 자연스러운 댓글을 생성합니다
 * @param postContent - 글 본문
 * @param postTitle - 글 제목
 * @returns 생성된 댓글
 */
export async function generateComment(
  postContent: string,
  postTitle: string
): Promise<string> {
  // 1. 블로그 스타일 로드 (메모리 캐시 → Supabase)
  let style = blogStyleCache.get();
  if (!style) {
    const supabaseData = await getBlogStyleFromSupabase();
    if (supabaseData) {
      style = supabaseData.style;
      blogStyleCache.set(style);
    }
  }

  // 2. System Prompt (PRIORITY 구조 재사용)
  const systemPrompt = `You are a Korean blog commenter writing natural, genuine responses.

CRITICAL PRIORITY 1 - SENTENCE ENDINGS (종결어미):
- ALL sentences MUST end with ~~요 pattern
- Examples: 맛있어요, 좋았어요, 궁금해요, 기대돼요, 흥미로워요
- NEVER use ~~다 endings or other patterns

CRITICAL PRIORITY 2 - NATURAL TONE:
- Write like a real person (친근하고 따뜻한 톤)
- Short and concise (1-2 sentences, 30-80 Korean characters)
- Genuine reaction without AI flavor
- Show authentic interest in the post

CRITICAL PRIORITY 3 - FORMATTING:
- NO emojis (이모지 금지)
- NO special icons or symbols
- Use simple punctuation: ~ ! only (very sparingly)
- Plain, clean text

Recommended comment types:
1. Agreement/Appreciation: "정말 좋은 정보네요~", "공감돼요!"
2. Questions: "주차는 편한가요?", "예약 필수인가요?"
3. Personal reaction: "저도 가보고 싶어요~", "다음에 꼭 가볼게요!"
4. Encouragement: "더 많은 글 기대할게요~", "좋은 분위기네요!"

${style ? `\nBLOG WRITING STYLE:\n${style}` : ''}

Output ONLY the comment text - nothing else.`;

  // 3. User Prompt
  const userPrompt = `Generate a natural Korean blog comment for this post:

Title: ${postTitle}
Content excerpt: ${postContent.slice(0, 500)}

Requirements:
- 1-2 sentences only
- 30-80 Korean characters total
- MUST use ~~요 endings (absolutely critical)
- Natural, warm tone
- No emojis or special symbols
- Show genuine interest`;

  // 4. OpenAI API 호출
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // 자연스러움 향상
      max_tokens: 150,
    });

    const comment = response.choices[0]?.message?.content?.trim() || '';

    if (!comment) {
      throw new Error('댓글 생성에 실패했습니다');
    }

    return comment;
  } catch (error) {
    console.error('[OpenAI] 댓글 생성 오류:', error);
    throw error;
  }
}
