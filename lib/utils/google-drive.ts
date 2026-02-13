import { google } from "googleapis";
import type { Auth } from "googleapis";

let authClient: Auth.GoogleAuth | null = null;

/**
 * Google Drive API 클라이언트 초기화
 */
function getAuthClient(): Auth.GoogleAuth {
  if (authClient) {
    return authClient;
  }

  // 환경 변수에서 인증 정보 읽기
  let credentials: any;

  try {
    // 방법 1: GOOGLE_DRIVE_CREDENTIALS JSON 문자열
    if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
      credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
    }
    // 방법 2: 개별 환경 변수
    else if (process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
      credentials = {
        type: "service_account",
        project_id: process.env.GOOGLE_DRIVE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_DRIVE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.GOOGLE_DRIVE_CLIENT_X509_CERT_URL,
      };
    }
  } catch (error) {
    console.error("Google Drive 인증 정보 파싱 오류:", error);
  }

  if (!credentials) {
    throw new Error("Google Drive 인증 정보가 설정되지 않았습니다. 환경 변수를 확인하세요.");
  }

  authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return authClient;
}

/**
 * 파일이 존재하는지 확인하고 파일 ID 반환
 */
async function findFileByName(fileName: string): Promise<string | null> {
  try {
    const auth = getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    const response = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and trashed=false`,
      spaces: "drive",
      fields: "files(id, name)",
      pageSize: 1,
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id || null;
    }

    return null;
  } catch (error) {
    console.error("파일 찾기 오류:", error);
    throw error;
  }
}

/**
 * 블로그 스타일을 Google Drive에 저장 (생성 또는 업데이트)
 */
export async function saveBlogStyleToGoogleDrive(content: string): Promise<string> {
  try {
    const auth = getAuthClient();
    const drive = google.drive({ version: "v3", auth });
    const fileName = "blog_style.txt";
    const mimeType = "text/plain";

    // 기존 파일 찾기
    const existingFileId = await findFileByName(fileName);

    let fileId: string;

    if (existingFileId) {
      // 기존 파일 업데이트
      await drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType,
          body: content,
        },
      });
      fileId = existingFileId;
      console.log(`블로그 스타일 파일 업데이트: ${fileId}`);
    } else {
      // 새 파일 생성
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType,
          description: "Blog writing style analysis - Auto-generated",
        },
        media: {
          mimeType,
          body: content,
        },
        fields: "id",
      });
      fileId = response.data.id || "";
      console.log(`블로그 스타일 파일 생성: ${fileId}`);
    }

    return fileId;
  } catch (error) {
    console.error("Google Drive 저장 오류:", error);
    throw error;
  }
}

/**
 * Google Drive에서 블로그 스타일 읽기
 */
export async function readBlogStyleFromGoogleDrive(): Promise<string | null> {
  try {
    const auth = getAuthClient();
    const drive = google.drive({ version: "v3", auth });
    const fileName = "blog_style.txt";

    // 파일 찾기
    const fileId = await findFileByName(fileName);

    if (!fileId) {
      console.log("블로그 스타일 파일이 없습니다");
      return null;
    }

    // 파일 내용 읽기
    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    return new Promise((resolve, reject) => {
      let content = "";
      const stream = response.data;

      if (typeof stream === "string") {
        resolve(stream);
        return;
      }

      stream.on("data", (chunk: Buffer) => {
        content += chunk.toString();
      });

      stream.on("end", () => {
        resolve(content);
      });

      stream.on("error", (error: Error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error("Google Drive 읽기 오류:", error);
    return null;
  }
}

/**
 * Google Drive 파일 ID 반환 (필요시 사용)
 */
export async function getBlogStyleFileId(): Promise<string | null> {
  try {
    return await findFileByName("blog_style.txt");
  } catch (error) {
    console.error("파일 ID 조회 오류:", error);
    return null;
  }
}
