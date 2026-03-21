"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = require("@clerk/express");
const supabase_1 = require("../lib/supabase");
const requireAuth_1 = require("../middleware/requireAuth");
const router = (0, express_1.Router)();
router.post('/sync', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const clerkUserId = req.clerkUserId;
        const clerkUser = await express_2.clerkClient.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
        const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
            email.split('@')[0] ||
            'Learner';
        const avatarUrl = clerkUser.imageUrl ?? null;
        const { data: user, error } = await supabase_1.supabaseAdmin
            .from('users')
            .upsert({
            id: userId,
            email,
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'id',
            ignoreDuplicates: false,
        })
            .select()
            .single();
        if (error) {
            throw error;
        }
        const { data: prefs } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        const needsOnboarding = !prefs;
        return res.json({
            success: true,
            data: {
                userId: user.id,
                displayName: user.display_name,
                needsOnboarding,
            },
        });
    }
    catch (error) {
        console.error('Auth sync error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SYNC_FAILED',
                message: 'Failed to sync user',
            },
        });
    }
});
exports.default = router;
