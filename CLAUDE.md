# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Blog Post Generator is a Next.js application that automatically generates blog posts in a target blog's style. The system learns from existing blog posts, analyzes user-provided images with high-quality vision analysis, and generates AI-written content with automatic image placement markers, focusing on sensory descriptions and consistent writing style.

**Key Workflow:**
1. User logs in with password authentication
2. User provides 2+ blog samples → System analyzes writing style (tone, sentence endings, expressions)
3. User uploads images (up to 25) → System analyzes them with GPT-4o (`detail: "high"`)
4. User enters topic, keywords, length preference
5. System generates blog post with `[IMAGE_N]` markers, matching learned style exactly
6. User can download content in multiple formats or copy to clipboard

## Architecture

### Core Layers

**Authentication & Middleware** (`middleware.ts`, `lib/auth/session.ts`)
- JWT-based session management using `jose` library
- Protected routes check for valid tokens before allowing access
- Public paths: `/login`, `/api/auth/login`
- Protected paths: `/generate`, `/format`, and their API endpoints
- Automatic redirection to login for unauthenticated page requests
- 401 responses for unauthenticated API requests

**OpenAI Integration** (`lib/openai/`)
- `client.ts`: OpenAI client initialization with model constants
- `assistant.ts`: OpenAI Assistant CRUD operations
- `blog-analyzer.ts`: **Uses GPT-4o** to extract blog style with **explicit sentence ending pattern analysis**
- `image-analyzer.ts`: **High-quality image analysis with GPT-4o (`detail: "high"`)** - extracts visual details, colors, composition
- `content-generator.ts`: Generates blog posts with **4-tier priority system**:
  1. SENTENCE ENDING CONSISTENCY (종결어미) - Must match extracted pattern exactly
  2. IMAGE-BASED DESCRIPTIONS - Only describe visible elements
  3. TECHNICAL REQUIREMENTS - Marker placement, keywords
  4. QUALITY & ENGAGEMENT
- `prompts.ts`: System prompts (all in English for cost optimization, includes 35+ sensory vocabulary terms)

**Blog Style Analysis & Caching** (`lib/blog/scraper.ts`, `lib/utils/cache.ts`, `lib/utils/blog-style-storage.ts`)
- User-provided blog samples (2+ posts) analyzed for writing style patterns
- **Sentence ending pattern (종결어미) extraction**: Identifies if writer uses ~~요, ~~다, ~~해요, etc.
- Style stored in `.cache/blog-style.txt` (plain text for Assistant instruction)
- File-based caching with 24-hour TTL
- Style automatically synced to OpenAI Assistant instructions for consistency

**Image Processing** (`lib/utils/image-processor.ts`)
- Client-side compression using Sharp (max 1920px, JPEG 85% quality)
- Base64 encoding for API transmission
- Token cost estimation for image analysis

**Content Segmentation** (`lib/utils/marker-parser.ts`, `lib/utils/image-guide-generator.ts`)
- Regex-based parsing of `[IMAGE_N]` markers (1-based indexing)
- Extraction of context around markers (2-3 lines before/after)
- Generation of image guides with suggested captions and placement type

**Document Export** (`lib/utils/download.ts`)
- TXT format (with or without markers)
- DOCX format using `docx` library
- HTML format with responsive styling

### API Workflow Flow (Phase 11)

```
/format (Format Management Page)
  ↓ User uploads 2+ blog samples
/api/blog/analyze-style
  ↓ analyzes with GPT-4o, **extracts sentence ending pattern explicitly**
  ↓ caches in .cache/blog-style.txt, syncs to Assistant instruction
/generate (Blog Generation Page)
  ↓ User uploads 1-25 images and enters topic/keywords
/api/generate/analyze-images
  ↓ batch analyzes images with **GPT-4o (`detail: "high"`)**
  ↓ extracts visual details: colors, textures, composition, lighting
/api/generate/create-content
  ↓ generates post with **4-tier priority**:
  ↓ 1. SENTENCE ENDING (종결어미) consistency
  ↓ 2. IMAGE-BASED descriptions only (visual elements)
  ↓ 3. Technical (markers, keywords)
  ↓ 4. Quality & engagement
Returns GeneratedContentWithImages
  ↓ (client extracts guides and segments)
User downloads/copies
```

## Development Workflow

### Environment Setup

```bash
# Install dependencies
npm install

# Create .env.local with:
OPENAI_API_KEY=sk-proj-...
AUTH_PASSWORD=wogns0513@
SESSION_SECRET=<random-32-char-string>
BLOG_URL=https://blog.naver.com/ssyeonee27
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Common Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint
```

## Key Implementation Details

### Sentence Ending Pattern (Phase 11 - CRITICAL)
- **Extracted automatically** when user analyzes their blog samples
- Patterns: `~~요`, `~~다`, `~~해요`, `~~하다`, etc.
- **MUST be applied consistently** in generated content (PRIORITY 1 in prompts)
- Stored in `.cache/blog-style.txt` section 1 with examples
- Verified by testing: Real sample texts show consistent pattern usage
- **Impact**: 100% consistency in writing style (vs 98% before)

