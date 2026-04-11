"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVideoUrl = parseVideoUrl;
exports.validateEducationalContent = validateEducationalContent;
exports.parseVideoUrlRaw = parseVideoUrlRaw;
exports.generateTopicCurriculum = generateTopicCurriculum;
exports.generateTopicCurriculumRaw = generateTopicCurriculumRaw;
exports.generateSkillQuiz = generateSkillQuiz;
exports.evaluateCode = evaluateCode;
exports.getMicroLesson = getMicroLesson;
exports.analyzeVideoForQuiz = analyzeVideoForQuiz;
exports.generatePersonalizedPlan = generatePersonalizedPlan;
exports.isQuotaError = isQuotaError;
/**
 * All Gemini API calls live here. Never call Gemini directly from routes.
 *
 * Model rules (from CLAUDE.md — do not change):
 *   Parser / curriculum generation: gemini-1.5-pro
 *   Stuck detection / micro-lessons: gemini-1.5-flash
 */
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
function apiKeyPrefix() {
    return `${process.env.GEMINI_API_KEY?.slice(0, 8) ?? 'MISSING'}...`;
}
function logGeminiError(scope, err) {
    const error = err;
    const msg = error.message?.toLowerCase?.() ?? String(err).toLowerCase();
    console.error('═══════════════════════════════════');
    console.error(`[${scope}] FAILED`);
    console.error(`[${scope}] Error type:`, error?.constructor?.name ?? typeof err);
    console.error(`[${scope}] Error message:`, error?.message ?? String(err));
    console.error(`[${scope}] Full error:`, err);
    if (msg.includes('quota') || msg.includes('429')) {
        console.error(`[${scope}] ⚠️  QUOTA ERROR DETECTED`);
        console.error(`[${scope}] Key used:`, apiKeyPrefix());
    }
    if (msg.includes('api key') || msg.includes('auth') || msg.includes('unauthorized')) {
        console.error(`[${scope}] ⚠️  AUTH ERROR DETECTED`);
    }
    if (msg.includes('not found') || msg.includes('404') || msg.includes('model')) {
        console.error(`[${scope}] ⚠️  MODEL NOT FOUND / MODEL ACCESS ISSUE`);
    }
    console.error('═══════════════════════════════════');
}
// Prompt template from CLAUDE.md — DO NOT change without team discussion
// NOTE: URL is passed via fileData (not in text) so Gemini actually watches the video.
const VIDEO_PARSER_PROMPT_TEXT = `Watch this YouTube video carefully and analyse its full content.
Return ONLY valid JSON with this structure:
{
  "title": "string",
  "total_duration_minutes": number,
  "checkpoints": [
    {
      "day": number,
      "title": "string",
      "concepts": ["string"],
      "task1": { "title": "string", "description": "string", "duration_minutes": number },
      "task2": { "title": "string", "description": "string", "duration_minutes": number },
      "practice": { "title": "string", "description": "string", "difficulty": "beginner|intermediate|advanced" }
    }
  ]
}
No explanation. No markdown. Only the JSON object.`;
const TOPIC_CURRICULUM_PROMPT = (topic, skillTier) => `Generate a structured 30-day coding curriculum for the topic: "${topic}".
The learner's skill level is: ${skillTier}.
Return ONLY valid JSON with this structure:
{
  "title": "string",
  "total_duration_minutes": number,
  "checkpoints": [
    {
      "day": number,
      "title": "string",
      "concepts": ["string"],
      "task1": { "title": "string", "description": "string", "duration_minutes": number },
      "task2": { "title": "string", "description": "string", "duration_minutes": number },
      "practice": { "title": "string", "description": "string", "difficulty": "beginner|intermediate|advanced" }
    }
  ]
}
Generate exactly 30 checkpoints (days 1–30).
No explanation. No markdown. Only the JSON object.`;
/**
 * Parse a YouTube URL with Gemini 1.5 Pro.
 * Returns the parsed plan JSON.
 * Throws on quota error (caller must handle fallback).
 */
async function parseVideoUrl(url) {
    const text = await parseVideoUrlRaw(url);
    return extractJson(text);
}
/**
 * Validates whether a YouTube URL contains educational/technical content before parsing.
 * Uses Gemini Flash (cheap + fast) for this check.
 * Returns isEducational: false for songs, movies, vlogs, gaming, entertainment etc.
 */
