// 폼 관련 타입
export interface GenerateFormData {
  topic: string;
  length: 'short' | 'medium' | 'long';
  keywords: KeywordItem[];
  images: File[];
  startSentence?: string;
  endSentence?: string;
}

export interface KeywordItem {
  text: string;
  count: number;
}

export interface LengthOption {
  value: 'short' | 'medium' | 'long';
  label: string;
  description: string;
  estimatedWords: number;
}

// 이미지 분석 관련 타입
export interface ImageCategory {
  category: string;
  confidence: number;
  details: string;
}

export interface CompressedImageAnalysis {
  idx: number;
  cats: ImageCategory[];
  desc: string;
  mood: string;
  visualDetails?: string;
}

export interface OverallAnalysis {
  theme: string;
  style: string;
  suggestions: string[];
}

export interface ImageAnalysisResult {
  images: CompressedImageAnalysis[];
  overall: OverallAnalysis;
  costEstimate: number;
}

// 블로그 스타일 관련 타입
export interface BlogAnalysisResult {
  style: BlogStyle;
  analyzedAt: string;
  blogs: BlogPost[];
  cacheKey: string;
}

export interface BlogStyle {
  tone: string;
  structure: string;
  emoticons: string[];
  keywords: string[];
  sentenceLength: 'short' | 'medium' | 'long';
  commonPhrases: string[];
  callToAction: string;
  introduction: string;
}

export interface BlogPost {
  title: string;
  url: string;
  excerpt: string;
}

// 이미지 가이드 관련 타입
export interface ImageGuide {
  index: number;
  marker: string;
  lineNumber: number;
  paragraphNumber: number;
  suggestedCaption: string;
  placement: 'inline' | 'standalone';
}

export interface GeneratedContentWithImages {
  content: string;
  imageGuides: ImageGuide[];
  wordCount: number;
  keywordCounts: Record<string, number>;
}

export interface MarkerInfo {
  index: number;
  marker: string;
  startPos: number;
  endPos: number;
}

export interface ContentSegment {
  type: 'text' | 'image';
  content: string;
  markerInfo?: MarkerInfo;
}

// 뷰 모드 관련 타입
export type ViewMode = 'preview' | 'edit';

export interface ContentDisplayState {
  content: string;
  imageGuides: ImageGuide[];
  viewMode: ViewMode;
  selectedImageIndex?: number;
}

// API 요청/응답 타입
export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
}

export interface AssistantCreateRequest {
  model: string;
  instructions: string;
  tools?: unknown[];
}

export interface AssistantCreateResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  instructions: string;
}

export interface AssistantUpdateRequest {
  id: string;
  instructions: string;
}

export interface AssistantUpdateResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  instructions: string;
}

export interface AssistantGetResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  instructions: string;
}

export interface FetchLatestBlogResponse {
  success: boolean;
  blogs: BlogPost[];
  message?: string;
  error?: string;
}

export interface AnalyzeStyleRequest {
  blogs: BlogPost[];
}

export interface AnalyzeStyleResponse {
  success: boolean;
  style: BlogStyle;
  analyzedAt: string;
  message?: string;
  error?: string;
}

export interface AnalyzeImagesRequest {
  images: string[];
  topic: string;
  context?: string;
}

export interface AnalyzeImagesResponse {
  success: boolean;
  analysis: ImageAnalysisResult;
  message?: string;
  error?: string;
}

export interface CreateContentRequest {
  topic: string;
  length: 'short' | 'medium' | 'long';
  keywords: KeywordItem[];
  imageAnalysis: ImageAnalysisResult;
  startSentence?: string;
  endSentence?: string;
  placeInfo?: PlaceInfo;
}

export interface CreateContentResponse {
  success: boolean;
  content: GeneratedContentWithImages;
  cost?: {
    usd: number;
    krw: number;
    breakdown?: {
      imageAnalysis: { usd: number; krw: number };
      contentGeneration: { usd: number; krw: number };
    };
  };
  message?: string;
  error?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

// 세션 관련 타입
export interface SessionPayload {
  iat: number;
  exp: number;
  authenticated: boolean;
}

// 블로그 스타일 캐시 타입
export interface BlogStyleCache {
  style: BlogStyle;
  blogs: BlogPost[];
  analyzedAt: string;
  cacheKey: string;
}

// 다운로드 관련 타입
export interface DownloadFormat {
  format: 'txt' | 'docx' | 'html';
  includeMarkers: boolean;
}

export interface DownloadOptions {
  filename: string;
  format: DownloadFormat['format'];
  includeMarkers: boolean;
}

// 채팅 수정 관련 타입
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface RefineContentRequest {
  conversationHistory: ChatMessage[];
  userRequest: string;
  currentContent: string;
  imageAnalysis: ImageAnalysisResult;
}

export interface RefineContentResponse {
  success: boolean;
  refinedContent: string;
  message?: string;
  error?: string;
}

// 가게 정보 관련 타입
export interface PlaceInfo {
  name: string;
  address: string;
  phone?: string;
  openingHours?: string[];
  parking?: string;
  rating?: number;
  website?: string;
  nearbyTransit?: string;
}