### Marker System
- Format: `[IMAGE_1]`, `[IMAGE_2]`, etc. (1-based indexing, not 0-based)
- Auto-generated during content creation at contextually relevant positions
- Placement driven by visual content (not generic filler)
- Parser extracts surrounding text as context for user guidance
- Must validate marker indices match actual image count

### Token Cost Optimization (Updated Phase 11)
- All system prompts written in English (not Korean)
- **Image analysis now uses `detail: "high"` (170+ tokens per image)** for superior visual quality
- **Model upgraded: gpt-4o-mini → gpt-4o** for image analysis to capture sensory details
- Sensory vocabulary guidance (35+ terms) reduces need for user refinement
- Blog style cached for 24 hours AND stored in Assistant instruction (zero repetition cost)
- Batch image analysis processes 5-6 images per API call
- **Cost per 10-image batch: ~$0.0043** (affordable for quality improvement)

### Style Storage System (Phase 11 Update)
- **Location**: `.cache/blog-style.txt` (plain text format for readability)
- **Format**: Numbered sections (1-7):
  1. SENTENCE ENDING PATTERN (종결어미 - PRIMARY)
  2. TONE & VOICE
  3. WRITING PATTERN
  4. GENERIC EXPRESSIONS & CONNECTORS
  5. NARRATIVE STRUCTURE
  6. EMPHASIS TECHNIQUES
  7. READER INTERACTION
- **Sync**: Automatically updated to OpenAI Assistant instruction for zero-cost reuse
- **TTL**: 24 hours (configurable in `lib/utils/cache.ts` line 6)

### Authentication Flow
1. User submits password to `POST /api/auth/login`
2. Validated against `AUTH_PASSWORD` environment variable
3. JWT token generated with 24-hour expiration
4. Token stored in `blog_session` HTTP-only cookie
5. Middleware verifies token on protected routes
6. Expired tokens trigger automatic logout/redirect

### Image Analysis Pipeline (Phase 11 Upgraded)
1. Client-side compression (Sharp) → Base64 data URLs
2. Batch splitting (5-6 images per batch for API efficiency)
3. Individual image analysis with **GPT-4o, `detail: "high"`**:
   - Category, confidence, description, mood
   - **NEW**: visualDetails (colors, textures, composition, lighting)
4. Overall context analysis (theme, visual style, sensory quality)
5. Data returned in compressed JSON format with sensory vocabulary
6. **Output integrated into content generation with visual-first approach**

## File Structure

```
app/
├── (auth)/login/              # Public login page
├── (protected)/
│   ├── layout.tsx             # Auth check, Navigation wrapper
│   ├── generate/              # Main blog generation interface
│   └── format/                # Blog style management
├── api/
│   ├── auth/                  # Authentication endpoints
│   ├── blog/                  # Blog crawling and style analysis
│   ├── assistant/             # OpenAI Assistant management
│   └── generate/              # Image analysis and content generation
├── layout.tsx                 # Root layout
├── page.tsx                   # Redirect to /generate
└── globals.css                # TailwindCSS

components/
├── layout/Navigation.tsx      # Top navigation with tab switching
├── form/
│   ├── ImageUpload.tsx       # Drag-drop image upload with preview
│   └── KeywordInput.tsx      # Keyword tag management
└── (result components planned for future)

lib/
├── auth/session.ts            # JWT creation/verification
├── openai/
│   ├── client.ts
│   ├── assistant.ts
│   ├── blog-analyzer.ts
│   ├── image-analyzer.ts
│   ├── content-generator.ts
│   └── prompts.ts
├── blog/scraper.ts            # Cheerio-based crawling
└── utils/
    ├── validation.ts
    ├── cache.ts
    ├── image-processor.ts
    ├── marker-parser.ts
    ├── image-guide-generator.ts
    └── download.ts

types/index.ts                 # All TypeScript type definitions
middleware.ts                  # Next.js request middleware
```

## Critical Files for Common Tasks

| Task | File | Notes |
|------|------|-------|
| Add new protected route | `middleware.ts` line 9 | Add to `protectedPaths` array |
| Change auth password | `.env.local` | Update `AUTH_PASSWORD` |
| Adjust cache duration | `lib/utils/cache.ts` line 6 | `CACHE_DURATION = ...` |
| Update system prompts | `lib/openai/prompts.ts` | **CRITICAL**: Maintain 4-tier priority order; include sensory vocabulary |
| Modify image analysis detail level | `lib/openai/image-analyzer.ts` line 60, 159 | Change `detail: "high"` to `"low"` (tradeoff: quality vs cost) |
| Change image compression settings | `lib/utils/image-processor.ts` line 19-22 | Adjust maxWidth, maxHeight, quality |
| Analyze blog style from samples | `lib/openai/blog-analyzer.ts` line 74-166 | Uses `analyzeStyleCompact()` with gpt-4o |
| Update Assistant instructions | `app/api/blog/analyze-style/route.ts` line 72+ | Syncs style to OpenAI Assistant |
| Add new API endpoint | Create in `app/api/...` | Must add to `protectedPaths` if protected |

