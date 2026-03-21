/**
 * Demo-day precache script.
 *
 * Parses a YouTube URL via Gemini and stores the result in daily_plans
 * so the demo shows an instant cache hit.
 *
 * Usage:
 *   node scripts/precache.js <youtube-url> <user-id> [skill-tier]
 *
 * Example (Traversy Media JS playlist):
 *   node scripts/precache.js \
 *     "https://www.youtube.com/playlist?list=PLillGF-RfqbbnEGy3ROiLWk7JMCrSPgBN" \
 *     "demo-user-uuid" \
 *     "beginner"
 */
require('dotenv').config();
const { parseUrl } = require('../services/parser');

async function precache(url, userId, skillTier = 'beginner') {
    if (!url || !userId) {
        console.error('Usage: node scripts/precache.js <url> <user-id> [skill-tier]');
        process.exit(1);
    }

    console.log(`Precaching: ${url}`);
    console.log(`User: ${userId} | Tier: ${skillTier}`);
    console.log('Calling Gemini (may take 5-15 seconds)...\n');

    try {
        const { plan, fromCache, fallback } = await parseUrl(userId, url, skillTier);

        if (fromCache) {
            console.log('✅ Cache hit — plan already stored, demo is ready!');
        } else {
            console.log('✅ Plan parsed and stored:');
        }

        console.log(`   Plan ID:    ${plan.id}`);
        console.log(`   Title:      ${plan.title}`);
        console.log(`   Days:       ${plan.total_days}`);
        console.log(`   Source:     ${plan.source_type}`);
        if (fallback) console.log(`   Fallback:   ${fallback}`);
        console.log('\nRun again to verify instant cache hit.');
    } catch (err) {
        console.error('❌ Precache failed:', err.message);
        process.exit(1);
    }
}

const [, , url, userId, skillTier] = process.argv;
precache(url, userId, skillTier);
