"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVideoUrl = parseVideoUrl;
exports.parseVideoUrlRaw = parseVideoUrlRaw;
exports.generateTopicCurriculum = generateTopicCurriculum;
exports.generateTopicCurriculumRaw = generateTopicCurriculumRaw;
exports.generateSkillQuiz = generateSkillQuiz;
exports.getMicroLesson = getMicroLesson;
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    // Pass the YouTube URL as fileData so Gemini actually watches the video
    // instead of just reading the URL string and hallucinating content.
    const result = await model.generateContent([
        { fileData: { fileUri: url, mimeType: 'video/mp4' } },
        { text: VIDEO_PARSER_PROMPT_TEXT },
    ]);
    return result.response.text().trim();
}
/**
 * Generate a curriculum from a topic name using Gemini 1.5 Pro.
 */
async function generateTopicCurriculum(topic, skillTier = 'beginner') {
    const text = await generateTopicCurriculumRaw(topic, skillTier);
    return extractJson(text);
}
async function generateTopicCurriculumRaw(topic, skillTier = 'beginner') {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
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
 * Detect if an error is a Gemini quota / rate-limit error.
 */
function isQuotaError(err) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('resource_exhausted') ||
        msg.includes('429'));
}
