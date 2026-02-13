'use client';

import { useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import { AlertCircle, X } from 'lucide-react';

interface ProcessResult {
  success: boolean;
  totalProcessed: number;
  totalLiked: number;
  neighborStats: Array<{
    nickname: string;
    postsProcessed: number;
    postsLiked: number;
  }>;
  errors: string[];
  startedAt: string;
  completedAt: string;
  message?: string;
  error?: string;
}

export default function NeighborPage() {
  const [blogId, setBlogId] = useState('');
  const [blogPassword, setBlogPassword] = useState('');
  const [daysLimit, setDaysLimit] = useState(7);
  const [maxNeighbors, setMaxNeighbors] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!blogId.trim() || !blogPassword.trim()) {
      setError('블로그 ID와 비밀번호를 입력하세요.');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/neighbor/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: blogId.trim(),
          blogPassword,
          daysLimit,
          maxNeighbors,
        }),
      });

      const data: ProcessResult = await response.json();

      if (!response.ok) {
        setError(data.error || '처리 중 오류가 발생했습니다.');
        setResult(data);
        return;
      }

      setResult(data);

      if (data.success) {
        // 성공 시 입력값 초기화
        setBlogId('');
        setBlogPassword('');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-2">🤝 이웃 자동 좋아요</h1>
            <p className="text-gray-600 text-lg">
              네이버 블로그 이웃들의 최근 글에 자동으로 좋아요를 누립니다
            </p>
          </div>

          {/* 정보 배너 */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">ℹ️ 로컬 환경에서만 작동합니다</p>
              <p className="text-sm text-blue-700 mt-1">
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">npm run dev</code>로 로컬 서버를 실행하세요.
              </p>
            </div>
          </div>

          {/* 메인 폼 */}
          <div className="glass-effect rounded-xl p-8 mb-8 shadow-md-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 블로그 ID */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">네이버 블로그 ID</label>
                <input
                  type="text"
                  value={blogId}
                  onChange={(e) => setBlogId(e.target.value)}
                  placeholder="예: my_blog_id"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block font-semibold text-gray-900 mb-2">네이버 계정 비밀번호</label>
                <input
                  type="password"
                  value={blogPassword}
                  onChange={(e) => setBlogPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                  disabled={isProcessing}
                />
                <p className="text-gray-500 text-sm mt-2">
                  ⚠️ 계정 정보는 메모리에만 임시 저장되며, 작업 완료 후 자동으로 삭제됩니다.
                </p>
              </div>

              {/* 옵션 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-900 mb-2">확인 기간 (일)</label>
                  <input
                    type="number"
                    value={daysLimit}
                    onChange={(e) => setDaysLimit(Math.max(1, parseInt(e.target.value) || 7))}
                    min="1"
                    max="30"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                    disabled={isProcessing}
                  />
                  <p className="text-gray-500 text-sm mt-1">지난 N일 안에 작성된 글만 확인</p>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 mb-2">이웃 제한 (명)</label>
                  <input
                    type="number"
                    value={maxNeighbors}
                    onChange={(e) => setMaxNeighbors(Math.max(1, parseInt(e.target.value) || 10))}
                    min="1"
                    max="50"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition"
                    disabled={isProcessing}
                  />
                  <p className="text-gray-500 text-sm mt-1">최대 N명의 이웃까지만 처리</p>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-lg flex items-start gap-3">
                  <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">오류</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isProcessing || !blogId.trim() || !blogPassword.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition-all smooth-transition ${
                  isProcessing || !blogId.trim() || !blogPassword.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:shadow-md-soft active:scale-95'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> 처리 중... (실제 브라우저가 열립니다)
                  </span>
                ) : (
                  '🚀 자동 좋아요 시작'
                )}
              </button>
            </form>
          </div>

          {/* 결과 표시 */}
          {result && (
            <div className={`rounded-xl p-8 shadow-md-soft border-l-4 ${
              result.success
                ? 'glass-effect border-l-green-500 bg-green-50'
                : 'glass-effect border-l-red-500 bg-red-50'
            }`}>
              <h2 className={`text-2xl font-bold mb-6 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                {result.success ? '✅ 처리 완료' : '❌ 처리 실패'}
              </h2>

              {/* 통계 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">처리된 글</p>
                  <p className="text-3xl font-bold text-primary">{result.totalProcessed}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">좋아요 완료</p>
                  <p className="text-3xl font-bold text-accent">{result.totalLiked}</p>
                </div>
                <div className="glass-effect rounded-lg p-4 shadow-md-soft">
                  <p className="text-sm text-gray-600 font-light mb-2">소요 시간</p>
                  <p className="text-3xl font-bold text-green-600">
                    {Math.round(
                      (new Date(result.completedAt).getTime() -
                        new Date(result.startedAt).getTime()) /
                        1000
                    )}
                    s
                  </p>
                </div>
              </div>

              {/* 이웃별 상세 통계 */}
              {result.neighborStats.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">이웃별 처리 결과</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {result.neighborStats.map((stat, idx) => (
                      <div key={idx} className="glass-effect rounded p-3 flex justify-between items-center shadow-sm">
                        <div>
                          <p className="font-medium text-gray-900">{stat.nickname}</p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {stat.postsProcessed}개 글 중 {stat.postsLiked}개 좋아요
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {stat.postsLiked}/{stat.postsProcessed}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 에러 목록 */}
              {result.errors.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">⚠️ 주의사항</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="bg-yellow-50 rounded p-2 text-yellow-700 text-sm border border-yellow-200">
                        • {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                onClick={() => setResult(null)}
                className="w-full py-2 glass-effect hover:shadow-md-soft text-gray-900 rounded-lg transition-all smooth-transition"
              >
                결과 닫기
              </button>
            </div>
          )}

          {/* 정보 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="glass-effect rounded-xl p-6 shadow-md-soft">
              <h3 className="font-bold text-lg gradient-text mb-4">🔍 작동 원리</h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>실제 크롬 브라우저를 띄워서 자동화</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>계정 정보는 메모리에만 임시 저장</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>이웃 목록 자동으로 가져오기</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>지난 N일간의 글 필터링</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>각 글의 좋아요 상태 확인 후 누르기</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span>작업 완료 후 모든 정보 삭제</span>
                </li>
              </ul>
            </div>

            <div className="glass-effect rounded-xl p-6 shadow-md-soft border-l-4 border-l-orange-400">
              <h3 className="font-bold text-lg text-gray-900 mb-4">⚠️ 주의사항</h3>
              <ul className="text-gray-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>로컬 환경에서만 작동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>Vercel 배포 후에는 사용 불가</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>올바른 ID/PW 입력 필요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>처리 시간이 길 수 있음 (이웃이 많을 경우)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>브라우저를 닫지 말 것</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">⚠️</span>
                  <span>과도한 빈도로 사용 금지 (네이버 차단)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
