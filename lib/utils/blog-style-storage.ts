import fs from 'fs/promises';
import path from 'path';

// 스타일 파일 경로
const STYLE_FILE_PATH = path.join(process.cwd(), '.cache', 'blog-style.txt');

/**
 * 블로그 스타일을 파일에 저장합니다
 */
export async function saveBlogStyleToFile(style: string): Promise<void> {
  try {
    const cacheDir = path.join(process.cwd(), '.cache');

    // .cache 디렉토리 생성
    await fs.mkdir(cacheDir, { recursive: true });

    // 스타일 저장
    await fs.writeFile(STYLE_FILE_PATH, style, 'utf-8');

    console.log('[스타일 저장] .cache/blog-style.txt에 저장됨');
  } catch (error) {
    console.error('스타일 저장 실패:', error);
    throw new Error('스타일을 파일에 저장할 수 없습니다');
  }
}

/**
 * 파일에서 블로그 스타일을 읽습니다
 */
export async function readBlogStyleFromFile(): Promise<string | null> {
  try {
    const style = await fs.readFile(STYLE_FILE_PATH, 'utf-8');
    return style;
  } catch (error) {
    // 파일이 없으면 null 반환
    return null;
  }
}
