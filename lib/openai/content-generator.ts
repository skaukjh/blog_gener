import { openai, DEFAULT_MODEL } from "./client";
import { CONTENT_GENERATOR_SYSTEM_PROMPT } from "./prompts";
import { parseMarkers } from "@/lib/utils/marker-parser";
import type {
  GeneratedContentWithImages,
  ImageAnalysisResult,
  KeywordItem,
  PlaceInfo,
} from "@/types/index";

/**
 * AI를 사용하여 블로그 글을 생성합니다
 *
 * 참고: 스타일 정보는 Assistant의 instruction에 저장되어 있으므로
 * 더 이상 user prompt에 전달하지 않습니다. (토큰 절약)
 */
export async function generateBlogContent(
  topic: string,
  length: "short" | "medium" | "long",
  keywords: KeywordItem[],
  imageAnalysis: ImageAnalysisResult,
  startSentence?: string,
  endSentence?: string,
  placeInfo?: PlaceInfo
): Promise<GeneratedContentWithImages> {
  try {
    // 간단한 user prompt 생성 (스타일 정보 제외)
    const charCount = {
      short: "1500-2000",
      medium: "2000-2500",
      long: "2500-3000",
    }[length];

    const keywordList = keywords.map((k) => `${k.text} (${k.count}회)`).join(", ");

    const imageCount = imageAnalysis.images.length;

    let userPrompt = `Generate a Korean blog post with the following specifications:

Topic: ${topic}
Character count: ${charCount} characters (Korean characters, not words)
Length: ${length}

Keywords to include naturally (${keywords.length} total):
${keywordList}

Image placement:
- TOTAL IMAGES: ${imageCount}
- Use EXACTLY ${imageCount} image marker(s): ${Array.from({ length: imageCount }, (_, i) => `[IMAGE_${i + 1}]`).join(", ")}
- Place markers naturally in the content where images enhance the narrative

Image context:
- Theme: ${imageAnalysis.overall.theme}
- Style: ${imageAnalysis.overall.style}
- Usage suggestions: ${
      Array.isArray(imageAnalysis.overall.suggestions)
        ? imageAnalysis.overall.suggestions.join("; ")
        : "Place images naturally throughout the content"
    }`;

    if (startSentence) {
      userPrompt += `\n\nStart with: "${startSentence}"`;
    }

    if (endSentence) {
      userPrompt += `\n\nEnd with: "${endSentence}"`;
    }

    if (placeInfo) {
      const placeInfoText = formatPlaceInfo(placeInfo);
      userPrompt += `\n\nPLACE INFORMATION (insert naturally at the BEGINNING, within first 2-3 paragraphs):

${placeInfoText}

FORMATTING RULES for place info:
1. Write the info naturally as part of the introduction
2. Use warm, friendly tone - not a list
3. Combine information into flowing sentences
4. Examples:
   - "영업시간은 평일 오전 11시부터 오후 10시까지, 주말은 정오부터 오후 10시까지예요."
   - "주차는 건물 뒤쪽에서 가능하고, 지하철 역에서도 5분 거리라 접근성이 정말 좋아요."
   - "예약은 0507-1234-5678로 받고 있어요."`;

      // 메뉴 정보 추가
      if (placeInfo.menus && placeInfo.menus.length > 0) {
        userPrompt += `\n\nRECOMMENDED MENU ITEMS:
${placeInfo.menus
  .map(
    (menu: any) =>
      `- ${menu.name}${menu.price ? ` (${menu.price})` : ''}: ${menu.description}`
  )
  .join('\n')}

Include these menu items naturally in the content. Write about them with sensory details and personal impressions.`;
      }

      // 리뷰 정보 추가
      if (placeInfo.reviews && placeInfo.reviews.length > 0) {
        const reviewTexts = placeInfo.reviews
          .map(
            (review: any) =>
              `- ${review.author} (${review.rating}★): ${review.text}`
          )
          .join('\n');

        userPrompt += `\n\nCUSTOMER REVIEWS (for reference):
${reviewTexts}

Use these reviews as context to understand what customers appreciate about this place.
Incorporate the essence of positive feedback naturally into your writing without directly quoting reviews.`;
      }
    }

    userPrompt += `\n\nCRITICAL REQUIREMENTS (IN PRIORITY ORDER):

PRIORITY 1 - SENTENCE ENDINGS (MANDATORY):
CRITICAL: ALL sentences MUST end with ~~요 pattern.
This is a FIXED requirement. DO NOT use any other ending style.
Examples: 맛있어요, 좋았어요, 추천해요, 방문해보세요, 느꼈어요
NEVER use: ~~다, ~~한다, ~~했다 or any non-~~요 endings.
100% consistency required - no exceptions.

PRIORITY 2 - IMAGE-BASED DESCRIPTIONS:
1. Describe ONLY what is ACTUALLY VISIBLE in the provided images
2. Use image descriptions as source of truth for what to write about
3. For food: visible plating, colors, presentation, textures
4. For interiors: visible decor, ambiance, furniture, lighting
5. Rich sensory language: taste, texture, aroma, appearance
6. NO generic filler - focus 80% on what images show, 20% on context

PRIORITY 3 - NATURAL, WARM TONE & AUTHENTICITY:
1. Write like chatting with a close friend - warm, genuine, conversational
2. Use personal reactions: "처음 들어갔을 때 와!", "먹다가 깜짝 놀랐어요", "솔직히 기대 안 했는데..."
3. Mix short energetic sentences with medium reflective ones for natural rhythm
4. Vary sentence openings: "근데 정말...", "그런데 또...", "아, 그리고..."
5. Include keywords naturally in first 2-3 sentences
6. Distribute keywords evenly (not clustered) - maintain natural flow
7. Be honest about minor drawbacks for credibility
8. Use warm transitional phrases: "그런데 정말 좋았던 건", "가장 인상적이었던 부분은"
9. Use relatable language: "진짜", "완전", "뭔가", "딱", "정말로" (natural, not forced)
10. Include practical info: location, price, menu, hours, reservation tips
11. Write as if recommending to a friend: genuine > promotional, specific > generic

PRIORITY 4 - TECHNICAL REQUIREMENTS:
1. Use EXACTLY ${imageCount} image marker(s) - NO MORE, NO LESS
2. Place [IMAGE_N] markers at natural locations where images fit the content
3. Keywords must appear naturally, not forced
4. NO emojis or icons - keep it clean and professional

PRIORITY 5 - QUALITY & ENGAGEMENT:
1. Write with rich, experiential descriptions - as if sharing personal experience
2. Include sensory details and practical tips where relevant
3. Make it engaging and valuable for readers`;


    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: CONTENT_GENERATOR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    let content = response.choices[0]?.message?.content || "";

    if (!content) {
      throw new Error("콘텐츠 생성 응답을 받을 수 없습니다");
    }

    // 마커 확인 및 검증
    const expectedMarkerCount = imageAnalysis.images.length;
    let markers = parseMarkers(content);

    // 마커가 없거나 개수가 맞지 않으면 수정
    if (markers.length === 0) {
      // 마커가 없으면 이미지 개수에 맞춰 강제 삽입
      content = insertMissingMarkers(content, expectedMarkerCount);
    } else if (markers.length > expectedMarkerCount) {
      // 마커가 너무 많으면 초과분 제거
      content = removeExcessMarkers(content, expectedMarkerCount);
    } else if (markers.length < expectedMarkerCount) {
      // 마커가 부족하면 누락된 마커 추가
      content = insertMissingMarkers(content, expectedMarkerCount);
    }

    // 최종 마커 검증
    const finalMarkers = parseMarkers(content);
    if (finalMarkers.length !== expectedMarkerCount) {
      throw new Error(`마커 개수 불일치: 예상 ${expectedMarkerCount}개, 실제 ${finalMarkers.length}개`);
    }

    // 키워드 개수 세기
    const keywordCounts: Record<string, number> = {};
    for (const keyword of keywords) {
      const count = (content.match(new RegExp(keyword.text, "gi")) || []).length;
      keywordCounts[keyword.text] = count;
    }

    // 글자 수 계산
    const charCountValue = content.replace(/\[IMAGE_\d+\]/g, "").length;

    // 주의: imageGuides는 클라이언트에서 생성하도록 변경 (응답 크기 최소화)
    // API 응답에는 content, imageAnalysis, wordCount, keywordCounts만 포함
    return {
      content,
      imageGuides: [], // 빈 배열 - 클라이언트에서 생성
      wordCount: charCountValue,
      keywordCounts,
    };
  } catch (error) {
    console.error("콘텐츠 생성 오류:", error);
    throw error;
  }
}

