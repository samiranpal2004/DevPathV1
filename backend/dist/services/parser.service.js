"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCacheKey = buildCacheKey;
exports.storePlanKeepExisting = storePlanKeepExisting;
exports.parseUrl = parseUrl;
exports.parseFromTopic = parseFromTopic;
exports.validateParsedPlan = validateParsedPlan;
/**
 * URL parser service — Phase 2
 *
 * Pipeline:
 *   1. Check DB cache (same url + user_id → return immediately)
 *   2. Detect URL type
 *   3. Call Gemini 1.5 Pro to parse
 *   4. On parse fail → topic fallback (if topic provided)
 *   5. On quota fail → return default JS/Python plan
 *   6. Store result in daily_plans
 */
const crypto_1 = __importDefault(require("crypto"));
const supabase_1 = require("../lib/supabase");
const gemini_service_1 = require("./gemini.service");
const onboarding_service_1 = require("./onboarding.service");
const default_plans_1 = require("../data/default-plans");
function safeParseGeminiJson(raw) {
    // FIX: Strip Gemini markdown code fences and parse JSON safely.
    const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    return JSON.parse(cleaned);
}
/**
 * Build a consistent cache key.
 * Architecture spec: hash(url + user_id + skill_tier)
 */
function buildCacheKey(url, userId, skillTier) {
    return crypto_1.default
        .createHash('sha256')
        .update(`${url}||${userId}||${skillTier}`)
        .digest('hex');
}
/**
 * Check if a parsed plan already exists for this user + url + skill_tier.
 * Returns the existing daily_plan row or null.
 */
async function getCachedPlan(url, userId) {
    const { data } = await supabase_1.supabaseAdmin
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('source_url', url)
        .not('source_type', 'eq', 'default')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
    return data || null;
}
async function fetchYouTubeVideoTitle(url) {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch?.[1];
    if (!videoId)
        return null;
    try {
        const oEmbedUrl = `https://www.youtube.com/oembed` +
            `?url=https://www.youtube.com/watch?v=${videoId}` +
            `&format=json`;
        const response = await fetch(oEmbedUrl);
        if (!response.ok)
            return null;
        const data = await response.json();
        return typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title
            : null;
    }
    catch {
        return null;
    }
}
/**
 * Store a parsed plan in daily_plans.
 */
