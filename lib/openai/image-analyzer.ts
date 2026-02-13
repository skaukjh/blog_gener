import { openai, OPENAI_MODELS } from "./client";
import { IMAGE_ANALYSIS_PROMPT } from "./prompts";
import type { ImageAnalysisResult, CompressedImageAnalysis } from "@/types/index";

/**
 * 이미지 배치를 분석합니다 (배치 크기: 5-6장)
 */
export async function analyzeImagesBatch(
  images: string[],
  batchSize: number = 5
): Promise<CompressedImageAnalysis[]> {
  const allAnalyses: CompressedImageAnalysis[] = [];

  // 배치로 나누기
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, Math.min(i + batchSize, images.length));
    const batchAnalyses = await analyzeImageBatchInternal(batch, i + 1);
    allAnalyses.push(...batchAnalyses);
  }

  return allAnalyses;
}

/**
 * 내부 배치 분석 함수
 */
async function analyzeImageBatchInternal(
  images: string[],
  startIndex: number = 1
): Promise<CompressedImageAnalysis[]> {
  try {
    const messageContent = [
      {
        type: "text" as const,
        text: `You MUST respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

Analyze each image and provide analysis starting from image index ${startIndex}.

Return ONLY this JSON structure:
{
  "images": [
    {
      "idx": number,
      "cats": [{"category": "string", "confidence": number, "details": "string"}],
      "desc": "description",
      "mood": "mood"
    }
  ],
  "overall": {
    "theme": "theme",
    "style": "style",
    "suggestions": ["suggestion1", "suggestion2"]
  }
}`,
      },
      ...images.map((image) => ({
        type: "image_url" as const,
        image_url: {
          url: image,
          detail: "high" as const, // 더 높은 품질의 분석을 위해 high 사용
        },
      })),
    ];

    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.GPT_4O, // 최고 품질 이미지 분석을 위해 gpt-4o 사용
      messages: [
        {
          role: "system",
          content: IMAGE_ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: messageContent as any,
        },
      ],
      temperature: 0.2, // 더 낮은 온도로 일관성 향상
      max_tokens: 2000,
    });

    let content = response.choices[0]?.message?.content || "";

    if (!content) {
      throw new Error("이미지 분석 응답을 받을 수 없습니다");
    }

    // 마크다운 코드 블록 제거
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // JSON 파싱 - 더 견고한 방식 사용
    let analysis;
    try {
      // 첫 번째 시도: 직접 파싱
      analysis = JSON.parse(content);
    } catch (e) {
      // 두 번째 시도: 정규식으로 JSON 추출
      // { 부터 } 까지의 가장 큰 객체 찾기
      const startIdx = content.indexOf("{");
      if (startIdx === -1) {
        console.error("JSON 시작 문자 찾기 실패. 응답:", content.substring(0, 300));
        throw new Error("분석 결과를 찾을 수 없습니다");
      }

      // 역순으로 마지막 } 찾기
      const endIdx = content.lastIndexOf("}");
      if (endIdx === -1 || endIdx <= startIdx) {
        console.error("JSON 종료 문자 찾기 실패. 응답:", content.substring(0, 300));
        throw new Error("분석 결과를 찾을 수 없습니다");
      }

      const jsonStr = content.substring(startIdx, endIdx + 1);
      try {
        analysis = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON 파싱 오류:", parseError);
        console.error("응답 길이:", content.length);
        console.error("추출된 JSON 길이:", jsonStr.length);
        console.error("응답 시작:", content.substring(0, 200));
        console.error("응답 끝:", content.substring(Math.max(0, content.length - 200)));
        throw new Error(`분석 결과 파싱 실패: JSON 형식 오류`);
      }
    }

    if (!analysis || !analysis.images || !Array.isArray(analysis.images)) {
      console.error("유효하지 않은 분석 결과 구조:", analysis);
      throw new Error("분석 결과 구조가 유효하지 않습니다");
    }

    const imageAnalyses: CompressedImageAnalysis[] = analysis.images || [];

    // 인덱스 조정
    return imageAnalyses.map((img, idx) => ({
      ...img,
      idx: startIndex + idx,
    }));
  } catch (error) {
    console.error("이미지 배치 분석 오류:", error);
    throw error;
  }
}

/**
 * 모든 이미지의 통합 컨텍스트를 분석합니다
 */
export async function analyzeOverallContext(
  images: string[],
  topic: string
): Promise<{ theme: string; style: string; suggestions: string[] }> {
  try {
    const messageContent = [
      {
        type: "text" as const,
        text: `These images will be used for a blog post about: "${topic}"\n\nProvide overall analysis in JSON format:\n{\n  "theme": "overall visual theme",\n  "style": "visual style",\n  "suggestions": ["how to use in blog"]\n}`,
      },
      ...images.slice(0, 3).map((image) => ({
        type: "image_url" as const,
        image_url: {
          url: image,
          detail: "high" as const, // 통합 분석도 높은 품질로
        },
      })),
    ];

    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.GPT_4O, // 최고 품질 통합 분석
      messages: [
        {
          role: "system",
          content: IMAGE_ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: messageContent as any,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        theme: topic,
        style: "visual",
        suggestions: ["이미지를 자연스럽게 배치하세요"],
      };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        theme: topic,
        style: "visual",
        suggestions: ["이미지를 자연스럽게 배치하세요"],
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("종합 컨텍스트 분석 오류:", error);
    return {
      theme: topic,
      style: "visual",
      suggestions: ["이미지를 자연스럽게 배치하세요"],
    };
  }
}

/**
 * 전체 이미지 분석을 수행합니다
 */
export async function analyzeAllImages(
  images: string[],
  topic: string
): Promise<ImageAnalysisResult> {
  try {
    // 배치 분석
    const imageAnalyses = await analyzeImagesBatch(images);

    // 통합 컨텍스트 분석
    const overall = await analyzeOverallContext(images, topic);

    // 토큰 비용 추정
    const baseTokens = images.length * 170; // detail: "high" = 170+ tokens per image (gpt-4o)
    const promptTokens = 500;
    const outputTokens = 800;
    const totalTokens = baseTokens + promptTokens + outputTokens;

    // gpt-4o 가격: 입력 $2.5/1M, 출력 $10/1M
    const cost = (totalTokens / 1000000) * 2.5 + (outputTokens / 1000000) * 10;

    return {
      images: imageAnalyses,
      overall,
      costEstimate: Math.round(cost * 10000), // 센트 단위로 반환
    };
  } catch (error) {
    console.error("이미지 분석 오류:", error);
    throw error;
  }
}