/**
 * 마커가 없는 경우 자동으로 삽입합니다
 */
function insertMissingMarkers(content: string, imageCount: number): string {
  const lines = content.split("\n");
  const markerCount = imageCount;
  const linesPerMarker = Math.floor(lines.length / (markerCount + 1));

  let currentLine = linesPerMarker;
  for (let i = 1; i <= markerCount; i++) {
    if (currentLine < lines.length) {
      lines.splice(currentLine, 0, `[IMAGE_${i}]`);
      currentLine += linesPerMarker + 1;
    }
  }

  return lines.join("\n");
}

/**
 * 초과 마커를 제거하고 인덱스를 재정렬합니다
 */
function removeExcessMarkers(content: string, maxImageCount: number): string {
  const markers = parseMarkers(content);
  let result = content;

  // 역순으로 처리하여 위치 이동을 방지
  for (let i = markers.length - 1; i >= maxImageCount; i--) {
    const marker = markers[i];
    result = result.replace(marker.marker, "").trim();
  }

  // 남은 마커의 인덱스를 1부터 재정렬
  let newContent = result;
  for (let i = 1; i <= maxImageCount; i++) {
    const oldMarker = `[IMAGE_${i}]`;
    if (!newContent.includes(oldMarker)) {
      // 이 인덱스가 없으면 다음 마커를 이 인덱스로 변경
      for (let j = i + 1; j <= markers.length; j++) {
        const searchMarker = `[IMAGE_${j}]`;
        if (newContent.includes(searchMarker)) {
          newContent = newContent.replace(searchMarker, oldMarker);
          break;
        }
      }
    }
  }

  return newContent;
}

