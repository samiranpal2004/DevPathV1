"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapScoreToSkillTier = mapScoreToSkillTier;
exports.saveQuizResult = saveQuizResult;
exports.savePreferences = savePreferences;
exports.detectUrlType = detectUrlType;
exports.getPlanPreview = getPlanPreview;
exports.getUserPreferences = getUserPreferences;
const supabase_1 = require("../lib/supabase");
// Maps correct-answer percentage → skill_tier
// <40% → beginner, 40–79% → familiar, ≥80% → intermediate
function mapScoreToSkillTier(correctCount, total = 5) {
    const pct = total > 0 ? correctCount / total : 0;
    if (pct < 0.4)
        return 'beginner';
    if (pct < 0.8)
        return 'familiar';
    return 'intermediate';
}
/**
 * Persist quiz result: upsert skill_tier into user_preferences.
 */
async function saveQuizResult(userId, answers) {
    const score = answers.filter(Boolean).length;
    const skill_tier = mapScoreToSkillTier(score, answers.length);
    const { error } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .upsert({ user_id: userId, skill_tier });
    if (error)
        throw new Error(`DB error saving quiz result: ${error.message}`);
    return { skill_tier, score };
}
/**
 * Persist goal + daily_time_minutes into user_preferences.
 */
async function savePreferences(userId, goal, daily_time_minutes) {
    const { error } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .upsert({ user_id: userId, goal, daily_time_minutes });
    if (error)
        throw new Error(`DB error saving preferences: ${error.message}`);
}
/**
 * Detect URL type for parse-url validation.
 */
function detectUrlType(url) {
    const YOUTUBE_PLAYLIST = /(?:youtube\.com\/playlist\?.*list=|youtube\.com\/watch\?.*list=)([A-Za-z0-9_-]+)/;
    const YOUTUBE_VIDEO = /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]+)/;
    const YOUTUBE_SHORT = /youtu\.be\/([A-Za-z0-9_-]+)/;
    const UDEMY_COURSE = /udemy\.com\/course\/([a-z0-9-]+)/i;
    if (YOUTUBE_PLAYLIST.test(url))
        return { valid: true, source_type: 'youtube_playlist' };
    if (YOUTUBE_VIDEO.test(url) || YOUTUBE_SHORT.test(url))
        return { valid: true, source_type: 'youtube_video' };
    if (UDEMY_COURSE.test(url))
        return { valid: true, source_type: 'udemy' };
    return { valid: false, reason: 'unsupported_url' };
}
/**
 * Get plan preview: first 3 checkpoints from the user's active daily_plan.
 */
async function getPlanPreview(userId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('daily_plans')
        .select('id, title, total_days, checkpoints')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
    if (error || !data)
        return null;
    const checkpoints = Array.isArray(data.checkpoints)
        ? data.checkpoints.slice(0, 3)
        : [];
    return {
        plan_id: data.id,
        title: data.title,
        total_days: data.total_days,
        preview_checkpoints: checkpoints,
    };
}
/**
 * Fetch user_preferences row for a given user.
 */
async function getUserPreferences(userId) {
    const { data } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
    return data || null;
}
