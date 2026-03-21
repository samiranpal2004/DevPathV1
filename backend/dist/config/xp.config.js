"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEVEL_RANKS = exports.LEVEL_THRESHOLDS = exports.XP_REWARDS = void 0;
exports.getLevelFromXp = getLevelFromXp;
exports.getXpToNextLevel = getXpToNextLevel;
exports.getProgressPercent = getProgressPercent;
exports.XP_REWARDS = {
    task1_complete: 20,
    task2_complete: 20,
    task_complete: 20,
    practice_solved: 30,
    full_day_complete: 25,
    streak_bonus: 10,
    no_hint_bonus: 15,
    busy_day_task: 5,
    weak_topic_revisit: 10,
    quest_complete: 30,
    room_first_finish: 25,
    room_all_complete: 20,
    streak_milestone: 50,
    speed_duel_win: 30,
    nudge_assist: 10,
};
exports.LEVEL_THRESHOLDS = {
    1: 0,
    2: 200,
    3: 600,
    4: 1400,
    5: 3000,
};
exports.LEVEL_RANKS = {
    1: 'Rookie',
    2: 'Coder',
    3: 'Builder',
    4: 'Hacker',
    5: 'Architect',
};
/**
 * Pure utility — no DB dependency, unit testable
 * Determines level based on total XP
 */
function getLevelFromXp(totalXp) {
    if (totalXp >= 3000)
        return 5;
    if (totalXp >= 1400)
        return 4;
    if (totalXp >= 600)
        return 3;
    if (totalXp >= 200)
        return 2;
    return 1;
}
/**
 * Pure utility — calculates XP needed to reach next level
 * Returns 0 if already at max level (5)
 */
function getXpToNextLevel(totalXp) {
    const level = getLevelFromXp(totalXp);
    if (level === 5)
        return 0;
    const nextThreshold = exports.LEVEL_THRESHOLDS[level + 1];
    return nextThreshold - totalXp;
}
/**
 * Pure utility — calculates progress percentage within current level band
 * Returns 0-100, where 100 means ready to level up
 */
function getProgressPercent(totalXp) {
    const level = getLevelFromXp(totalXp);
    if (level === 5)
        return 100;
    const currentThreshold = exports.LEVEL_THRESHOLDS[level];
    const nextThreshold = exports.LEVEL_THRESHOLDS[level + 1];
    const progress = totalXp - currentThreshold;
    const band = nextThreshold - currentThreshold;
    return Math.round((progress / band) * 100);
}