async function storePlan(userId, url, sourceType, parsedPlan, skillTier, keepExistingPlans = false) {
    const checkpoints = parsedPlan.checkpoints;
    const totalDays = Array.isArray(checkpoints) ? checkpoints.length : 30;
    if (!keepExistingPlans) {
        // Deactivate any existing active plan for this user (onboarding flow)
        await supabase_1.supabaseAdmin
            .from('daily_plans')
            .update({ status: 'paused' })
            .eq('user_id', userId)
            .eq('status', 'active');
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('daily_plans')
        .insert({
        user_id: userId,
        source_url: url,
        source_type: sourceType,
        title: parsedPlan.title,
        total_days: totalDays,
        current_day: 1,
        status: 'active',
        checkpoints: checkpoints,
    })
        .select()
        .single();
    if (error)
        throw new Error(`DB error storing plan: ${error.message}`);
    return data;
}
/**
 * Store a plan generated from the video quiz flow.
 * Does NOT deactivate existing plans — user keeps all plans.
 */
async function storePlanKeepExisting(userId, url, sourceType, parsedPlan, skillTier) {
    return storePlan(userId, url, sourceType, parsedPlan, skillTier, true);
}
/**
 * Main parse pipeline.
 */
async function parseUrl(userId, url, skillTier = 'beginner', fallbackTopic = null) {
    console.log('▶▶▶ PARSER PIPELINE START');
    console.log('[Parser] User ID:', userId);
    console.log('[Parser] URL:', url);
    console.log('[Parser] Skill tier:', skillTier);
    console.log('[Parser] Fallback topic:', fallbackTopic);
    console.log('[Parser] Cache key:', buildCacheKey(url, userId, skillTier));
    console.log('[Parser] Timestamp:', new Date().toISOString());
    // Step 1 — cache check
    const cached = await getCachedPlan(url, userId);
    if (cached) {
        console.log('[Parser] ✅ Cache HIT — returning cached plan');
        console.log('[Parser] Cached plan title:', cached.title);
        return { plan: cached, fromCache: true, fallback: null };
    }
    else {
        console.log('[Parser] Cache MISS — proceeding to Gemini');
    }
    // Step 2 — URL type detection
    const detection = (0, onboarding_service_1.detectUrlType)(url);
    if (!detection.valid) {
        if (!/^https?:\/\//i.test(url)) {
            return parseFromTopic(userId, url, skillTier);
        }
        throw Object.assign(new Error('unsupported_url'), { code: 'unsupported_url' });
    }
    let parsedPlan;
    let usedFallback = null;
    // Step 3 — Gemini parse
    try {
        if (detection.source_type === 'udemy') {
            const slugMatch = url.match(/udemy\.com\/course\/([a-z0-9-]+)/i);
            const topicFromSlug = slugMatch?.[1]?.replace(/-/g, ' ') || fallbackTopic || 'JavaScript fundamentals';
            const rawTopicResponse = await (0, gemini_service_1.generateTopicCurriculumRaw)(topicFromSlug, skillTier);
            parsedPlan = safeParseGeminiJson(rawTopicResponse);
            usedFallback = 'topic';
        }
        else {
            console.log('[Parser] Running content validation...');
            const videoTitle = await fetchYouTubeVideoTitle(url);
            const validation = await (0, gemini_service_1.validateEducationalContent)(url, videoTitle ?? undefined);
            if (!validation.isEducational) {
                console.warn('[Parser] Content rejected:', validation.category, '-', validation.reason);
                const nonEducationalError = new Error(validation.reason);
                nonEducationalError.code = 'non_educational_content';
                nonEducationalError.category = validation.category;
                nonEducationalError.reason = validation.reason;
                throw nonEducationalError;
            }
            console.log('[Parser] Content validated ✅:', validation.category, `(${validation.confidence})`);
            const rawParserResponse = await (0, gemini_service_1.parseVideoUrlRaw)(url);
            try {
                parsedPlan = safeParseGeminiJson(rawParserResponse);
            }
            catch {
                const defaultPlan = (0, default_plans_1.getDefaultPlan)('javascript');
                const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
                return { plan: stored, fromCache: false, fallback: 'parse_default' };
            }
        }
        validateParsedPlan(parsedPlan);
    }
    catch (err) {
        if (err.code === 'non_educational_content') {
            throw err;
        }
        if ((0, gemini_service_1.isQuotaError)(err)) {
            // Step 5 — quota fallback: default plan
            console.error('[Parser] ❌ All Gemini calls failed');
            console.error('[Parser] Using hardcoded default plan');
            console.error('[Parser] This means GEMINI_API_KEY may be wrong');
            const defaultPlan = (0, default_plans_1.getDefaultPlan)('javascript');
            const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
            return { plan: stored, fromCache: false, fallback: 'quota_default' };
        }
        // Step 4 — generic parse fail: topic fallback
        if (fallbackTopic) {
            try {
                console.warn('[Parser] ⚠️  Gemini failed — using topic fallback');
                console.warn('[Parser] Fallback reason:', err.message);
                const rawTopicResponse = await (0, gemini_service_1.generateTopicCurriculumRaw)(fallbackTopic, skillTier);
                parsedPlan = safeParseGeminiJson(rawTopicResponse);
                validateParsedPlan(parsedPlan);
                usedFallback = 'topic';
            }
            catch (topicErr) {
                if ((0, gemini_service_1.isQuotaError)(topicErr)) {
                    console.error('[Parser] ❌ All Gemini calls failed');
                    console.error('[Parser] Using hardcoded default plan');
                    console.error('[Parser] This means GEMINI_API_KEY may be wrong');
                    const defaultPlan = (0, default_plans_1.getDefaultPlan)('javascript');
                    const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
                    return { plan: stored, fromCache: false, fallback: 'quota_default' };
                }
                throw topicErr;
            }
        }
        else {
            // No topic provided — return default plan
            console.error('[Parser] ❌ All Gemini calls failed');
            console.error('[Parser] Using hardcoded default plan');
            console.error('[Parser] This means GEMINI_API_KEY may be wrong');
            const defaultPlan = (0, default_plans_1.getDefaultPlan)('javascript');
            const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
            return { plan: stored, fromCache: false, fallback: 'parse_default' };
        }
    }
    // Step 6 — store result
    const sourceType = usedFallback === 'topic' ? 'topic' : detection.source_type;
    const stored = await storePlan(userId, url, sourceType, parsedPlan, skillTier);
    return { plan: stored, fromCache: false, fallback: usedFallback };
}
/**
 * Generate a plan from a topic name only (no URL).
 */
async function parseFromTopic(userId, topic, skillTier = 'beginner') {
    let parsedPlan;
    let usedFallback = null;
    try {
        const rawTopicResponse = await (0, gemini_service_1.generateTopicCurriculumRaw)(topic, skillTier);
        parsedPlan = safeParseGeminiJson(rawTopicResponse);
        validateParsedPlan(parsedPlan);
    }
    catch (err) {
        if ((0, gemini_service_1.isQuotaError)(err)) {
            parsedPlan = (0, default_plans_1.getDefaultPlan)('javascript');
            usedFallback = 'quota_default';
        }
        else {
            parsedPlan = (0, default_plans_1.getDefaultPlan)('javascript');
            usedFallback = 'parse_default';
        }
    }
    const sourceType = usedFallback ? 'default' : 'topic';
    const stored = await storePlan(userId, null, sourceType, parsedPlan, skillTier);
    return { plan: stored, fromCache: false, fallback: usedFallback };
}
/**
 * Validate that a Gemini response matches the expected plan shape.
 * Throws if structure is wrong.
 */
function validateParsedPlan(plan) {
    if (!plan || typeof plan !== 'object')
        throw new Error('Plan is not an object');
    const p = plan;
    if (!p['title'] || typeof p['title'] !== 'string')
        throw new Error('Plan missing title');
    if (!Array.isArray(p['checkpoints']) || p['checkpoints'].length === 0) {
        throw new Error('Plan missing checkpoints array');
    }
    const first = p['checkpoints'][0];
    if (!first['task1'] || !first['task2'] || !first['practice']) {
        throw new Error('Checkpoint missing task1, task2, or practice');
    }
}
