import { google } from "googleapis";

// 환경 변수 검증
function validateEnv(): { client_id: string; client_secret: string; redirect_uri: string } {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI;

  if (!client_id || !client_secret || !redirect_uri) {
    console.error("❌ Google OAuth 환경 변수 누락:", {
      GOOGLE_CLIENT_ID: !!client_id,
      GOOGLE_CLIENT_SECRET: !!client_secret,
      GOOGLE_REDIRECT_URI: !!redirect_uri,
    });
    throw new Error(
      "Google OAuth 환경 변수가 설정되지 않았습니다: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
    );
  }

  return { client_id, client_secret, redirect_uri };
}

/**
 * Google OAuth 2.0 클라이언트 생성
 */
export function createOAuth2Client() {
  const { client_id, client_secret, redirect_uri } = validateEnv();

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uri
  );

  return oauth2Client;
}

/**
 * 인증 URL 생성
 *
 * ⭐ 중요: access_type="offline" + prompt="consent"
 *
 * 왜 필요한가?
 * ────────────────────────────────────────────────────────
 * 1. access_type="offline"
 *    → "사용자가 온라인이 아닐 때도 API를 쓰고 싶다"는 뜻
 *    → Google이 refresh_token을 발급하도록 명시적 요청
 *    → 없으면 refresh_token이 발급되지 않음
 *
 * 2. prompt="consent"
 *    → 매번 강제로 동의 화면 표시
 *    → 중요! 두 번째 로그인부터는 refresh_token이 안 나옴
 *    → prompt="consent"를 넣어야 매번 refresh_token 재발급
 *
 * 🔥 이 둘이 없으면?
 *    access_token 만료 → refresh_token 없음 → 다시 로그인 필수
 *    → 블로그 자동 업로드 불가능!
 *
 * 📌 현실 문제
 *    기본 Google OAuth는:
 *    - access_token은 1시간 후 만료
 *    - refresh_token 없으면 재로그인 필요
 *    - 서버 자동화 완전 불가능
 *
 *    ✅ refresh_token이 있으면:
 *    - access_token 만료 → 자동으로 새 token 발급
 *    - 사용자 개입 없이 계속 작동
 *    - 장기 자동화 가능
 */
export function generateAuthUrl(): string {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.file", // Google Drive 파일 접근
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // ⭐ refresh_token 발급 받기 위해 필수!
    scope: scopes,
    prompt: "consent", // ⭐ 매번 재동의 화면 표시 (refresh_token 재발급)
  });

  console.log("✅ 인증 URL 생성됨");
  console.log("📌 옵션: access_type=offline, prompt=consent (refresh_token 발급 필수)");

  return authUrl;
}

/**
 * Authorization code를 access_token으로 교환
 */
export async function exchangeCodeForToken(
  code: string
): Promise<{ access_token: string; refresh_token?: string; token_type: string; expiry_date: number; scope: string }> {
  try {
    const oauth2Client = createOAuth2Client();

    console.log("🔄 Authorization code 교환 중...");
    const { tokens } = await oauth2Client.getToken(code);

    console.log("✅ Token 교환 완료");
    console.log("📧 Token 정보:", {
      access_token: tokens.access_token?.substring(0, 20) + "...",
      refresh_token: tokens.refresh_token ? "(있음)" : "(없음)",
      expiry_date: tokens.expiry_date,
    });

    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      token_type: tokens.token_type || "Bearer",
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000, // 기본 1시간
      scope: tokens.scope || "",
    };
  } catch (error) {
    console.error("❌ Token 교환 실패:", error);
    throw error;
  }
}

/**
 * Refresh token으로 새로운 access token 발급
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expiry_date: number }> {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    console.log("🔄 Access token 갱신 중...");
    const { credentials } = await oauth2Client.refreshAccessToken();

    console.log("✅ Access token 갱신 완료");

    return {
      access_token: credentials.access_token!,
      expiry_date: credentials.expiry_date || Date.now() + 3600 * 1000,
    };
  } catch (error) {
    console.error("❌ Access token 갱신 실패:", error);
    throw error;
  }
}

/**
 * Token이 만료되었는지 확인
 */
export function isTokenExpired(expiryDate: number): boolean {
  // 5분 전에 갱신 (여유있게)
  const bufferTime = 5 * 60 * 1000;
  return Date.now() >= expiryDate - bufferTime;
}

/**
 * OAuth2 클라이언트에 credentials 설정
 */
export function setOAuth2Credentials(oauth2Client: any, token: {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
}) {
  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.expiry_date,
  });
}

/**
 * Access token으로 사용자 정보 조회
 */
export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  try {
    console.log("🔍 사용자 정보 조회 중...");

    const response = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`사용자 정보 조회 실패: ${response.statusText}`);
    }

    const userInfo = await response.json();

    console.log("✅ 사용자 정보 조회 완료:", userInfo.email);

    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    };
  } catch (error) {
    console.error("❌ 사용자 정보 조회 실패:", error);
    throw error;
  }
}
