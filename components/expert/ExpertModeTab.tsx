'use client';

import { useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ExpertType, WebSearchResult, RecommendationItem, ModelConfig, KeywordItem } from '@/types';
import { ExpertSelector } from './ExpertSelector';
import { ModelSelector } from './ModelSelector';
import { CreativitySlider } from './CreativitySlider';
import ImageUpload from '../form/ImageUpload';
import KeywordInput from '../form/KeywordInput';

// 동적 임포트: 웹 검색 결과와 추천 목록은 필요할 때만 로드
const WebSearchResults = dynamic(() => import('./WebSearchResults').then(mod => ({ default: mod.WebSearchResults })), {
  loading: () => <p className="text-sm text-gray-500">검색 결과 로딩 중...</p>,
});

const RecommendationsList = dynamic(() => import('./RecommendationsList').then(mod => ({ default: mod.RecommendationsList })), {
  loading: () => <p className="text-sm text-gray-500">추천 항목 로딩 중...</p>,
});

interface ExpertModeTabProps {
  onGenerateWithExpert: (params: {
    expertType: ExpertType;
    modelConfig: ModelConfig;
    webSearchResults?: WebSearchResult[];
    recommendations?: RecommendationItem[];
  }) => void;
  isLoading?: boolean;
  disabled?: boolean;
  // 필수 입력 필드
  images: File[];
  onImagesChange: (images: File[]) => void; // ImageUpload는 onChange를 사용하지만 여기서는 onImagesChange로 래핑
  topic: string;
  onTopicChange: (topic: string) => void;
  keywords: KeywordItem[];
  onKeywordsChange: (keywords: KeywordItem[]) => void;
  length: 'short' | 'medium' | 'long';
  onLengthChange: (length: 'short' | 'medium' | 'long') => void;
  error?: string;
}

