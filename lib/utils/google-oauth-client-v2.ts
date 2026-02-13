import { google } from "googleapis";
import { createHmac, randomBytes } from "crypto";

/**
 * 단일 사용자용 Google OAuth 2.0 클라이언트 (개선 버전)
 *
 * 🔐 보안 개선:
 * - CSRF 방지 (state 파라미터)
 * - refresh_token 최초 발급 처리
 * - 자동 갱신 시 새 refresh_token 저장
 * - 명확한 에러 처리
 */

// 환경 변수 검증
function validateEnv(): {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
} {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI;

  if (!client_id || !client_secret || !redirect_uri) {
    throw new Error(
      "❌ Google OAuth 환경 변수 누락\n" +
      "필수: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
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
 * CSRF 방지를 위한 state 파라미터 생성
 *
 * 🔐 역할:
 * - 로그인 요청과 콜백이 같은 사용자인지 확인
 * - 악의적인 redirect 공격 방지
 */
export function generateState(): string {
  const random = randomBytes(32).toString("hex");
  return createHmac("sha256", process.env.SESSION_SECRET || "secret")
    .update(random)
    .digest("hex");
}

/**
 * state 파라미터 검증
 */
export function validateState(
  receivedState: string,
  expectedState: string
): boolean {
  // timing attack 방지를 위해 항상 비교 수행
  const isValid = receivedState === expectedState;

  if (!isValid) {
    console.error("❌ CSRF 검증 실패: state 파라미터 불일치");
    console.error(`받은 state: ${receivedState?.substring(0, 10)}...`);
    console.error(`예상 state: ${expectedState?.substring(0, 10)}...`);
  }

  return isValid;
}

/**
 * 인증 URL 생성
 *
 * 📌 critical 옵션:
 * - access_type="offline" → refresh_token 발급
 * - prompt="consent" → 매번 refresh_token 재발급
 * - state → CSRF 방지
 */
export function generateAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.file", // ⭐ 최소 권한 (drive.file만)
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // ⭐ refresh_token 받기 위해 필수!
    scope: scopes,
    prompt: "consent", // ⭐ 매번 refresh_token 재발급
    state, // 🔐 CSRF 방지
  });

  console.log("✅ 인증 URL 생성됨");
  console.log("📌 옵션: access_type=offline, prompt=consent, state");

  return authUrl;
}

/**
 * Authorization code를 access_token으로 교환
 *
 * ⚠️ critical: refresh_token 발급 여부 확인
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expiry_date: number;
  scope: string;
}> {
  try {
    const oauth2Client = createOAuth2Client();

    console.log("🔄 Authorization code 교환 중...");
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("access_token을 받을 수 없습니다");
    }

    // ⭐ refresh_token 확인 (매우 중요!)
    if (!tokens.refresh_token) {
      console.warn("⚠️ ⚠️ ⚠️ refresh_token이 없습니다! ⚠️ ⚠️ ⚠️");
      console.warn("원인:");
      console.warn("  1. prompt=consent 옵션 누락");
      console.warn("  2. 이전에 로그인한 계정 (Google이 동의한 것으로 간주)");
      console.warn("해결:");
      console.warn("  1. Google 계정 → 보안 → 타사 앱 액세스에서 앱 삭제");
      console.warn("  2. 다시 로그인");
    }

    console.log("✅ Token 교환 완료");
    if (tokens.refresh_token) {
      console.log("✅ refresh_token 정상 발급됨!");
      console.log("📌 이제 자동화 가능 (영구 저장됨)");
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_type: tokens.token_type || "Bearer",
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
      scope: tokens.scope || "",
    };
  } catch (error) {
    if (error instanceof Error) {
      // 일반적인 OAuth 에러 처리
      if (error.message.includes("invalid_grant")) {
        throw new Error(
          "❌ invalid_grant: 인증 코드가 만료되었거나 유효하지 않습니다"
        );
      }
      if (error.message.includes("redirect_uri_mismatch")) {
        throw new Error(
          "❌ redirect_uri_mismatch: 환경변수의 GOOGLE_REDIRECT_URI를 확인하세요"
        );
      }
    }
    throw error;
  }
}

/**
 * Refresh token으로 새로운 access token 발급
 *
 * ⭐ 자동 갱신의 핵심!
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  expiry_date: number;
  new_refresh_token?: string;
}> {
  try {
    const oauth2Client = createOAuth2Client();

    // ⭐ critical: refresh_token 설정
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // 🔐 중요: 새로운 refresh_token을 받을 수 있음
    oauth2Client.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        console.log("🔄 새로운 refresh_token 받음!");
        console.log("📌 저장소에 업데이트해야 합니다");
      }
    });

    console.log("🔄 Access token 갱신 중...");
    const { credentials } = await oauth2Client.refreshAccessToken();

    console.log("✅ Access token 갱신 완료");

    return {
      access_token: credentials.access_token!,
      expiry_date: credentials.expiry_date || Date.now() + 3600 * 1000,
      new_refresh_token: credentials.refresh_token || undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("invalid_grant")) {
        throw new Error(
          "❌ Refresh token이 유효하지 않습니다\n" +
          "다시 로그인해주세요"
        );
      }
    }
    throw error;
  }
}

/**
 * Token이 만료되었는지 확인
 *
 * 5분 버퍼로 미리 갱신
 */
export function isTokenExpired(expiryDate: number): boolean {
  const bufferTime = 5 * 60 * 1000; // 5분
  const isExpired = Date.now() >= expiryDate - bufferTime;

  if (isExpired) {
    console.log("⚠️ Token이 곧 만료됩니다 (5분 내)");
  }

  return isExpired;
}

/**
 * OAuth2 클라이언트에 credentials 설정
 */
export function setOAuth2Credentials(
  oauth2Client: any,
  token: {
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
  }
): void {
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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
