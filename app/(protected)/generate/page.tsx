'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/layout/Navigation';
import ImageUpload from '@/components/form/ImageUpload';
import KeywordInput from '@/components/form/KeywordInput';
import { ExpertModeTab } from '@/components/expert/ExpertModeTab';
import { Sparkles, Copy, Download, AlertCircle, ChevronDown, Check, X, Star } from 'lucide-react';
import type { KeywordItem, ImageAnalysisResult, ChatMessage, MenuInfo, ExpertType, ModelConfig, WebSearchResult, RecommendationItem } from '@/types/index';
import { generateClientImageGuides } from '@/lib/utils/client-image-guide';
import { copyToClipboard } from '@/lib/utils/download';

export default function GeneratePage() {
  const [topic, setTopic] = useState('');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [images, setImages] = useState<File[]>([]);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [startSentence, setStartSentence] = useState('');
  const [endSentence, setEndSentence] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'compress' | 'analyze' | 'generate' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ content: string; imageAnalysis: ImageAnalysisResult; wordCount: number; keywordCounts: Record<string, number>; cost?: { usd: number; krw: number; breakdown?: { imageAnalysis: { usd: number; krw: number }; contentGeneration: { usd: number; krw: number } } } } | null>(null);
  const [savedStyle, setSavedStyle] = useState<string | null>(null);
  const [styleChecked, setStyleChecked] = useState(false);
  const [showSeoDetails, setShowSeoDetails] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeInfo, setPlaceInfo] = useState<any | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [menuInput, setMenuInput] = useState('');
  const [showMenuInput, setShowMenuInput] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<number[]>([]); // 선택된 리뷰 인덱스

  // 초기 로드 시 저장된 스타일 조회 (sessionStorage 우선)
  useEffect(() => {
    const loadSavedStyle = async () => {
      try {
        // 1. sessionStorage에서 먼저 확인 (클라이언트 측)
        const sessionStyle = sessionStorage.getItem('blog_style');
        if (sessionStyle) {
          setSavedStyle(sessionStyle);
          setStyleChecked(true);
          return;
        }

        // 2. 서버에서 조회 시도 (Vercel에서는 실패할 수 있음)
        try {
          const response = await fetch('/api/blog/get-current-style');
          if (response.ok) {
            const data = await response.json();
            if (data.exists) {
              setSavedStyle(data.style);
              // 서버에서 받은 스타일을 sessionStorage에 저장
              sessionStorage.setItem('blog_style', data.style);
            }
          }
        } catch (serverErr) {
          console.warn('서버 스타일 조회 실패 (Vercel 환경일 수 있음):', serverErr);
        }
      } catch (err) {
        console.error('저장된 스타일 조회 실패:', err);
      } finally {
        setStyleChecked(true);
      }
    };

    loadSavedStyle();
  }, []);

  // 클라이언트 사이드 이미지 압축 함수
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 최대 1280px로 리사이징
          const maxSize = 1280;
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 얻을 수 없습니다'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // JPEG로 변환하여 압축 (품질 75%)
          const compressedData = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressedData);
        };
        img.onerror = () => {
          reject(new Error('이미지 로드 실패'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('파일 읽기 실패'));
      };
      reader.readAsDataURL(file);
    });
  };

  // 메뉴 정보 파싱 (메뉴명 | 가격 형식)
  const parseMenuInput = (): MenuInfo[] => {
    if (!menuInput.trim()) return [];

    return menuInput
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        return {
          name: parts[0] || '',
          price: parts[1] || undefined,
          description: '', // 설명은 빈 문자열
        };
      })
      .filter((menu) => menu.name); // 이름이 있는 메뉴만
  };

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    setLoadingStep('compress');

    try {
      if (!topic.trim()) {
        throw new Error('주제를 입력해주세요');
      }

      if (images.length === 0) {
        throw new Error('최소 1장 이상의 이미지를 업로드해주세요');
      }

      if (keywords.length === 0) {
        throw new Error('최소 1개의 키워드를 추가해주세요');
      }

      const base64Images: string[] = [];
      for (let i = 0; i < images.length; i++) {
        try {
          const compressedData = await compressImage(images[i]);
          base64Images.push(compressedData);
        } catch (err) {
          console.error(`이미지 ${i + 1} 압축 실패:`, err);
          // 압축 실패 시 원본 이미지로 진행
          const data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(images[i]);
          });
          base64Images.push(data);
        }
      }

      setLoadingStep('analyze');
      const imageResponse = await fetch('/api/generate/analyze-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: base64Images, topic }),
      });

      if (!imageResponse.ok) {
        const data = await imageResponse.json();
        throw new Error(data.error || '이미지 분석 실패');
      }

      const imageData = await imageResponse.json();

      setLoadingStep('generate');

      // 메뉴 정보 파싱 및 placeInfo에 추가
      const menus = parseMenuInput();

      // 선택된 리뷰만 필터링
      const filteredReviews = placeInfo?.reviews
        ? placeInfo.reviews.filter((_: any, idx: number) => selectedReviews.includes(idx))
        : [];

      const placeInfoWithMenus = placeInfo
        ? {
            ...placeInfo,
            menus,
            reviews: filteredReviews, // 선택된 리뷰만 전달
          }
        : undefined;

      const contentResponse = await fetch('/api/generate/create-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          length,
          keywords,
          imageAnalysis: imageData.analysis,
          startSentence: startSentence || undefined,
          endSentence: endSentence || undefined,
          placeInfo: placeInfoWithMenus || undefined,
        }),
      });

      if (!contentResponse.ok) {
        const data = await contentResponse.json();
        throw new Error(data.error || '콘텐츠 생성 실패');
      }

      // 응답 텍스트 크기 확인
      const responseText = await contentResponse.text();
      console.log('API 응답 크기:', responseText.length, 'bytes');

      try {
        const contentData = JSON.parse(responseText);
        setResult({
          content: contentData.content.content,
          imageAnalysis: imageData.analysis,
          wordCount: contentData.content.wordCount,
          keywordCounts: contentData.content.keywordCounts,
          cost: contentData.cost,
        });
        setImageAnalysisResult(imageData.analysis);
        setChatHistory([]);
        setRefineInput('');
        setError('');
        setLoadingStep(null);
      } catch (parseError) {
        console.error('JSON 파싱 실패:', {
          errorMessage: parseError instanceof Error ? parseError.message : '알 수 없음',
          responseSize: responseText.length,
          firstChars: responseText.substring(0, 200),
          lastChars: responseText.substring(Math.max(0, responseText.length - 200)),
        });
        throw new Error('응답 데이터 처리 실패 - 응답 크기가 너무 큽니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  // Phase 20: 전문가 모드 글 생성
  const handleGenerateExpert = async (params: {
    expertType: ExpertType;
    modelConfig: ModelConfig;
    webSearchResults?: WebSearchResult[];
    recommendations?: RecommendationItem[];
  }) => {
    if (!images.length) {
      setError('이미지를 최소 1장 이상 업로드해주세요');
      return;
    }
    if (!topic.trim()) {
      setError('주제를 입력해주세요');
      return;
    }
    if (!keywords.length) {
      setError('키워드를 최소 1개 이상 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingStep('compress');

    try {
      // 1. 이미지 압축
      const compressedImages: string[] = [];
      for (const file of images) {
        const base64 = await compressImage(file);
        compressedImages.push(base64);
      }

      // 2. 전문가별 이미지 분석
      setLoadingStep('analyze');
      const analyzeResponse = await fetch('/api/generate/analyze-images-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: compressedImages,
          topic,
          expertType: params.expertType,
          modelConfig: params.modelConfig,
        }),
      });

      const analyzeText = await analyzeResponse.text();
      const imageData = JSON.parse(analyzeText);

      if (!imageData.success) {
        throw new Error(imageData.error || '이미지 분석 실패');
      }

      // 3. 전문가 콘텐츠 생성
      setLoadingStep('generate');
      const generateResponse = await fetch('/api/generate/create-content-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          length,
          keywords,
          imageAnalysis: imageData.analysis,
          expertType: params.expertType,
          modelConfig: params.modelConfig,
          webSearchResults: params.webSearchResults,
          recommendations: params.recommendations,
          startSentence,
          endSentence,
          placeInfo,
        }),
      });

      const contentText = await generateResponse.text();
      const contentData = JSON.parse(contentText);

      if (!contentData.success) {
        throw new Error(contentData.error || '콘텐츠 생성 실패');
      }

      setResult({
        content: contentData.content.content,
        imageAnalysis: imageData.analysis,
        wordCount: contentData.content.wordCount,
        keywordCounts: contentData.content.keywordCounts,
        cost: contentData.cost,
      });
      setImageAnalysisResult(imageData.analysis);
      setChatHistory([]);
      setRefineInput('');
      setError('');
      setLoadingStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!result) return;

    setCopyStatus('idle');
    try {
      const success = await copyToClipboard(result.content);
      if (success) {
        setCopyStatus('success');
        setTimeout(() => setCopyStatus('idle'), 2000);
      } else {
        throw new Error('클립보드 복사에 실패했습니다');
      }
    } catch (error) {
      console.error('클립보드 복사 에러:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  const handleRefineContent = async () => {
    if (!refineInput.trim() || !result || !imageAnalysisResult) return;

    setIsRefining(true);
    const userMessage: ChatMessage = {
      role: 'user',
      content: refineInput,
      timestamp: new Date().toISOString(),
    };

    setChatHistory((prev) => [...prev, userMessage]);
    const requestText = refineInput;
    setRefineInput('');

    try {
      const response = await fetch('/api/generate/refine-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContent: result.content,
          userRequest: requestText,
          keywords: keywords,
          imageAnalysis: imageAnalysisResult,
          placeInfo: placeInfo || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '수정에 실패했습니다');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.refinedContent,
        timestamp: new Date().toISOString(),
      };

      setChatHistory((prev) => [...prev, assistantMessage]);

      // 결과 업데이트
      setResult({
        ...result,
        content: data.refinedContent,
      });

      console.log('✅ 콘텐츠가 수정되었습니다');
      console.log('수정된 콘텐츠 길이:', data.refinedContent.length);
    } catch (error) {
      console.error('수정 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '수정 중 오류가 발생했습니다';

      // 에러 메시지를 대화 히스토리에 추가
      const errorMessage2 = `오류: ${errorMessage}`;
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: errorMessage2,
        timestamp: new Date().toISOString(),
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSearchPlace = async () => {
    if (!placeName.trim()) return;

    setLoadingPlace(true);
    try {
      const response = await fetch(`/api/place/search?name=${encodeURIComponent(placeName)}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '가게 정보를 가져올 수 없습니다');
      }

      const data = await response.json();
      setPlaceInfo(data.placeInfo);
      console.log('가게 정보를 가져왔습니다');
    } catch (error) {
      console.error('가게 검색 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '가게 정보를 가져올 수 없습니다';
      alert(errorMessage);
      setPlaceInfo(null);
    } finally {
      setLoadingPlace(false);
    }
  };

  const lengthOptions = [
    { value: 'short', label: '짧은 글', desc: '1500-2000자', emoji: '📄' },
    { value: 'medium', label: '중간 글', desc: '2000-2500자', emoji: '📑' },
    { value: 'long', label: '긴 글', desc: '2500-3000자', emoji: '📚' },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-5xl font-bold gradient-text">블로그 글 생성</h1>
          </div>
          <p className="text-lg text-gray-600 font-light">
            AI를 활용하여 파워 블로거 스타일의 블로그 글을 자동으로 생성합니다
          </p>

          </div>

        {/* 스타일 상태 표시 */}
        {styleChecked && (
          <div className={`mb-8 p-4 rounded-lg border-2 ${
            savedStyle
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-start gap-3">
              {savedStyle ? (
                <>
                  <div className="text-2xl">✅</div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">스타일이 준비되었습니다</p>
                    <p className="text-sm text-green-700 mt-1">
                      저장된 블로그 스타일이 글 생성에 적용됩니다.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900">스타일이 아직 설정되지 않았습니다</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      먼저 <a href="/format" className="underline font-medium hover:text-yellow-900">블로그 스타일 분석 페이지</a>에서 블로그 글 2개를 입력하여 스타일을 학습시켜주세요.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {result ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center glass-effect rounded-xl p-6 shadow-soft">
              <div>
                <h2 className="text-3xl font-bold gradient-text">✨ 생성 완료!</h2>
                <p className="text-gray-600 mt-1">고품질 블로그 글이 준비되었습니다</p>
              </div>
              <button
                onClick={() => setResult(null)}
                className="px-6 py-3 bg-gradient-primary text-white rounded-lg hover:shadow-lg smooth-transition font-semibold"
              >
                🔄 다시 생성
              </button>
            </div>

            {(() => {
              const imageGuides = generateClientImageGuides(result.content, result.imageAnalysis);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft">
                      <p className="text-sm text-gray-600 font-light mb-2">글자 수</p>
                      <p className="text-4xl font-bold gradient-text">{result.wordCount.toLocaleString()}</p>
                    </div>
                    <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft">
                      <p className="text-sm text-gray-600 font-light mb-2">이미지 개수</p>
                      <p className="text-4xl font-bold text-accent">{imageGuides.length}</p>
                    </div>
                    <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft">
                      <p className="text-sm text-gray-600 font-light mb-2">키워드 포함</p>
                      <p className="text-4xl font-bold text-primary">
                        {Object.values(result.keywordCounts).reduce((a: number, b: unknown) => a + (b as number), 0)}회
                      </p>
                    </div>
                  </div>

                  {result.cost && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft border-l-4 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50">
                        <p className="text-sm text-orange-700 font-light mb-2">💸 생성 비용 (총)</p>
                        <p className="text-3xl font-bold text-orange-600">{result.cost.krw.toLocaleString()}₩</p>
                        <p className="text-xs text-orange-600 mt-1">${result.cost.usd.toFixed(4)}</p>
                      </div>
                      {result.cost.breakdown && (
                        <>
                          <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft bg-gradient-to-br from-blue-50 to-cyan-50">
                            <p className="text-sm text-blue-700 font-light mb-2">🔍 이미지 분석</p>
                            <p className="text-2xl font-bold text-blue-600">{result.cost.breakdown.imageAnalysis.krw.toLocaleString()}₩</p>
                            <p className="text-xs text-blue-600 mt-1">${result.cost.breakdown.imageAnalysis.usd.toFixed(4)}</p>
                          </div>
                          <div className="glass-effect rounded-xl p-6 shadow-md-soft smooth-transition hover:shadow-soft bg-gradient-to-br from-green-50 to-emerald-50">
                            <p className="text-sm text-green-700 font-light mb-2">✨ 글 생성</p>
                            <p className="text-2xl font-bold text-green-600">{result.cost.breakdown.contentGeneration.krw.toLocaleString()}₩</p>
                            <p className="text-xs text-green-600 mt-1">${result.cost.breakdown.contentGeneration.usd.toFixed(4)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <div className="whitespace-pre-wrap text-gray-800 text-base leading-relaxed font-light">
                {result.content}
              </div>
            </div>

            {/* 부분 수정 기능 */}
            <div className="glass-effect rounded-xl p-8 shadow-soft mb-6">
              <h3 className="text-xl font-bold gradient-text mb-4">💬 부분 수정 요청</h3>
              <p className="text-sm text-gray-600 mb-4">
                수정하고 싶은 부분을 자연스럽게 요청하세요. 예: "두 번째 단락을 더 자세하게 써줘", "가격 정보를 추가해줘"
              </p>

              {/* 채팅 히스토리 */}
              {chatHistory.length > 0 && (
                <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-green-50 border border-green-200'
                      }`}
                    >
                      <p className="text-xs text-gray-500 mb-1">
                        {msg.role === 'user' ? '사용자' : 'AI'} • {new Date(msg.timestamp).toLocaleTimeString('ko-KR')}
                      </p>
                      <p className="text-sm text-gray-800">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 입력 폼 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  placeholder="수정 요청을 입력하세요..."
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary smooth-transition text-gray-800"
                  disabled={isRefining}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleRefineContent();
                    }
                  }}
                />
                <button
                  onClick={handleRefineContent}
                  disabled={!refineInput.trim() || isRefining}
                  className="px-6 py-3 gradient-primary text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition"
                >
                  {isRefining ? '수정 중...' : '수정'}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyToClipboard}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl smooth-transition ${
                  copyStatus === 'success'
                    ? 'bg-green-500 text-white'
                    : copyStatus === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white hover:from-orange-500 hover:via-amber-500 hover:to-yellow-500'
                }`}
              >
                {copyStatus === 'success' ? (
                  <>
                    <Check className="w-5 h-5" />
                    복사 완료!
                  </>
                ) : copyStatus === 'error' ? (
                  <>
                    <X className="w-5 h-5" />
                    복사 실패
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    클립보드에 복사
                  </>
                )}
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 rounded-xl hover:from-orange-200 hover:to-amber-200 smooth-transition font-semibold">
                <Download className="w-5 h-5" />
                다운로드
              </button>
            </div>

            {/* 네이버 블로그 SEO 최적화 설명 */}
            <div className="glass-effect rounded-xl p-6 shadow-soft border border-orange-100">
              <button
                onClick={() => setShowSeoDetails(!showSeoDetails)}
                className="w-full flex items-center justify-between hover:bg-orange-50/50 p-2 rounded-lg transition-colors"
              >
                <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                  🎯 네이버 블로그 노출 최적화 가이드
                </h3>
                <ChevronDown
                  className={`w-5 h-5 text-orange-600 transition-transform ${
                    showSeoDetails ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showSeoDetails && (
                <div className="mt-4 pt-4 border-t border-orange-100 space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-orange-800 flex items-center gap-2">
                      ✅ 이 글에서 적용된 최적화 기법
                    </h4>
                    <ul className="space-y-2 text-sm text-orange-700">
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>첫 문장 키워드 포함</strong>: 포스트 상단에 주요 검색어를 자연스럽게 배치하여 검색 봇 크롤링 최적화
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>키워드 균등 분포</strong>: 포스트 전체에 검색어를 고르게 배치하여 부자연스러움 제거
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>적절한 글 길이</strong>: 2000-3000자의 상세한 콘텐츠로 네이버의 품질 기준 충족
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>명확한 구조</strong>: 도입-본문-결론의 논리적 구조로 가독성과 SEO 점수 향상
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>자연스러운 말투</strong>: AI 특유의 패턴 제거로 사용자 신뢰도와 참여율 증가
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>실용적 정보</strong>: 위치, 가격, 메뉴 등 독자가 찾는 정보 포함으로 검색 의도 충족
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          <strong>이미지 최적 배치</strong>: 텍스트와 이미지의 조화로 시각적 매력 향상 및 체류 시간 증가
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-700">
                      💡 <strong>팁</strong>: 글을 네이버 블로그에 올린 후 수동으로 검색 등록 신청(설정 → 검색 설정)을 하면 더 빠르게 노출될 수 있습니다.
                      또한 댓글과 공감 수가 많을수록 검색 순위가 올라갑니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ExpertModeTab
            onGenerateWithExpert={handleGenerateExpert}
            isLoading={loading}
            disabled={!savedStyle}
          />
        )}

        {/* 기본 모드는 제거됨 (전문가 모드만 제공) */}
        {false && (
          <div className="space-y-6">
            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                📝 블로그 글 주제 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 강남역 맛집 한식당 추천, 겨울 스키장 여행지 가이드"
                className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary smooth-transition text-gray-800"
              />
            </div>

            {/* 가게 정보 자동 수집 */}
            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                🏪 가게 정보 (선택사항)
              </label>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    가게 상호명 입력
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={placeName}
                      onChange={(e) => setPlaceName(e.target.value)}
                      placeholder="예: 강남 맛집 이름"
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary smooth-transition text-gray-800"
                    />
                    <button
                      onClick={handleSearchPlace}
                      disabled={!placeName.trim() || loadingPlace}
                      className="px-6 py-3 gradient-primary text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold smooth-transition"
                    >
                      {loadingPlace ? '검색 중...' : '정보 가져오기'}
                    </button>
                  </div>
                </div>

                {/* 가게 정보 표시 */}
                {placeInfo && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-green-900">✅ 가게 정보를 가져왔습니다</p>
                    <div className="text-xs text-green-800 space-y-2">
                      <p><strong>이름:</strong> {placeInfo.name}</p>
                      <p><strong>주소:</strong> {placeInfo.address}</p>
                      {placeInfo.phone && <p><strong>전화:</strong> {placeInfo.phone}</p>}

                      {/* 영업시간 직접 편집 */}
                      <div>
                        <strong>영업시간:</strong>
                        <textarea
                          value={placeInfo.openingHours?.join('\n') || ''}
                          onChange={(e) => {
                            const hours = e.target.value.split('\n').filter(h => h.trim());
                            setPlaceInfo({ ...placeInfo, openingHours: hours });
                          }}
                          placeholder="월~금 11:00 - 23:00&#10;라스트오더 22:00&#10;토~일 12:00 - 22:00&#10;라스트오더 21:00"
                          rows={4}
                          className="w-full px-3 py-2 mt-1 border border-green-300 rounded text-green-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                        <p className="text-xs text-green-700 mt-1">💡 원하는 형식으로 직접 편집할 수 있습니다</p>
                      </div>

                      {placeInfo.parking && <p><strong>주차:</strong> {placeInfo.parking}</p>}
                      {placeInfo.nearbyTransit && <p><strong>대중교통:</strong> {placeInfo.nearbyTransit}</p>}
                    </div>
                    {/* 메뉴 정보 입력 */}
                    <div className="border-t border-green-200 pt-3">
                      <button
                        onClick={() => setShowMenuInput(!showMenuInput)}
                        className="text-xs font-semibold text-green-900 hover:text-green-700 flex items-center gap-1"
                      >
                        {showMenuInput ? '▼' : '▶'} 🍽️ 대표 메뉴 추가 (선택사항)
                      </button>

                      {showMenuInput && (
                        <div className="mt-3 space-y-2">
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-xs font-semibold text-blue-900 mb-2">📝 입력 형식 (메뉴명 | 가격)</p>
                            <div className="text-xs text-blue-800 font-mono space-y-1 bg-white rounded p-2">
                              <p>감자탕 | 15,000원</p>
                              <p>뼈구이 | 18,000원</p>
                              <p>우거지 | 12,000원</p>
                            </div>
                          </div>
                          <textarea
                            value={menuInput}
                            onChange={(e) => setMenuInput(e.target.value)}
                            placeholder="감자탕 | 15,000원&#10;뼈구이 | 18,000원&#10;우거지 | 12,000원"
                            rows={4}
                            className="w-full px-3 py-2 border border-green-300 rounded text-green-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                          />
                          <p className="text-xs text-green-700">💡 각 줄에 하나의 메뉴를 입력하세요 (선택사항)</p>
                        </div>
                      )}
                    </div>

                    {/* 리뷰 표시 */}
                    {placeInfo.reviews && placeInfo.reviews.length > 0 && (
                      <div className="border-t border-green-200 pt-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-semibold text-green-900">
                            최신 리뷰 ({placeInfo.reviews.length}개) - 글 작성에 참고할 리뷰 선택
                          </span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {placeInfo.reviews.map((review: any, idx: number) => (
                            <label key={idx} className="flex gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedReviews.includes(idx)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedReviews([...selectedReviews, idx]);
                                  } else {
                                    setSelectedReviews(selectedReviews.filter((i) => i !== idx));
                                  }
                                }}
                                className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                              />
                              <div className="flex-1 bg-white rounded p-2 border border-green-100">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-700">{review.author}</p>
                                    <div className="flex gap-0.5 mt-0.5">
                                      {Array(5)
                                        .fill(0)
                                        .map((_, i) => (
                                          <Star
                                            key={i}
                                            className={`w-3 h-3 ${
                                              i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                                            }`}
                                          />
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">{review.text}</p>
                                  </div>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                          💡 선택된 리뷰가 글 작성 시 참고됩니다 ({selectedReviews.length}개 선택됨)
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-green-700 mt-2">
                      이 정보는 글 생성 시 자동으로 포함됩니다
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                📊 글 길이 선택 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-4">
                {lengthOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLength(option.value as 'short' | 'medium' | 'long')}
                    className={`p-6 rounded-lg border-2 smooth-transition text-center ${
                      length === option.value
                        ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md-soft'
                        : 'border-gray-200 bg-white hover:border-primary hover:shadow-md-soft'
                    }`}
                  >
                    <div className="text-2xl mb-2">{option.emoji}</div>
                    <p className="font-semibold text-gray-800">{option.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                🖼️ 이미지 업로드 <span className="text-red-500">*</span>
              </h3>
              <ImageUpload images={images} onChange={setImages} />
            </div>

            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                🏷️ 검색 키워드 <span className="text-red-500">*</span>
              </h3>
              <KeywordInput keywords={keywords} onChange={setKeywords} />
            </div>

            <div className="glass-effect rounded-xl p-8 shadow-soft">
              <p className="text-lg font-semibold text-gray-800 mb-4">✍️ 추가 설정 (선택사항)</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시작 문장 (최대 200자)
                  </label>
                  <textarea
                    value={startSentence}
                    onChange={(e) => setStartSentence(e.target.value)}
                    placeholder="예: 안녕하세요, 미식가 블로거입니다!&#10;오늘은 강남역 맛집을 소개합니다."
                    rows={3}
                    maxLength={200}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary smooth-transition text-gray-800 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {startSentence.length}/200
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    마무리 문장 (최대 200자)
                  </label>
                  <textarea
                    value={endSentence}
                    onChange={(e) => setEndSentence(e.target.value)}
                    placeholder="예: 댓글로 의견을 공유해주세요!&#10;다음에 더 좋은 정보로 찾아뵙겠습니다."
                    rows={3}
                    maxLength={200}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary smooth-transition text-gray-800 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {endSentence.length}/200
                  </p>
                </div>
              </div>
            </div>

            {loading && (
              <div className="p-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-orange-900">
                        {loadingStep === 'compress' && '📸 이미지 압축 중...'}
                        {loadingStep === 'analyze' && '🔍 이미지 분석 중...'}
                        {loadingStep === 'generate' && '✨ 블로그 글 생성 중...'}
                      </p>
                      <span className="text-xs text-orange-700">
                        {loadingStep === 'compress' && '1/3'}
                        {loadingStep === 'analyze' && '2/3'}
                        {loadingStep === 'generate' && '3/3'}
                      </span>
                    </div>
                    <div className="w-full bg-orange-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500 ${
                          loadingStep === 'compress' ? 'w-1/3' : loadingStep === 'analyze' ? 'w-2/3' : 'w-full'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-orange-700">
                    {loadingStep === 'compress' && '이미지를 압축하고 최적화하는 중입니다...'}
                    {loadingStep === 'analyze' && '이미지의 시각적 특징을 분석하는 중입니다...'}
                    {loadingStep === 'generate' && 'AI가 당신의 스타일에 맞는 블로그 글을 작성하는 중입니다...'}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium animate-pulse">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim() || images.length === 0 || keywords.length === 0}
              className="w-full py-4 px-6 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white font-bold rounded-xl hover:from-orange-500 hover:via-amber-500 hover:to-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed smooth-transition flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl disabled:shadow-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  블로그 글 생성하기
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