async function validateEducationalContent(url, videoTitle) {
    console.log('[Gemini:validate] Checking URL:', url);
    console.log('[Gemini:validate] Title hint:', videoTitle ?? 'none');
    const context = videoTitle
        ? `Video title: "${videoTitle}"\nURL: ${url}`
        : `URL: ${url}`;
    const prompt = `You are a content classifier for a coding education platform.

Analyze this YouTube video and determine if it is educational or technical content suitable for a coding learning platform.

${context}

ALLOWED content types:
- Programming tutorials (any language)
- Data structures and algorithms
- Web development (frontend, backend, fullstack)
- System design and architecture
- Computer science concepts
- DevOps, cloud, databases
- Math or science tutorials
- Any technical skill-building content
- Coding interview preparation
- Software engineering concepts

NOT ALLOWED content types:
- Music videos or songs
- Movies or TV show clips
- Gaming/entertainment streams
- Vlogs or lifestyle content
- Sports videos
- Comedy or meme videos
- News or politics
- Cooking or food content
- Any non-technical entertainment

Return ONLY valid JSON with no markdown:
{
  "isEducational": boolean,
  "category": "string (e.g. DSA Tutorial, Music Video, Vlog, Python Course)",
  "reason": "string (one sentence explaining the decision)",
  "confidence": "high" | "medium" | "low"
}`;
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        console.log('[Gemini:validate] Raw response:', text);
        const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
        const parsed = JSON.parse(cleaned);
        const normalized = {
            isEducational: parsed.isEducational === true,
            category: typeof parsed.category === 'string' && parsed.category.trim().length > 0
                ? parsed.category.trim()
                : 'unknown',
            reason: typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
                ? parsed.reason.trim()
                : 'No reason provided',
            confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
                ? parsed.confidence
                : 'low',
        };
        console.log('[Gemini:validate] Result:', normalized.isEducational ? '✅ Educational' : '❌ Not educational', '-', normalized.category, `(${normalized.confidence})`);
        return normalized;
    }
    catch (err) {
        console.error('[Gemini:validate] Failed:', err);
        return {
            isEducational: true,
            category: 'unknown',
            reason: 'Validation check failed — proceeding with parse',
            confidence: 'low',
        };
    }
}
async function parseVideoUrlRaw(url) {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:parseVideo] START');
    console.log('[Gemini:parseVideo] URL:', url);
    console.log('[Gemini:parseVideo] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:parseVideo] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:parseVideo] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    // Step 1 — Extract video ID from URL
    // Handles all formats:
    // youtube.com/watch?v=ID
    // youtube.com/watch?v=ID&list=PLAYLIST&index=4
    // youtu.be/ID
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch?.[1];
    let videoContext = '';
    // Step 2 — Fetch real title from YouTube oEmbed
    // oEmbed is completely free — no API key required
    // Returns the actual video title so Gemini knows 
    // exactly what the video is about
    if (videoId) {
        try {
            console.log('[Gemini:parseVideo] Fetching oEmbed...');
            const oEmbedUrl = `https://www.youtube.com/oembed` +
                `?url=https://www.youtube.com/watch?v=${videoId}` +
                `&format=json`;
            const response = await fetch(oEmbedUrl);
            if (response.ok) {
                const data = await response.json();
                videoContext = [
                    data.title ? `Video title: "${data.title}"` : '',
                    data.author_name ? `Channel: ${data.author_name}` : '',
                ]
                    .filter(Boolean)
                    .join('\n');
                console.log('[Gemini:parseVideo] oEmbed result:', videoContext || 'FAILED — using URL only');
            }
            else {
                console.warn('[Gemini:parseVideo] oEmbed returned non-OK status:', response.status);
                console.log('[Gemini:parseVideo] oEmbed result:', 'FAILED — using URL only');
            }
        }
        catch (err) {
            // oEmbed failed — continue with URL only
            // Gemini will still try its best
            console.warn('[Gemini:parseVideo] oEmbed fetch failed:', err);
            console.log('[Gemini:parseVideo] oEmbed result:', 'FAILED — using URL only');
        }
    }
    else {
        console.log('[Gemini:parseVideo] oEmbed result:', 'FAILED — using URL only');
    }
    // Step 3 — Build contextual prompt with real video info
    // NEVER use fileData — it hallucinates for unknown videos
    const contextBlock = videoContext
        ? `You are generating a study plan for this specific video:\n${videoContext}\nURL: ${url}`
        : `You are generating a study plan for this YouTube video:\nURL: ${url}`;
    const fullPrompt = `${contextBlock}

The study plan MUST be based on the actual topic of this video.
If the video title mentions DSA — generate DSA content.
If the video title mentions React — generate React content.
If the video title mentions Python — generate Python content.
Do NOT default to Python or JavaScript if the topic is different.

${VIDEO_PARSER_PROMPT_TEXT}`;
    console.log('[Gemini:parseVideo] Prompt context:', contextBlock);
    console.log('[Gemini:parseVideo] Full prompt:', fullPrompt);
    // Step 4 — Call Gemini with text prompt (not fileData)
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });
        console.log('[Gemini:parseVideo] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent(fullPrompt);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:parseVideo] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:parseVideo] Response length:', text.length);
        console.log('[Gemini:parseVideo] Response preview:', text.slice(0, 150));
        console.log('[Gemini:parseVideo] SUCCESS');
        console.log('═══════════════════════════════════');
        return text;
    }
    catch (err) {
        logGeminiError('Gemini:parseVideo', err);
        throw err;
    }
}
/**
 * Generate a curriculum from a topic name using Gemini 1.5 Pro.
 */
