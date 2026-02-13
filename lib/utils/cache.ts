import { promises as fs } from "fs";
import path from "path";
import type { BlogStyleCache } from "@/types/index";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // 디렉토리가 이미 존재하면 무시
  }
}

function getCacheKey(): string {
  return `blog_style_${process.env.BLOG_URL?.replace(/\//g, "_") || "default"}`;
}

export async function getCachedBlogStyle(): Promise<BlogStyleCache | null> {
  try {
    await ensureCacheDir();
    const cacheKey = getCacheKey();
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

    const data = await fs.readFile(cacheFile, "utf-8");
    const cache: BlogStyleCache = JSON.parse(data);

    // 캐시 유효성 검증 (24시간)
    const cacheTime = new Date(cache.analyzedAt).getTime();
    const now = Date.now();

    if (now - cacheTime > CACHE_DURATION) {
      // 캐시 만료
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

export async function setCachedBlogStyle(cache: BlogStyleCache): Promise<void> {
  try {
    await ensureCacheDir();
    const cacheKey = getCacheKey();
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

    await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    console.error("캐시 저장 실패:", error);
  }
}

export async function clearBlogStyleCache(): Promise<void> {
  try {
    await ensureCacheDir();
    const cacheKey = getCacheKey();
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

    await fs.unlink(cacheFile);
  } catch {
    // 파일이 없으면 무시
  }
}

export function getCacheExpiredAt(analyzedAt: string): string {
  const expiredDate = new Date(new Date(analyzedAt).getTime() + CACHE_DURATION);
  return expiredDate.toISOString();
}

export function isCacheValid(analyzedAt: string): boolean {
  const cacheTime = new Date(analyzedAt).getTime();
  const now = Date.now();
  return now - cacheTime <= CACHE_DURATION;
}

export function getCacheRemainingTime(analyzedAt: string): number {
  const cacheTime = new Date(analyzedAt).getTime();
  const now = Date.now();
  const remaining = CACHE_DURATION - (now - cacheTime);
  return Math.max(0, remaining);
}

export function formatRemainingTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}
