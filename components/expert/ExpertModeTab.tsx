'use client';

import { useState } from 'react';
import { ExpertType, WebSearchResult, RecommendationItem, ModelConfig } from '@/types';
import { ExpertSelector } from './ExpertSelector';
import { ModelSelector } from './ModelSelector';
import { CreativitySlider } from './CreativitySlider';
import { WebSearchResults } from './WebSearchResults';
import { RecommendationsList } from './RecommendationsList';

interface ExpertModeTabProps {
  onGenerateWithExpert: (params: {
    expertType: ExpertType;
    modelConfig: ModelConfig;
    webSearchResults?: WebSearchResult[];
    recommendations?: RecommendationItem[];
  }) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ExpertModeTab({
  onGenerateWithExpert,
  isLoading = false,
  disabled = false,
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
  const handleWebSearch = async () => {
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
  };

  // 추천 검색
  const handleGetRecommendations = async () => {
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
  };

  const canGenerate = selectedExpert && !disabled && !isLoading;

  return (
    <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
      {/* 전문가 선택 */}
      <ExpertSelector
        selectedExpert={selectedExpert}
        onSelectExpert={setSelectedExpert}
        disabled={disabled || isLoading}
      />

      {selectedExpert && (
        <>
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