async function generateTopicCurriculum(topic, skillTier = 'beginner') {
    const text = await generateTopicCurriculumRaw(topic, skillTier);
    return extractJson(text);
}
async function generateTopicCurriculumRaw(topic, skillTier = 'beginner') {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:generateTopicCurriculum] START');
    console.log('[Gemini:generateTopicCurriculum] Topic:', topic);
    console.log('[Gemini:generateTopicCurriculum] Skill tier:', skillTier);
    console.log('[Gemini:generateTopicCurriculum] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:generateTopicCurriculum] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:generateTopicCurriculum] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    try {
        const prompt = TOPIC_CURRICULUM_PROMPT(topic, skillTier);
        console.log('[Gemini:generateTopicCurriculum] Prompt:', prompt);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });
        console.log('[Gemini:generateTopicCurriculum] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent(prompt);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:generateTopicCurriculum] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:generateTopicCurriculum] Response length:', text.length);
        console.log('[Gemini:generateTopicCurriculum] Response preview:', text.slice(0, 150));
        console.log('[Gemini:generateTopicCurriculum] SUCCESS');
        console.log('═══════════════════════════════════');
        return text;
    }
    catch (err) {
        logGeminiError('Gemini:generateTopicCurriculum', err);
        throw err;
    }
}
/**
 * Generate 5 skill-assessment questions for the given goal using Gemini 1.5 Flash.
 */
async function generateSkillQuiz(goal) {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:generateSkillQuiz] START');
    console.log('[Gemini:generateSkillQuiz] Goal:', goal);
    console.log('[Gemini:generateSkillQuiz] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:generateSkillQuiz] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:generateSkillQuiz] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    const prompt = `Generate exactly 5 multiple-choice questions to assess a beginner's coding knowledge for the goal: "${goal}".
Return ONLY valid JSON as an array of 5 objects:
[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": number
  }
]
Questions should cover: variables, loops, functions, debugging, and data structures relevant to the goal.
No explanation. No markdown. Only the JSON array.`;
    try {
        console.log('[Gemini:generateSkillQuiz] Prompt:', prompt);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('[Gemini:generateSkillQuiz] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent(prompt);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:generateSkillQuiz] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:generateSkillQuiz] Response length:', text.length);
        console.log('[Gemini:generateSkillQuiz] Response preview:', text.slice(0, 150));
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(stripped);
        console.log('[Gemini:generateSkillQuiz] SUCCESS');
        console.log('═══════════════════════════════════');
        return parsed;
    }
    catch (err) {
        logGeminiError('Gemini:generateSkillQuiz', err);
        throw err;
    }
}
/**
 * Evaluate learner code against a task description using Gemini Flash.
 * Returns structured feedback without revealing the full solution.
 */
async function evaluateCode(code, language, taskTitle, taskDescription) {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:evaluateCode] START');
    console.log('[Gemini:evaluateCode] Language:', language);
    console.log('[Gemini:evaluateCode] Task title:', taskTitle);
    console.log('[Gemini:evaluateCode] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:evaluateCode] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:evaluateCode] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    const isTextAnswer = language === 'text';
    const prompt = isTextAnswer
        ? `You are a coding instructor evaluating a student's written answer.

Task title: "${taskTitle}"
Task description: "${taskDescription}"

Student's written answer:
"""
${code}
"""

Evaluate the written answer and return ONLY valid JSON with this structure:
{
  "passed": boolean,
  "score": number (0-100, how well it addresses the task),
  "feedback": "string (1-2 sentence overall verdict — be encouraging)",
  "hints": ["string", "string"] (1-3 specific, actionable hints if score < 80, empty array if passed well)
}

