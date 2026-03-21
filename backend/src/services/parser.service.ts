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
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { parseVideoUrlRaw, generateTopicCurriculumRaw, isQuotaError } from './gemini.service';
import { detectUrlType } from './onboarding.service';
import { getDefaultPlan, DefaultPlan } from '../data/default-plans';

export interface ParseResult {
    plan: Record<string, unknown>;
    fromCache: boolean;
    fallback: string | null;
}

function safeParseGeminiJson(raw: string): unknown {
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
export function buildCacheKey(url: string, userId: string, skillTier: string): string {
    return crypto
        .createHash('sha256')
        .update(`${url}||${userId}||${skillTier}`)
        .digest('hex');
}

/**
 * Check if a parsed plan already exists for this user + url + skill_tier.
 * Returns the existing daily_plan row or null.
 */
async function getCachedPlan(url: string, userId: string, skillTier: string): Promise<Record<string, unknown> | null> {
    const cacheKey = buildCacheKey(url, userId, skillTier);
    const { data } = await supabaseAdmin
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('source_url', url)
        .not('source_type', 'eq', 'default')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
    // Also store cache_key in metadata for demo-day precache lookup
    const row = data as Record<string, unknown> | null;
    if (row && row['cache_key'] === cacheKey) return row;
    // Fallback: match by url + user_id (cache_key may not exist on older rows)
    if (row) return row;
    return null;
}

/**
 * Store a parsed plan in daily_plans.
 */
async function storePlan(
    userId: string,
    url: string | null,
    sourceType: string,
    parsedPlan: Record<string, unknown> | DefaultPlan,
    skillTier: string,
): Promise<Record<string, unknown>> {
    const checkpoints = (parsedPlan as { checkpoints?: unknown[] }).checkpoints;
    const totalDays = Array.isArray(checkpoints) ? checkpoints.length : 30;
    const cacheKey = url ? buildCacheKey(url, userId, skillTier) : null;

    // Deactivate any existing active plan for this user
    await supabaseAdmin
        .from('daily_plans')
        .update({ status: 'paused' })
        .eq('user_id', userId)
        .eq('status', 'active');

    const { data, error } = await supabaseAdmin
        .from('daily_plans')
        .insert({
            user_id: userId,
            source_url: url,
            source_type: sourceType,
            title: (parsedPlan as { title: string }).title,
            total_days: totalDays,
            current_day: 1,
            status: 'active',
            checkpoints: checkpoints,
            cache_key: cacheKey,
        })
        .select()
        .single();

    if (error) throw new Error(`DB error storing plan: ${error.message}`);
    return data as Record<string, unknown>;
}

/**
 * Main parse pipeline.
 */
export async function parseUrl(
    userId: string,
    url: string,
    skillTier = 'beginner',
    fallbackTopic: string | null = null,
): Promise<ParseResult> {
    // Step 1 — cache check
    const cached = await getCachedPlan(url, userId, skillTier);
    if (cached) {
        return { plan: cached, fromCache: true, fallback: null };
    }

    // Step 2 — URL type detection
    const detection = detectUrlType(url);
    if (!detection.valid) {
        if (!/^https?:\/\//i.test(url)) {
            return parseFromTopic(userId, url, skillTier);
        }
        throw Object.assign(new Error('unsupported_url'), { code: 'unsupported_url' });
    }

    let parsedPlan: Record<string, unknown> | DefaultPlan;
    let usedFallback: string | null = null;

    // Step 3 — Gemini parse
    try {
        if (detection.source_type === 'udemy') {
            const slugMatch = url.match(/udemy\.com\/course\/([a-z0-9-]+)/i);
            const topicFromSlug = slugMatch?.[1]?.replace(/-/g, ' ') || fallbackTopic || 'JavaScript fundamentals';
            const rawTopicResponse = await generateTopicCurriculumRaw(topicFromSlug, skillTier);
            parsedPlan = safeParseGeminiJson(rawTopicResponse) as Record<string, unknown>;
            usedFallback = 'topic';
        } else {
            const rawParserResponse = await parseVideoUrlRaw(url);
            try {
                parsedPlan = safeParseGeminiJson(rawParserResponse) as Record<string, unknown>;
            } catch {
                const defaultPlan = getDefaultPlan('javascript');
                const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
                return { plan: stored, fromCache: false, fallback: 'parse_default' };
            }
        }
        validateParsedPlan(parsedPlan);
    } catch (err) {
        if (isQuotaError(err)) {
            // Step 5 — quota fallback: default plan
            const defaultPlan = getDefaultPlan('javascript');
            const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
            return { plan: stored, fromCache: false, fallback: 'quota_default' };
        }

        // Step 4 — generic parse fail: topic fallback
        if (fallbackTopic) {
            try {
                const rawTopicResponse = await generateTopicCurriculumRaw(fallbackTopic, skillTier);
                parsedPlan = safeParseGeminiJson(rawTopicResponse) as Record<string, unknown>;
                validateParsedPlan(parsedPlan);
                usedFallback = 'topic';
            } catch (topicErr) {
                if (isQuotaError(topicErr)) {
                    const defaultPlan = getDefaultPlan('javascript');
                    const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
                    return { plan: stored, fromCache: false, fallback: 'quota_default' };
                }
                throw topicErr;
            }
        } else {
            // No topic provided — return default plan
            const defaultPlan = getDefaultPlan('javascript');
            const stored = await storePlan(userId, url, 'default', defaultPlan, skillTier);
            return { plan: stored, fromCache: false, fallback: 'parse_default' };
        }
    }

    // Step 6 — store result
    const sourceType = usedFallback === 'topic' ? 'topic' : detection.source_type;
    const stored = await storePlan(userId, url, sourceType, parsedPlan!, skillTier);
    return { plan: stored, fromCache: false, fallback: usedFallback };
}

/**
 * Generate a plan from a topic name only (no URL).
 */
export async function parseFromTopic(userId: string, topic: string, skillTier = 'beginner'): Promise<ParseResult> {
    let parsedPlan: Record<string, unknown> | DefaultPlan;
    let usedFallback: string | null = null;

    try {
        const rawTopicResponse = await generateTopicCurriculumRaw(topic, skillTier);
        parsedPlan = safeParseGeminiJson(rawTopicResponse) as Record<string, unknown>;
        validateParsedPlan(parsedPlan);
    } catch (err) {
        if (isQuotaError(err)) {
            parsedPlan = getDefaultPlan('javascript');
            usedFallback = 'quota_default';
        } else {
            parsedPlan = getDefaultPlan('javascript');
            usedFallback = 'parse_default';
        }
    }

    const sourceType = usedFallback ? 'default' : 'topic';
    const stored = await storePlan(userId, null, sourceType, parsedPlan!, skillTier);
    return { plan: stored, fromCache: false, fallback: usedFallback };
}

/**
 * Validate that a Gemini response matches the expected plan shape.
 * Throws if structure is wrong.
 */
export function validateParsedPlan(plan: unknown): void {
    if (!plan || typeof plan !== 'object') throw new Error('Plan is not an object');
    const p = plan as Record<string, unknown>;
    if (!p['title'] || typeof p['title'] !== 'string') throw new Error('Plan missing title');
    if (!Array.isArray(p['checkpoints']) || (p['checkpoints'] as unknown[]).length === 0) {
        throw new Error('Plan missing checkpoints array');
    }
    const first = (p['checkpoints'] as Record<string, unknown>[])[0];
    if (!first['task1'] || !first['task2'] || !first['practice']) {
        throw new Error('Checkpoint missing task1, task2, or practice');
    }
}