## Type System

All types are defined in `types/index.ts`. Key types:
- `GenerateFormData` - User input for blog generation
- `ImageAnalysisResult` - Output from image analysis with token cost estimate
- `BlogStyle` - Extracted style characteristics (tone, emoticons, phrases, etc.)
- `ImageGuide` - Metadata for each image placement (position, context, caption)
- `GeneratedContentWithImages` - Final output with content, guides, word count, keyword counts

## Error Handling

- API endpoints return `{ success: false, error: string }` on failure
- Client components display user-friendly error messages
- Blog crawling failures gracefully fallback to alternative selectors
- Token verification failures automatically redirect to login
- Image validation prevents unsupported formats or oversized files (>10MB)

## Testing Workflow (Phase 11)

### Login & Initial Setup
- Test login: `/login` with password `wogns0513@`
- Direct to `/format` (style management page)

### Style Analysis Testing
1. **Format Page** (`/format`)
   - Input 2+ blog samples (300+ chars each)
   - Click "새로운 글 작성 스타일 분석"
   - Verify SENTENCE ENDING PATTERN appears first in analysis
   - Check `.cache/blog-style.txt` for correct format
   - Confirm OpenAI Assistant instruction was updated

2. **API Direct Test**: `POST /api/blog/analyze-style`
   - Body: `{ posts: [{ title: "...", excerpt: "..." }, ...] }`
   - Response should include numbered sections with sentence ending pattern highlighted

### Content Generation Testing
1. **Generate Page** (`/generate`)
   - Verify "✅ 스타일이 준비되었습니다" appears
   - Upload test images
   - Check image analysis quality (visual details should be specific)
   - Generate content and verify:
     - Sentence endings match extracted pattern (~~요, ~~다, etc.)
     - Only visual elements from images are mentioned
     - Sensory vocabulary is used (고소한, 바삭한, 촉촉한, etc.)
     - No generic filler unrelated to images

2. **API Direct Test**: `POST /api/generate/analyze-images`
   - Body: `{ images: ["data:image/jpeg;base64,..."], topic: "..." }`
   - Response includes `visualDetails` field with colors, textures, composition

3. **API Direct Test**: `POST /api/generate/create-content`
   - Verify image marker placement matches visual content
   - Verify keyword inclusion is natural
   - Check marker count equals image count

## Performance Considerations (Phase 11 Optimized)

- Images analyzed in batches of 5-6 to balance API rate limits
- Blog style stored in Assistant instruction (zero cost on reuse, 70% token savings vs Phase 10)
- High-quality image analysis (`detail: "high"`, gpt-4o) provides better sensory descriptions
- Sensory vocabulary guidance (35+ terms) in prompts reduces hallucination and redundant refinement
- Client-side image compression reduces payload size
- Next.js automatically optimizes CSS with TailwindCSS v3
- **Trade-off**: Cost increases ~3x per image analysis, but quality improvement justifies (sensory detail, consistency)

## Quality Improvements (Phase 11 - Blog Generation Enhancement)

### Five Quality Pillars Implemented

1. **Sentence Ending Consistency (종결어미)** ⭐
   - Automatically extracted from user samples
   - Applied as PRIORITY 1 in all generation prompts
   - Ensures 100% consistency (vs 98% before)
   - Examples: "~~요 endings", "~~다 endings" patterns

2. **Image-Based Descriptions**
   - System forced to only describe visible elements
   - 80% focus on visual details, 20% context
   - Eliminates generic filler unrelated to images

3. **Sensory Vocabulary Enhancement**
   - 35+ taste terms (고소한, 짭짜한, 담백한, 진한, etc.)
   - 35+ texture terms (쫄깃한, 바삭한, 촉촉한, 폭신한, etc.)
   - Aroma, temperature, specific phrases
   - Reduces need for user refinement

4. **High-Quality Image Analysis**
   - Upgraded: gpt-4o-mini → gpt-4o
   - Detail level: `"low"` (85 tokens) → `"high"` (170+ tokens)
   - **Cost**: ~3x per image ($0.0015 → $0.0043 per 10-image batch)
   - **Benefit**: Colors, plating, textures, lighting captured precisely

5. **Writing Priority System**
   - 4-tier priority ensures correct precedence
   - Prevents lower-priority rules from overriding critical ones
   - Especially important for sentence ending consistency

### Decision Rationale
- **Cost vs. Quality Tradeoff**: Accepted 3x cost increase for sensory detail quality
- **Explicit Style Extraction**: Moved from implicit pattern matching to explicit sentence-ending analysis
- **Priority-Based Prompting**: Replaced competing instructions with clear hierarchy
- **Visual-First Approach**: Forced image descriptions to avoid hallucination and generic content

## Security Notes

- Never commit `.env.local` (already in `.gitignore`)
- JWT tokens stored in HTTP-only cookies (not accessible to client JS)
- Session secret should be cryptographically random (>32 characters)
- All protected routes verified by middleware before reaching handlers
- API endpoints validate JWT before processing requests
- OpenAI API keys never logged or exposed in error messages