Rules:
- passed = true if score >= 70
- Evaluate based on conceptual understanding, accuracy, and completeness
- The answer does not need to contain code — a clear text explanation is valid
- Be encouraging even when the answer is incomplete
- hints should point out missing concepts or inaccuracies
No explanation. No markdown. Only the JSON object.`
        : `You are a coding instructor evaluating a student's code submission.

Task title: "${taskTitle}"
Task description: "${taskDescription}"
Language: ${language}

Student's code:
\`\`\`${language}
${code}
\`\`\`

Evaluate the code and return ONLY valid JSON with this structure:
{
  "passed": boolean,
  "score": number (0-100, how well it addresses the task),
  "feedback": "string (1-2 sentence overall verdict — be encouraging)",
  "hints": ["string", "string"] (1-3 specific, actionable hints if score < 80, empty array if passed well)
}

Rules:
- passed = true if score >= 70
- Do NOT reveal the full solution
- Be encouraging even when failing
- hints should address specific issues in their code
No explanation. No markdown. Only the JSON object.`;
    try {
        console.log('[Gemini:evaluateCode] Prompt:', prompt);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('[Gemini:evaluateCode] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent(prompt);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:evaluateCode] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:evaluateCode] Response length:', text.length);
        console.log('[Gemini:evaluateCode] Response preview:', text.slice(0, 150));
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(stripped);
        console.log('[Gemini:evaluateCode] SUCCESS');
        console.log('═══════════════════════════════════');
        return parsed;
    }
    catch (err) {
        logGeminiError('Gemini:evaluateCode', err);
        throw err;
    }
}
/**
 * Get a micro-lesson for a stuck learner using Gemini 1.5 Flash.
 */
async function getMicroLesson({ topic, problem, errorTypes, skillTier }) {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:getMicroLesson] START');
    console.log('[Gemini:getMicroLesson] Topic:', topic);
    console.log('[Gemini:getMicroLesson] Skill tier:', skillTier);
    console.log('[Gemini:getMicroLesson] Error types:', errorTypes);
    console.log('[Gemini:getMicroLesson] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:getMicroLesson] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:getMicroLesson] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    const prompt = `The learner is stuck on ${topic}.
Problem: ${problem}.
Their recent errors: ${errorTypes.join(', ')}.
Give a targeted 3-step micro-lesson that directly addresses their error pattern.
Do not solve the problem. Guide them.`;
    try {
        console.log('[Gemini:getMicroLesson] Prompt:', prompt);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('[Gemini:getMicroLesson] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent(prompt);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:getMicroLesson] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:getMicroLesson] Response length:', text.length);
        console.log('[Gemini:getMicroLesson] Response preview:', text.slice(0, 150));
        console.log('[Gemini:getMicroLesson] SUCCESS');
        console.log('═══════════════════════════════════');
        return text;
    }
    catch (err) {
        logGeminiError('Gemini:getMicroLesson', err);
        throw err;
    }
}
/**
 * Strip possible markdown code fences and parse JSON from Gemini response.
 * Throws a structured error if the JSON is invalid.
 */
function extractJson(text) {
    // Strip ```json ... ``` or ``` ... ``` fences if present
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
        return JSON.parse(stripped);
    }
    catch {
        throw new Error(`Gemini returned invalid JSON: ${stripped.slice(0, 200)}`);
    }
}
/**
 * Analyze a YouTube video and generate quiz questions to assess the user's
 * level on the video's topic.  Returns both the video analysis and questions.
 *
 * Step 1 of the new two-step parse flow.
 */
async function analyzeVideoForQuiz(url) {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:analyzeVideoForQuiz] START');
    console.log('[Gemini:analyzeVideoForQuiz] URL:', url);
    console.log('[Gemini:analyzeVideoForQuiz] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:analyzeVideoForQuiz] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:analyzeVideoForQuiz] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    const prompt = `Watch this YouTube video carefully and do TWO things:

1. Analyse the video content — extract the main topic, key concepts taught, estimated difficulty, total duration.
2. Generate 3-5 multiple-choice questions that test a learner's EXISTING knowledge of the topic covered in this video. These questions should help judge whether the learner is a beginner, familiar, or intermediate with this topic. Questions should NOT test video-specific content — they should test prerequisite/foundational knowledge of the topic.

Return ONLY valid JSON with this structure:
{
  "analysis": {
    "topic": "string (main topic of the video)",
    "concepts": ["string (key concepts taught)"],
    "difficulty_estimate": "beginner|intermediate|advanced",
    "total_duration_minutes": number,
    "summary": "string (2-3 sentence summary of what the video teaches)"
  },
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": number (0-3)
    }
  ]
}
No explanation. No markdown. Only the JSON object.`;
    try {
        console.log('[Gemini:analyzeVideoForQuiz] Prompt:', prompt);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('[Gemini:analyzeVideoForQuiz] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent([
            { fileData: { fileUri: url, mimeType: 'video/mp4' } },
            { text: prompt },
        ]);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:analyzeVideoForQuiz] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:analyzeVideoForQuiz] Response length:', text.length);
        console.log('[Gemini:analyzeVideoForQuiz] Response preview:', text.slice(0, 150));
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(stripped);
        console.log('[Gemini:analyzeVideoForQuiz] SUCCESS');
        console.log('═══════════════════════════════════');
        return parsed;
    }
    catch (err) {
        logGeminiError('Gemini:analyzeVideoForQuiz', err);
        throw err;
    }
}
/**
 * Generate a personalised day-wise plan based on the video analysis and the
 * user's assessed skill level.
 *
 * Step 2 of the new two-step parse flow.
 */
async function generatePersonalizedPlan(analysis, skillLevel, dailyTimeMinutes = 20) {
    console.log('═══════════════════════════════════');
    console.log('[Gemini:generatePersonalizedPlan] START');
    console.log('[Gemini:generatePersonalizedPlan] Topic:', analysis.topic);
    console.log('[Gemini:generatePersonalizedPlan] Skill level:', skillLevel);
    console.log('[Gemini:generatePersonalizedPlan] Daily minutes:', dailyTimeMinutes);
    console.log('[Gemini:generatePersonalizedPlan] API Key present:', !!process.env.GEMINI_API_KEY);
    console.log('[Gemini:generatePersonalizedPlan] API Key prefix:', apiKeyPrefix());
    console.log('[Gemini:generatePersonalizedPlan] Model: gemini-2.5-flash');
    console.log('───────────────────────────────────');
    const prompt = `You are building a personalised coding study plan.

