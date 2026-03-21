"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVideoUrl = parseVideoUrl;
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
async function parseVideoUrlRaw(url) {
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
                console.log('[Gemini] oEmbed success:', videoContext);
            }
            else {
                console.warn('[Gemini] oEmbed returned non-OK status:', response.status);
            }
        }
        catch (err) {
            // oEmbed failed — continue with URL only
            // Gemini will still try its best
            console.warn('[Gemini] oEmbed fetch failed:', err);
        }
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
    console.log('[Gemini] Sending prompt with context:', contextBlock);
    // Step 4 — Call Gemini with text prompt (not fileData)
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro'
    });
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text().trim();
    console.log('[Gemini] Raw response length:', text.length);
    console.log('[Gemini] Response preview:', text.slice(0, 200));
    return text;
}
/**
 * Generate a curriculum from a topic name using Gemini 1.5 Pro.
 */
async function generateTopicCurriculum(topic, skillTier = 'beginner') {
    const text = await generateTopicCurriculumRaw(topic, skillTier);
    return extractJson(text);
}
async function generateTopicCurriculumRaw(topic, skillTier = 'beginner') {
    // Use flash for topic curriculum — saves pro quota 
    // for video parsing where accuracy matters most
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash'
    });
    const result = await model.generateContent(TOPIC_CURRICULUM_PROMPT(topic, skillTier));
    return result.response.text().trim();
}
/**
 * Generate 5 skill-assessment questions for the given goal using Gemini 1.5 Flash.
 */
async function generateSkillQuiz(goal) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(stripped);
}
/**
 * Evaluate learner code against a task description using Gemini Flash.
 * Returns structured feedback without revealing the full solution.
 */
async function evaluateCode(code, language, taskTitle, taskDescription) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a coding instructor evaluating a student's code submission.

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
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(stripped);
}
/**
 * Get a micro-lesson for a stuck learner using Gemini 1.5 Flash.
 */
async function getMicroLesson({ topic, problem, errorTypes, skillTier }) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `The learner is stuck on ${topic}.
Problem: ${problem}.
Their recent errors: ${errorTypes.join(', ')}.
Give a targeted 3-step micro-lesson that directly addresses their error pattern.
Do not solve the problem. Guide them.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const result = await model.generateContent([
        { fileData: { fileUri: url, mimeType: 'video/mp4' } },
        { text: prompt },
    ]);
    const text = result.response.text().trim();
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(stripped);
}
/**
 * Generate a personalised day-wise plan based on the video analysis and the
 * user's assessed skill level.
 *
 * Step 2 of the new two-step parse flow.
 */
async function generatePersonalizedPlan(analysis, skillLevel, dailyTimeMinutes = 20) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
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
