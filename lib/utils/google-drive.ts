import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

let driveInstance: drive_v3.Drive | null = null;

/**
 * Google Drive 인스턴스 초기화
 * GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 환경 변수에서 base64로 인코딩된 서비스 계정 키를 읽음
 */
function getDriveInstance(): drive_v3.Drive {
  if (driveInstance) {
    return driveInstance;
  }

  try {
    // 환경 변수 확인
    const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;

    if (!base64Key) {
      console.error("❌ GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 환경 변수가 설정되지 않았습니다");
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 환경 변수가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요."
      );
    }

    // Base64 디코딩
    console.log("🔍 Base64 환경 변수에서 서비스 계정 키 읽는 중...");
    const keyBuffer = Buffer.from(base64Key, "base64");
    const keyString = keyBuffer.toString("utf8");
    const credentials = JSON.parse(keyString);

    console.log("✅ 서비스 계정 키 파싱 완료");
    console.log("📧 클라이언트 이메일:", credentials.client_email);

    // Google Auth 초기화
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    // Google Drive 인스턴스 생성
    driveInstance = google.drive({
      version: "v3",
      auth,
    });

    console.log("✅ Google Drive 클라이언트 초기화 완료");

    return driveInstance;
  } catch (error) {
    console.error("❌ Google Drive 클라이언트 초기화 오류:", error);
    throw error;
  }
}

/**
 * 파일이 존재하는지 확인하고 파일 ID 반환
 */
async function findFileByName(fileName: string): Promise<string | null> {
  try {
    const drive = getDriveInstance();

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
    const drive = getDriveInstance();
    const fileName = "blog_style.txt";
    const mimeType = "text/plain";

    // 기존 파일 찾기
    const existingFileId = await findFileByName(fileName);

    let fileId: string;

    if (existingFileId) {
      // 기존 파일 업데이트
      console.log(`📝 블로그 스타일 파일 업데이트 중: ${existingFileId}`);
      await drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType,
          body: content,
        },
      });
      fileId = existingFileId;
      console.log(`✅ 블로그 스타일 파일 업데이트 완료: ${fileId}`);
    } else {
      // 새 파일 생성
      console.log("📝 블로그 스타일 파일 생성 중...");
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
      console.log(`✅ 블로그 스타일 파일 생성 완료: ${fileId}`);
    }

    return fileId;
  } catch (error) {
    console.error("❌ Google Drive 저장 오류:", error);
    throw error;
  }
}

/**
 * Google Drive에서 블로그 스타일 읽기
 */
export async function readBlogStyleFromGoogleDrive(): Promise<string | null> {
  try {
    const drive = getDriveInstance();
    const fileName = "blog_style.txt";

    // 파일 찾기
    console.log("🔍 Google Drive에서 블로그 스타일 파일 찾는 중...");
    const fileId = await findFileByName(fileName);

    if (!fileId) {
      console.log("⚠️ 블로그 스타일 파일이 없습니다");
      return null;
    }

    console.log(`📖 파일 읽는 중: ${fileId}`);

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
        console.log("✅ 블로그 스타일 읽기 완료");
        resolve(stream);
        return;
      }

      stream.on("data", (chunk: Buffer) => {
        content += chunk.toString();
      });

      stream.on("end", () => {
        console.log("✅ 블로그 스타일 읽기 완료");
        resolve(content);
      });

      stream.on("error", (error: Error) => {
        console.error("❌ 파일 읽기 스트림 오류:", error);
        reject(error);
      });
    });
  } catch (error) {
    console.error("❌ Google Drive 읽기 오류:", error);
    return null;
  }
}

/**
 * Google Drive 블로그 스타일 파일 ID 반환
 */
export async function getBlogStyleFileId(): Promise<string | null> {
  try {
    const fileId = await findFileByName("blog_style.txt");
    if (fileId) {
      console.log(`📄 블로그 스타일 파일 ID: ${fileId}`);
    }
    return fileId;
  } catch (error) {
    console.error("❌ 파일 ID 조회 오류:", error);
    return null;
  }
}