Video topic: "${analysis.topic}"
Concepts covered: ${JSON.stringify(analysis.concepts)}
Video duration: ${analysis.total_duration_minutes} minutes
Video difficulty: ${analysis.difficulty_estimate}
Video summary: ${analysis.summary}

Learner's assessed skill level for this topic: ${skillLevel}
Daily time budget: ${dailyTimeMinutes} minutes

RULES for generating the plan:
- If the learner is "beginner": break down into more days with simpler tasks, more explanation, easier practice problems.
- If the learner is "familiar": moderate pace, balanced tasks, intermediate practice.
- If the learner is "intermediate": fewer days, more challenging tasks, advanced practice problems, skip basics.
- Each day should fit within the ${dailyTimeMinutes}-minute daily budget.
- Easy topics can be covered in 1-2 days. Hard topics should take more days.
- Adjust the number of days based on BOTH the topic complexity AND the learner's level.
- Each day must have exactly: task1, task2, and a practice problem.

Return ONLY valid JSON with this structure:
{
  "title": "string",
  "total_duration_minutes": ${analysis.total_duration_minutes},
  "checkpoints": [
    {
      "day": number,
      "title": "string",
      "concepts": ["string"],
      "task1": { "title": "string", "description": "string", "duration_minutes": number },
      "task2": { "title": "string", "description": "string", "duration_minutes": number },
      "practice": { "title": "string", "description": "string", "difficulty": "beginner|intermediate|advanced" }
    }
  ]
}
No explanation. No markdown. Only the JSON object.`;
    try {
        console.log('[Gemini:generatePersonalizedPlan] Prompt:', prompt);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('[Gemini:generatePersonalizedPlan] Calling Gemini API...');
        const startTime = Date.now();
        const result = await model.generateContent(prompt);
        const elapsed = Date.now() - startTime;
        console.log(`[Gemini:generatePersonalizedPlan] Response received in ${elapsed}ms`);
        const text = result.response.text().trim();
        console.log('[Gemini:generatePersonalizedPlan] Response length:', text.length);
        console.log('[Gemini:generatePersonalizedPlan] Response preview:', text.slice(0, 150));
        console.log('[Gemini:generatePersonalizedPlan] SUCCESS');
        console.log('═══════════════════════════════════');
        return text;
    }
    catch (err) {
        logGeminiError('Gemini:generatePersonalizedPlan', err);
        throw err;
    }
}
/**
 * Detect if an error is a Gemini quota / rate-limit error.
 */
function isQuotaError(err) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('resource_exhausted') ||
        msg.includes('429'));
}