/**
 * GPT-4o를 사용한 콘텐츠 생성 비용을 계산합니다 (USD)
 */
export function calculateGenerationCost(
  inputTokens: number,
  outputTokens: number
): number {
  // gpt-4o 가격: 입력 $2.5/1M tokens, 출력 $10/1M tokens
  const inputCost = (inputTokens / 1000000) * 2.5;
  const outputCost = (outputTokens / 1000000) * 10;
  return inputCost + outputCost;
}

/**
 * 생성 비용을 추정합니다 (USD)
 */
export function estimateGenerationCost(
  topic: string,
  keywords: KeywordItem[]
): number {
  const promptSize = topic.length + keywords.reduce((sum, k) => sum + k.text.length, 0) + 500;
  const outputTokens = 2500; // 평균 출력 토큰 (2000-3000)

  const inputTokens = Math.ceil(promptSize / 4);
  // gpt-4o 가격: 입력 $2.5/1M, 출력 $10/1M
  const cost = (inputTokens / 1000000) * 2.5 + (outputTokens / 1000000) * 10;

  return cost;
}

/**
 * 키워드가 모두 삽입되었는지 확인합니다
 */
export function validateKeywordInsertion(
  content: string,
  keywords: KeywordItem[]
): { valid: boolean; missingKeywords: string[] } {
  const missingKeywords: string[] = [];

  for (const keyword of keywords) {
    const regex = new RegExp(keyword.text, "i");
    if (!regex.test(content)) {
      missingKeywords.push(keyword.text);
    }
  }

  return {
    valid: missingKeywords.length === 0,
    missingKeywords,
  };
}