export function ExpertModeTab({
  onGenerateWithExpert,
  isLoading = false,
  disabled = false,
  images,
  onImagesChange,
  topic,
  onTopicChange,
  keywords,
  onKeywordsChange,
  length,
  onLengthChange,
  error,
}: ExpertModeTabProps) {
  const [selectedExpert, setSelectedExpert] = useState<ExpertType | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    imageAnalysisModel: 'gpt-4o',
    webSearchModel: 'gpt-4o-mini',
    contentGenerationModel: 'gpt-4o',
    creativity: 7,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [webSearchResults, setWebSearchResults] = useState<WebSearchResult[]>([]);
  const [selectedWebResults, setSelectedWebResults] = useState<WebSearchResult[]>([]);
  const [searchErrors, setSearchErrors] = useState<{ naver?: string; google?: string }>({});

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [selectedRecommendations, setSelectedRecommendations] = useState<RecommendationItem[]>([]);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);

  // 웹 검색 (Naver + Google 동시)
  const handleWebSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요');
      return;
    }

    setLoadingSearch(true);
    setSearchErrors({});
    try {
      const response = await fetch('/api/search/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          searchEngine: 'both', // 네이버 + 구글 동시 검색
          limit: 5,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWebSearchResults(data.results);
        setSelectedWebResults([]); // 초기화
        if (data.results.length === 0) {
          alert('검색 결과가 없습니다');
        }
      } else {
        alert('검색 실패: ' + (data.error || '알 수 없는 오류'));
        setSearchErrors({ naver: data.error, google: data.error });
      }
    } catch (error) {
      console.error('Web search error:', error);
      const errorMsg = error instanceof Error ? error.message : '검색 중 오류가 발생했습니다';
      alert(errorMsg);
      setSearchErrors({ naver: errorMsg, google: errorMsg });
    } finally {
      setLoadingSearch(false);
    }
  }, [searchQuery]);

  // 추천 검색
  const handleGetRecommendations = useCallback(async () => {
    if (!selectedExpert) {
      alert('먼저 전문가를 선택해주세요');
      return;
    }

    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요');
      return;
    }

    setLoadingRec(true);
    try {
      const response = await fetch('/api/search/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          expertType: selectedExpert,
          recommendationType: selectedExpert === 'restaurant' ? 'nearby' :
                             selectedExpert === 'travel' ? 'destination' : 'related',
          limit: 5,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setRecommendations(data.recommendations);
        setSelectedRecommendations([]); // 초기화
      } else {
        alert('추천 검색 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Recommendations error:', error);
      alert('추천 검색 중 오류가 발생했습니다');
    } finally {
      setLoadingRec(false);
    }
  }, [selectedExpert, searchQuery]);

  // 창의성 슬라이더 변경 핸들러
  const handleCreativityChange = useCallback((creativity: number) => {
    setModelConfig(prev => ({ ...prev, creativity }));
  }, []);

  const canGenerate = selectedExpert && !disabled && !isLoading;

  return (
    <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">❌ 오류</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 전문가 선택 */}
      <ExpertSelector
        selectedExpert={selectedExpert}
        onSelectExpert={setSelectedExpert}
        disabled={disabled || isLoading}
      />

      {selectedExpert && (
        <>
          {/* 필수 입력 필드 */}
          <div className="border-t pt-6 space-y-4">
            {/* 이미지 업로드 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📸 이미지 업로드 <span className="text-red-500">*필수</span></h3>
              <ImageUpload
                images={images}
                onChange={onImagesChange}
              />
              {images.length > 0 && (
                <p className="text-sm text-green-600 mt-2">✓ {images.length}장의 이미지가 업로드되었습니다</p>
              )}
            </div>

            {/* 주제 입력 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📝 주제 입력 <span className="text-red-500">*필수</span></h3>
              <input
                type="text"
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="블로그 글의 주제를 입력하세요... (예: 강남 맛집 추천, 요즘 핫한 제품)"
                disabled={disabled || isLoading}
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">{topic.length} / 100</p>
              {topic.trim().length > 0 && (
                <p className="text-sm text-green-600 mt-1">✓ 주제가 입력되었습니다</p>
              )}
            </div>

            {/* 키워드 입력 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">🏷️ 키워드 <span className="text-red-500">*필수</span></h3>
              <KeywordInput
                keywords={keywords}
                onChange={onKeywordsChange}
              />
              {keywords.length > 0 && (
                <p className="text-sm text-green-600 mt-2">✓ {keywords.length}개의 키워드가 입력되었습니다</p>
              )}
            </div>

            {/* 글 길이 선택 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">📏 글 길이 선택</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'short', label: '짧은 글', desc: '1500-2000자' },
                  { value: 'medium', label: '중간 글', desc: '2000-2500자' },
                  { value: 'long', label: '긴 글', desc: '2500-3000자' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onLengthChange(opt.value as 'short' | 'medium' | 'long')}
                    disabled={disabled || isLoading}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      length === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-primary'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                선택됨: <strong>{length === 'short' ? '짧은 글 (1500-2000자)' : length === 'medium' ? '중간 글 (2000-2500자)' : '긴 글 (2500-3000자)'}</strong>
              </p>
            </div>
          </div>

          {/* 모델 설정 */}
          <div className="border-t pt-6">
            <ModelSelector
              modelConfig={modelConfig}
              onUpdateModelConfig={setModelConfig}
              disabled={disabled || isLoading}
            />
          </div>

          {/* 창의성 조절 */}
          <div className="border-t pt-6">
            <CreativitySlider
              creativity={modelConfig.creativity}
              onChangeCreativity={(creativity) =>
                setModelConfig({ ...modelConfig, creativity })
              }
              disabled={disabled || isLoading}
            />
          </div>

          {/* 웹 검색 */}
          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">🔍 웹 검색 (선택) - 네이버 + 구글 동시 검색</h3>
              <div className="space-y-3">
                {/* 검색어 입력 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색어를 입력하세요..."
                    disabled={disabled || isLoading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleWebSearch();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
                  />

                  {/* 검색 버튼 */}
                  <button
                    onClick={handleWebSearch}
                    disabled={disabled || isLoading || loadingSearch || !searchQuery.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loadingSearch ? '검색중...' : '검색'}
                  </button>
                </div>

                {/* 검색 엔진 안내 */}
                <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                  📌 네이버와 구글에서 동시에 검색합니다. 검색 결과는 중복 제거 후 표시됩니다.
                </div>

                {/* 검색 에러 표시 */}
                {(searchErrors.naver || searchErrors.google) && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm font-semibold text-red-700 mb-1">⚠️ 검색 중 문제 발생:</p>
                    {searchErrors.naver && <p className="text-xs text-red-600">🔹 네이버: {searchErrors.naver}</p>}
                    {searchErrors.google && <p className="text-xs text-red-600">🔹 구글: {searchErrors.google}</p>}
                  </div>
                )}

                {/* 웹 검색 결과 */}
                {webSearchResults.length > 0 && (
                  <WebSearchResults
                    results={webSearchResults}
                    selectedResults={selectedWebResults}
                    onSelectResults={setSelectedWebResults}
                    isLoading={loadingSearch}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 추천 검색 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">⭐ 추천 검색 (선택)</h3>

            <button
              onClick={handleGetRecommendations}
              disabled={disabled || isLoading || loadingRec || !searchQuery.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loadingRec ? '검색중...' : '추천 항목 검색'}
            </button>

            {/* 추천 결과 */}
            {recommendations.length > 0 && (
              <div className="mt-4">
                <RecommendationsList
                  recommendations={recommendations}
                  selectedRecommendations={selectedRecommendations}
                  onSelectRecommendations={setSelectedRecommendations}
                  expertType={selectedExpert}
                />
              </div>
            )}
          </div>

          {/* 생성 버튼 */}
          <div className="border-t pt-6">
            <button
              onClick={() => {
                onGenerateWithExpert({
                  expertType: selectedExpert!,
                  modelConfig,
                  webSearchResults: selectedWebResults.length > 0 ? selectedWebResults : undefined,
                  recommendations: selectedRecommendations.length > 0 ? selectedRecommendations : undefined,
                });
              }}
              disabled={!canGenerate}
              className="w-full px-4 py-3 bg-purple-600 text-white text-lg font-semibold rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '생성 중...' : '✨ 전문가 모드로 글 생성'}
            </button>

            {selectedRecommendations.length > 0 || selectedWebResults.length > 0 ? (
              <p className="text-sm text-green-600 mt-2">
                ✓ {selectedWebResults.length}개 검색 결과 + {selectedRecommendations.length}개 추천 항목 적용됨
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                웹 검색 결과와 추천 항목을 선택하면 글에 자동으로 반영됩니다.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