/**
 * 가게 정보를 블로그 글 형식으로 포맷팅합니다
 * 사용자가 요청한 정확한 형식:
 * 원조해장촌 뼈구이한판 감자탕 선릉역점
 * 📍 서울 강남구 선릉로86길 28 지상2층
 * ⏰ 월~금 11:00 - 23:00
 * 라스트오더 22:00
 * 토~일 12:00 - 22:00
 * 라스트오더 21:00
 * 📞 0507-1407-9915
 */
function formatPlaceInfo(placeInfo: PlaceInfo): string {
  let info = `${placeInfo.name}\n`;

  if (placeInfo.address) {
    info += `📍 ${placeInfo.address}\n`;
  }

  if (placeInfo.openingHours && placeInfo.openingHours.length > 0) {
    // 첫 번째 영업시간 앞에 ⏰ 추가
    info += `⏰ ${placeInfo.openingHours[0]}\n`;

    // 나머지 영업시간들은 그대로 추가 (라스트오더 등)
    for (let i = 1; i < placeInfo.openingHours.length; i++) {
      info += `${placeInfo.openingHours[i]}\n`;
    }
  }

  if (placeInfo.phone) {
    info += `📞 ${placeInfo.phone}\n`;
  }

  return info;
}

/**
 * 사용자 요청에 따라 생성된 블로그 글을 수정합니다
 */
export async function refineBlogContent(
  currentContent: string,
  userRequest: string,
  keywords: KeywordItem[],
  imageAnalysis: ImageAnalysisResult,
  _placeInfo?: PlaceInfo
): Promise<string> {
  try {
    const imageCount = imageAnalysis.images.length;
    const keywordList = keywords.map((k) => `${k.text} (${k.count}회)`).join(", ");

    let userPrompt = `You are a professional Korean blog writer. The user has requested a modification to an existing blog post.

CURRENT CONTENT:
"""
${currentContent}
"""

USER REQUEST:
"${userRequest}"

TASK: Modify the content according to the user's request while maintaining:
1. All ${imageCount} image markers: ${Array.from({ length: imageCount }, (_, i) => `[IMAGE_${i + 1}]`).join(", ")}
2. Keywords naturally included (${keywords.length} total): ${keywordList}
3. Korean language with ~~요 sentence endings (MANDATORY)
4. Natural, warm, conversational tone
5. Image-based descriptions only (describe what's visible)
6. No emojis or icons

CRITICAL RULES:
- PRESERVE all [IMAGE_N] markers in their original positions
- Keep keyword usage intact
- Improve readability and flow based on the user's request
- Maintain the overall structure and length
- Use only ~~요 sentence endings (맛있어요, 좋았어요, 추천해요, etc.)

Output ONLY the modified blog post content. No explanations.`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: CONTENT_GENERATOR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    let refinedContent = response.choices[0]?.message?.content || "";

    if (!refinedContent) {
      throw new Error("수정된 콘텐츠를 받을 수 없습니다");
    }

    // 마커 검증 - 수정 후에도 마커 개수 확인
    const expectedMarkerCount = imageCount;
    const markers = parseMarkers(refinedContent);

    if (markers.length !== expectedMarkerCount) {
      console.warn(`마커 개수 불일치: 예상 ${expectedMarkerCount}개, 실제 ${markers.length}개. 마커 재정렬 시도`);

      // 마커가 없으면 원본의 마커를 복사해서 추가
      if (markers.length === 0) {
        const originalMarkers = parseMarkers(currentContent);
        if (originalMarkers.length === expectedMarkerCount) {
          // 원본에서 마커 위치 정보 추출
          for (let i = 0; i < expectedMarkerCount; i++) {
            refinedContent += `\n[IMAGE_${i + 1}]`;
          }
        }
      } else if (markers.length > expectedMarkerCount) {
        // 초과 마커 제거
        refinedContent = removeExcessMarkers(refinedContent, expectedMarkerCount);
      } else if (markers.length < expectedMarkerCount) {
        // 부족한 마커 추가
        refinedContent = insertMissingMarkers(refinedContent, expectedMarkerCount);
      }
    }

    return refinedContent;
  } catch (error) {
    console.error("콘텐츠 수정 오류:", error);
    throw error;
  }
}
